import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AuthPhaseFailureError, isAuthServiceUnavailableError } from '../auth/auth-messages';
import type { AuthSnapshot } from '../auth/auth-types';
import type { DislikeReason, FeedbackValue } from '../domain/feedback';
import { submitRecommendationFeedback } from '../feedback/feedback-messages';
import { requestAuthSnapshot, requestProviderList } from '../auth/auth-messages';
import { requestSync, requestSyncSnapshot } from '../sync/sync-messages';
import type { SyncSnapshot } from '../sync/sync-messages';
import { Icon, Modal, Button, Toast } from './components/ui';
import { applyThemePreference } from '../settings/theme';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../settings/settings-types';
import { isUsagePending, type UsageEvent } from '../profile/usage-streak';
import { useUsageSession } from './usage-session';
import { getCopy, normalizeLanguage, type AppCopy, type Language } from '../locales';
import { requestSettingsSnapshot, updateSettings } from '../settings/settings-messages';
import {
  requestUpdateCheck,
  requestUpdateDownload,
  requestUpdateReleasePage,
} from '../updates/update-messages';
import type { UpdateSnapshot } from '../updates/update-checker';
import { DetailPage, DashboardPage, LoadingPage, ProfilePage, SettingsPage } from './pages';
import type { AnimeCardData } from './components/anime';
import type { PageId } from './pages';
import { PAGE_EXIT_MS, transitionDirection, type PageTransition } from './page-transition';

interface NavItem {
  readonly id: PageId;
  readonly icon: 'home' | 'sparkles' | 'user' | 'settings';
  readonly label: (copy: AppCopy) => string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', icon: 'home', label: (copy) => copy.discover },
  { id: 'profile', icon: 'user', label: (copy) => copy.profile },
  { id: 'settings', icon: 'settings', label: (copy) => copy.settings },
];

const NAV_PAGE_ORDER: readonly PageId[] = NAV_ITEMS.map((item) => item.id);

function DislikeReasonModal({
  anime,
  onCancel,
  onSubmit,
  copy,
}: {
  readonly anime: AnimeCardData;
  readonly copy: AppCopy;
  readonly onCancel: () => void;
  readonly onSubmit: (reasons: readonly DislikeReason[]) => void;
}) {
  const [selectedReasons, setSelectedReasons] = useState<readonly DislikeReason[]>([]);
  const featureReasons = [
    ...anime.themes.slice(0, 1).map((item) => ({
      kind: 'theme' as const,
      name: item.name,
      label: copy.dislikeTheme(item.name),
    })),
    ...anime.genres.slice(0, 1).map((item) => ({
      kind: 'genre' as const,
      name: item.name,
      label: copy.dislikeGenre(item.name),
    })),
  ];
  const options: readonly {
    readonly kind: DislikeReason['kind'];
    readonly name?: string;
    readonly label: string;
  }[] = [...featureReasons, { kind: 'general' as const, label: copy.dislikeGeneral }].slice(0, 3);

  const toggleReason = (reason: DislikeReason) => {
    setSelectedReasons((current) => {
      const isSelected = current.some(
        (item) => item.kind === reason.kind && item.name === reason.name,
      );
      return isSelected
        ? current.filter((item) => item.kind !== reason.kind || item.name !== reason.name)
        : [...current, reason];
    });
  };

  return (
    <Modal open title={copy.dislikeTitle} onClose={onCancel} closeLabel={copy.closeLabel}>
      <p className="modal-copy">{copy.dislikeDescription}</p>

      <div className="dislike-reason-options" role="group" aria-label={copy.dislikeReasons}>
        {options.map((option) => {
          const reason: DislikeReason = { kind: option.kind, name: option.name };
          const selected = selectedReasons.some(
            (item) => item.kind === reason.kind && item.name === reason.name,
          );
          return (
            <label
              className={`dislike-reason-option${selected ? ' is-selected' : ''}`}
              key={`${option.kind}-${option.name ?? 'general'}`}
            >
              <input type="checkbox" checked={selected} onChange={() => toggleReason(reason)} />

              <span>{option.label}</span>
            </label>
          );
        })}
      </div>

      <div className="confirmation-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {copy.cancel}
        </Button>

        <Button
          variant="danger"
          size="sm"
          disabled={selectedReasons.length === 0}
          onClick={() => onSubmit(selectedReasons)}
        >
          {copy.send}
        </Button>
      </div>
    </Modal>
  );
}

export function App() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [transition, setTransition] = useState<PageTransition | null>(null);
  const exitTimer = useRef<number | null>(null);
  const [selectedAnime, setSelectedAnime] = useState<AnimeCardData | undefined>();
  const scrollPositions = useRef<Partial<Record<PageId, number>>>({
    dashboard: 0,
    profile: 0,
    settings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | undefined>();
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [auth, setAuth] = useState<AuthSnapshot>({
    status: 'signed_out',
    profile: null,
    errorCode: null,
    errorMessage: null,
  });
  const [recommendationsRevision, setRecommendationsRevision] = useState(0);
  const [pendingDislike, setPendingDislike] = useState<AnimeCardData | null>(null);
  const [update, setUpdate] = useState<UpdateSnapshot | null>(null);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  // The usage streak is written back, so it must not start until the stored streak has been read.
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState('MyAnimeList');
  const copy = getCopy(language);
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
    document.documentElement.lang = language;
  }, [copy, language]);

  const refreshActiveProviderName = () => {
    void requestProviderList()
      .then((providers) => {
        const active = providers.find((provider) => provider.active);
        if (active !== undefined) setActiveProviderName(active.displayName);
      })
      .catch(() => undefined);
  };
  useEffect(() => {
    refreshActiveProviderName();
  }, [auth.status]);
  const [sync, setSync] = useState<SyncSnapshot>({
    metadata: {
      status: 'idle',
      phase: null,
      progress: null,
      lastSyncedAt: null,
      itemCount: 0,
      nextPageUrl: null,
      errorCode: null,
      errorMessage: null,
      fromCache: false,
    },
    progress: null,
  });

  useEffect(() => {
    let cleanupTheme = applyThemePreference(DEFAULT_USER_PREFERENCES.theme);
    let disposed = false;
    void requestSettingsSnapshot()
      .then((snapshot) => {
        if (disposed) return;
        cleanupTheme();
        cleanupTheme = applyThemePreference(snapshot.preferences.theme);
        setLanguage(normalizeLanguage(snapshot.preferences.language));
        setPreferences(snapshot.preferences);
        setPreferencesLoaded(true);
      })
      .catch(() => undefined);

    const timer = window.setTimeout(() => setLoading(false), 550);
    void requestUpdateCheck()
      .then((snapshot) => {
        if (!disposed) setUpdate(snapshot);
      })
      .catch(() => undefined);
    void requestAuthSnapshot('auth.get_snapshot')
      .then((snapshot) => {
        if (disposed) return;
        setAuth(snapshot);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setAuth((current) => ({
          ...current,
          status: 'error',
          errorCode: 'unknown',
          errorMessage: error instanceof Error ? error.message : copyRef.current.authUnavailable,
        }));
      });
    void requestSyncSnapshot()
      .then((snapshot) => {
        if (!disposed) setSync(snapshot);
      })
      .catch(() => undefined);
    const syncTimer = window.setInterval(() => {
      void requestSyncSnapshot()
        .then((snapshot) => {
          if (!disposed) setSync(snapshot);
        })
        .catch(() => undefined);
    }, 750);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      disposed = true;
      cleanupTheme();
    };
  }, []);

  useLayoutEffect(() => {
    if (loading) return;
    window.scrollTo(0, scrollPositions.current[page] ?? 0);
  }, [loading, page]);

  const rememberScrollPosition = (currentPage: PageId) => {
    if (currentPage === 'dashboard' || currentPage === 'profile' || currentPage === 'settings') {
      scrollPositions.current[currentPage] = window.scrollY;
    }
  };

  // The outgoing page stays mounted and in normal flow while it slides out, so the swap is
  // invisible at the moment both pages are fully transparent and the document height can change.
  const beginTransition = (nextPage: PageId) => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    const direction = transitionDirection(page, nextPage, NAV_PAGE_ORDER);
    setTransition({ direction, phase: 'exit', to: nextPage });
    exitTimer.current = window.setTimeout(() => {
      setPage(nextPage);
      setTransition({ direction, phase: 'enter', to: nextPage });
      exitTimer.current = null;
    }, PAGE_EXIT_MS);
  };

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  const navigate = (nextPage: PageId) => {
    if (nextPage === page) return;
    rememberScrollPosition(page);
    beginTransition(nextPage);
  };
  const selectAnime = (anime: AnimeCardData) => {
    rememberScrollPosition(page);
    setSelectedAnime(anime);
    beginTransition('detail');
  };
  const showToast = (message: string) => setToast(message);

  // Only the day boundary and the warm-up towards it need a write, so an ordinary session is silent.
  const recordUsageEvent = (event: UsageEvent) => {
    const now = Date.now();
    if (!event.countedDay && !isUsagePending(event.streak, now)) return;
    setPreferences((current) => {
      const preferences = { ...current, usageStreak: event.streak };
      void updateSettings(preferences).catch(() => undefined);
      return preferences;
    });
    if (event.xpAwarded > 0) showToast(copy.streakXpAwarded(event.xpAwarded));
  };
  useUsageSession({
    streak: preferences.usageStreak,
    enabled: preferencesLoaded,
    onEvent: recordUsageEvent,
  });
  const startUpdateDownload = () => {
    if (downloadingUpdate) return;
    setDownloadingUpdate(true);
    void requestUpdateDownload()
      .then(() => showToast(copy.updateStarted))
      .catch(() => showToast(copy.updateFailed))
      .finally(() => setDownloadingUpdate(false));
  };
  const openUpdateReleasePage = () => {
    void requestUpdateReleasePage().catch(() => showToast(copy.updateFailed));
  };
  const handleRecommendationFeedback = (
    anime: AnimeCardData,
    value: FeedbackValue,
    reasons: readonly DislikeReason[] = [],
  ) => {
    if (value === 'dislike' && reasons.length === 0) {
      setPendingDislike(anime);
      return;
    }
    void submitRecommendationFeedback(`local-${anime.id}`, anime, value, reasons)
      .then(() => {
        const messages: Record<FeedbackValue, string> = {
          like: copy.savedPreference,
          dislike: copy.savedPreference,
          seen: copy.savedPreference,
          not_now: copy.savedPreference,
        };
        showToast(messages[value]);
        setRecommendationsRevision((current) => current + 1);
      })
      .catch(() => showToast(copy.recommendationsError));
  };

  const submitDislike = (reasons: readonly DislikeReason[]) => {
    const anime = pendingDislike;
    if (anime === null || reasons.length === 0) return;
    setPendingDislike(null);
    handleRecommendationFeedback(anime, 'dislike', reasons);
  };
  const syncNow = () => {
    void requestSync('manual')
      .then((snapshot) => {
        setSync(snapshot);
        setRecommendationsRevision((current) => current + 1);
      })
      .catch(() => showToast(copy.syncUnavailable));
  };

  const authAction = (action: 'connect' | 'disconnect') => {
    setAuth((current) => ({
      ...current,
      status: action === 'connect' ? 'authorizing' : current.status,
      errorMessage: null,
      errorCode: null,
      phase: undefined,
    }));
    void requestAuthSnapshot(action === 'connect' ? 'auth.connect' : 'auth.disconnect')
      .then((snapshot) => {
        setAuth(snapshot);
        if (snapshot.status === 'authenticated') {
          showToast(copy.providerConnectedToast(activeProviderName));
          syncNow();
        }
        if (snapshot.status === 'signed_out') {
          showToast(copy.providerDisconnectedToast(activeProviderName));
        }
      })
      .catch((error: unknown) => {
        const message = isAuthServiceUnavailableError(error)
          ? copy.authUnavailable
          : error instanceof AuthPhaseFailureError
            ? error.message
            : error instanceof Error
              ? error.message
              : copy.actionImpossible;
        const phase =
          error instanceof AuthPhaseFailureError
            ? error.phase
            : error instanceof Error &&
                'phase' in error &&
                typeof (error as { phase?: unknown }).phase === 'string'
              ? (error as { phase: 'token_exchange' | 'profile_fetch' }).phase
              : undefined;
        setAuth({
          status: 'error',
          profile: null,
          errorCode: phase === 'token_exchange' ? 'token_exchange' : 'unknown',
          errorMessage: message,
          phase,
        });
      });
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        {' '}
        <button
          className="brand"
          type="button"
          onClick={() => navigate('dashboard')}
          aria-label={`${copy.discover} · ${copy.brandWordmark}`}
        >
          <img className="brand-icon" src="icons/icon32.png" alt="" aria-hidden="true" />
          <span className="brand-name">{copy.brandWordmark}</span>

          <span className="brand-badge">{copy.betaBadge}</span>
        </button>
        <span className={`connection-status${isOnline ? '' : ' is-offline'}`}>
          <span />
          {isOnline ? copy.live : copy.offline}
        </span>
      </header>

      {!loading && update?.status === 'available' && update.releaseUrl !== null && (
        <div className="update-banner" role="status">
          <div>
            <strong>{copy.updateAvailable(update.latestVersion ?? '')}</strong>

            <span>{copy.currentVersion(update.currentVersion)}</span>
          </div>

          <div className="update-banner-actions">
            <button className="update-banner-notes" type="button" onClick={openUpdateReleasePage}>
              {copy.updateReleaseNotes}
            </button>

            <button
              className="update-banner-action"
              type="button"
              disabled={downloadingUpdate}
              onClick={startUpdateDownload}
            >
              {downloadingUpdate ? copy.updateDownloading : copy.update}
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingPage />
      ) : (
        <div
          className="page-transition"
          data-phase={transition?.phase}
          data-direction={transition?.direction}
        >
          {page === 'dashboard' ? (
            <DashboardPage
              onNavigate={navigate}
              onSelectAnime={selectAnime}
              onFeedback={showToast}
              onRecommendationFeedback={handleRecommendationFeedback}
              recommendationsRevision={recommendationsRevision}
              isOnline={isOnline}
              auth={auth}
              onAuthAction={authAction}
              sync={sync}
              onSync={syncNow}
              activeProviderName={activeProviderName}
              copy={copy}
            />
          ) : page === 'profile' ? (
            <ProfilePage
              onNavigate={navigate}
              onSelectAnime={selectAnime}
              onFeedback={showToast}
              auth={auth}
              activeProviderName={activeProviderName}
              preferences={preferences}
              onPreferencesChange={setPreferences}
              copy={copy}
            />
          ) : page === 'settings' ? (
            <SettingsPage
              onNavigate={navigate}
              onSelectAnime={selectAnime}
              onFeedback={showToast}
              onProvidersChanged={refreshActiveProviderName}
              onAuthSnapshot={setAuth}
              onPreferencesChanged={(next) => {
                if (next !== undefined) {
                  setLanguage(normalizeLanguage(next.language));
                  setPreferences(next);
                }
                setRecommendationsRevision((current) => current + 1);
              }}
              onSync={syncNow}
              copy={copy}
            />
          ) : (
            <DetailPage
              anime={selectedAnime ?? null}
              onNavigate={navigate}
              onSelectAnime={selectAnime}
              onFeedback={showToast}
              onRecommendationFeedback={handleRecommendationFeedback}
              auth={auth}
              onMalListChanged={() => setRecommendationsRevision((current) => current + 1)}
              copy={copy}
            />
          )}
        </div>
      )}
      {!loading && page !== 'detail' && (
        <nav className="bottom-nav" aria-label={copy.discover}>
          {NAV_ITEMS.map((item) => (
            <button
              className={(transition?.to ?? page) === item.id ? 'is-active' : ''}
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={16} />

              <span>{item.label(copy)}</span>
            </button>
          ))}
        </nav>
      )}
      {pendingDislike !== null && (
        <DislikeReasonModal
          anime={pendingDislike}
          copy={copy}
          onCancel={() => setPendingDislike(null)}
          onSubmit={submitDislike}
        />
      )}
      {toast !== undefined && (
        <Toast
          message={toast}
          onClose={() => setToast(undefined)}
          dismissLabel={copy.dismissNotificationLabel}
        />
      )}
    </main>
  );
}
