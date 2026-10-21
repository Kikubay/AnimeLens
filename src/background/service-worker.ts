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
import { computeWeeklyRecap } from '../profile/weekly-recap';
import { TOP_PICKS_RANKING_KEY, TOP_PICKS_SIGNATURE_KEY } from '../profile/top-picks-store';
import type { StorageKey } from '../storage/storage-types';
import { createTopPicksStore } from '../profile/top-picks-store';
import { emptyTopPickPlan, planTopPicks, type TopPickPlan } from '../profile/top-picks';
import type { TopPicksMessage, TopPicksMessageResponse } from '../profile/top-picks-messages';
import { isTopPicksMessage } from '../profile/top-picks-messages';
import type {
  SettingsMessage,
  SettingsResponse,
  SettingsSnapshotSuccess,
} from '../settings/settings-messages';
import { isSettingsMessage } from '../settings/settings-messages';
import { normalizeUserPreferences } from '../settings/settings-types';
import {
  EXPORTED_STORAGE_KEYS,
  buildDataExport,
  parseDataExport,
  serializeDataExport,
  storedValuesFromExport,
  summarizeDataExport,
  type DataExportSource,
} from '../settings/data-transfer';
import type {
  RecommendationMessage,
  RecommendationMessageResponse,
} from '../recommendations/recommendation-messages';
import { isRecommendationMessage } from '../recommendations/recommendation-messages';
import type { MalListMessage, MalListMessageResponse } from '../api/mal-list-messages';
import type { AnimeProvider, CandidatePoolConfig } from '../api/anime-provider';
import { buildTasteClusters, type TasteClusters } from '../recommendations/taste-clusters';
import type { ProviderStatus } from '../providers/provider-registry';
import { isMalListMessage } from '../api/mal-list-messages';
import {
  ANIME_SEARCH_PAGE_SIZE,
  isAnimeSearchMessage,
  type AnimeSearchMessage,
  type AnimeSearchResponse,
} from '../api/anime-search-messages';
import { parseAnimeSearchQuery } from '../api/anime-search-query';
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

async function activeAuthService() {
  return providerRegistry.getAuthService(await providerRegistry.registry.getActiveProvider());
}

const DEFAULT_CANDIDATE_POOL_CONFIG: CandidatePoolConfig = {
  suggestionLimit: 50,
  rankingLimit: 100,
  rankingOffset: 2000,
};
const DEFAULT_TASTE_POOL_LIMIT = 50;
const DAILY_RECOMMENDATION_ALARM = 'animelens-daily-recommendation';
const SYNC_ALARM = 'animelens-sync';
let updateCheckInFlight: Promise<UpdateSnapshot> | null = null;

const candidatePoolStore = createCandidatePoolStore(createSessionStorageArea());
const dashboardSnapshotStore = createDashboardSnapshotStore(createSessionStorageArea());
let candidatePoolInFlight: {
  readonly poolKey: string;
  readonly request: Promise<readonly Anime[]>;
} | null = null;

async function invalidateCandidatePool(): Promise<void> {
  candidatePoolInFlight = null;
  await candidatePoolStore.clear();
  await dashboardSnapshotStore.clear();
}

type Storage = ConstructorParameters<typeof ChromeAnimeCacheStore>[0];

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

async function forgetAnilistPinToken(): Promise<void> {
  const stored = await chrome.storage.session.get(ANILIST_PIN_TOKEN_KEY);
  const record = readAnilistPinTokenRecord(stored[ANILIST_PIN_TOKEN_KEY]);
  await chrome.storage.session.remove(ANILIST_PIN_TOKEN_KEY);
  if (record?.tabId === undefined) return;
  await chrome.tabs?.update?.(record.tabId, { url: ANILIST_HOME_URL }).catch(() => {});
}

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

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  const token = extractAnilistPinToken(changeInfo.url);
  if (token === null) return;
  void rememberAnilistPinToken(token, tabId).catch(reportBackgroundFailure);
});

chrome.runtime.onStartup?.addListener(() => {
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
      /** Omitted when the worker already captured the token from the pin tab. */
      readonly token?: string;
    }
  | { readonly type: 'auth.get_token_exchange_diagnostic' }
  | { readonly type: 'auth.get_pin_token' };

type AuthResponse =
  | { readonly ok: true; readonly snapshot: AuthSnapshot }
  | { readonly ok: true; readonly diagnostic: TokenExchangeDiagnostic | null }
  | { readonly ok: true; readonly providers: ProviderStatus[] }
  | { readonly ok: true; readonly pinAvailable: boolean }
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

async function handleUpdateMessage(message: UpdateMessage): Promise<UpdateResponse> {
  const snapshot = await checkForUpdates();
  if (message.type === 'updates.download') {
    await startUpdateDownload(snapshot);
    return { ok: true, snapshot };
  }
  if (message.type === 'updates.openRelease') {
    await openExternalUrl(snapshot.releaseUrl);
    return { ok: true, snapshot };
  }
  return { ok: true, snapshot };
}

interface DownloadsApi {
  download(options: { readonly url: string; readonly saveAs: boolean }): Promise<number>;
}

interface TabsApi {
  create(properties: { readonly url: string }): Promise<unknown>;
}

async function startUpdateDownload(snapshot: UpdateSnapshot): Promise<void> {
  if (snapshot.status !== 'available') return;
  const url = snapshot.downloadUrl ?? snapshot.releaseUrl;
  if (url === null) return;
  const downloads = (globalThis.chrome as { downloads?: DownloadsApi }).downloads;
  if (typeof downloads?.download === 'function') {
    await downloads.download({ url, saveAs: false });
    return;
  }
  await openExternalUrl(url);
}

async function openExternalUrl(url: string | null): Promise<void> {
  if (url === null) return;
  await (globalThis.chrome as { tabs?: TabsApi }).tabs?.create({ url });
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
    // Availability only: the token itself never crosses into the popup, which is the one place a
    // compromised bundle could read it. `complete_pin_connect` reads it back from here.
    return { ok: true, pinAvailable: (await readStoredAnilistPinToken()) !== null };
  }
  if (message.type === 'auth.complete_pin_connect') {
    if (message.providerId !== 'anilist') {
      return { ok: false, message: (await currentCopy()).pinFlowAniListOnly };
    }
    // An omitted token means "use the one the worker already captured from the pin tab", so the
    // auto-detect path never has to hold the secret in the popup at all.
    const supplied = message.token?.trim() ?? '';
    const accessToken = supplied.length > 0 ? supplied : await readStoredAnilistPinToken();
    if (accessToken === null) {
      return {
        ok: true,
        snapshot: {
          status: 'error',
          profile: null,
          errorCode: 'invalid_callback',
          errorMessage: (await currentCopy()).pinFlowNoTokenDetected,
        },
      };
    }
    const snapshot = await providerRegistry.completeAnilistPinSignIn(accessToken);
    if (snapshot.status === 'authenticated') {
      await forgetAnilistPinToken();
      void configureScheduledTasks().catch(reportBackgroundFailure);

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

    await invalidateCandidatePool();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    const auth = await (await activeAuthService()).getSnapshot();
    if (auth.status === 'authenticated') {
      void startSync('reconnect').catch(reportBackgroundFailure);
    }
    return { ok: true, snapshot: auth };
  }

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

    await profileHistoryStore.clear();
    syncSnapshot = { metadata: createIdleMetadata(), progress: null };
    void hydrateCachedSync().catch(reportBackgroundFailure);
    return settingsSnapshot();
  }
  if (message.type === 'settings.delete_local_data') {
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

  if (message.type === 'settings.export_data') {
    const stored = await readExportedStorage();
    const exported = buildDataExport(stored, new Date().toISOString());
    const summary = summarizeDataExport(exported.data);
    return {
      ...(await settingsSnapshot()),
      data: {
        kind: 'export',
        json: serializeDataExport(exported),
        feedback: summary.feedback,
        profileSnapshots: summary.profileSnapshots,
      },
    };
  }
  if (message.type === 'settings.import_data') {
    const parsed = parseDataExport(message.payload);
    if (parsed === null) {
      return { ok: false, message: getCopy(await currentLanguage()).dataImportInvalid };
    }
    const values = storedValuesFromExport(parsed);
    await Promise.all([
      storage.set('feedback', values.feedback),
      storage.set('preferences', values.preferences),
      storage.set(PROFILE_HISTORY_KEY, values.profileHistory),
    ]);
    if (values.activeProvider !== null) await storage.set('activeProvider', values.activeProvider);
    if (values.manualTop3Ranking !== null) {
      await storage.set(TOP_PICKS_RANKING_KEY, values.manualTop3Ranking);
      await storage.set(TOP_PICKS_SIGNATURE_KEY, values.manualTop3PoolSignature ?? '');
    }
    await invalidateCandidatePool();
    await configureScheduledTasks();
    const summary = summarizeDataExport(parsed.data);
    return {
      ...(await settingsSnapshot()),
      data: {
        kind: 'import',
        json: serializeDataExport(parsed),
        feedback: summary.feedback,
        profileSnapshots: summary.profileSnapshots,
      },
    };
  }

  if (message.type === 'settings.disconnect_mal') {
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

  return { ok: false, message: (await currentCopy()).unknownSettingsAction };
}

async function settingsSnapshot(): Promise<SettingsSnapshotSuccess> {
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

        const dedicated = await provider.getStreamingLinks?.(message.animeId);
        if (dedicated !== undefined) return dedicated;
        const anime = await provider.getAnime(message.animeId);
        return anime.streamingSites ?? [];
      }),
    };
  } catch (error) {
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
  const parsed = parseAnimeSearchQuery(message.query);
  if (parsed === null) return { ok: true, results: [], hasMore: false, nextOffset: 0 };
  const offset = message.offset ?? 0;

  try {
    const page = await (
      await activeAuthService()
    ).withAccessToken(async (accessToken) => {
      const provider = await providerRegistry.createActiveProvider(accessToken);
      return provider.searchAnime(parsed.kind === 'tag' ? (parsed.values[0] ?? '') : parsed.value, {
        limit: ANIME_SEARCH_PAGE_SIZE,
        offset,
        tags: parsed.kind === 'tag' ? parsed.values : null,
        formats: message.formats ?? [],
      });
    });
    return {
      ok: true,
      results: page.results,
      hasMore: page.hasMore,
      nextOffset: offset + ANIME_SEARCH_PAGE_SIZE,
    };
  } catch (error) {
    reportBackgroundFailure(error);
    return { ok: false, message: await toUserFacingSearchError(error) };
  }
}

async function fetchCandidatePool(clusters: TasteClusters): Promise<readonly Anime[]> {
  const pool = await (
    await activeAuthService()
  ).withAccessToken(async (accessToken) => {
    const provider = await providerRegistry.createActiveProvider(accessToken);

    const degrade = async <T>(
      load: () => Promise<readonly T[]> | undefined,
    ): Promise<{ readonly items: readonly T[]; readonly failed: boolean }> => {
      try {
        return { items: (await load()) ?? [], failed: false };
      } catch (error) {
        reportBackgroundFailure(error);
        return { items: [], failed: true };
      }
    };

    const config = provider.candidatePoolConfig ?? DEFAULT_CANDIDATE_POOL_CONFIG;
    const tasteLimit = config.tasteLimit ?? DEFAULT_TASTE_POOL_LIMIT;
    const [suggested, ranked, deepRanked, tasteDerived] = await Promise.all([
      degrade<Anime>(() => provider.getAnimeSuggestions?.(config.suggestionLimit)),
      degrade<Anime>(() => provider.getAnimeRanking?.(config.rankingLimit, config.rankingOffset)),
      degrade<Anime>(() =>
        provider.getAnimeRanking?.(
          config.rankingLimit,
          config.rankingOffset + config.rankingLimit * 4,
        ),
      ),
      degrade<Anime>(() => fetchTasteDerived(provider, clusters, tasteLimit)),
    ]);

    // A source returning nothing is normal; a source that threw is a provider outage. Treating the
    // second like the first turns an outage into a cached, nearly-empty dashboard with no error shown.
    if (suggested.failed && ranked.failed && deepRanked.failed && tasteDerived.failed) {
      throw new Error('Every candidate source failed for the active provider.');
    }

    const merged: Anime[] = [];
    const seen = new Set<number>();
    for (const batch of [suggested.items, ranked.items, deepRanked.items, tasteDerived.items]) {
      for (const anime of batch) {
        if (seen.has(anime.id)) continue;
        seen.add(anime.id);
        merged.push(anime);
      }
    }
    return merged;
  });
  return pool;
}

async function fetchTasteDerived(
  provider: AnimeProvider,
  clusters: TasteClusters,
  limit: number,
): Promise<readonly Anime[]> {
  if (provider.getAnimeByTags === undefined || clusters.clusters.length === 0) return [];
  const batches = await Promise.all(
    clusters.clusters.map(
      async (cluster) => (await provider.getAnimeByTags?.(cluster, limit)) ?? [],
    ),
  );
  return batches.flat();
}

async function loadCandidatePool(
  providerId: ProviderId,
  clusters: TasteClusters,
): Promise<readonly Anime[]> {
  const poolKey = clusters.seed.length === 0 ? providerId : `${providerId}:${clusters.seed}`;
  const cached = await candidatePoolStore.load(poolKey, Date.now());
  if (cached !== null) return cached;

  if (candidatePoolInFlight !== null && candidatePoolInFlight.poolKey === poolKey) {
    return candidatePoolInFlight.request;
  }

  const request = (async () => fetchCandidatePool(clusters))();
  candidatePoolInFlight = { poolKey, request };

  try {
    // Propagated on purpose: an empty-but-ready dashboard hides a provider outage, and an empty pool
    // signature would also be cached for the whole TTL.
    const pool = await request;

    if (pool.length > 0) {
      await candidatePoolStore.save(poolKey, pool, Date.now());
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
      snapshot: createEmptyDashboardRecommendationSnapshot(null, preferences.includeHiddenGems),
    };
  }

  const providerId = await providerRegistry.registry.getActiveProvider();
  const watched = stored.entries.filter((entry) => entry.status !== 'plan_to_watch');
  const clusters = buildTasteClusters(buildUserPreferenceProfile(watched, feedback));
  let pool: readonly Anime[];
  try {
    pool = await loadCandidatePool(providerId, clusters);
  } catch (error) {
    reportBackgroundFailure(error);
    // Surfacing this as an error keeps the dashboard off a cached empty pool instead of rendering a
    // handful of plan-to-watch titles as if that were the recommendation set.
    return { ok: false, message: await toUserFacingRecommendationError(error) };
  }
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

async function recordProfileBaseline(): Promise<void> {
  try {
    const current = await buildCurrentProfileSummary();
    if (current === null || !current.summary.hasData) return;
    await profileHistoryStore.record(current.providerId, current.summary);
  } catch (error) {
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
        recap: null,
        errorMessage: null,
      },
    };
  }
  const snapshot = toStoredProfileSnapshot(
    current.summary,
    current.providerId,
    new Date().toISOString(),
  );
  const history = historyCleared ? [] : await profileHistoryStore.list(current.providerId);
  const previous = history[0] ?? null;
  return {
    ok: true,
    snapshot: {
      status: current.summary.hasData ? 'ready' : 'empty',
      summary: current.summary,
      delta: diffProfileSnapshots(previous, snapshot),
      recap: computeWeeklyRecap([snapshot, ...history]),
      errorMessage: null,
    },
  };
}

async function readExportedStorage(): Promise<DataExportSource> {
  const values = await chrome.storage.local.get(EXPORTED_STORAGE_KEYS);
  return values as DataExportSource;
}

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
    return;
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
    // The token is optional: omitting it asks the worker to reuse the one it captured itself, which
    // is what keeps the secret out of the popup entirely.
    const token = (value as { token?: unknown }).token;
    return (
      'providerId' in value &&
      isProviderId((value as { providerId: unknown }).providerId) &&
      (token === undefined || typeof token === 'string')
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

// A dashboard that cannot reach its provider is a different failure from a search that returns
// nothing, and reusing the search copy here would promise a retry that never helps.
async function toUserFacingRecommendationError(error: unknown): Promise<string> {
  const copy = getCopy(await currentLanguage());
  if (error instanceof ApiError && error.code === 'network_error') return copy.recommendationsError;
  return copy.recommendationsUnavailable;
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
