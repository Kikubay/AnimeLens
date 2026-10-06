import {
  createRuntimeAuthDependencies,
  createRuntimeProviderRegistryService,
  getProviderClientId,
  MAL_CLIENT_ID_STORAGE_KEY,
  ANILIST_CLIENT_ID_STORAGE_KEY,
} from '../auth/runtime-auth';
import type {
  AuthErrorCode,
  AuthSnapshot,
  ProviderId,
  TokenExchangeDiagnostic,
} from '../auth/auth-types';
import { isProviderId } from '../providers/provider-registry';
import { AuthServiceError } from '../auth/auth-service';
import { ApiError } from '../api/api-errors';
import { RecommendationFeedbackService } from '../feedback/feedback-service';
import { ChromeFeedbackStore } from '../feedback/feedback-store';
import type { FeedbackMessage, FeedbackMessageResponse } from '../feedback/feedback-messages';
import { isFeedbackMessage } from '../feedback/feedback-messages';
import { ChromeAnimeCacheStore } from '../sync/sync-cache';
import type { AnimeCache } from '../domain/sync';
import type { Anime } from '../domain/anime';
import { AuthenticatedAnimeListSyncService } from '../sync/runtime-sync';
import type { SyncMessage, SyncMessageResponse, SyncSnapshot } from '../sync/sync-messages';
import { isSyncMessage } from '../sync/sync-messages';
import type { SyncMetadata, SyncProgress } from '../domain/sync';
import { buildUserPreferenceProfile } from '../recommendations/recommendation-engine';
import {
  buildDashboardRecommendationSnapshot,
  createEmptyDashboardRecommendationSnapshot,
} from '../recommendations/recommendation-dashboard';
import { emptyProfileSummary, profileSummaryFromModel } from '../profile/profile-types';
import type { UserProfileSummary } from '../profile/profile-types';
import type { ProfileMessage, ProfileMessageResponse } from '../profile/profile-messages';
import { isProfileMessage } from '../profile/profile-messages';
import {
  baselineProfileDelta,
  diffProfileSnapshots,
  toStoredProfileSnapshot,
} from '../profile/profile-delta';
import { createProfileHistoryStore, PROFILE_HISTORY_KEY } from '../profile/profile-history-store';
import { TOP_PICKS_RANKING_KEY, TOP_PICKS_SIGNATURE_KEY } from '../profile/top-picks-store';
import type { StorageKey } from '../storage/storage-types';
import { createTopPicksStore } from '../profile/top-picks-store';
import { emptyTopPickPlan, planTopPicks, type TopPickPlan } from '../profile/top-picks';
import type { TopPicksMessage, TopPicksMessageResponse } from '../profile/top-picks-messages';
import { isTopPicksMessage } from '../profile/top-picks-messages';
import type { SettingsMessage, SettingsResponse } from '../settings/settings-messages';
import { isSettingsMessage } from '../settings/settings-messages';
import { normalizeUserPreferences } from '../settings/settings-types';
import type {
  RecommendationMessage,
  RecommendationMessageResponse,
} from '../recommendations/recommendation-messages';
import { isRecommendationMessage } from '../recommendations/recommendation-messages';
import type { MalListMessage, MalListMessageResponse } from '../api/mal-list-messages';
import type { ProviderStatus } from '../providers/provider-registry';
import { isMalListMessage } from '../api/mal-list-messages';
import {
  isStreamingLinksMessage,
  type StreamingLinksMessage,
  type StreamingLinksResponse,
} from '../api/streaming-links-messages';
import { ANILIST_PIN_REDIRECT_URL } from '../api/providers/anilist/anilist-queries';
import {
  GITHUB_LATEST_RELEASE_URL,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_STORAGE_KEY,
  buildUpdateSnapshot,
  createInitialUpdateSnapshot,
  isGitHubRelease,
  type StoredUpdateCheck,
  type UpdateSnapshot,
} from '../updates/update-checker';
import type { UpdateMessage, UpdateResponse } from '../updates/update-messages';
import { isUpdateMessage } from '../updates/update-messages';
import { getCopy, type Language } from '../locales';

const dependencies = createRuntimeAuthDependencies();
const providerRegistry = createRuntimeProviderRegistryService(dependencies);

/**
 * The auth service of the **active** provider. Auth messages target the
 * active provider so existing flows (connect, disconnect, snapshot) keep
 * working unchanged; provider-scoped operations use `providerRegistry`.
 */
async function activeAuthService() {
  return providerRegistry.getAuthService(await providerRegistry.registry.getActiveProvider());
}

// MAL ranks by descending popularity; deep pages reach titles with a small
// audience. Offsets too far down return empty pages on MAL's side, so the
// offset stays well inside the populated range while still clearing the
// mega-popular head of the ranking.
const RANKING_DISCOVERY_OFFSET = 2000;
const DAILY_RECOMMENDATION_ALARM = 'animelens-daily-recommendation';
const SYNC_ALARM = 'animelens-sync';
let updateCheckInFlight: Promise<UpdateSnapshot> | null = null;

/**
 * How long a fetched candidate pool stays reusable.
 *
 * The dashboard re-requests on every feedback submit, list add, preference
 * change and sync, and each request previously issued two provider calls. One
 * popup session that synced and rated two anime therefore spent 8+ requests
 * returning byte-identical suggestions and ranking pages. The pool is the same
 * for the whole window — it depends on the account, not on local state — so a
 * short TTL collapses that amplification without making recommendations feel
 * pinned to a stale pool.
 */
const CANDIDATE_POOL_TTL_MS = 10 * 60 * 1000;
const CANDIDATE_POOL_SUGGESTION_LIMIT = 50;
const CANDIDATE_POOL_RANKING_LIMIT = 100;

interface CandidatePoolEntry {
  readonly providerId: ProviderId;
  readonly fetchedAt: number;
  readonly pool: readonly Anime[];
}

/**
 * In-memory only. An MV3 worker is torn down after ~30s idle, which discards
 * this map; that is acceptable because the burst being fixed happens inside a
 * live popup session, while the worker is still alive for it. A disk-backed
 * pool would go stale across sessions and add a second cache to invalidate on
 * disconnect and clear-cache.
 */
let candidatePoolCache: CandidatePoolEntry | null = null;
let candidatePoolInFlight: {
  readonly providerId: ProviderId;
  readonly request: Promise<readonly Anime[]>;
} | null = null;

/** Drop the pool when the account, or the data it was drawn from, changes. */
function invalidateCandidatePool(): void {
  candidatePoolCache = null;
  candidatePoolInFlight = null;
}

type Storage = ConstructorParameters<typeof ChromeAnimeCacheStore>[0];

const storage = {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
} as Storage;

const feedbackService = new RecommendationFeedbackService(new ChromeFeedbackStore(storage));
const topPicksStore = createTopPicksStore(storage);
const profileHistoryStore = createProfileHistoryStore(storage);
let syncSnapshot: SyncSnapshot = {
  metadata: createIdleMetadata(),
  progress: null,
};
const syncService = new AuthenticatedAnimeListSyncService(providerRegistry, storage);

void providerRegistry.migrateLegacySessions().catch(reportBackgroundFailure);

void hydrateCachedSync().catch(reportBackgroundFailure);
void chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  .catch(reportBackgroundFailure);

function reportBackgroundFailure(error: unknown): void {
  console.warn(
    'AnimeLens background task failed:',
    error instanceof Error ? error.message : 'Unknown background error',
  );
}

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_RECOMMENDATION_ALARM) {
    void showDailyRecommendationNotification().catch(reportBackgroundFailure);
  }
  if (alarm.name === SYNC_ALARM) {
    void startSync('manual').catch(reportBackgroundFailure);
  }
});

void configureScheduledTasks().catch(reportBackgroundFailure);

type AuthMessage =
  | { readonly type: 'auth.get_snapshot' }
  | { readonly type: 'auth.connect'; readonly providerId?: ProviderId }
  | { readonly type: 'auth.disconnect'; readonly providerId?: ProviderId }
  | { readonly type: 'auth.get_providers' }
  | { readonly type: 'auth.set_active_provider'; readonly providerId: ProviderId }
  | {
      readonly type: 'auth.complete_pin_connect';
      readonly providerId: ProviderId;
      readonly token: string;
    }
  | { readonly type: 'auth.get_token_exchange_diagnostic' };

type AuthResponse =
  | { readonly ok: true; readonly snapshot: AuthSnapshot }
  | { readonly ok: true; readonly diagnostic: TokenExchangeDiagnostic | null }
  | { readonly ok: true; readonly providers: ProviderStatus[] }
  | { readonly ok: false; readonly message: string };

type WorkerResponse =
  | AuthResponse
  | AuthResponse
  | SyncMessageResponse
  | FeedbackMessageResponse
  | ProfileMessageResponse
  | SettingsResponse
  | RecommendationMessageResponse
  | MalListMessageResponse
  | UpdateResponse;

chrome.runtime.onInstalled.addListener(() => {
  console.info('AnimeLens extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: WorkerResponse) => void) => {
    if (isAuthMessage(message)) {
      void handleAuthMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isSyncMessage(message)) {
      void handleSyncMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isFeedbackMessage(message)) {
      void handleFeedbackMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isProfileMessage(message)) {
      void handleProfileMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isTopPicksMessage(message)) {
      void handleTopPicksMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isSettingsMessage(message)) {
      void handleSettingsMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isRecommendationMessage(message)) {
      void handleRecommendationMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isStreamingLinksMessage(message)) {
      void handleStreamingLinksMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isMalListMessage(message)) {
      void handleMalListMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    if (isUpdateMessage(message)) {
      void handleUpdateMessage(message)
        .then(sendResponse)
        .catch(async (error: unknown) =>
          sendResponse({ ok: false, message: await toMessage(error) }),
        );
      return true;
    }
    return false;
  },
);

async function handleUpdateMessage(_message: UpdateMessage): Promise<UpdateResponse> {
  return { ok: true, snapshot: await checkForUpdates() };
}

async function checkForUpdates(): Promise<UpdateSnapshot> {
  if (updateCheckInFlight !== null) return updateCheckInFlight;
  updateCheckInFlight = performUpdateCheck().finally(() => {
    updateCheckInFlight = null;
  });
  return updateCheckInFlight;
}

async function performUpdateCheck(): Promise<UpdateSnapshot> {
  const currentVersion = chrome.runtime.getManifest().version;
  const now = Date.now();
  const storedValue = await storage.get(UPDATE_CHECK_STORAGE_KEY);
  const stored: StoredUpdateCheck | undefined = isStoredUpdateCheck(storedValue)
    ? storedValue
    : undefined;
  const previousSnapshot = stored?.snapshot ?? null;
  if (stored !== undefined && isRecentUpdateCheck(stored, currentVersion, now))
    return stored.snapshot;

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    const release: unknown = await response.json();
    const snapshot = isGitHubRelease(release)
      ? buildUpdateSnapshot(currentVersion, release, now)
      : createInitialUpdateSnapshot(currentVersion);
    const checkedSnapshot = { ...snapshot, checkedAt: now };
    await storage.set(UPDATE_CHECK_STORAGE_KEY, {
      checkedAt: now,
      snapshot: checkedSnapshot,
    });
    return checkedSnapshot;
  } catch (error) {
    reportBackgroundFailure(error);
    const fallback =
      previousSnapshot?.status === 'available'
        ? { ...previousSnapshot, currentVersion, checkedAt: now }
        : { ...createInitialUpdateSnapshot(currentVersion), checkedAt: now };
    await storage.set(UPDATE_CHECK_STORAGE_KEY, {
      checkedAt: now,
      snapshot: fallback,
    });
    return fallback;
  }
}

function isStoredUpdateCheck(value: unknown): value is StoredUpdateCheck {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.checkedAt === 'number' &&
    Number.isFinite(candidate.checkedAt) &&
    typeof candidate.snapshot === 'object' &&
    candidate.snapshot !== null
  );
}

function isRecentUpdateCheck(
  value: StoredUpdateCheck | undefined,
  currentVersion: string,
  now: number,
): value is StoredUpdateCheck {
  return (
    value !== undefined &&
    typeof value.checkedAt === 'number' &&
    Number.isFinite(value.checkedAt) &&
    now - value.checkedAt < UPDATE_CHECK_INTERVAL_MS &&
    value.snapshot !== undefined &&
    value.snapshot.currentVersion === currentVersion
  );
}

async function handleAuthMessage(message: AuthMessage): Promise<AuthResponse> {
  if (message.type === 'auth.get_token_exchange_diagnostic') {
    return {
      ok: true,
      diagnostic: await (await activeAuthService()).getTokenExchangeDiagnostic(),
    };
  }
  if (message.type === 'auth.get_providers') {
    return { ok: true, providers: await providerRegistry.listProviderStatuses() };
  }
  if (message.type === 'auth.complete_pin_connect') {
    if (message.providerId !== 'anilist') {
      return { ok: false, message: 'The pin flow is only available for AniList.' };
    }
    const snapshot = await providerRegistry.completeAnilistPinSignIn(message.token);
    if (snapshot.status === 'authenticated') {
      void configureScheduledTasks().catch(reportBackgroundFailure);
      // The pin flow does not change the active provider; sync only if
      // AniList is the one receiving traffic.
      const activeProvider = await providerRegistry.registry.getActiveProvider();
      if (activeProvider === 'anilist') {
        void startSync('initial').catch(reportBackgroundFailure);
      }
    }
    return { ok: true, snapshot };
  }
  if (message.type === 'auth.set_active_provider') {
    const providerId = message.providerId;
    if (!isProviderId(providerId)) {
      return { ok: false, message: 'Unknown provider.' };
    }
    await providerRegistry.registry.setActiveProvider(providerId);
    // Reset the visible sync state; the fresh provider's cache hydrates on
    // the next snapshot read, then a background re-sync refreshes it.
    invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    const auth = await (await activeAuthService()).getSnapshot();
    if (auth.status === 'authenticated') {
      void startSync('reconnect').catch(reportBackgroundFailure);
    }
    return { ok: true, snapshot: auth };
  }

  // AniList connect uses the Auth Pin flow: launchWebAuthFlow cannot complete
  // its fragment redirect, so we open the authorize page in a tab and the
  // user pastes the token back (auth.complete_pin_connect).
  if (message.type === 'auth.connect' && message.providerId === 'anilist') {
    try {
      const authorizeUrl = await providerRegistry.getAniListPinAuthorizeUrl();
      await chrome.tabs.create({ url: authorizeUrl });
      return {
        ok: true,
        snapshot: {
          status: 'error',
          profile: null,
          errorCode: 'pin_flow_started' as AuthErrorCode,
          errorMessage: 'token-pending',
        },
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : await toMessage(error),
      };
    }
  }

  const targetProviderId =
    (message.type === 'auth.connect' || message.type === 'auth.disconnect') &&
    isProviderId(message.providerId)
      ? message.providerId
      : undefined;
  const targetService =
    targetProviderId === undefined
      ? await activeAuthService()
      : providerRegistry.getAuthService(targetProviderId);

  const snapshot =
    message.type === 'auth.get_snapshot'
      ? await targetService.getSnapshot()
      : message.type === 'auth.connect'
        ? await targetService.connect()
        : await targetService.disconnect();

  if (message.type === 'auth.connect' && snapshot.status === 'authenticated') {
    // A successful sign-in becomes the active provider when the current one
    // has no session (first sign-in, or the previously active provider was
    // disconnected). Connecting an additional provider while another stays
    // signed in never steals the active slot.
    const activeProvider = await providerRegistry.registry.getActiveProvider();
    const activeStillSignedIn = await providerRegistry.isProviderSignedIn(activeProvider);
    const shouldActivate =
      targetProviderId === undefined || targetProviderId === activeProvider || !activeStillSignedIn;
    if (shouldActivate && targetProviderId !== undefined && targetProviderId !== activeProvider) {
      await providerRegistry.registry.setActiveProvider(targetProviderId);
      invalidateCandidatePool();
      syncSnapshot = { metadata: createIdleMetadata(), progress: null };
      void hydrateCachedSync().catch(reportBackgroundFailure);
    }
    if (
      targetProviderId === undefined ||
      targetProviderId === (await providerRegistry.registry.getActiveProvider())
    ) {
      void configureScheduledTasks().catch(reportBackgroundFailure);
      void startSync('initial').catch(reportBackgroundFailure);
    }
  }
  if (message.type === 'auth.disconnect') {
    // Only clear feedback/profile when NO provider remains signed in.
    const disconnectedProviderId =
      targetProviderId ?? (await providerRegistry.registry.getActiveProvider());
    await syncService.invalidate(disconnectedProviderId);
    invalidateCandidatePool();
    const anySignedIn = await providerRegistry
      .listProviderStatuses()
      .then((statuses) => statuses.some((status) => status.signedIn));
    if (!anySignedIn) {
      await Promise.all([storage.remove('feedback'), storage.remove('profile')]);
      await profileHistoryStore.clear();
    }
    await configureScheduledTasks();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
  }
  return { ok: true, snapshot };
}

async function handleSettingsMessage(message: SettingsMessage): Promise<SettingsResponse> {
  if (message.type === 'settings.get_snapshot') return settingsSnapshot();
  if (message.type === 'settings.update_anilist_client_id') {
    const clientId = message.clientId.trim();
    if (clientId.length === 0) {
      await storage.remove(ANILIST_CLIENT_ID_STORAGE_KEY);
    } else {
      await storage.set(ANILIST_CLIENT_ID_STORAGE_KEY, clientId);
    }
    // Changing the AniList client ID invalidates AniList sessions only.
    await providerRegistry.getAuthService('anilist').disconnect();
    return settingsSnapshot();
  }
  if (message.type === 'settings.update_mal_client_id') {
    const clientId = message.clientId.trim();
    if (clientId.length === 0) {
      await storage.remove(MAL_CLIENT_ID_STORAGE_KEY);
    } else {
      await storage.set(MAL_CLIENT_ID_STORAGE_KEY, clientId);
    }
    // Changing the MAL client ID invalidates MAL sessions only.
    await providerRegistry.getAuthService('mal').disconnect();
    return settingsSnapshot();
  }
  if (message.type === 'settings.update_preferences') {
    const preferences = normalizeUserPreferences(message.preferences);
    await storage.set('preferences', preferences);
    await configureScheduledTasks();
    return settingsSnapshot();
  }
  if (message.type === 'settings.clear_cache') {
    await syncService.invalidate();
    invalidateCandidatePool();
    // The history derives entirely from the cache, so keeping it after the
    // cache is gone would let the next sync diff against discarded data.
    await profileHistoryStore.clear();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    return settingsSnapshot();
  }
  if (message.type === 'settings.delete_local_data') {
    // Every key the extension persists, typed against AnimeLensStorage so a
    // new persisted key is a compile error here rather than a silent omission.
    const LOCAL_DATA_KEYS: readonly StorageKey[] = [
      'animeData',
      'animeData:mal',
      'animeData:anilist',
      'feedback',
      'profile',
      'preferences',
      PROFILE_HISTORY_KEY,
      TOP_PICKS_RANKING_KEY,
      TOP_PICKS_SIGNATURE_KEY,
      'updateCheck',
      'malClientId',
      'anilistClientId',
      'activeProvider',
    ];
    await Promise.all(LOCAL_DATA_KEYS.map((key) => storage.remove(key)));
    await profileHistoryStore.clear();
    invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    await configureScheduledTasks();
    return settingsSnapshot();
  }

  if (message.type === 'settings.disconnect_mal') {
    // Disconnect MAL only; keep AniList sessions and AniList's cached list.
    // Legacy caches under `animeData` belong to MAL. Matched explicitly rather
    // than as the fall-through of the chain above: an unrecognized settings
    // message must not silently wipe the user's list.
    await providerRegistry.getAuthService('mal').disconnect();
    await Promise.all([storage.remove('animeData'), storage.remove('animeData:mal')]);
    await profileHistoryStore.clear('mal');
    const anySignedIn = await providerRegistry
      .listProviderStatuses()
      .then((statuses) => statuses.some((status) => status.signedIn));
    if (!anySignedIn) {
      await Promise.all([storage.remove('feedback'), storage.remove('profile')]);
      await profileHistoryStore.clear();
    }
    invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    await configureScheduledTasks();
    return settingsSnapshot();
  }

  // Unreachable for every message in `SettingsMessage`, but kept explicit so
  // adding a variant is a type error rather than a destructive fall-through.
  return { ok: false, message: 'Unknown settings action.' };
}

async function settingsSnapshot(): Promise<SettingsResponse> {
  const preferences = normalizeUserPreferences(await storage.get('preferences'));
  const auth = await (await activeAuthService()).getSnapshot();
  const malClientId = await getProviderClientId('mal', import.meta.env.VITE_MAL_CLIENT_ID ?? '');
  const anilistClientId = await getProviderClientId(
    'anilist',
    import.meta.env.VITE_ANILIST_CLIENT_ID ?? '',
  );
  return {
    ok: true,
    snapshot: {
      preferences,
      auth,
      malClientId,
      anilistClientId,
      providers: await providerRegistry.listProviderStatuses(),
      malRedirectUri: chrome.identity.getRedirectURL(),
      // AniList connects via the Auth Pin flow: the app must register AniList's
      // pin page as its redirect URL, not the chromiumapp.org origin.
      anilistRedirectUri: ANILIST_PIN_REDIRECT_URL,
    },
  };
}

const DAILY_RECOMMENDATION_PERIOD_MINUTES = 24 * 60;
const SYNC_PERIOD_MINUTES = {
  daily: 24 * 60,
  weekly: 7 * 24 * 60,
} as const satisfies Record<string, number>;

async function configureScheduledTasks(): Promise<void> {
  const preferences = normalizeUserPreferences(await storage.get('preferences'));
  await updateDailyRecommendationAlarm(preferences.dailyRecommendationsEnabled);
  await updateSyncAlarm(preferences.syncFrequency);
}

/**
 * Reconcile one alarm against a desired period without disturbing an
 * equivalent one that is already scheduled.
 *
 * An MV3 worker is torn down after ~30s idle and re-instantiated on the next
 * event, so this runs on effectively every cold start. `chrome.alarms.create`
 * with an existing name *replaces* the alarm and restarts its countdown from
 * `delayInMinutes`, so a clear-then-create on every wake pushes the alarm
 * forward by a full period each time and it never fires. Clearing also resets
 * the countdown when the user merely toggles an unrelated preference.
 *
 * Only clear-and-recreate when the desired period genuinely differs from the
 * live one, so an unchanged alarm survives both worker restarts and unrelated
 * preference writes.
 */
async function reconcileAlarm(name: string, periodMinutes: number | null): Promise<void> {
  const existing = await chrome.alarms.get(name);

  if (periodMinutes === null) {
    if (existing !== undefined) await chrome.alarms.clear(name);
    return;
  }

  if (existing !== undefined && existing.periodInMinutes === periodMinutes) return;

  if (existing !== undefined) await chrome.alarms.clear(name);
  chrome.alarms.create(name, {
    delayInMinutes: periodMinutes,
    periodInMinutes: periodMinutes,
  });
}

async function updateDailyRecommendationAlarm(enabled: boolean): Promise<void> {
  await reconcileAlarm(
    DAILY_RECOMMENDATION_ALARM,
    enabled ? DAILY_RECOMMENDATION_PERIOD_MINUTES : null,
  );
}

async function updateSyncAlarm(
  frequency: ReturnType<typeof normalizeUserPreferences>['syncFrequency'],
): Promise<void> {
  await reconcileAlarm(
    SYNC_ALARM,
    frequency === 'manual' ? null : SYNC_PERIOD_MINUTES[frequency],
  );
}

async function showDailyRecommendationNotification(): Promise<void> {
  if (chrome.notifications === undefined) return;
  const copy = getCopy(await currentLanguage());
  await chrome.notifications.create(DAILY_RECOMMENDATION_ALARM, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: copy.dailyNotificationTitle,
    message: copy.dailyNotificationMessage,
  });
}

/**
 * Reads the cached list of the active provider (including the pre-v5 shape
 * migration), mirroring what the sync service would load.
 */
async function readActiveProviderCache(): Promise<AnimeCache | undefined> {
  const providerId = await providerRegistry.registry.getActiveProvider();
  const cacheStore = new ChromeAnimeCacheStore(storage, providerId);
  const raw = await cacheStore.get();
  return raw === null || raw === undefined ? undefined : (raw as AnimeCache);
}

async function handleStreamingLinksMessage(
  message: StreamingLinksMessage,
): Promise<StreamingLinksResponse> {
  try {
    return {
      ok: true,
      links: await (
        await activeAuthService()
      ).withAccessToken(async (accessToken) => {
        const provider = await providerRegistry.createActiveProvider(accessToken);
        // Asked per title rather than read off the cached record: list,
        // suggestions and ranking responses aren't obliged to carry these.
        const dedicated = await provider.getStreamingLinks?.(message.animeId);
        if (dedicated !== undefined) return dedicated;
        const anime = await provider.getAnime(message.animeId);
        return anime.streamingSites ?? [];
      }),
    };
  } catch (error) {
    // Expired session, no data, offline — none of it may break the page.
    reportBackgroundFailure(error);
    return { ok: true, links: [] };
  }
}

async function handleMalListMessage(message: MalListMessage): Promise<MalListMessageResponse> {
  try {
    await (
      await activeAuthService()
    ).withAccessToken(async (accessToken) => {
      const provider = await providerRegistry.createActiveProvider(accessToken);
      await provider.addToList(message.animeId, message.status ?? 'plan_to_watch');
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: await toUserFacingMalListError(error) };
  }
}

/**
 * The dashboard's discovery pool: provider-personalized suggestions plus a deep
 * page of the ranking.
 *
 * Suggestions stay the primary source (they reflect what the provider thinks
 * the user wants; AniList has no such endpoint and resolves to an empty pool).
 * Top-ranked titles are already known to heavy users and far too popular to
 * ever qualify as hidden gems, so a deep ranking page widens the pool with
 * quality-but-obscure titles.
 *
 * The two calls are issued concurrently and degraded **independently**: a
 * ranking failure must not discard the suggestions, and vice versa. They used
 * to be sequential, and the ranking fallback sat behind an unguarded
 * suggestions `await`, so any suggestions failure unwound straight to the
 * outer catch and skipped the ranking pool entirely — the fallback could not
 * run in the case it existed for.
 */
async function fetchCandidatePool(): Promise<readonly Anime[]> {
  const pool = await (
    await activeAuthService()
  ).withAccessToken(async (accessToken) => {
    const provider = await providerRegistry.createActiveProvider(accessToken);

    /** One source failing must not discard the other. */
    const degrade = async <T,>(
      load: () => Promise<readonly T[]> | undefined,
    ): Promise<readonly T[]> => {
      try {
        return (await load()) ?? [];
      } catch (error) {
        reportBackgroundFailure(error);
        return [];
      }
    };

    const [suggested, ranked] = await Promise.all([
      degrade<Anime>(() => provider.getAnimeSuggestions?.(CANDIDATE_POOL_SUGGESTION_LIMIT)),
      degrade<Anime>(() =>
        provider.getAnimeRanking?.(CANDIDATE_POOL_RANKING_LIMIT, RANKING_DISCOVERY_OFFSET),
      ),
    ]);
    const seen = new Set(suggested.map((anime) => anime.id));
    return [...suggested, ...ranked.filter((anime) => !seen.has(anime.id))];
  });
  return pool;
}

/**
 * TTL-cached, in-flight-deduplicated wrapper around {@link fetchCandidatePool}.
 *
 * Keyed on the active provider so switching accounts cannot serve the previous
 * account's pool, and on wall clock so the refresh survives the worker restart
 * that clears the map.
 */
async function loadCandidatePool(): Promise<readonly Anime[]> {
  const providerId = await providerRegistry.registry.getActiveProvider();
  const cached = candidatePoolCache;
  if (cached !== null && cached.providerId === providerId) {
    if (Date.now() - cached.fetchedAt < CANDIDATE_POOL_TTL_MS) return cached.pool;
  }

  // A provider switch mid-flight must not be served the previous account's pool.
  if (candidatePoolInFlight !== null && candidatePoolInFlight.providerId === providerId) {
    return candidatePoolInFlight.request;
  }

  const request = (async () => {
    try {
      return await fetchCandidatePool();
    } catch (error) {
      // Session or network problems must not block the dashboard: degrade to
      // plan-to-watch-only candidates.
      reportBackgroundFailure(error);
      return [] as readonly Anime[];
    }
  })();
  candidatePoolInFlight = { providerId, request };

  try {
    const pool = await request;
    // An empty pool is the degraded result of a failure, not a real answer, so
    // it is not cached; the next dashboard request retries instead of being
    // locked to an empty pool for the whole TTL.
    if (pool.length > 0) {
      candidatePoolCache = { providerId, fetchedAt: Date.now(), pool };
    }
    return pool;
  } finally {
    if (candidatePoolInFlight?.request === request) candidatePoolInFlight = null;
  }
}

async function handleRecommendationMessage(
  _message: RecommendationMessage,
): Promise<RecommendationMessageResponse> {
  const stored = await readActiveProviderCache();
  const preferences = normalizeUserPreferences(await storage.get('preferences'));
  const feedback = await feedbackService.list();
  if (stored === undefined) {
    return {
      ok: true,
      snapshot: createEmptyDashboardRecommendationSnapshot(),
    };
  }

  return {
    ok: true,
    snapshot: await buildDashboardRecommendationSnapshot(
      stored.entries,
      stored.sync,
      preferences,
      feedback,
      new Date().toISOString(),
      loadCandidatePool,
    ),
  };
}

/** The active provider's profile, recomputed from the cache. */
async function buildCurrentProfileSummary(): Promise<{
  readonly summary: UserProfileSummary;
  readonly providerId: string;
} | null> {
  const stored = await readActiveProviderCache();
  if (stored === undefined) return null;
  const providerId = await providerRegistry.registry.getActiveProvider();
  const feedback = await feedbackService.list();
  const summary = profileSummaryFromModel(
    buildUserPreferenceProfile(stored.entries, feedback),
    await currentLanguage(),
    stored.entries,
    providerId,
  );
  return { summary, providerId };
}

/**
 * Makes the current profile the point later snapshots are compared against.
 *
 * Called when the inputs change - a completed sync, a written rating - and
 * never on a read, or the delta would be consumed by the first popup opening.
 */
async function recordProfileBaseline(): Promise<void> {
  try {
    const current = await buildCurrentProfileSummary();
    if (current === null || !current.summary.hasData) return;
    await profileHistoryStore.record(current.providerId, current.summary);
  } catch (error) {
    // A history that fails to write must not break a sync or a rating.
    reportBackgroundFailure(error);
  }
}

async function handleProfileMessage(message: ProfileMessage): Promise<ProfileMessageResponse> {
  const historyCleared = message.type === 'profile.clear_history';
  if (historyCleared) {
    await profileHistoryStore.clear(await providerRegistry.registry.getActiveProvider());
  }
  const current = await buildCurrentProfileSummary();
  if (current === null) {
    return {
      ok: true,
      snapshot: {
        status: 'empty',
        summary: emptyProfileSummary(),
        delta: baselineProfileDelta(),
        errorMessage: null,
      },
    };
  }
  const snapshot = toStoredProfileSnapshot(
    current.summary,
    current.providerId,
    new Date().toISOString(),
  );
  const previous = historyCleared ? null : await profileHistoryStore.load(current.providerId);
  return {
    ok: true,
    snapshot: {
      status: current.summary.hasData ? 'ready' : 'empty',
      summary: current.summary,
      delta: diffProfileSnapshots(previous, snapshot),
      errorMessage: null,
    },
  };
}

/**
 * Top 3 tie-break storage. The plan is recomputed from the cached list on every
 * call so the signature always reflects the list as it is right now, and a
 * ranking that no longer matches is dropped rather than trusted.
 */
async function currentTopPickPlan(): Promise<TopPickPlan> {
  const providerId = await providerRegistry.registry.getActiveProvider();
  const stored = await readActiveProviderCache();
  if (stored === undefined) return emptyTopPickPlan(providerId);
  return planTopPicks(stored.entries, { providerId });
}

async function handleTopPicksMessage(message: TopPicksMessage): Promise<TopPicksMessageResponse> {
  if (message.type === 'profile.clear_top_picks_ranking') {
    await topPicksStore.clear();
    return { ok: true, ranking: null };
  }
  const plan = await currentTopPickPlan();
  if (message.type === 'profile.get_top_picks_ranking') {
    return { ok: true, ranking: await topPicksStore.load(plan) };
  }
  // Only the open slots are stored; the locked ones are re-derived from the
  // plan so a stored answer can never contradict the scores.
  const ranking = message.ranking;
  const valid =
    plan.needsChoice &&
    ranking.length === plan.openSlots &&
    new Set(ranking).size === ranking.length &&
    ranking.every((id) => plan.candidates.some((candidate) => candidate.id === id));
  if (!valid) {
    await topPicksStore.clear();
    return { ok: true, ranking: null };
  }
  await topPicksStore.save(plan, ranking);
  return { ok: true, ranking };
}

async function handleFeedbackMessage(message: FeedbackMessage): Promise<FeedbackMessageResponse> {
  if (message.type === 'feedback.list') return { ok: true, feedback: await feedbackService.list() };
  const feedback = await feedbackService.submit(
    message.recommendationId,
    message.anime,
    message.value,
    message.reasons ?? [],
  );
  // Feedback feeds the same model as the list, so a rating moves the profile
  // just as watching something does.
  await recordProfileBaseline();
  return { ok: true, feedback };
}

async function handleSyncMessage(message: SyncMessage): Promise<SyncMessageResponse> {
  if (message.type === 'sync.get_snapshot') return { ok: true, snapshot: syncSnapshot };
  if (message.type === 'sync.invalidate') {
    await syncService.invalidate();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    return { ok: true, snapshot: syncSnapshot };
  }

  void startSync(message.reason ?? 'manual').catch(reportBackgroundFailure);
  return { ok: true, snapshot: syncSnapshot };
}

async function startSync(reason: 'initial' | 'manual' | 'reconnect'): Promise<void> {
  if (syncSnapshot.metadata.status === 'syncing') return;
  const language = await currentLanguage();
  const copy = getCopy(language);
  syncSnapshot = {
    metadata: { ...syncSnapshot.metadata, status: 'syncing', errorCode: null, errorMessage: null },
    progress: {
      phase: 'fetching',
      current: 0,
      total: null,
      message: copy.syncProgressFetching,
    },
  };
  try {
    const result = await syncService.sync({
      reason,
      force: reason !== 'initial',
      language,
      onProgress: (progress) => updateProgress(progress),
    });
    syncSnapshot = { metadata: result.metadata, progress: result.metadata.progress };
    // A completed sync is the one moment the list behind the profile is known
    // to have changed.
    if (result.metadata.status === 'success') await recordProfileBaseline();
  } catch (error) {
    let cached: Awaited<ReturnType<typeof syncService.getCachedResult>> = null;
    try {
      cached = await syncService.getCachedResult(language);
    } catch (cacheError) {
      reportBackgroundFailure(cacheError);
    }
    if (cached !== null) {
      syncSnapshot = { metadata: cached.metadata, progress: cached.metadata.progress };
      return;
    }
    const metadata: SyncMetadata = {
      ...syncSnapshot.metadata,
      status: 'error',
      phase: null,
      progress: null,
      errorCode: toSyncErrorCode(error),
      errorMessage: await toMessage(error),
      fromCache: false,
    };
    syncSnapshot = { metadata, progress: null };
  }
}

async function hydrateCachedSync(): Promise<void> {
  try {
    const cached = await syncService.getCachedResult(await currentLanguage());
    if (cached !== null)
      syncSnapshot = { metadata: cached.metadata, progress: cached.metadata.progress };
  } catch {
    // Corrupted local cache is discarded by the cache store validator.
  }
}

function updateProgress(progress: SyncProgress): void {
  syncSnapshot = {
    metadata: {
      ...syncSnapshot.metadata,
      status: 'syncing',
      phase: progress.phase,
      progress,
      errorCode: null,
      errorMessage: null,
    },
    progress,
  };
}

function createIdleMetadata(): SyncMetadata {
  return {
    status: 'idle',
    phase: null,
    progress: null,
    lastSyncedAt: null,
    itemCount: 0,
    nextPageUrl: null,
    errorCode: null,
    errorMessage: null,
    fromCache: false,
  };
}

function isAuthMessage(value: unknown): value is AuthMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type === 'auth.complete_pin_connect') {
    return (
      'providerId' in value &&
      isProviderId((value as { providerId: unknown }).providerId) &&
      'token' in value &&
      typeof (value as { token: unknown }).token === 'string'
    );
  }
  return (
    value.type === 'auth.get_snapshot' ||
    value.type === 'auth.connect' ||
    value.type === 'auth.disconnect' ||
    value.type === 'auth.get_providers' ||
    value.type === 'auth.set_active_provider' ||
    value.type === 'auth.get_token_exchange_diagnostic'
  );
}

async function toUserFacingMalListError(error: unknown): Promise<string> {
  const copy = getCopy(await currentLanguage());
  const providerName =
    (await providerRegistry.registry.getActiveProvider()) === 'anilist' ? 'AniList' : 'MyAnimeList';
  if (error instanceof AuthServiceError) return copy.listAuthRequired(providerName);
  if (error instanceof ApiError && error.code === 'unauthorized') {
    return copy.listSessionExpired(providerName);
  }
  if (error instanceof ApiError && error.code === 'network_error') {
    return copy.listUnavailable(providerName);
  }
  if (error instanceof ApiError && error.code === 'forbidden') {
    return copy.listRefused(providerName);
  }
  return copy.providerListError(providerName);
}

function toSyncErrorCode(error: unknown): SyncMetadata['errorCode'] {
  if (error instanceof AuthServiceError) return 'unauthorized';
  if (error instanceof ApiError) {
    if (error.code === 'network_error') return 'network_error';
    if (error.code === 'rate_limited') return 'rate_limited';
    if (error.code === 'unauthorized') return 'unauthorized';
    if (error.code === 'invalid_response') return 'invalid_response';
  }
  return 'unknown';
}

async function toMessage(error: unknown): Promise<string> {
  if (error instanceof Error) return error.message;
  return getCopy(await currentLanguage()).backgroundActionFailed;
}

async function currentLanguage(): Promise<Language> {
  const preferences = normalizeUserPreferences(await storage.get('preferences'));
  return preferences.language;
}
