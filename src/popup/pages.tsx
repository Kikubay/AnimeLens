import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthSnapshot } from '../auth/auth-types';
import type { UserProfile } from '../domain/user-profile';
import { addAnimeToMalList } from '../api/mal-list-messages';
import type { SyncSnapshot } from '../sync/sync-messages';
import {
  requestDashboardRecommendations,
  type DashboardRecommendationSnapshot,
} from '../recommendations/recommendation-messages';
import type { RecommendationSectionId } from '../recommendations/recommendation-messages';
import type { Recommendation } from '../domain/recommendation';
import type { FeedbackValue } from '../domain/feedback';
import type { DislikeReason } from '../domain/feedback';
import { requestProfileSnapshot } from '../profile/profile-messages';
import type { ProfileSnapshot, UserProfileSummary } from '../profile/profile-types';
import {
  buildTasteCardModel,
  layoutAfterCardClose,
  shouldRenderTopPicks,
  tasteCardRenderOptions,
  type TasteCardRenderOptions,
  type TasteCardPicksLayout,
} from '../profile/taste-card-types';
import { applyManualRanking, type TopPickCandidate } from '../profile/top-picks';
import {
  clearTopPicksRanking,
  requestTopPicksRanking,
  saveTopPicksRanking,
} from '../profile/top-picks-messages';
import {
  clearLocalCache,
  deleteLocalData,
  requestSettingsSnapshot,
  updateAnilistClientId,
  updateMalClientId,
  updateSettings,
} from '../settings/settings-messages';
import {
  completeAniListPinSignIn,
  connectProvider,
  disconnectProvider,
  setActiveProvider,
} from '../auth/auth-messages';
import type { ProviderId } from '../auth/auth-types';
import type { ProviderStatusView } from '../settings/settings-types';
import {
  DEFAULT_USER_PREFERENCES,
  persistableTasteCardPicksLayout,
  normalizeSettingsText,
  type ThemePreference,
  type UserPreferences,
} from '../settings/settings-types';
import { applyThemePreference } from '../settings/theme';
import { categoryLabel, type AppCopy } from '../locales';
import { MAL_GENRE_NAMES, MAL_THEME_NAMES } from '../api/mal-taxonomy';
import type { AnimeCardData } from './components/anime';
import { AnimeGrid, FeaturedAnime } from './components/anime';
import { TasteCardModal } from './components/taste-card-modal';
import { TopPicksModal } from './components/top-picks-modal';
import { GridPickerModal } from './components/grid-picker-modal';
import {
  Badge,
  Button,
  Card,
  CompatibilityScore,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Modal,
  Progress,
  Rating,
  Skeleton,
} from './components/ui';

export type PageId = 'dashboard' | 'detail' | 'profile' | 'settings';

/** Section titles are generated in the background (English only); localize them at render time. */
function sectionTitle(id: RecommendationSectionId, copy: AppCopy): string {
  switch (id) {
    case 'highly-compatible':
      return copy.sectionHighlyCompatible;
    case 'because-you-liked':
      return copy.sectionBecauseYouLiked;
    case 'hidden-gem':
      return copy.sectionHiddenGems;
    default:
      return copy.sectionExplore;
  }
}

interface PageProps {
  readonly onNavigate: (page: PageId) => void;
  readonly onSelectAnime: (anime: AnimeCardData) => void;
  readonly onFeedback: (message: string) => void;
  readonly onRecommendationFeedback?: (
    anime: AnimeCardData,
    value: FeedbackValue,
    reasons?: readonly DislikeReason[],
  ) => void;
  readonly onSync?: () => void;
  readonly auth?: AuthSnapshot;
  readonly onMalListChanged?: () => void;
  readonly onAuthSnapshot?: (snapshot: AuthSnapshot) => void;
  readonly onPreferencesChanged?: (preferences: UserPreferences) => void;
  /** Display name of the active provider, surfaced on the taste card. */
  readonly activeProviderName?: string;
  readonly preferences?: UserPreferences;
  /** Applies a preference patch and persists it. */
  readonly onPreferencesChange?: (preferences: UserPreferences) => void;
  readonly copy: AppCopy;
}

interface DashboardPageProps extends PageProps {
  readonly recommendationsRevision?: number;
  readonly isOnline: boolean;
  readonly auth: AuthSnapshot;
  readonly onAuthAction: (action: 'connect' | 'disconnect') => void;
  readonly sync: SyncSnapshot;
  /** Display name of the active provider, for provider-aware copy. */
  readonly activeProviderName: string;
}

export function DashboardPage({
  onSelectAnime,
  auth,
  onAuthAction,
  sync,
  onSync,
  onRecommendationFeedback,
  recommendationsRevision = 0,
  copy,
  isOnline,
  activeProviderName,
}: DashboardPageProps) {
  const requestSequence = useRef(0);
  const disposed = useRef(false);
  const [snapshot, setSnapshot] = useState<DashboardRecommendationSnapshot>({
    status: 'loading',
    daily: null,
    sections: [],
    analyzedCount: 0,
    generatedAt: null,
    sync: null,
    errorMessage: null,
  });

  const loadRecommendations = useCallback(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setSnapshot((current) => ({ ...current, status: 'loading', errorMessage: null }));
    void requestDashboardRecommendations()
      .then((nextSnapshot) => {
        if (!disposed.current && sequence === requestSequence.current) setSnapshot(nextSnapshot);
      })
      .catch((error: unknown) => {
        if (disposed.current || sequence !== requestSequence.current) return;
        setSnapshot((current) => ({
          ...current,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : copy.recommendationsUnavailable,
        }));
      });
  }, [copy.recommendationsUnavailable]);

  useEffect(() => {
    disposed.current = false;
    loadRecommendations();
    return () => {
      disposed.current = true;
      requestSequence.current += 1;
    };
  }, [recommendationsRevision, loadRecommendations]);

  useEffect(() => {
    if (sync.metadata.status === 'success' || sync.metadata.status === 'offline') {
      loadRecommendations();
    }
  }, [sync.metadata.status, sync.metadata.lastSyncedAt, loadRecommendations]);

  const toCardData = (recommendation: Recommendation): AnimeCardData => ({
    ...recommendation.anime,
    compatibility: recommendation.compatibilityScore,
    recommendation: recommendation.reasons[0]?.label ?? copy.exploreLead,
    reasons: recommendation.reasons,
    category: recommendation.category,
  });
  const daily = snapshot.daily === null ? null : toCardData(snapshot.daily);
  const sections = snapshot.sections.map((section) => ({
    ...section,
    title: sectionTitle(section.id, copy),
    recommendations: section.recommendations.map(toCardData),
  }));

  const displayStatus = !isOnline && daily !== null ? 'offline' : snapshot.status;

  return (
    <div className="page-content dashboard-page">
      <section className="welcome-block dashboard-hero" aria-labelledby="dashboard-title">
        <p className="eyebrow">{copy.dashboardEyebrow}</p>
        <h2 id="dashboard-title">
          {copy.hello} <span aria-hidden="true">👋</span>
        </h2>
        <p>{copy.dashboardIntro}</p>
        <div className="auth-strip" aria-live="polite">
          {auth.status === 'authenticated' && auth.profile !== null ? (
            <span className="auth-strip-status">
              <span className="status-dot is-online" aria-hidden="true" />
              {auth.profile.username} · {copy.providerListConnected(activeProviderName)}
            </span>
          ) : auth.status === 'authorizing' || auth.status === 'exchanging' ? (
            <span className="auth-strip-status is-progress">
              <span className="status-dot is-online" aria-hidden="true" />
              {auth.status === 'authorizing'
                ? copy.providerAuthenticating(activeProviderName)
                : copy.finalizingAccount}
            </span>
          ) : (
            <>
              <span className="auth-strip-copy">
                {copy.providerConnectSignals(activeProviderName)}
              </span>
              <Button variant="secondary" size="sm" onClick={() => onAuthAction('connect')}>
                {copy.providerConnectAction(activeProviderName)}
              </Button>
            </>
          )}
        </div>
        {auth.errorMessage !== null && (
          <p className="auth-error" role="alert">
            {copy.authErrorMessage(auth.errorCode, auth.errorMessage)}
          </p>
        )}
        {auth.phase === 'token_exchange' && (
          <p className="auth-hint" role="status">
            {copy.authHint}
          </p>
        )}
        <SyncStatusPanel
          sync={sync}
          onSync={onSync ?? (() => undefined)}
          isAuthenticated={auth.status === 'authenticated'}
          providerName={activeProviderName}
          copy={copy}
        />
      </section>

      {displayStatus === 'loading' ? (
        <DashboardLoadingState copy={copy} />
      ) : displayStatus === 'error' ? (
        <ErrorState
          title={copy.recommendationsUnavailable}
          message={snapshot.errorMessage ?? copy.recommendationsError}
          action={
            <Button size="sm" variant="secondary" onClick={loadRecommendations}>
              {copy.retry}
            </Button>
          }
        />
      ) : displayStatus === 'empty' || daily === null ? (
        <EmptyState
          title={copy.selectionPreparing}
          message={
            auth.status === 'authenticated'
              ? copy.providerSyncListFirst(activeProviderName)
              : copy.providerConnectToAnalyze(activeProviderName)
          }
          action={
            auth.status === 'authenticated' ? (
              <Button size="sm" variant="secondary" onClick={onSync}>
                {copy.synchronize}
              </Button>
            ) : (
              <Button size="sm" onClick={() => onAuthAction('connect')}>
                {copy.providerConnectAction(activeProviderName)}
              </Button>
            )
          }
        />
      ) : (
        <>
          {displayStatus === 'offline' && (
            <div className="offline-banner" role="status">
              <span className="status-dot is-offline" aria-hidden="true" />
              {copy.offlineRecommendations}
            </div>
          )}
          <section className="dashboard-daily" aria-labelledby="daily-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy.todayPick}</p>
                <h2 id="daily-title">{copy.recommendationOfTheDay}</h2>
              </div>
              {snapshot.analyzedCount > 0 && (
                <Badge tone="success">{copy.analyzed(snapshot.analyzedCount)}</Badge>
              )}
            </div>
            <FeaturedAnime
              anime={daily}
              onSelect={onSelectAnime}
              onRecommendationFeedback={onRecommendationFeedback}
              copy={copy}
            />
          </section>
          {sections.map((section) => (
            <RecommendationSectionView
              key={section.id}
              title={section.title}
              recommendations={section.recommendations}
              onSelect={onSelectAnime}
              onRecommendationFeedback={onRecommendationFeedback}
              copy={copy}
            />
          ))}
        </>
      )}
    </div>
  );
}

function RecommendationSectionView({
  title,
  recommendations,
  onSelect,
  onRecommendationFeedback,
  copy,
}: {
  readonly title: string;
  readonly recommendations: readonly AnimeCardData[];
  readonly onSelect: (anime: AnimeCardData) => void;
  readonly onRecommendationFeedback?: (
    anime: AnimeCardData,
    value: FeedbackValue,
    reasons?: readonly DislikeReason[],
  ) => void;
  readonly copy: AppCopy;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const hasOverflow = recommendations.length > 3;

  const updateScrollState = () => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    setScrollState({
      canScrollLeft: viewport.scrollLeft > 1,
      canScrollRight: maxScrollLeft - viewport.scrollLeft > 1,
    });
  };

  useEffect(() => {
    updateScrollState();
  }, [recommendations.length]);

  const scrollByPage = (direction: -1 | 1) => {
    viewportRef.current?.scrollBy({
      left: direction * (viewportRef.current.clientWidth || 0),
      behavior: 'smooth',
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (!hasOverflow) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const edgeSize = Math.min(48, bounds.width * 0.16);
    const position = event.clientX - bounds.left;
    setHoveredEdge(
      position <= edgeSize ? 'left' : position >= bounds.width - edgeSize ? 'right' : null,
    );
  };

  return (
    <section className="recommendation-section" aria-labelledby={`section-${title}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{copy.curatedSignal}</p>
          <h2 id={`section-${title}`}>{title}</h2>
        </div>
        <span className="section-count">{copy.titles(recommendations.length)}</span>
      </div>
      {recommendations.length === 0 ? (
        <div className="section-empty-state">
          <span>{copy.noTitles}</span>
        </div>
      ) : (
        <div
          className={`recommendation-carousel${hasOverflow ? ' has-overflow' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredEdge(null)}
        >
          <div
            className="recommendation-carousel-viewport"
            ref={viewportRef}
            onScroll={updateScrollState}
          >
            <AnimeGrid
              anime={recommendations}
              onSelect={onSelect}
              onRecommendationFeedback={onRecommendationFeedback}
              copy={copy}
            />
          </div>
          {hasOverflow && scrollState.canScrollLeft && hoveredEdge === 'left' && (
            <button
              className="carousel-arrow carousel-arrow-left"
              type="button"
              aria-label={copy.previousTitles(title)}
              onClick={() => scrollByPage(-1)}
            >
              &lt;
            </button>
          )}
          {hasOverflow && scrollState.canScrollRight && hoveredEdge === 'right' && (
            <button
              className="carousel-arrow carousel-arrow-right"
              type="button"
              aria-label={copy.nextTitles(title)}
              onClick={() => scrollByPage(1)}
            >
              &gt;
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DashboardLoadingState({ copy }: { readonly copy: AppCopy }) {
  return (
    <div className="dashboard-loading" aria-label={copy.loadingRecommendations}>
      <Skeleton className="skeleton-featured" />
      <Skeleton className="skeleton-line" />
      <div className="skeleton-grid">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  );
}

function SyncStatusPanel({
  sync,
  onSync,
  isAuthenticated,
  providerName,
  copy,
}: {
  readonly sync: SyncSnapshot;
  readonly onSync: () => void;
  readonly isAuthenticated: boolean;
  readonly providerName: string;
  readonly copy: AppCopy;
}) {
  const { metadata } = sync;
  const isSyncing = metadata.status === 'syncing';
  const hasData = metadata.itemCount > 0;
  const lastSyncedLabel = metadata.lastSyncedAt
    ? new Date(metadata.lastSyncedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="sync-panel" aria-live="polite">
      <div className="sync-panel-copy">
        <span
          className={`status-dot ${isSyncing ? 'is-online is-pulsing' : ''}`}
          aria-hidden="true"
        />
        <div>
          <strong>
            {isSyncing
              ? copy.analyzingList
              : hasData
                ? copy.cachedAnime(metadata.itemCount)
                : copy.providerListNotSynced(providerName)}
          </strong>
          <span>
            {metadata.fromCache && metadata.status === 'offline'
              ? copy.localData
              : lastSyncedLabel
                ? copy.lastSync(lastSyncedLabel)
                : isAuthenticated
                  ? copy.readyToImport
                  : copy.providerConnectToStart(providerName)}
          </span>
        </div>
      </div>
      <div className="sync-panel-actions">
        {metadata.status === 'error' && <span className="sync-error-text">{copy.syncFailed}</span>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={!isAuthenticated || isSyncing}
          aria-label={isSyncing ? copy.syncing : copy.synchronize}
        >
          {isSyncing ? copy.syncing : metadata.status === 'error' ? copy.retry : copy.synchronize}
        </Button>
      </div>
    </div>
  );
}

export function DetailPage({
  anime,
  onNavigate,
  onRecommendationFeedback,
  auth,
  onFeedback,
  onMalListChanged,
  copy,
}: PageProps & { readonly anime: AnimeCardData | null }) {
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isOnMalList, setIsOnMalList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setIsOnMalList(false);
    setListError(null);
  }, [anime?.id]);

  if (anime === null) {
    return (
      <div className="page-content detail-page">
        <button className="back-link" type="button" onClick={() => onNavigate('dashboard')}>
          <Icon name="chevron-left" size={15} /> {copy.backToRecommendations}
        </button>
        <EmptyState title={copy.animeNotFound} message={copy.recommendationUnavailable} />
      </div>
    );
  }

  const imageUrl = anime.image?.large ?? anime.image?.medium;
  const alternativeTitle = anime.title.english ?? anime.title.japanese ?? anime.title.synonyms[0];
  const isAniListEntry = anime.provider === 'anilist';
  const entryProviderName = isAniListEntry ? 'AniList' : 'MyAnimeList';
  const providerUrl = isAniListEntry
    ? `https://anilist.co/anime/${anime.id}`
    : `https://myanimelist.net/anime/${anime.id}`;
  const reasons = anime.reasons ?? [];
  const canUpdateMalList = auth?.status === 'authenticated';

  const addToPlanToWatch = () => {
    if (!canUpdateMalList || isAddingToList) return;
    setIsAddingToList(true);
    setListError(null);
    void addAnimeToMalList(anime.id)
      .then(() => {
        setIsOnMalList(true);
        onFeedback(copy.providerAddSuccess(entryProviderName));
        onMalListChanged?.();
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : copy.providerListError(entryProviderName);
        setListError(message);
      })
      .finally(() => setIsAddingToList(false));
  };

  return (
    <div className="page-content detail-page">
      <button className="back-link" type="button" onClick={() => onNavigate('dashboard')}>
        <Icon name="chevron-left" size={15} /> {copy.backToRecommendations}
      </button>
      <div className="detail-hero">
        <div
          className="detail-poster poster"
          style={{ '--poster-accent': anime.accent ?? '#8a7ecf' } as React.CSSProperties}
        >
          {imageUrl !== null && imageUrl !== undefined ? (
            <img
              className="anime-cover"
              src={imageUrl}
              alt={copy.coverAlt(anime.title.default)}
              decoding="async"
            />
          ) : (
            <>
              <span className="poster-orbit poster-orbit-one" />
              <span className="poster-orbit poster-orbit-two" />
              <span className="poster-label">{anime.posterLabel ?? anime.title.default}</span>
              <span className="poster-noise" />
            </>
          )}
        </div>
        <div>
          <Badge tone="accent">
            {anime.category === null || anime.category === undefined
              ? copy.recommendations
              : categoryLabel(copy, anime.category)}
          </Badge>
          <h2>{anime.title.default}</h2>
          {alternativeTitle !== undefined && (
            <p className="alternative-title">{alternativeTitle}</p>
          )}
          <p className="detail-lede">{anime.synopsis ?? copy.recommendationUnavailable}</p>
          <div className="detail-inline">
            {anime.score !== null && <Rating value={anime.score} copy={copy} />}
            <span>•</span>
            <span>
              {anime.episodeCount ?? '—'} {copy.episodeLabel}
            </span>
            {anime.year !== null && (
              <>
                <span>•</span>
                <span>{anime.year}</span>
              </>
            )}
            <span>•</span>
            <span>{anime.type.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <Card className="detail-info-card">
        <div className="detail-info-grid">
          <DetailInfo
            label={copy.genres}
            value={anime.genres.map((item) => item.name).join(' · ') || '—'}
          />
          <DetailInfo
            label={copy.themes}
            value={anime.themes.map((item) => item.name).join(' · ') || '—'}
          />
          <DetailInfo
            label={copy.studio}
            value={anime.studios.map((item) => item.name).join(' · ') || '—'}
          />
          <DetailInfo
            label={copy.providerScore(entryProviderName)}
            value={anime.score === null ? '—' : `${anime.score.toFixed(1)} / 10`}
          />
          <DetailInfo
            label={copy.episodes}
            value={anime.episodeCount === null ? '—' : String(anime.episodeCount)}
          />
          <DetailInfo label={copy.year} value={anime.year === null ? '—' : String(anime.year)} />
        </div>
      </Card>
      <Card className="why-card">
        <div className="why-card-heading">
          <span className="state-icon">
            <Icon name="sparkles" size={17} />
          </span>
          <div>
            <p className="eyebrow">{copy.recommendationWhy}</p>
            <h3>{copy.whyThisAnime}</h3>
          </div>
        </div>
        <div className="detail-reasons">
          {(reasons.length > 0
            ? reasons
            : [{ label: anime.recommendation, kind: 'discovery', weight: 0.5 }]
          ).map((reason) => (
            <div className="detail-reason" key={`${reason.kind}-${reason.label}`}>
              <Icon name="check" size={14} />
              <span>{reason.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="detail-score-row">
        <CompatibilityScore value={anime.compatibility} copy={copy} />
        <div>
          <p className="eyebrow">{copy.compatibility}</p>
          <h3>{anime.compatibility >= 80 ? copy.greatMatch : copy.exploreLead}</h3>
          <p>{copy.calculatedScore}</p>
        </div>
      </div>
      <div className="detail-actions detail-actions-primary">
        <Button
          icon="list"
          onClick={addToPlanToWatch}
          disabled={!canUpdateMalList || isAddingToList || isOnMalList}
          title={
            !canUpdateMalList
              ? copy.providerConnectToAdd(entryProviderName)
              : isOnMalList
                ? copy.alreadyInList
                : undefined
          }
        >
          {isAddingToList ? copy.adding : isOnMalList ? copy.alreadyInList : copy.addToList}
        </Button>
        <Button
          variant="secondary"
          icon="arrow-right"
          onClick={() => window.open(providerUrl, '_blank', 'noopener,noreferrer')}
        >
          {isAniListEntry ? copy.openOnAnilist : copy.openOnMal}
        </Button>
      </div>
      {listError !== null && (
        <p className="mal-list-error" role="alert">
          {listError}
        </p>
      )}
      {!canUpdateMalList && (
        <p className="mal-list-hint" role="status">
          {copy.providerConnectToAdd(entryProviderName)}
        </p>
      )}
      <div className="detail-actions detail-actions-feedback">
        <IconButton
          icon="thumbs-up"
          label={`${copy.like} ${anime.title.default}`}
          onClick={() => onRecommendationFeedback?.(anime, 'like')}
        />
        <IconButton
          icon="thumbs-down"
          label={`${copy.dislike}: ${anime.title.default}`}
          onClick={() => onRecommendationFeedback?.(anime, 'dislike')}
        />
        <IconButton
          icon="check"
          label={`${copy.seen}: ${anime.title.default}`}
          onClick={() => onRecommendationFeedback?.(anime, 'seen')}
        />
        <IconButton
          icon="moon"
          label={`${copy.notNow}: ${anime.title.default}`}
          onClick={() => onRecommendationFeedback?.(anime, 'not_now')}
        />
      </div>
      <button
        className="mal-link"
        type="button"
        onClick={() => window.open(providerUrl, '_blank', 'noopener,noreferrer')}
      >
        {isAniListEntry ? copy.viewAnilist : copy.viewMal}
      </button>
    </div>
  );
}

function DetailInfo({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="detail-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ProfilePage({
  onFeedback,
  auth,
  activeProviderName,
  preferences,
  onPreferencesChange,
  copy,
}: PageProps) {
  const requestSequence = useRef(0);
  const disposed = useRef(false);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot>({
    status: 'loading',
    summary: null,
    errorMessage: null,
  });

  const loadProfile = useCallback(() => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setSnapshot((current) => ({ ...current, status: 'loading', errorMessage: null }));
    void requestProfileSnapshot()
      .then((nextSnapshot) => {
        if (!disposed.current && sequence === requestSequence.current) setSnapshot(nextSnapshot);
      })
      .catch((error: unknown) => {
        if (disposed.current || sequence !== requestSequence.current) return;
        setSnapshot({
          status: 'error',
          summary: null,
          errorMessage: error instanceof Error ? error.message : copy.recommendationsUnavailable,
        });
      });
  }, [copy.recommendationsUnavailable]);

  useEffect(() => {
    disposed.current = false;
    loadProfile();
    return () => {
      disposed.current = true;
      requestSequence.current += 1;
    };
  }, [loadProfile]);

  if (snapshot.status === 'loading') return <ProfileLoadingPage />;
  if (snapshot.status === 'error') {
    return (
      <div className="page-content profile-page">
        <ErrorState
          title={copy.recommendationsUnavailable}
          message={snapshot.errorMessage ?? copy.recommendationsError}
          action={
            <Button size="sm" variant="secondary" onClick={loadProfile}>
              {copy.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (snapshot.status === 'empty' || snapshot.summary === null) {
    return (
      <div className="page-content profile-page">
        <div className="page-title">
          <p className="eyebrow">{copy.profileEyebrow}</p>
          <h2>{copy.animeProfile}</h2>
          <p>{copy.profileIntro}</p>
        </div>
        <EmptyState title={copy.profileNoData} message={copy.profileHint} />
      </div>
    );
  }

  return (
    <ProfileSummary
      summary={snapshot.summary}
      profile={auth?.profile ?? null}
      providerName={activeProviderName ?? null}
      preferences={preferences ?? DEFAULT_USER_PREFERENCES}
      onPreferencesChange={onPreferencesChange}
      onFeedback={onFeedback}
      onRefresh={loadProfile}
      copy={copy}
    />
  );
}

function ProfileSummary({
  summary,
  profile,
  providerName,
  preferences,
  onPreferencesChange,
  onFeedback,
  onRefresh,
  copy,
}: {
  readonly summary: UserProfileSummary;
  readonly profile: UserProfile | null;
  readonly providerName: string | null;
  readonly preferences: UserPreferences;
  readonly onPreferencesChange?: (preferences: UserPreferences) => void;
  readonly onFeedback: (message: string) => void;
  readonly onRefresh: () => void;
  readonly copy: AppCopy;
}) {
  const [isTasteCardOpen, setTasteCardOpen] = useState(false);
  const [isTopPicksOpen, setTopPicksOpen] = useState(false);
  const [isGridPickerOpen, setGridPickerOpen] = useState(false);
  const [isReranking, setReranking] = useState(false);
  const [isPreparingShare, setPreparingShare] = useState(false);
  /** Saved tie-break ranking, or `null` for the automatic order. */
  const [ranking, setRanking] = useState<readonly number[] | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const plan = summary.topPicks;
  // The 3x3 grid needs nine hand-picked entries that are never persisted, so it
  // lives in session state only; the stored preference can only be List or
  // Triangle. This mirrors that split.
  const [sessionLayout, setSessionLayout] = useState<TasteCardPicksLayout>(
    preferences.tasteCard.picksLayout,
  );
  const cardOptions = useMemo(
    () => ({ ...tasteCardRenderOptions(preferences.tasteCard), picksLayout: sessionLayout }),
    [preferences, sessionLayout],
  );
  const isGridLayout = cardOptions.picksLayout === 'grid';
  // Grid mode replaces the ranked Top 3 with a hand-picked nine, kept in
  // component state only: nothing about a collage is persisted.
  const [gridPicks, setGridPicks] = useState<readonly TopPickCandidate[]>([]);
  // Phase 5: the card renders the manual ranking when one applies, otherwise
  // the plan's own most-recently-updated resolution.
  const resolvedPicks = useMemo(
    () => (isGridLayout ? gridPicks : applyManualRanking(plan, ranking)),
    [gridPicks, isGridLayout, plan, ranking],
  );
  const tasteCardModel = useMemo(
    () => buildTasteCardModel(summary, profile, providerName, resolvedPicks),
    [summary, profile, providerName, resolvedPicks],
  );
  // Asking someone to break a tie for a section that will not be drawn is
  // pointless friction, so the picker is skipped when it is hidden. The grid has
  // its own selection flow, so the tie-breaker never applies to it.
  const shouldPromptForPicks =
    !isGridLayout && plan.needsChoice && shouldRenderTopPicks(tasteCardModel, cardOptions);

  const saveCardOptions = useCallback(
    (next: TasteCardRenderOptions) => {
      if (onPreferencesChange === undefined) return;
      setSessionLayout(next.picksLayout);
      // The grid is a session-only choice, so it is never written to storage —
      // otherwise the next visit would open onto an empty collage.
      const tasteCard = { ...next, picksLayout: persistableTasteCardPicksLayout(next.picksLayout) };
      onPreferencesChange({ ...preferences, tasteCard });
      void updateSettings({ ...preferences, tasteCard }).catch(() => undefined);
    },
    [onPreferencesChange, preferences],
  );

  // Phase 4 trigger: the picker only ever opens from this click, never on load.
  const openShareFlow = useCallback(() => {
    if (isPreparingShare) return;
    setPreparingShare(true);
    // Grid mode has its own flow: the user composes all nine boxes by hand.
    if (isGridLayout) {
      setGridPickerOpen(true);
      setPreparingShare(false);
      return;
    }
    if (!shouldPromptForPicks) {
      setTasteCardOpen(true);
      setPreparingShare(false);
      return;
    }
    void requestTopPicksRanking()
      .then((saved) => {
        if (!mountedRef.current) return;
        setRanking(saved);
        if (saved === null) {
          setReranking(false);
          setTopPicksOpen(true);
        } else {
          setTasteCardOpen(true);
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        // Storage trouble must not block sharing: fall back to the default.
        setRanking(null);
        setTasteCardOpen(true);
        onFeedback(copy.topPicksLoadFailed);
      })
      .finally(() => {
        if (mountedRef.current) setPreparingShare(false);
      });
  }, [copy, isGridLayout, isPreparingShare, onFeedback, shouldPromptForPicks]);

  const completeGrid = (picked: readonly TopPickCandidate[]) => {
    setGridPicks(picked);
    setGridPickerOpen(false);
    setTasteCardOpen(true);
  };

  const handleCardClose = useCallback(() => {
    setTasteCardOpen(false);
    // Dismissing the card leaves grid mode: a grid is never persisted, so
    // staying in it would reopen onto an empty collage. The other layouts are
    // left as the user set them.
    const next = layoutAfterCardClose(cardOptions);
    if (next !== cardOptions.picksLayout) saveCardOptions({ ...cardOptions, picksLayout: next });
  }, [cardOptions, saveCardOptions]);

  // The share button cannot produce a grid until all nine boxes are chosen.
  // The share button only needs data. The "nine boxes must be filled" rule
  // belongs to the grid picker, which is the only way into grid mode — gating
  // the button on it would make the picker unreachable.
  const canShare = summary.hasData;

  const completeTopPicks = (selected: readonly number[]) => {
    setRanking(selected);
    setTopPicksOpen(false);
    setTasteCardOpen(true);
    void saveTopPicksRanking(selected)
      .then(() => onFeedback(copy.topPicksUpdated))
      .catch(() => onFeedback(copy.topPicksSaveFailed));
  };

  const skipTopPicks = () => {
    // No save: the automatic most-recently-updated order stays in effect.
    setRanking(null);
    setTopPicksOpen(false);
    setTasteCardOpen(true);
    onFeedback(copy.topPicksDefaultUsed);
  };

  const openGridPicker = useCallback(() => {
    setTasteCardOpen(false);
    setGridPickerOpen(true);
  }, []);

  const changeTopPicks = () => {
    setTasteCardOpen(false);
    setReranking(true);
    setRanking(null);
    setTopPicksOpen(true);
    void clearTopPicksRanking()
      .then(() => {
        if (mountedRef.current) onFeedback(copy.topPicksResetDone);
      })
      .catch(() => undefined);
  };

  return (
    <div className="page-content profile-page">
      <div className="profile-header">
        <div className="page-title">
          <p className="eyebrow">{copy.profileEyebrow}</p>
          <h2>{copy.animeProfile}</h2>
          <p>{copy.profileIntro}</p>
        </div>
        {/* An action on the data rather than a stranded button between the
            intro and the hero stat. */}
        <Button
          size="sm"
          icon="sparkles"
          onClick={openShareFlow}
          disabled={!canShare || isPreparingShare}
        >
          {copy.tasteCardShare}
        </Button>
      </div>
      <div className="profile-stat-hero">
        <strong>{summary.analyzedAnimeCount}</strong>
        <span>{copy.analyzedAnime}</span>
      </div>
      <div className="taste-stat-grid profile-stat-grid">
        <div>
          <strong>{summary.averageScore === null ? '—' : summary.averageScore.toFixed(1)}</strong>
          <span>{copy.averageScore}</span>
        </div>
        <div>
          <strong>{summary.ratedAnimeCount}</strong>
          <span>{copy.ratedAnime}</span>
        </div>
        <div>
          <strong>{summary.favoriteGenres.length}</strong>
          <span>{copy.favoriteGenres}</span>
        </div>
      </div>
      <PreferenceSection title={copy.favoriteGenres} items={summary.favoriteGenres} copy={copy} />
      <PreferenceSection title={copy.favoriteThemes} items={summary.favoriteThemes} copy={copy} />
      <PreferenceSection title={copy.favoriteStudios} items={summary.favoriteStudios} copy={copy} />
      <Card className="detected-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.detectedPreferences}</p>
            <h2>{copy.detectedPreferences}</h2>
          </div>
          <Badge tone="success">{copy.learned}</Badge>
        </div>
        {summary.detectedPreferences.length === 0 ? (
          <p className="profile-muted">{copy.profileHint}</p>
        ) : (
          <div className="detected-list">
            {summary.detectedPreferences.map((preference) => (
              <div className="detected-item" key={preference.label}>
                <span className="feedback-positive">
                  <Icon name="sparkles" size={14} />
                </span>
                <div>
                  <strong>{preference.label}</strong>
                  <p>{preference.detail}</p>
                </div>
                <span className="detected-score">{preference.score}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <PreferenceSection
        title={copy.lessLikedGenres}
        items={summary.lessLikedGenres}
        negative
        copy={copy}
      />
      <div className="profile-refresh-row">
        <span>{copy.profileCalculated}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onRefresh();
            onFeedback(copy.profileRefreshed);
          }}
        >
          {copy.refresh}
        </Button>
      </div>
      <GridPickerModal
        open={isGridPickerOpen}
        initial={gridPicks}
        candidates={plan.ranked}
        copy={copy}
        onClose={() => setGridPickerOpen(false)}
        onComplete={completeGrid}
      />
      <TopPicksModal
        open={isTopPicksOpen}
        plan={plan}
        copy={copy}
        isReranking={isReranking}
        onClose={() => setTopPicksOpen(false)}
        onComplete={completeTopPicks}
        onSkip={skipTopPicks}
      />
      <TasteCardModal
        open={isTasteCardOpen}
        model={tasteCardModel}
        profile={profile}
        copy={copy}
        options={cardOptions}
        onOptionsChange={saveCardOptions}
        onClose={handleCardClose}
        onFeedback={onFeedback}
        onRequestGridPicker={openGridPicker}
        onChangePicks={
          // In grid mode the same button reopens the picker, seeded with the
          // nine already chosen. The tie-break ranking is unrelated to it.
          isGridLayout
            ? openGridPicker
            : ranking === null || !shouldPromptForPicks
              ? undefined
              : changeTopPicks
        }
      />
    </div>
  );
}

function PreferenceSection({
  title,
  items,
  negative = false,
  copy,
}: {
  readonly title: string;
  readonly items: readonly { readonly name: string; readonly score: number }[];
  readonly negative?: boolean;
  readonly copy: AppCopy;
}) {
  return (
    <Card className={`preference-card${negative ? ' preference-card-negative' : ''}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{negative ? copy.negativeSignal : copy.positiveSignal}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="profile-muted">{copy.noSignals}</p>
      ) : (
        <div className="preference-bars">
          {items.map((item) => (
            <div className="preference-bar" key={item.name}>
              <div className="bar-label">
                <span>{item.name}</span>
                <span>{item.score}%</span>
              </div>
              <Progress value={item.score} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ProfileLoadingPage() {
  return (
    <div className="page-content loading-page profile-page">
      <Skeleton className="skeleton-eyebrow" />
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-copy" />
      <Skeleton className="skeleton-featured" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-line" />
    </div>
  );
}

export function SettingsPage({
  onFeedback,
  onSync,
  onAuthSnapshot,
  onPreferencesChanged,
  onProvidersChanged,
  copy,
}: PageProps & {
  readonly onProvidersChanged?: () => void;
}) {
  const requestSequence = useRef(0);
  const disposed = useRef(false);
  const preferencesRef = useRef(DEFAULT_USER_PREFERENCES);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [malClientId, setMalClientId] = useState('');
  const [malClientIdDraft, setMalClientIdDraft] = useState('');
  const [isSavingMalClientId, setIsSavingMalClientId] = useState(false);
  const [snapshot, setSnapshot] = useState<SettingsSnapshotState>({
    status: 'loading',
    preferences: DEFAULT_USER_PREFERENCES,
    auth: null,
    errorMessage: null,
    malClientId: '',
    malRedirectUri: '',
    anilistRedirectUri: '',
  });
  const [confirmation, setConfirmation] = useState<DestructiveAction | null>(null);
  const [providers, setProviders] = useState<readonly ProviderStatusView[]>([]);
  const [anilistClientIdDraft, setAnilistClientIdDraft] = useState('');
  const [anilistClientId, setAnilistClientId] = useState('');
  const [isSavingAnilistClientId, setIsSavingAnilistClientId] = useState(false);
  const [providerActionInFlight, setProviderActionInFlight] = useState<ProviderId | null>(null);
  const [pinTabToken, setPinTabToken] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const anilistProvider = providers.find((provider) => provider.id === 'anilist');
  const anilistSignedIn = anilistProvider?.signedIn ?? false;

  const loadSettings = () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setSnapshot((current) => ({ ...current, status: 'loading', errorMessage: null }));
    void requestSettingsSnapshot()
      .then((value) => {
        if (disposed.current || sequence !== requestSequence.current) return;
        const nextMalClientId = normalizeSettingsText(value.malClientId);
        const nextMalRedirectUri = normalizeSettingsText(value.malRedirectUri);
        preferencesRef.current = value.preferences;
        setMalClientId(nextMalClientId);
        setMalClientIdDraft(nextMalClientId);
        setSnapshot({
          status: 'ready',
          preferences: value.preferences,
          auth: value.auth,
          errorMessage: null,
          malClientId: nextMalClientId,
          malRedirectUri: nextMalRedirectUri,
          anilistRedirectUri: normalizeSettingsText(value.anilistRedirectUri),
        });
        setProviders(value.providers ?? []);
        setAnilistClientId(normalizeSettingsText(value.anilistClientId));
        setAnilistClientIdDraft(normalizeSettingsText(value.anilistClientId));
        onAuthSnapshot?.(value.auth);
      })
      .catch((error: unknown) => {
        if (disposed.current || sequence !== requestSequence.current) return;
        setSnapshot({
          status: 'error',
          preferences: DEFAULT_USER_PREFERENCES,
          auth: null,
          errorMessage: error instanceof Error ? error.message : copy.settingsUnavailable,
          malClientId: '',
          malRedirectUri: '',
          anilistRedirectUri: '',
        });
      });
  };

  useEffect(() => {
    disposed.current = false;
    loadSettings();
    return () => {
      disposed.current = true;
      requestSequence.current += 1;
    };
    // loadSettings is intentionally scoped to this page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => applyThemePreference(snapshot.preferences.theme), [snapshot.preferences.theme]);

  // AniList Auth-Pin detection: while the popup is open, watch for a tab on
  // the pin redirect (https://anilist.co/api/v2/oauth/pin#access_token=…).
  // The panel only exists while that tab is present, and the token is pulled
  // straight from the tab URL — no manual paste needed. Query throttled by
  // the polling interval below; host permission for anilist.co makes URL
  // fragments visible to the extension.
  useEffect(() => {
    if (anilistSignedIn) {
      setPinTabToken(null);
      return;
    }
    let disposed = false;
    const PIN_TAB_URL_PREFIX = 'https://anilist.co/api/v2/oauth/pin#access_token=';
    const detectPinTab = () => {
      void chrome.tabs
        .query({ url: 'https://anilist.co/api/v2/oauth/pin*' })
        .then((tabs) => {
          if (disposed) return;
          const match = tabs.find(
            (tab) => typeof tab.url === 'string' && tab.url.startsWith(PIN_TAB_URL_PREFIX),
          );
          const url = match?.url;
          if (url === undefined) {
            setPinTabToken(null);
            return;
          }
          try {
            const params = new URLSearchParams(url.slice(url.indexOf('#') + 1));
            const token = params.get('access_token');
            setPinTabToken(token !== null && token.length > 0 ? token : null);
          } catch {
            setPinTabToken(null);
          }
        })
        .catch(() => {
          if (!disposed) setPinTabToken(null);
        });
    };
    detectPinTab();
    const timer = window.setInterval(detectPinTab, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [anilistSignedIn]);

  const saveMalClientId = () => {
    const clientId = malClientIdDraft.trim();
    setIsSavingMalClientId(true);
    void updateMalClientId(clientId)
      .then((value) => {
        if (disposed.current) return;
        const nextMalClientId = normalizeSettingsText(value.malClientId);
        const nextMalRedirectUri = normalizeSettingsText(value.malRedirectUri);
        setMalClientId(nextMalClientId);
        setMalClientIdDraft(nextMalClientId);
        setSnapshot({
          status: 'ready',
          ...value,
          malClientId: nextMalClientId,
          malRedirectUri: nextMalRedirectUri,
          errorMessage: null,
        });
        onAuthSnapshot?.(value.auth);
        onFeedback(clientId.length === 0 ? copy.clientIdReset : copy.clientIdSaved);
      })
      .catch((error: unknown) => {
        if (!disposed.current) {
          setSnapshot((current) => ({
            ...current,
            errorMessage: error instanceof Error ? error.message : copy.saveError,
          }));
        }
      })
      .finally(() => setIsSavingMalClientId(false));
  };

  const saveAnilistClientId = () => {
    const clientId = anilistClientIdDraft.trim();
    setIsSavingAnilistClientId(true);
    void updateAnilistClientId(clientId)
      .then((value) => {
        if (disposed.current) return;
        setAnilistClientId(normalizeSettingsText(value.anilistClientId));
        setAnilistClientIdDraft(normalizeSettingsText(value.anilistClientId));
        setProviders(value.providers ?? []);
        onAuthSnapshot?.(value.auth);
        onFeedback(clientId.length === 0 ? copy.anilistClientIdReset : copy.anilistClientIdSaved);
      })
      .catch((error: unknown) => {
        if (!disposed.current) {
          setSnapshot((current) => ({
            ...current,
            errorMessage: error instanceof Error ? error.message : copy.saveError,
          }));
        }
      })
      .finally(() => setIsSavingAnilistClientId(false));
  };

  const runProviderAction = (
    providerId: ProviderId,
    action: 'connect' | 'activate' | 'disconnect',
  ) => {
    setProviderActionInFlight(providerId);
    const request =
      action === 'connect'
        ? connectProvider(providerId)
        : action === 'activate'
          ? setActiveProvider(providerId)
          : disconnectProvider(providerId);
    void request
      .then((authSnapshot) => {
        // AniList pin flow: the authorize tab opened successfully. The popup
        // detects the pin redirect tab and offers a one-click completion.
        if (action === 'connect' && authSnapshot.errorCode === 'pin_flow_started') {
          onFeedback(copy.pinInstructions);
          return undefined;
        }
        // `auth.connect` resolves with an error snapshot when the provider
        // rejects the flow (missing client ID, declined consent, bad
        // callback…). Treat any non-authenticated connect as a failure.
        if (
          action === 'connect' &&
          (authSnapshot.status !== 'authenticated' || authSnapshot.profile === null)
        ) {
          const failureMessage = authSnapshot.errorMessage ?? copy.authUnavailable;
          setSnapshot((current) => ({ ...current, errorMessage: failureMessage }));
          onAuthSnapshot?.(authSnapshot);
          onFeedback(failureMessage);
          return undefined;
        }
        return requestSettingsSnapshot();
      })
      .then((value) => {
        if (value === undefined) return;
        if (disposed.current) return;
        setProviders(value.providers ?? []);
        setSnapshot({ status: 'ready', ...value, errorMessage: null });
        onAuthSnapshot?.(value.auth);
        onProvidersChanged?.();
        const name =
          (value.providers ?? []).find((item) => item.id === providerId)?.displayName ?? providerId;
        onFeedback(
          action === 'connect'
            ? copy.providerConnectedToast(name)
            : action === 'activate'
              ? copy.providerActiveToast(name)
              : copy.providerDisconnectedToast(name),
        );
      })
      .catch((error: unknown) => {
        if (!disposed.current) {
          setSnapshot((current) => ({
            ...current,
            errorMessage: error instanceof Error ? error.message : copy.actionImpossible,
          }));
        }
      })
      .finally(() => setProviderActionInFlight(null));
  };

  const submitPinToken = () => {
    const token = pinTabToken?.trim() ?? '';
    if (token.length === 0 || isVerifyingPin) return;
    setIsVerifyingPin(true);
    void completeAniListPinSignIn(token)
      .then((authSnapshot) => {
        if (disposed.current) return;
        if (authSnapshot.status !== 'authenticated' || authSnapshot.profile === null) {
          const failureMessage = authSnapshot.errorMessage ?? copy.authUnavailable;
          setSnapshot((current) => ({ ...current, errorMessage: failureMessage }));
          onFeedback(failureMessage);
          return;
        }
        setPinTabToken(null);
        return requestSettingsSnapshot().then((value) => {
          if (disposed.current) return;
          setProviders(value.providers ?? []);
          setSnapshot({ status: 'ready', ...value, errorMessage: null });
          onAuthSnapshot?.(value.auth);
          onProvidersChanged?.();
          onFeedback(copy.providerConnectedToast('AniList'));
        });
      })
      .catch((error: unknown) => {
        if (!disposed.current) {
          const message = error instanceof Error ? error.message : copy.actionImpossible;
          setSnapshot((current) => ({ ...current, errorMessage: message }));
          onFeedback(message);
        }
      })
      .finally(() => setIsVerifyingPin(false));
  };

  const save = (patch: Partial<UserPreferences>, message: string) => {
    const preferences = { ...preferencesRef.current, ...patch };
    preferencesRef.current = preferences;
    setSnapshot((current) => ({ ...current, preferences }));
    const operation = saveQueue.current.then(async () => {
      const value = await updateSettings(preferences);
      if (disposed.current) return;
      preferencesRef.current = value.preferences;
      setSnapshot({ status: 'ready', ...value, errorMessage: null });
      // Hand back the persisted object, not the optimistic patch: the
      // background normalizes and clamps what it stores.
      onPreferencesChanged?.(value.preferences);
      onFeedback(message);
    });
    saveQueue.current = operation.catch(() => undefined);
    void operation.catch(() => {
      if (!disposed.current) {
        setSnapshot((current) => ({
          ...current,
          errorMessage: copy.saveError,
        }));
      }
    });
  };

  const runDestructiveAction = () => {
    if (confirmation === null) return;
    const action = confirmation;
    setConfirmation(null);
    const request = action === 'cache' ? clearLocalCache : deleteLocalData;
    void request()
      .then((value) => {
        if (disposed.current) return;
        preferencesRef.current = value.preferences;
        setSnapshot({ status: 'ready', ...value, errorMessage: null });
        onAuthSnapshot?.(value.auth);
        onFeedback(action === 'cache' ? copy.clearCache : copy.deleteLocalData);
      })
      .catch((error: unknown) =>
        setSnapshot((current) => ({
          ...current,
          errorMessage: error instanceof Error ? error.message : copy.actionImpossible,
        })),
      );
  };

  if (snapshot.status === 'loading') return <SettingsLoadingPage />;
  if (snapshot.status === 'error') {
    return (
      <div className="page-content settings-page">
        <ErrorState
          title={copy.settingsUnavailable}
          message={snapshot.errorMessage ?? copy.settingsLoadError}
          action={
            <Button size="sm" variant="secondary" onClick={loadSettings}>
              {copy.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const { preferences, auth } = snapshot;
  const isAuthenticated = auth?.status === 'authenticated' && auth.profile !== null;
  return (
    <div className="page-content settings-page">
      <div className="settings-header">
        <div className="settings-header-icon" aria-hidden="true">
          <img src="icons/icon32.png" alt="" />
        </div>
        <div className="page-title">
          <p className="eyebrow">{copy.settingsEyebrow}</p>
          <h2>{copy.settingsTitle}</h2>
          <p>{copy.settingsIntro}</p>
        </div>
      </div>
      <div className="settings-overview" aria-label={copy.accountSummary}>
        <div className="settings-overview-main">
          <span className={`status-dot ${isAuthenticated ? 'is-online' : ''}`} aria-hidden="true" />
          <div>
            <strong>{isAuthenticated ? auth.profile?.username : copy.accountNotConnected}</strong>
            <span>
              {isAuthenticated
                ? copy.providerSynced(
                    providers.find((provider) => provider.active)?.displayName ?? 'MyAnimeList',
                  )
                : copy.providerConnectToStart(
                    providers.find((provider) => provider.active)?.displayName ?? 'MyAnimeList',
                  )}
            </span>
          </div>
        </div>
        <div className="settings-overview-mode">
          <span>{copy.mode}</span>
          <strong>
            {preferences.recommendationMode === 'personalized'
              ? copy.personalized
              : copy.exploratory}
          </strong>
        </div>
      </div>
      <SettingsSection title={copy.language} eyebrow={copy.languageEyebrow}>
        <div className="mode-setting">
          <div>
            <strong>{copy.language}</strong>
            <p>{copy.languageDescription}</p>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label={copy.language}>
            <button
              type="button"
              role="radio"
              aria-checked={preferences.language === 'fr'}
              className={preferences.language === 'fr' ? 'is-selected' : ''}
              onClick={() => save({ language: 'fr' }, copy.savedPreference)}
            >
              {copy.french}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={preferences.language === 'en'}
              className={preferences.language === 'en' ? 'is-selected' : ''}
              onClick={() => save({ language: 'en' }, copy.savedPreference)}
            >
              {copy.english}
            </button>
          </div>
        </div>
      </SettingsSection>
      <SettingsSection title={copy.providers} eyebrow={copy.providersEyebrow}>
        {providers.map((provider) => (
          <SettingRow
            key={provider.id}
            icon="user"
            title={provider.displayName}
            description={
              provider.signedIn
                ? provider.active
                  ? copy.connectedAs(auth?.profile?.username ?? '')
                  : copy.connected
                : copy.noAccount
            }
            trailing={
              <div className="provider-actions">
                {!provider.signedIn && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={providerActionInFlight !== null}
                    onClick={() => runProviderAction(provider.id, 'connect')}
                  >
                    {copy.providerConnect}
                  </Button>
                )}
                {provider.signedIn && !provider.active && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={providerActionInFlight !== null}
                    onClick={() => runProviderAction(provider.id, 'activate')}
                  >
                    {copy.providerMakeActive}
                  </Button>
                )}
                {provider.signedIn && provider.active && (
                  <Badge tone="success">{copy.providerActive}</Badge>
                )}
                {provider.signedIn && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={providerActionInFlight !== null}
                    onClick={() => runProviderAction(provider.id, 'disconnect')}
                  >
                    {copy.providerDisconnect}
                  </Button>
                )}
              </div>
            }
          />
        ))}
        {/* AniList Auth-Pin completion: shown only while a tab is open on
            the pin redirect (https://anilist.co/api/v2/oauth/pin#access_token=…).
            The token is prefilled from that tab's URL — one click finishes. */}
        {pinTabToken !== null && !anilistSignedIn && (
          <div className="pin-signin-panel">
            <p>{copy.pinDetected}</p>
            <div className="provider-actions">
              <Button
                size="sm"
                variant="secondary"
                disabled={isVerifyingPin}
                onClick={submitPinToken}
              >
                {isVerifyingPin ? copy.saving : copy.pinSubmit}
              </Button>
            </div>
          </div>
        )}
        <p className="settings-note">{copy.providersIntro}</p>
      </SettingsSection>
      <SettingsSection title={copy.oauthConfig} eyebrow={copy.oauthEyebrow}>
        <div className="mal-config-panel">
          <div>
            <strong>{copy.malClientId}</strong>
            <p>{copy.sharedFolderDescription}</p>
          </div>
          <input
            className="mal-client-id-input"
            type="text"
            value={malClientIdDraft}
            placeholder={copy.yourMalClientId}
            autoComplete="off"
            spellCheck={false}
            aria-label={copy.malClientId}
            onChange={(event) => setMalClientIdDraft(event.target.value)}
          />
          <div className="mal-redirect-row">
            <span>{copy.redirectUri}</span>
            <code>{snapshot.malRedirectUri}</code>
          </div>
          <p className="settings-note">{copy.oauthInstructions}</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={isSavingMalClientId || malClientIdDraft.trim() === malClientId.trim()}
            onClick={saveMalClientId}
          >
            {isSavingMalClientId ? copy.saving : copy.saveClientId}
          </Button>
        </div>
        <div className="mal-config-panel">
          <div>
            <strong>{copy.providerAnilistClientId}</strong>
            <p>{copy.anilistOauthInstructions}</p>
          </div>
          <input
            className="mal-client-id-input"
            type="text"
            value={anilistClientIdDraft}
            placeholder={copy.yourAnilistClientId}
            autoComplete="off"
            spellCheck={false}
            aria-label={copy.providerAnilistClientId}
            onChange={(event) => setAnilistClientIdDraft(event.target.value)}
          />
          <div className="mal-redirect-row">
            <span>{copy.anilistRedirectUriLabel}</span>
            <code>{snapshot.anilistRedirectUri}</code>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={
              isSavingAnilistClientId || anilistClientIdDraft.trim() === anilistClientId.trim()
            }
            onClick={saveAnilistClientId}
          >
            {isSavingAnilistClientId ? copy.saving : copy.saveClientId}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title={copy.recommendations} eyebrow={copy.discovery}>
        <SettingToggle
          title={copy.hiddenGems}
          description={copy.hiddenGemsDescription}
          checked={preferences.includeHiddenGems}
          onChange={(checked) => save({ includeHiddenGems: checked }, copy.savedPreference)}
        />
        <SettingToggle
          title={copy.olderAnime}
          description={copy.olderAnimeDescription}
          checked={preferences.includeOlderAnime}
          onChange={(checked) => save({ includeOlderAnime: checked }, copy.savedPreference)}
        />
        <SettingToggle
          title={copy.movies}
          description={copy.moviesDescription}
          checked={preferences.includeMovies}
          onChange={(checked) => save({ includeMovies: checked }, copy.savedPreference)}
        />
        <SettingToggle
          title={copy.shortSeries}
          description={copy.shortSeriesDescription}
          checked={preferences.includeShortSeries}
          onChange={(checked) => save({ includeShortSeries: checked }, copy.savedPreference)}
        />
        <div className="mode-setting">
          <div>
            <strong>{copy.discoveryStyle}</strong>
            <p>{copy.discoveryStyleDescription}</p>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label={copy.discoveryStyle}>
            <button
              type="button"
              role="radio"
              aria-checked={preferences.recommendationMode === 'personalized'}
              className={preferences.recommendationMode === 'personalized' ? 'is-selected' : ''}
              onClick={() => save({ recommendationMode: 'personalized' }, copy.savedPreference)}
            >
              {copy.personalized}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={preferences.recommendationMode === 'exploratory'}
              className={preferences.recommendationMode === 'exploratory' ? 'is-selected' : ''}
              onClick={() => save({ recommendationMode: 'exploratory' }, copy.savedPreference)}
            >
              {copy.exploratory}
            </button>
          </div>
        </div>
        <BlacklistEditor
          preferences={preferences}
          onChange={(patch, message) => save(patch, message)}
          copy={copy}
        />
      </SettingsSection>
      <SettingsSection title={copy.appearance} eyebrow={copy.interfaceLabel}>
        <ThemeSelector
          value={preferences.theme}
          onChange={(theme) => save({ theme }, copy.preferenceUpdated)}
          copy={copy}
        />
      </SettingsSection>
      <SettingsSection title={copy.notifications} eyebrow={copy.reminders}>
        <SettingToggle
          title={copy.dailyRecommendation}
          description={copy.dailyRecommendationDescription}
          checked={preferences.dailyRecommendationsEnabled}
          onChange={(checked) =>
            save(
              { dailyRecommendationsEnabled: checked },
              checked ? copy.notificationsEnabled : copy.notificationsDisabled,
            )
          }
        />
        <p className="settings-note">{copy.notificationsDescription}</p>
      </SettingsSection>
      <SettingsSection title={copy.data} eyebrow={copy.localStorage}>
        <SettingActionRow
          icon="download"
          title={copy.synchronize}
          description={copy.importLatestList}
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={auth?.status !== 'authenticated'}
              onClick={() => {
                onSync?.();
                onFeedback(copy.synchronize);
              }}
            >
              {copy.synchronize}
            </Button>
          }
        />
        <SettingActionRow
          icon="refresh"
          title={copy.clearCache}
          description={copy.clearCacheDescription}
          action={
            <Button size="sm" variant="danger" onClick={() => setConfirmation('cache')}>
              {copy.clearCache}
            </Button>
          }
        />
        <SettingActionRow
          icon="close"
          title={copy.deleteLocalData}
          description={copy.deleteLocalDataDescription}
          action={
            <Button size="sm" variant="danger" onClick={() => setConfirmation('data')}>
              {copy.deleteLocalData}
            </Button>
          }
        />
      </SettingsSection>
      {snapshot.errorMessage !== null && (
        <p className="auth-error" role="alert">
          {snapshot.errorMessage}
        </p>
      )}
      <ConfirmationModal
        action={confirmation}
        onCancel={() => setConfirmation(null)}
        onConfirm={runDestructiveAction}
        copy={copy}
      />
    </div>
  );
}

type SettingsSnapshotState = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly preferences: UserPreferences;
  readonly auth: AuthSnapshot | null;
  readonly errorMessage: string | null;
  readonly malClientId: string;
  readonly malRedirectUri: string;
  readonly anilistRedirectUri: string;
};

type DestructiveAction = 'cache' | 'data';

function SettingsSection({
  title,
  eyebrow,
  children,
}: {
  readonly title: string;
  readonly eyebrow: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="settings-section" aria-labelledby={`settings-${title}`}>
      <div className="settings-section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h3 id={`settings-${title}`}>{title}</h3>
      </div>
      <Card className="settings-list">{children}</Card>
    </section>
  );
}

function SettingActionRow({
  icon,
  title,
  description,
  action,
}: {
  readonly icon: 'user' | 'refresh' | 'close' | 'moon' | 'download';
  readonly title: string;
  readonly description: string;
  readonly action: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <span className="setting-icon">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="setting-trailing">{action}</div>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  readonly title: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row setting-toggle-row">
      <span>
        <strong>{title}</strong>
        <p>{description}</p>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ThemeSelector({
  value,
  onChange,
  copy,
}: {
  readonly value: ThemePreference;
  readonly onChange: (value: ThemePreference) => void;
  readonly copy: AppCopy;
}) {
  const options: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: copy.system },
    { value: 'light', label: copy.themeLight },
    { value: 'dark', label: copy.themeDark },
  ];
  return (
    <div className="theme-options" role="radiogroup" aria-label={copy.appearance}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? 'is-selected' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BlacklistEditor({
  preferences,
  onChange,
  copy,
}: {
  readonly preferences: UserPreferences;
  readonly onChange: (patch: Partial<UserPreferences>, message: string) => void;
  readonly copy: AppCopy;
}) {
  const [kind, setKind] = useState<'genre' | 'theme'>('genre');
  const [query, setQuery] = useState('');
  const values = kind === 'genre' ? preferences.excludedGenres : preferences.excludedThemes;
  const source = kind === 'genre' ? MAL_GENRE_NAMES : MAL_THEME_NAMES;
  const normalizedValues = new Set(values.map((value) => value.trim().toLocaleLowerCase()));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const suggestions = source
    .filter((value) => !normalizedValues.has(value.toLocaleLowerCase()))
    .filter(
      (value) =>
        normalizedQuery.length === 0 || value.toLocaleLowerCase().includes(normalizedQuery),
    )
    .slice(0, 8);

  const add = (value: string) => {
    const next = [...values, value];
    onChange(
      kind === 'genre' ? { excludedGenres: next } : { excludedThemes: next },
      copy.excluded(kind === 'genre' ? copy.genre : copy.theme, value),
    );
    setQuery('');
  };

  const remove = (value: string) => {
    const next = values.filter((item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase());
    onChange(
      kind === 'genre' ? { excludedGenres: next } : { excludedThemes: next },
      copy.restored(kind === 'genre' ? copy.genre : copy.theme, value),
    );
  };

  return (
    <div className="blacklist-editor">
      <div className="blacklist-heading">
        <div>
          <strong>{copy.exclusionType}</strong>
          <p>{copy.exclusionDescription}</p>
        </div>
      </div>
      <div className="blacklist-kind" role="radiogroup" aria-label={copy.exclusionType}>
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'genre'}
          className={kind === 'genre' ? 'is-selected' : ''}
          onClick={() => setKind('genre')}
        >
          {copy.genres}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kind === 'theme'}
          className={kind === 'theme' ? 'is-selected' : ''}
          onClick={() => setKind('theme')}
        >
          {' '}
          {copy.themes}
        </button>
      </div>
      <div className="blacklist-search-row">
        <input
          className="blacklist-search"
          type="search"
          value={query}
          placeholder={copy.searchExcluded(
            kind === 'genre' ? copy.genre.toLocaleLowerCase() : copy.theme.toLocaleLowerCase(),
          )}
          aria-label={copy.searchExcluded(
            kind === 'genre' ? copy.genre.toLocaleLowerCase() : copy.theme.toLocaleLowerCase(),
          )}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query.trim().length > 0 && suggestions.length > 0 && (
          <div className="blacklist-suggestions" role="listbox">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" role="option" onClick={() => add(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 ? (
        <div
          className="blacklist-tags"
          aria-label={copy.excludedList(
            kind === 'genre' ? copy.genre.toLocaleLowerCase() : copy.theme.toLocaleLowerCase(),
          )}
        >
          {values.map((value) => (
            <button
              className="blacklist-tag"
              key={value}
              type="button"
              aria-label={`${copy.restore} ${value}`}
              onClick={() => remove(value)}
            >
              <span>{value}</span>
              <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      ) : (
        <p className="blacklist-empty">
          {copy.noExcluded(
            kind === 'genre' ? copy.genre.toLocaleLowerCase() : copy.theme.toLocaleLowerCase(),
          )}
        </p>
      )}
    </div>
  );
}

function ConfirmationModal({
  action,
  onCancel,
  onConfirm,
  copy,
}: {
  readonly action: DestructiveAction | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly copy: AppCopy;
}) {
  if (action === null) return null;
  const content: { title: string; message: string; confirm: string } = {
    cache: {
      title: copy.clearCache,
      message: copy.clearCacheConfirmation,
      confirm: copy.clearCache,
    },
    data: {
      title: copy.deleteDataConfirmationTitle,
      message: copy.deleteDataConfirmationMessage,
      confirm: copy.deleteDataConfirmationAction,
    },
  }[action];
  return (
    <Modal open title={content.title} onClose={onCancel} closeLabel={copy.closeLabel}>
      <p className="modal-copy">{content.message}</p>
      <div className="confirmation-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {content.confirm}
        </Button>
      </div>
    </Modal>
  );
}

function SettingRow({
  icon,
  title,
  description,
  trailing,
}: {
  readonly icon: 'moon' | 'refresh' | 'info' | 'user';
  readonly title: string;
  readonly description: string;
  readonly trailing: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <span className="setting-icon">
        <Icon name={icon} size={16} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="setting-trailing">{trailing}</div>
    </div>
  );
}

export function SettingsLoadingPage() {
  return (
    <div className="page-content loading-page settings-page">
      <Skeleton className="skeleton-eyebrow" />
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-copy" />
      <Skeleton className="skeleton-line" />
      <Skeleton className="skeleton-featured" />
      <Skeleton className="skeleton-line" />
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="page-content loading-page">
      <Skeleton className="skeleton-eyebrow" />
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-copy" />
      <Skeleton className="skeleton-featured" />
      <Skeleton className="skeleton-line" />
      <div className="skeleton-grid">
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  );
}
