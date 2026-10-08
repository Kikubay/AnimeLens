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
import { toSyncErrorCode as toProviderSyncErrorCode } from '../sync/sync-service';
import { StorageQuotaError } from '../storage/storage-adapter';
import type { SyncMessage, SyncMessageResponse, SyncSnapshot } from '../sync/sync-messages';
import { isSyncMessage } from '../sync/sync-messages';
import type { SyncMetadata, SyncProgress } from '../domain/sync';
import { buildUserPreferenceProfile } from '../recommendations/recommendation-engine';
import {
  buildDashboardRecommendationSnapshot,
  createEmptyDashboardRecommendationSnapshot,
  withCurrentSync,
} from '../recommendations/recommendation-dashboard';
import { createCandidatePoolStore } from '../recommendations/candidate-pool-store';
import {
  createDashboardSnapshotStore,
  dashboardSignature,
} from '../recommendations/recommendation-snapshot-store';
import { createSessionStorageArea } from '../storage/session-area';
import { ChromeStorageAdapter } from '../storage/storage-adapter';
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
import type { CandidatePoolConfig } from '../api/anime-provider';
import type { ProviderStatus } from '../providers/provider-registry';
import { isMalListMessage } from '../api/mal-list-messages';
import {
  ANIME_SEARCH_MAX_LENGTH,
  isAnimeSearchMessage,
  type AnimeSearchMessage,
  type AnimeSearchResponse,
} from '../api/anime-search-messages';
import {
  isStreamingLinksMessage,
  type StreamingLinksMessage,
  type StreamingLinksResponse,
} from '../api/streaming-links-messages';
import { ANILIST_PIN_REDIRECT_URL } from '../api/providers/anilist/anilist-queries';
import {
  ANILIST_HOME_URL,
  ANILIST_PIN_TOKEN_KEY,
  ANILIST_PIN_URL_MATCH,
  extractAnilistPinToken,
  readAnilistPinTokenRecord,
  type AnilistPinTokenRecord,
} from '../auth/anilist-pin';
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

// Plain auth messages deliberately target the active provider so connect/disconnect/snapshot keep working as before; anything provider-scoped goes through `providerRegistry`.
async function activeAuthService() {
  return providerRegistry.getAuthService(await providerRegistry.registry.getActiveProvider());
}

// Deep enough to skip the mega-popular head, but MAL starts returning empty pages further down than you'd expect.
const DEFAULT_CANDIDATE_POOL_CONFIG: CandidatePoolConfig = {
  suggestionLimit: 50,
  rankingLimit: 100,
  rankingOffset: 2000,
};
const DAILY_RECOMMENDATION_ALARM = 'animelens-daily-recommendation';
const SYNC_ALARM = 'animelens-sync';
const ANIME_SEARCH_RESULT_LIMIT = 24;
let updateCheckInFlight: Promise<UpdateSnapshot> | null = null;

// Every rating, add, preference change and sync re-requests the pool, and each request costs two provider calls for byte-identical results.
const candidatePoolStore = createCandidatePoolStore(createSessionStorageArea());
const dashboardSnapshotStore = createDashboardSnapshotStore(createSessionStorageArea());
let candidatePoolInFlight: {
  readonly providerId: ProviderId;
  readonly request: Promise<readonly Anime[]>;
} | null = null;

/** Drop the pool when the account, or the data it was drawn from, changes. */
async function invalidateCandidatePool(): Promise<void> {
  candidatePoolInFlight = null;
  await candidatePoolStore.clear();
  await dashboardSnapshotStore.clear();
}

type Storage = ConstructorParameters<typeof ChromeAnimeCacheStore>[0];

// The shared adapter rather than a local copy, so a failed write raises the same typed error everywhere instead of vanishing into a generic sync error.
const storage: Storage = new ChromeStorageAdapter();

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
// `setAccessLevel` is Chrome-only, so an unguarded call throws synchronously at module scope and takes the whole background script with it.
chrome.storage.session
  .setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })
  ?.catch(reportBackgroundFailure);

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

async function rememberAnilistPinToken(token: string, tabId?: number): Promise<void> {
  const record: AnilistPinTokenRecord = tabId === undefined ? { token } : { token, tabId };
  await chrome.storage.session.set({ [ANILIST_PIN_TOKEN_KEY]: record });
}

/** Clears the stashed token and navigates its tab off the pin URL, which still holds the token in its address bar for the next scan to find. */
async function forgetAnilistPinToken(): Promise<void> {
  const stored = await chrome.storage.session.get(ANILIST_PIN_TOKEN_KEY);
  const record = readAnilistPinTokenRecord(stored[ANILIST_PIN_TOKEN_KEY]);
  await chrome.storage.session.remove(ANILIST_PIN_TOKEN_KEY);
  if (record?.tabId === undefined) return;
  await chrome.tabs?.update?.(record.tabId, { url: ANILIST_HOME_URL }).catch(() => {
    // A closed tab is the common case, and nothing depends on the redirect landing.
  });
}

/** A tab already parked on the pin page is invisible to `tabs.onUpdated` after a worker restart, so ask the open tabs directly. */
async function readStoredAnilistPinToken(): Promise<string | null> {
  const stored = await chrome.storage.session.get(ANILIST_PIN_TOKEN_KEY);
  const record = readAnilistPinTokenRecord(stored[ANILIST_PIN_TOKEN_KEY]);
  if (record !== null) return record.token;

  const tabs = await chrome.tabs.query({ url: ANILIST_PIN_URL_MATCH });
  for (const tab of tabs) {
    const found = extractAnilistPinToken(tab.url);
    if (found !== null) {
      await rememberAnilistPinToken(found, tab.id);
      return found;
    }
  }
  return null;
}

// Optional because the desktop shim implements neither, and a top-level registration that throws is nothing a `catch` can rescue.
chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  const token = extractAnilistPinToken(changeInfo.url);
  if (token === null) return;
  void rememberAnilistPinToken(token, tabId).catch(reportBackgroundFailure);
});

chrome.runtime.onStartup?.addListener(() => {
  // Firefox drops alarms on browser restart, unlike Chromium, so the daily recommendation would quietly stop firing.
  void configureScheduledTasks().catch(reportBackgroundFailure);
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
  | { readonly type: 'auth.get_token_exchange_diagnostic' }
  | { readonly type: 'auth.get_pin_token' };

type AuthResponse =
  | { readonly ok: true; readonly snapshot: AuthSnapshot }
  | { readonly ok: true; readonly diagnostic: TokenExchangeDiagnostic | null }
  | { readonly ok: true; readonly providers: ProviderStatus[] }
  | { readonly ok: true; readonly pinToken: string | null }
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
  | AnimeSearchResponse
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
    if (isAnimeSearchMessage(message)) {
      void handleAnimeSearchMessage(message)
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
  if (message.type === 'auth.get_pin_token') {
    return { ok: true, pinToken: await readStoredAnilistPinToken() };
  }
  if (message.type === 'auth.complete_pin_connect') {
    if (message.providerId !== 'anilist') {
      return { ok: false, message: (await currentCopy()).pinFlowAniListOnly };
    }
    const snapshot = await providerRegistry.completeAnilistPinSignIn(message.token);
    if (snapshot.status === 'authenticated') {
      // The pin tab is still sitting on its URL, so without this the same token would be handed out again on every later popup open.
      await forgetAnilistPinToken();
      void configureScheduledTasks().catch(reportBackgroundFailure);
      // The pin flow doesn't switch the active provider, so only sync if AniList is already the one taking traffic.
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
      return { ok: false, message: (await currentCopy()).unknownProvider };
    }
    await providerRegistry.registry.setActiveProvider(providerId);
    // Reset the visible sync state; the new provider's cache hydrates on the next snapshot read, then a background re-sync refreshes it.
    await invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    const auth = await (await activeAuthService()).getSnapshot();
    if (auth.status === 'authenticated') {
      void startSync('reconnect').catch(reportBackgroundFailure);
    }
    return { ok: true, snapshot: auth };
  }

  // launchWebAuthFlow can't complete AniList's fragment redirect, so we open the authorize page in a tab and wait for the pasted token.
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
    // Only take the active slot when nothing is signed in there; adding a second provider never steals it.
    const activeProvider = await providerRegistry.registry.getActiveProvider();
    const activeStillSignedIn = await providerRegistry.isProviderSignedIn(activeProvider);
    const shouldActivate =
      targetProviderId === undefined || targetProviderId === activeProvider || !activeStillSignedIn;
    if (shouldActivate && targetProviderId !== undefined && targetProviderId !== activeProvider) {
      await providerRegistry.registry.setActiveProvider(targetProviderId);
      await invalidateCandidatePool();
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
    // Feedback and profile are global, so they only go when the last provider signs out.
    const disconnectedProviderId =
      targetProviderId ?? (await providerRegistry.registry.getActiveProvider());
    await syncService.invalidate(disconnectedProviderId);
    await invalidateCandidatePool();
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
    await invalidateCandidatePool();
    // The history is derived from the cache, so keeping it would make the next sync diff against data that's already gone.
    await profileHistoryStore.clear();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    return settingsSnapshot();
  }
  if (message.type === 'settings.delete_local_data') {
    // Typed as StorageKey[], so adding a persisted key anywhere else becomes a compile error rather than a silent omission here.
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
    await invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    await configureScheduledTasks();
    return settingsSnapshot();
  }

  if (message.type === 'settings.disconnect_mal') {
    // Matches explicitly instead of falling through, because an unrecognized settings message must never wipe the user's list. AniList keeps its session and its cached list.
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
    await invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    await configureScheduledTasks();
    return settingsSnapshot();
  }

  // Unreachable today, but keeping it explicit means a new SettingsMessage variant is a type error instead of a destructive fall-through.
  return { ok: false, message: (await currentCopy()).unknownSettingsAction };
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
      // The pin page, not the chromiumapp.org origin, is what the AniList app must register as its redirect URL.
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

// `chrome.alarms.create` replaces an existing alarm and restarts its countdown, so a clear-then-create on every cold start would push the alarm forward forever and it would never fire. Recreate only when the period actually changed, otherwise toggling an unrelated preference also resets the countdown.
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
  await reconcileAlarm(SYNC_ALARM, frequency === 'manual' ? null : SYNC_PERIOD_MINUTES[frequency]);
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
        // Asked per title rather than read off the cached record, since list/suggestion/ranking responses aren't obliged to carry these.
        const dedicated = await provider.getStreamingLinks?.(message.animeId);
        if (dedicated !== undefined) return dedicated;
        const anime = await provider.getAnime(message.animeId);
        return anime.streamingSites ?? [];
      }),
    };
  } catch (error) {
    // An expired session or an offline network must not break the page.
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

async function handleAnimeSearchMessage(message: AnimeSearchMessage): Promise<AnimeSearchResponse> {
  try {
    const query = message.query.trim().slice(0, ANIME_SEARCH_MAX_LENGTH);
    const results = await (
      await activeAuthService()
    ).withAccessToken(async (accessToken) => {
      const provider = await providerRegistry.createActiveProvider(accessToken);
      return provider.searchAnime(query);
    });
    return { ok: true, results: results.slice(0, ANIME_SEARCH_RESULT_LIMIT) };
  } catch (error) {
    reportBackgroundFailure(error);
    return { ok: false, message: await toUserFacingSearchError(error) };
  }
}

// Suggestions are the primary source; the deep ranking page is what widens it with quality-but-obscure titles, since the top of the ranking is already known to heavy users. Each source is fetched independently so a failure in one can't discard the other — they used to run sequentially behind an unguarded await, which meant the fallback never ran in the one case it existed for.
async function fetchCandidatePool(): Promise<readonly Anime[]> {
  const pool = await (
    await activeAuthService()
  ).withAccessToken(async (accessToken) => {
    const provider = await providerRegistry.createActiveProvider(accessToken);

    const degrade = async <T>(
      load: () => Promise<readonly T[]> | undefined,
    ): Promise<readonly T[]> => {
      try {
        return (await load()) ?? [];
      } catch (error) {
        reportBackgroundFailure(error);
        return [];
      }
    };

    const config = provider.candidatePoolConfig ?? DEFAULT_CANDIDATE_POOL_CONFIG;
    const [suggested, ranked] = await Promise.all([
      degrade<Anime>(() => provider.getAnimeSuggestions?.(config.suggestionLimit)),
      degrade<Anime>(() => provider.getAnimeRanking?.(config.rankingLimit, config.rankingOffset)),
    ]);
    const seen = new Set(suggested.map((anime) => anime.id));
    return [...suggested, ...ranked.filter((anime) => !seen.has(anime.id))];
  });
  return pool;
}

// Keyed on the active provider so switching accounts can't serve the previous account's pool.
async function loadCandidatePool(): Promise<readonly Anime[]> {
  const providerId = await providerRegistry.registry.getActiveProvider();
  const cached = await candidatePoolStore.load(providerId, Date.now());
  if (cached !== null) return cached;

  // A provider switch mid-flight must not be served the previous account's pool.
  if (candidatePoolInFlight !== null && candidatePoolInFlight.providerId === providerId) {
    return candidatePoolInFlight.request;
  }

  const request = (async () => {
    try {
      return await fetchCandidatePool();
    } catch (error) {
      // Degrade to plan-to-watch-only candidates rather than blocking the dashboard.
      reportBackgroundFailure(error);
      return [] as readonly Anime[];
    }
  })();
  candidatePoolInFlight = { providerId, request };

  try {
    const pool = await request;
    // An empty pool is a degraded failure, not an answer, so don't cache it and lock the dashboard to it for the whole TTL.
    if (pool.length > 0) {
      await candidatePoolStore.save(providerId, pool, Date.now());
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

  const providerId = await providerRegistry.registry.getActiveProvider();
  const pool = await loadCandidatePool();
  const signature = dashboardSignature({
    providerId,
    cacheVersion: stored.version,
    cachedAt: stored.cachedAt,
    pool,
    preferences,
    feedback,
  });

  const cached = await dashboardSnapshotStore.load(signature, Date.now());
  if (cached !== null) {
    return { ok: true, snapshot: withCurrentSync(cached, stored.sync) };
  }

  const snapshot = await buildDashboardRecommendationSnapshot(
    stored.entries,
    stored.sync,
    preferences,
    feedback,
    new Date().toISOString(),
    async () => pool,
  );
  await dashboardSnapshotStore.save(signature, snapshot, Date.now());
  return { ok: true, snapshot };
}

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

// Called when the inputs change (a finished sync, a written rating) and never on a read, or the first popup to open would eat the delta.
async function recordProfileBaseline(): Promise<void> {
  try {
    const current = await buildCurrentProfileSummary();
    if (current === null || !current.summary.hasData) return;
    await profileHistoryStore.record(current.providerId, current.summary);
  } catch (error) {
    // A failed history write must not take the sync or the rating down with it.
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

// Recomputed on every call so the stored signature always reflects the list as it is now.
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
  // Locked slots are re-derived from the plan, so only the open ones are stored and a stale answer can't contradict the scores.
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
  // A rating moves the profile just as watching something does.
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
    // A successful sync is the one moment we know the list behind the profile changed.
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
    // Nothing to hydrate; the cache store already discarded anything unreadable.
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
    value.type === 'auth.get_token_exchange_diagnostic' ||
    value.type === 'auth.get_pin_token'
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

async function toUserFacingSearchError(error: unknown): Promise<string> {
  const copy = getCopy(await currentLanguage());
  const providerName =
    (await providerRegistry.registry.getActiveProvider()) === 'anilist' ? 'AniList' : 'MyAnimeList';
  if (error instanceof AuthServiceError) return copy.searchAuthRequired(providerName);
  if (error instanceof ApiError && error.code === 'unauthorized') {
    return copy.searchSessionExpired(providerName);
  }
  if (
    error instanceof ApiError &&
    (error.code === 'network_error' || error.code === 'rate_limited')
  ) {
    return copy.searchUnavailable(providerName);
  }
  return copy.backgroundActionFailed;
}

function toSyncErrorCode(error: unknown): SyncMetadata['errorCode'] {
  if (error instanceof AuthServiceError) return 'unauthorized';
  return toProviderSyncErrorCode(error);
}

async function toMessage(error: unknown): Promise<string> {
  const copy = getCopy(await currentLanguage());
  if (error instanceof StorageQuotaError) return copy.syncStorageFull;
  if (error instanceof Error) return error.message;
  return copy.backgroundActionFailed;
}

async function currentLanguage(): Promise<Language> {
  const preferences = normalizeUserPreferences(await storage.get('preferences'));
  return preferences.language;
}

async function currentCopy() {
  return getCopy(await currentLanguage());
}
