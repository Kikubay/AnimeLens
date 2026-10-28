import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { isDesktopHost } from '../platform/desktop-bridge';
import type { AuthSnapshot } from '../auth/auth-types';
import type { UserProfile } from '../domain/user-profile';
import {
  currentCalendarYear,
  recommendationPeriodWithEndYear,
  recommendationPeriodWithStartYear,
  recommendationYearOptions,
  type RecommendationPeriod,
} from '../domain/recommendation-period';
import { addAnimeToMalList } from '../api/mal-list-messages';
import { ANIME_SEARCH_MIN_LENGTH } from '../api/anime-search-messages';
import { requestStreamingLinks } from '../api/streaming-links-messages';
import type { StreamingLink } from '../domain/streaming';
import {
  entryProviderDisplayName,
  entryProviderUrl,
  isAniListEntry,
} from '../domain/entry-provider';
import type { SyncSnapshot } from '../sync/sync-messages';
import {
  requestDashboardRecommendations,
  type DashboardRecommendationSnapshot,
} from '../recommendations/recommendation-messages';
import type { RecommendationSectionId } from '../recommendations/recommendation-messages';
import type { Recommendation, RecommendationReason } from '../domain/recommendation';
import type { FeedbackValue } from '../domain/feedback';
import type { DislikeReason } from '../domain/feedback';
import { requestProfileSnapshot } from '../profile/profile-messages';
import type { ProfileSnapshot, UserProfileSummary } from '../profile/profile-types';
import { computeTasteLevel, type TasteLevel } from '../profile/taste-level';
import { computeProfileStrength } from '../profile/profile-strength';
import {
  cosmeticUnlockContextFrom,
  unlockedCosmetics,
  type TasteCardCosmetics,
} from '../profile/cosmetics';
import type { WeeklyRecap } from '../profile/weekly-recap';
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
  exportLocalData,
  importLocalData,
  requestSettingsSnapshot,
  updateAnilistClientId,
  updateMalClientId,
  updateSettings,
} from '../settings/settings-messages';
import {
  completeAniListPinSignIn,
  connectProvider,
  disconnectProvider,
  requestAnilistPinStatus,
  setActiveProvider,
} from '../auth/auth-messages';
import type { AnilistPinFlowState } from '../auth/anilist-pin';
import type { ProviderId } from '../auth/auth-types';
import type { ProviderStatusView } from '../settings/settings-types';
import {
  DEFAULT_USER_PREFERENCES,
  persistableTasteCardPicksLayout,
  normalizeSettingsText,
  type ContentRatingPreference,
  type RecommendationMode,
  type TasteCardExportFormat,
  type ThemePreference,
  type AccentTheme,
  type UserPreferences,
} from '../settings/settings-types';
import { applyAccentTheme, applyThemePreference } from '../settings/theme';
import { categoryLabel, type AppCopy, type Language } from '../locales';
import { MAL_GENRE_NAMES, MAL_THEME_NAMES } from '../api/mal-taxonomy';
import type { AnimeCardData } from './components/anime';
import { AnimeGrid, FeaturedAnime } from './components/anime';
import { AnimeSearchField, AnimeSearchPanel } from './components/anime-search';
import { isSearchActive } from './search-state';
import {
  acceptsDashboardResponse,
  decideDashboardRefresh,
  hasDashboard,
} from './dashboard-refresh';
import { TasteCardModal } from './components/taste-card-modal';
import { TopPicksModal } from './components/top-picks-modal';
import { GridPickerModal } from './components/grid-picker-modal';
import { RadioGroup } from './components/radio-group';
import {
  Badge,
  Button,
  Card,
  CompatibilityScore,
  EmptyState,
  ErrorState,
  Icon,
  type IconName,
  IconButton,
  Modal,
  Progress,
  Rating,
  Skeleton,
} from './components/ui';

import type { PageId } from './page-id';

export type { PageId } from './page-id';

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

function reasonHeadline(reason: RecommendationReason | undefined): string | null {
  if (reason === undefined) return null;
  const detail = reason.detail;
  return detail === undefined || detail === null || detail.length === 0
    ? reason.label
    : `${reason.label} ${detail}`;
}

function toCardData(recommendation: Recommendation, copy: AppCopy): AnimeCardData {
  return {
    ...recommendation.anime,
    compatibility: recommendation.compatibilityScore,
    recommendation: reasonHeadline(recommendation.reasons[0]) ?? copy.exploreLead,
    reasons: recommendation.reasons,
    category: recommendation.category,
  };
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
  readonly activeProviderName?: string;
  readonly preferences?: UserPreferences;
  readonly onPreferencesChange?: (preferences: UserPreferences) => void;
  readonly copy: AppCopy;
}

interface DashboardPageProps extends PageProps {
  readonly recommendationsRevision?: number;
  readonly isOnline: boolean;
  readonly auth: AuthSnapshot;
  readonly onAuthAction: (action: 'connect' | 'disconnect') => void;
  readonly sync: SyncSnapshot;
  readonly activeProviderName: string;
}

export function DashboardPage({
  onSelectAnime,
  auth,
  onAuthAction,
  sync,
  onSync,
  onFeedback,
  onRecommendationFeedback,
  recommendationsRevision = 0,
  copy,
  isOnline,
  activeProviderName,
}: DashboardPageProps) {
  const requestSequence = useRef(0);
  const disposed = useRef(false);
  const dashboardVisible = useRef(false);
  const [query, setQuery] = useState('');
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
    if (decideDashboardRefresh('start', dashboardVisible.current).outcome === 'loading') {
      setSnapshot((current) => ({ ...current, status: 'loading', errorMessage: null }));
    }
    void requestDashboardRecommendations()
      .then((nextSnapshot) => {
        if (!acceptsDashboardResponse(disposed.current, sequence, requestSequence.current)) return;
        dashboardVisible.current = hasDashboard(nextSnapshot.status);
        setSnapshot(nextSnapshot);
      })
      .catch((error: unknown) => {
        if (!acceptsDashboardResponse(disposed.current, sequence, requestSequence.current)) return;
        const failure = decideDashboardRefresh('failed', dashboardVisible.current);
        if (failure.notify) onFeedback(copy.recommendationsError);
        if (failure.outcome !== 'replace') return;
        setSnapshot((current) => ({
          ...current,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : copy.recommendationsUnavailable,
        }));
      });
  }, [copy.recommendationsError, copy.recommendationsUnavailable, onFeedback]);

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

  const daily = useMemo(
    () => (snapshot.daily === null ? null : toCardData(snapshot.daily, copy)),
    [snapshot.daily, copy],
  );
  const sections = useMemo(
    () =>
      snapshot.sections.map((section) => ({
        ...section,
        title: sectionTitle(section.id, copy),
        recommendations: section.recommendations.map((item) => toCardData(item, copy)),
      })),
    [snapshot.sections, copy],
  );

  const displayStatus = !isOnline && daily !== null ? 'offline' : snapshot.status;
  const searchIsActive = isSearchActive(query);
  const isAuthenticated = auth.status === 'authenticated';

  return (
    <div className="page-content dashboard-page">
      <section className="hud dashboard-hero">
        <div className="hud-stack" aria-live="polite">
          <div className="hud-instruments">
            <div className="auth-strip">
              {auth.status === 'authenticated' && auth.profile !== null ? (
                <span className="auth-strip-status">
                  {auth.profile.username} · {copy.providerListConnected(activeProviderName)}
                </span>
              ) : auth.status === 'authorizing' || auth.status === 'exchanging' ? (
                <span className="auth-strip-status is-progress">
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
              isAuthenticated={isAuthenticated}
              providerName={activeProviderName}
              copy={copy}
            />
            <div className="anime-search">
              <AnimeSearchField query={query} onQueryChange={setQuery} copy={copy} />
              {query.trim().length > 0 && !searchIsActive ? (
                <p className="anime-search-hint">{copy.searchMinChars(ANIME_SEARCH_MIN_LENGTH)} </p>
              ) : (
                <p className="anime-search-hint">{copy.searchTagHint}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {searchIsActive ? (
        <AnimeSearchPanel
          query={query}
          isAuthenticated={isAuthenticated}
          providerName={activeProviderName}
          onSelect={onSelectAnime}
          onConnect={() => onAuthAction('connect')}
          copy={copy}
        />
      ) : displayStatus === 'loading' ? (
        <DashboardLoadingState copy={copy} />
      ) : displayStatus === 'error' ? (
        <ErrorState
          title={snapshot.errorMessage ?? copy.recommendationsUnavailable}
          message={copy.recommendationsError}
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
              {copy.offlineRecommendations}
            </div>
          )}
          <section className="dashboard-daily" aria-labelledby="daily-title">
            <div className="section-heading">
              <div>
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
              <Icon name="chevron-left" size={16} />
            </button>
          )}
          {hasOverflow && scrollState.canScrollRight && hoveredEdge === 'right' && (
            <button
              className="carousel-arrow carousel-arrow-right"
              type="button"
              aria-label={copy.nextTitles(title)}
              onClick={() => scrollByPage(1)}
            >
              <Icon name="chevron-right" size={16} />
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
        {metadata.status === 'error' && (
          <span className="sync-error-text">{metadata.errorMessage ?? copy.syncFailed}</span>
        )}
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
  const [fetchedStreamingLinks, setFetchedStreamingLinks] = useState<
    readonly StreamingLink[] | null
  >(null);

  useEffect(() => {
    setIsOnMalList(false);
    setListError(null);
  }, [anime?.id]);

  useEffect(() => {
    const embedded = anime?.streamingSites;
    if (anime === null || anime === undefined) return;
    if (embedded !== undefined && embedded.length > 0) return;
    let cancelled = false;
    setFetchedStreamingLinks(null);
    void requestStreamingLinks(anime.id).then((links) => {
      if (!cancelled) setFetchedStreamingLinks(links);
    });
    return () => {
      cancelled = true;
    };
  }, [anime]);

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
  const isAniListEntryRecord = isAniListEntry(anime);
  const entryProviderName = entryProviderDisplayName(anime);
  const providerUrl = entryProviderUrl(anime);
  const reasons = anime.reasons ?? [];
  const fallbackReason: readonly RecommendationReason[] | null =
    anime.recommendation === undefined
      ? null
      : [{ label: anime.recommendation, kind: 'discovery', weight: 0.5 }];
  const detailReasons = reasons.length > 0 ? reasons : (fallbackReason ?? []);
  const streamingSites = anime.streamingSites ?? fetchedStreamingLinks ?? [];
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
          style={
            anime.accent === null || anime.accent === undefined
              ? undefined
              : ({ '--poster-accent': anime.accent } as React.CSSProperties)
          }
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
            <span>{anime.type}</span>
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
      {detailReasons.length > 0 && (
        <Card className="why-card">
          <div className="why-card-heading">
            <span className="state-icon">
              <Icon name="sparkles" size={17} />
            </span>
            <div>
              <h3>{copy.whyThisAnime}</h3>
            </div>
          </div>
          <div className="detail-reasons">
            {detailReasons.map((reason) => (
              <div className="detail-reason" key={`${reason.kind}-${reason.label}`}>
                <Icon name="check" size={14} />
                <span>
                  {reason.label}
                  {reason.detail ? <strong> {reason.detail}</strong> : null}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {streamingSites.length > 0 && (
        <Card className="where-to-watch-card">
          <div className="why-card-heading">
            <span className="state-icon">
              <Icon name="play" size={17} />
            </span>
            <h3>{copy.whereToWatch}</h3>
          </div>
          <div className="where-to-watch-links">
            {streamingSites.map((site) =>
              site.url === null ? (
                <span className="streaming-link is-static" key={site.serviceId}>
                  {site.serviceName}
                </span>
              ) : (
                <a
                  className="streaming-link"
                  key={site.serviceId}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.watchOn(site.serviceName)}
                >
                  <Icon name="play" size={11} />
                  {site.serviceName}
                </a>
              ),
            )}
          </div>
        </Card>
      )}
      {anime.compatibility !== undefined && (
        <div className="detail-score-row">
          <CompatibilityScore value={anime.compatibility} copy={copy} />
          <div>
            <h3>{anime.compatibility >= 80 ? copy.greatMatch : copy.exploreLead}</h3>
            <p>{copy.calculatedScore}</p>
          </div>
        </div>
      )}
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
          {isAniListEntryRecord ? copy.openOnAnilist : copy.openOnMal}
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
        {isAniListEntryRecord ? copy.viewAnilist : copy.viewMal}
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
    delta: null,
    recap: null,
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
          delta: null,
          recap: null,
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
      recap={snapshot.recap}
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
  recap,
  profile,
  providerName,
  preferences,
  onPreferencesChange,
  onFeedback,
  onRefresh,
  copy,
}: {
  readonly summary: UserProfileSummary;
  readonly recap: WeeklyRecap | null;
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
  const [ranking, setRanking] = useState<readonly number[] | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const plan = summary.topPicks;

  const [sessionLayout, setSessionLayout] = useState<TasteCardPicksLayout>(
    preferences.tasteCard.picksLayout,
  );
  const tasteLevel = useMemo(
    () => computeTasteLevel(summary, preferences.language, preferences.usageStreak.xp),
    [summary, preferences.language, preferences.usageStreak.xp],
  );
  const strength = useMemo(
    () => computeProfileStrength(summary, preferences.language),
    [summary, preferences.language],
  );
  const understoodSignals = useMemo(
    () => strength.signals.filter((signal) => signal.unlocked),
    [strength],
  );
  const unlockContext = useMemo(
    () => cosmeticUnlockContextFrom(summary, tasteLevel),
    [summary, tasteLevel],
  );
  const unlocked = useMemo(() => unlockedCosmetics(unlockContext), [unlockContext]);
  const cardOptions = useMemo(
    () => ({
      ...tasteCardRenderOptions(preferences.tasteCard, unlocked),
      picksLayout: sessionLayout,
    }),
    [preferences.tasteCard, unlocked, sessionLayout],
  );
  const isGridLayout = cardOptions.picksLayout === 'grid';
  const [gridPicks, setGridPicks] = useState<readonly TopPickCandidate[]>([]);
  const resolvedPicks = useMemo(
    () => (isGridLayout ? gridPicks : applyManualRanking(plan, ranking)),
    [gridPicks, isGridLayout, plan, ranking],
  );
  const tasteCardModel = useMemo(
    () => buildTasteCardModel(summary, profile, providerName, resolvedPicks),
    [summary, profile, providerName, resolvedPicks],
  );

  const shouldPromptForPicks =
    !isGridLayout && plan.needsChoice && shouldRenderTopPicks(tasteCardModel, cardOptions);

  const saveCardOptions = useCallback(
    (next: TasteCardRenderOptions) => {
      if (onPreferencesChange === undefined) return;
      setSessionLayout(next.picksLayout);

      const tasteCard = {
        ...next,
        picksLayout: persistableTasteCardPicksLayout(next.picksLayout),
        cosmetics: preferences.tasteCard.cosmetics,
        exportFormat: preferences.tasteCard.exportFormat,
      };
      onPreferencesChange({ ...preferences, tasteCard });
      void updateSettings({ ...preferences, tasteCard }).catch(() => undefined);
    },
    [onPreferencesChange, preferences],
  );

  const saveCosmetics = useCallback(
    (next: TasteCardCosmetics) => {
      if (onPreferencesChange === undefined) return;
      const tasteCard = { ...preferences.tasteCard, cosmetics: next };
      onPreferencesChange({ ...preferences, tasteCard });
      void updateSettings({ ...preferences, tasteCard }).catch(() => undefined);
    },
    [onPreferencesChange, preferences],
  );

  const saveExportFormat = useCallback(
    (next: TasteCardExportFormat) => {
      if (onPreferencesChange === undefined) return;
      const tasteCard = { ...preferences.tasteCard, exportFormat: next };
      onPreferencesChange({ ...preferences, tasteCard });
      void updateSettings({ ...preferences, tasteCard }).catch(() => undefined);
    },
    [onPreferencesChange, preferences],
  );

  const openShareFlow = useCallback(() => {
    if (isPreparingShare) return;
    setPreparingShare(true);
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

    const next = layoutAfterCardClose(cardOptions);
    if (next !== cardOptions.picksLayout) saveCardOptions({ ...cardOptions, picksLayout: next });
  }, [cardOptions, saveCardOptions]);

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

  const detected = useCollapsePanel();

  return (
    <div className="page-content profile-page">
      <div className="profile-header">
        <div className="page-title">
          <h2>{copy.animeProfile}</h2>
          <p>{copy.profileIntro}</p>
        </div>

        <Button
          size="sm"
          icon="sparkles"
          onClick={openShareFlow}
          disabled={!canShare || isPreparingShare}
        >
          {copy.tasteCardShare}
        </Button>
      </div>
      <div className="hud-instruments profile-instruments">
        <WeeklyRecapCard recap={recap} copy={copy} />
        <TasteLevelCard level={tasteLevel} copy={copy} />
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
        <CollapsibleCardHeading
          title={copy.profileStrengthTitle}
          panelId={detected.panelId}
          collapsed={detected.collapsed}
          onToggle={detected.toggle}
          trailing={
            <Badge tone="success">
              {copy.profileStrengthCount(strength.unlocked, strength.total)}
            </Badge>
          }
        />
        <div id={detected.panelId} hidden={detected.collapsed}>
          <Progress value={strength.strength} />
          <div className="detected-list">
            {understoodSignals.length === 0 ? (
              <p className="profile-muted">{copy.noSignals}</p>
            ) : (
              understoodSignals.map((signal) => {
                const detail = detectedDetail(summary.detectedPreferences, signal.key);
                return (
                  <div className="detected-item" key={signal.key}>
                    <span className="feedback-positive">
                      <Icon name="sparkles" size={14} />
                    </span>
                    <div>
                      <strong>{signal.label}</strong>
                      <p>{detail ?? copy.profileStrengthUnlocked}</p>
                    </div>
                    <span className="detected-score">{copy.profileStrengthUnlocked}</span>
                  </div>
                );
              })
            )}
          </div>
          {strength.nextSignal !== null && (
            <p className="profile-muted strength-next">
              {copy.profileStrengthNext}: {strength.nextSignal.label} (
              {strength.nextSignal.progress}%)
            </p>
          )}
        </div>
      </Card>
      <PreferenceSection
        title={copy.lessLikedGenres}
        items={summary.lessLikedGenres}
        negative
        collapsible
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
        unlockContext={unlockContext}
        unlocked={unlocked}
        onCosmeticsChange={saveCosmetics}
        exportFormat={preferences.tasteCard.exportFormat}
        onExportFormatChange={saveExportFormat}
        onClose={handleCardClose}
        onFeedback={onFeedback}
        onRequestGridPicker={openGridPicker}
        onChangePicks={
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

function exportFileName(): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  return `animelens-export-${stamp}.json`;
}

function downloadJsonFile(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

function detectedDetail(
  preferences: readonly { readonly key: string; readonly detail: string }[],
  key: string,
): string | null {
  return preferences.find((preference) => preference.key === key)?.detail ?? null;
}

function WeeklyRecapCard({
  recap,
  copy,
}: {
  readonly recap: WeeklyRecap | null;
  readonly copy: AppCopy;
}) {
  if (recap === null) return null;
  const hasActivity = recap.entriesAdded > 0 || recap.entriesRated > 0;

  return (
    <Card className="recap-card">
      <div className="section-heading">
        <div>
          <h2>{copy.weeklyRecapTitle}</h2>
        </div>
        <Badge tone="accent">{copy.weeklyRecapWeek(recap.weekNumber)}</Badge>
      </div>
      <p className="recap-window">{copy.weeklyRecapWindow(recap.windowDays)}</p>
      {hasActivity ? (
        <div className="recap-stats">
          <div>
            <strong>{recap.entriesAdded}</strong>
            <span>{copy.weeklyRecapEntriesAdded}</span>
          </div>
          <div>
            <strong>{recap.entriesRated}</strong>
            <span>{copy.weeklyRecapEntriesRated}</span>
          </div>
          <div>
            <strong>
              {recap.averageDelta === null || recap.averageAfter === null
                ? '—'
                : recap.averageAfter.toFixed(1)}
            </strong>
            <span>{copy.averageScore}</span>
          </div>
        </div>
      ) : (
        <p className="profile-muted">{copy.weeklyRecapQuiet}</p>
      )}
      {recap.averageDelta !== null &&
        recap.averageBefore !== null &&
        recap.averageAfter !== null && (
          <p className="recap-average">
            {copy.weeklyRecapAverageMoved(
              recap.averageBefore.toFixed(1),
              recap.averageAfter.toFixed(1),
            )}
          </p>
        )}
    </Card>
  );
}

function TasteLevelCard({ level, copy }: { readonly level: TasteLevel; readonly copy: AppCopy }) {
  const collapse = useCollapsePanel();
  return (
    <Card className="taste-level-card">
      <CollapsibleCardHeading
        title={copy.tasteLevelTitle}
        panelId={collapse.panelId}
        collapsed={collapse.collapsed}
        onToggle={collapse.toggle}
        trailing={<Badge tone="accent">{copy.tasteLevelBadge(level.level)}</Badge>}
      />
      <div id={collapse.panelId} hidden={collapse.collapsed}>
        <div className="taste-level-hero">
          <strong>{level.title}</strong>
          <span>
            {level.isMaxLevel
              ? copy.tasteLevelMaxLevel
              : copy.tasteLevelProgress(level.xpIntoLevel, level.xpForNextLevel)}
          </span>
        </div>
        <Progress value={level.progress} />
        {level.nextTitle !== null && level.nextTitleLevel !== null && (
          <p className="taste-level-next">
            {copy.tasteLevelNextTitle(level.nextTitle)}
            <span>{copy.tasteLevelBadge(level.nextTitleLevel)}</span>
          </p>
        )}
        {level.sources.length > 0 && (
          <div className="taste-level-sources">
            <p className="profile-muted">{copy.tasteLevelSources}</p>
            {level.sources.map((source) => (
              <div className="taste-level-source" key={source.key}>
                <span>{source.label}</span>
                <strong>+{source.xp}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PreferenceSection({
  title,
  items,
  negative = false,
  collapsible = false,
  copy,
}: {
  readonly title: string;
  readonly items: readonly { readonly name: string; readonly score: number }[];
  readonly negative?: boolean;
  readonly collapsible?: boolean;
  readonly copy: AppCopy;
}) {
  const collapse = useCollapsePanel();
  const body = (
    <>
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
    </>
  );
  return (
    <Card className={`preference-card${negative ? ' preference-card-negative' : ''}`}>
      {collapsible ? (
        <>
          <CollapsibleCardHeading
            title={title}
            panelId={collapse.panelId}
            collapsed={collapse.collapsed}
            onToggle={collapse.toggle}
          />
          <div id={collapse.panelId} hidden={collapse.collapsed}>
            {body}
          </div>
        </>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>{title}</h2>
            </div>
          </div>
          {body}
        </>
      )}
    </Card>
  );
}

function ProfileLoadingPage() {
  return (
    <div className="page-content loading-page profile-page">
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
  const [pendingImport, setPendingImport] = useState<{ readonly payload: unknown } | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [providers, setProviders] = useState<readonly ProviderStatusView[]>([]);
  const [anilistClientIdDraft, setAnilistClientIdDraft] = useState('');
  const [anilistClientId, setAnilistClientId] = useState('');
  const [isSavingAnilistClientId, setIsSavingAnilistClientId] = useState(false);
  const [providerActionInFlight, setProviderActionInFlight] = useState<ProviderId | null>(null);
  const [pinTokenAvailable, setPinTokenAvailable] = useState(false);
  const [pinFlowState, setPinFlowState] = useState<AnilistPinFlowState>('idle');

  const canAutoDetectPinToken = !isDesktopHost();

  const [pinTokenDraft, setPinTokenDraft] = useState('');

  const [pinFlowActive, setPinFlowActive] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const anilistProvider = providers.find((provider) => provider.id === 'anilist');
  const anilistSignedIn = anilistProvider?.signedIn ?? false;

  const loadSettings = useCallback(() => {
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
  }, [copy.settingsUnavailable, onAuthSnapshot]);

  useEffect(() => {
    disposed.current = false;
    loadSettings();
    return () => {
      disposed.current = true;
      requestSequence.current += 1;
    };
  }, [loadSettings]);

  useEffect(() => applyThemePreference(snapshot.preferences.theme), [snapshot.preferences.theme]);
  useEffect(
    () => applyAccentTheme(snapshot.preferences.accentTheme),
    [snapshot.preferences.accentTheme],
  );

  useEffect(() => {
    if (anilistSignedIn || !canAutoDetectPinToken) {
      setPinTokenAvailable(false);
      setPinFlowState('idle');
      return;
    }
    let disposed = false;
    const detectPinTab = () => {
      void requestAnilistPinStatus()
        .then((status) => {
          if (disposed) return;
          setPinTokenAvailable(status.available);
          setPinFlowState(status.state);
        })
        .catch(() => {
          if (disposed) return;
          setPinTokenAvailable(false);
          setPinFlowState('idle');
        });
    };
    detectPinTab();
    const timer = window.setInterval(detectPinTab, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [anilistSignedIn, canAutoDetectPinToken]);

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
        if (action === 'connect' && authSnapshot.errorCode === 'pin_flow_started') {
          setPinFlowActive(true);
          onFeedback(copy.pinInstructions);
          return undefined;
        }

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
    const token = pinTokenDraft.trim();
    const useCaptured = token.length === 0 && pinTokenAvailable;
    if ((!useCaptured && token.length === 0) || isVerifyingPin) return;
    setIsVerifyingPin(true);
    void completeAniListPinSignIn(useCaptured ? undefined : token)
      .then((authSnapshot) => {
        if (disposed.current) return;
        if (authSnapshot.status !== 'authenticated' || authSnapshot.profile === null) {
          const failureMessage = authSnapshot.errorMessage ?? copy.authUnavailable;
          setSnapshot((current) => ({ ...current, errorMessage: failureMessage }));
          onFeedback(failureMessage);
          return;
        }
        setPinTokenAvailable(false);
        setPinTokenDraft('');
        setPinFlowActive(false);
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

  const runExport = () => {
    setIsTransferring(true);
    void exportLocalData()
      .then((response) => {
        downloadJsonFile(response.data.json, exportFileName());
        onFeedback(copy.dataExportDone(response.data.feedback, response.data.profileSnapshots));
      })
      .catch((error: unknown) =>
        setSnapshot((current) => ({
          ...current,
          errorMessage: error instanceof Error ? error.message : copy.actionImpossible,
        })),
      )
      .finally(() => {
        if (!disposed.current) setIsTransferring(false);
      });
  };

  const readImportFile = (file: File) => {
    void file
      .text()
      .then((text) => {
        if (disposed.current) return;
        setPendingImport({ payload: JSON.parse(text) as unknown });
        setConfirmation('import');
      })
      .catch(() => {
        if (!disposed.current) {
          setSnapshot((current) => ({ ...current, errorMessage: copy.dataImportInvalid }));
        }
      });
  };

  const runImport = () => {
    const payload = pendingImport?.payload;
    setConfirmation(null);
    setPendingImport(null);
    if (payload === undefined) return;
    setIsTransferring(true);
    void importLocalData(payload)
      .then((response) => {
        if (disposed.current) return;
        preferencesRef.current = response.snapshot.preferences;
        setSnapshot({ status: 'ready', ...response.snapshot, errorMessage: null });
        onAuthSnapshot?.(response.snapshot.auth);
        onPreferencesChanged?.(response.snapshot.preferences);
        onFeedback(copy.dataImportDone(response.data.feedback, response.data.profileSnapshots));
      })
      .catch((error: unknown) => {
        if (!disposed.current) {
          setSnapshot((current) => ({
            ...current,
            errorMessage: error instanceof Error ? error.message : copy.dataImportInvalid,
          }));
        }
      })
      .finally(() => {
        if (!disposed.current) setIsTransferring(false);
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
        <div className="page-title">
          <h2>{copy.settingsTitle}</h2>
          <p>{copy.settingsIntro}</p>
        </div>
      </div>
      <div className="settings-overview" aria-label={copy.accountSummary}>
        <div className="settings-overview-main">
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
      <SettingsSection title={copy.language}>
        <div className="mode-setting">
          <div>
            <strong>{copy.language}</strong>
            <p>{copy.languageDescription}</p>
          </div>
          <RadioGroup<Language>
            className="segmented-control"
            ariaLabel={copy.language}
            value={preferences.language}
            onChange={(language) => save({ language }, copy.savedPreference)}
            options={[
              { value: 'fr', label: copy.french },
              { value: 'en', label: copy.english },
              { value: 'es', label: copy.spanish },
            ]}
          />
        </div>
      </SettingsSection>
      <SettingsSection title={copy.providers}>
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

        {(canAutoDetectPinToken
          ? pinTokenAvailable || pinFlowState === 'closed'
          : pinFlowActive || pinTokenAvailable) &&
          !anilistSignedIn && (
            <div className="pin-signin-panel">
              <p>
                {pinTokenAvailable
                  ? copy.pinDetected
                  : pinFlowState === 'closed'
                    ? copy.pinFlowTabClosed
                    : copy.pinPastePrompt}
              </p>
              {!canAutoDetectPinToken && (
                <input
                  className="mal-client-id-input"
                  type="text"
                  value={pinTokenDraft}
                  placeholder={copy.pinTokenPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={copy.pinTokenLabel}
                  onChange={(event) => setPinTokenDraft(event.target.value)}
                />
              )}
              <div className="provider-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={
                    isVerifyingPin || (pinTokenDraft.trim().length === 0 && !pinTokenAvailable)
                  }
                  onClick={submitPinToken}
                >
                  {isVerifyingPin ? copy.saving : copy.pinSubmit}
                </Button>
              </div>
            </div>
          )}
        <p className="settings-note">{copy.providersIntro}</p>
      </SettingsSection>
      <SettingsSection title={copy.oauthConfig}>
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
      <SettingsSection title={copy.recommendations} collapsible>
        <div className="mode-setting">
          <div>
            <strong>{copy.contentRating}</strong>
            <p>{copy.contentRatingDescription}</p>
          </div>
          <RadioGroup<ContentRatingPreference>
            className="segmented-control"
            ariaLabel={copy.contentRating}
            value={preferences.contentRating}
            onChange={(contentRating) => save({ contentRating }, copy.savedPreference)}
            options={[
              { value: 'safe', label: copy.contentRatingSafe },
              { value: 'questionable', label: copy.contentRatingQuestionable },
              { value: 'explicit', label: copy.contentRatingExplicit },
            ]}
          />
        </div>
        <SettingToggle
          title={copy.hiddenGems}
          description={copy.hiddenGemsDescription}
          checked={preferences.includeHiddenGems}
          onChange={(checked) => save({ includeHiddenGems: checked }, copy.savedPreference)}
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
          <RadioGroup<RecommendationMode>
            className="segmented-control"
            ariaLabel={copy.discoveryStyle}
            value={preferences.recommendationMode}
            onChange={(recommendationMode) => save({ recommendationMode }, copy.savedPreference)}
            options={[
              { value: 'personalized', label: copy.personalized },
              { value: 'exploratory', label: copy.exploratory },
            ]}
          />
        </div>
        <RecommendationPeriodSetting
          preferences={preferences}
          onChange={(period) =>
            save(
              {
                recommendationStartYear: period.startYear,
                recommendationEndYear: period.endYear,
              },
              copy.savedPreference,
            )
          }
          copy={copy}
        />
        <BlacklistEditor
          preferences={preferences}
          onChange={(patch, message) => save(patch, message)}
          copy={copy}
        />
      </SettingsSection>
      <SettingsSection title={copy.appearance} collapsible>
        <ThemeSelector
          value={preferences.theme}
          onChange={(theme) => save({ theme }, copy.preferenceUpdated)}
          copy={copy}
        />
        <AccentThemeSelector
          value={preferences.accentTheme}
          onChange={(accentTheme) => save({ accentTheme }, copy.preferenceUpdated)}
          copy={copy}
        />
      </SettingsSection>
      <SettingsSection title={copy.notifications} collapsible>
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
      <SettingsSection title={copy.data} collapsible>
        <SettingActionRow
          icon="download"
          title={copy.dataExport}
          description={copy.dataExportDescription}
          action={
            <Button size="sm" variant="secondary" disabled={isTransferring} onClick={runExport}>
              {copy.dataExport}
            </Button>
          }
        />
        <SettingActionRow
          icon="upload"
          title={copy.dataImport}
          description={copy.dataImportDescription}
          action={
            <>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                aria-label={copy.dataImportChooseFile}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) readImportFile(file);
                  event.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={isTransferring}
                onClick={() => importFileRef.current?.click()}
              >
                {copy.dataImport}
              </Button>
            </>
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
        onCancel={() => {
          setConfirmation(null);
          setPendingImport(null);
        }}
        onConfirm={() => {
          if (confirmation === 'import') runImport();
          else runDestructiveAction();
        }}
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

type DestructiveAction = 'cache' | 'data' | 'import';

function DisclosureChevron({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <span className={`disclosure-chevron${collapsed ? ' is-collapsed' : ''}`} aria-hidden="true">
      <Icon name="chevron-down" size={14} />
    </span>
  );
}

function useCollapsePanel() {
  const [collapsed, setCollapsed] = useState(true);
  const panelId = useId();
  return {
    collapsed,
    panelId,
    toggle: () => setCollapsed((value) => !value),
  };
}

function CollapsibleCardHeading({
  title,
  panelId,
  collapsed,
  onToggle,
  trailing,
}: {
  readonly title: string;
  readonly panelId: string;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly trailing?: React.ReactNode;
}) {
  return (
    <h2 className="section-heading">
      <button
        type="button"
        className="card-disclosure"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="card-disclosure-title">{title}</span>
        {trailing}
        <DisclosureChevron collapsed={collapsed} />
      </button>
    </h2>
  );
}

function SettingsSection({
  title,
  collapsible = false,
  children,
}: {
  readonly title: string;
  readonly collapsible?: boolean;
  readonly children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(collapsible);
  const panelId = useId();
  return (
    <section className="settings-section" aria-labelledby={`settings-${title}`}>
      <div className="settings-section-heading">
        {collapsible ? (
          <h3 id={`settings-${title}`}>
            <button
              type="button"
              className="settings-disclosure"
              aria-expanded={!collapsed}
              aria-controls={panelId}
              onClick={() => setCollapsed((value) => !value)}
            >
              <span className="settings-disclosure-title">{title}</span>
              <DisclosureChevron collapsed={collapsed} />
            </button>
          </h3>
        ) : (
          <h3 id={`settings-${title}`}>{title}</h3>
        )}
      </div>

      <div id={panelId} hidden={collapsed}>
        <Card className="settings-list">{children}</Card>
      </div>
    </section>
  );
}

function SettingActionRow({
  icon,
  title,
  description,
  action,
}: {
  readonly icon: IconName;
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

function RecommendationPeriodSetting({
  preferences,
  onChange,
  copy,
}: {
  readonly preferences: UserPreferences;
  readonly onChange: (period: RecommendationPeriod) => void;
  readonly copy: AppCopy;
}) {
  const currentYear = currentCalendarYear();
  const years = useMemo(() => recommendationYearOptions(currentYear), [currentYear]);
  const period: RecommendationPeriod = {
    startYear: preferences.recommendationStartYear,
    endYear: preferences.recommendationEndYear,
  };

  return (
    <div className="mode-setting recommendation-period">
      <div>
        <strong>{copy.recommendationPeriod}</strong>
        <p>{copy.recommendationPeriodDescription}</p>
      </div>
      <div className="recommendation-period-fields">
        <label className="year-field">
          <span className="year-field-label">{copy.startYear}</span>
          <span className="year-select">
            <select
              value={period.startYear}
              onChange={(event) =>
                onChange(
                  recommendationPeriodWithStartYear(
                    period,
                    Number(event.target.value),
                    currentYear,
                  ),
                )
              }
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="year-field">
          <span className="year-field-label">{copy.endYear}</span>
          <span className="year-select">
            <select
              value={period.endYear}
              onChange={(event) =>
                onChange(
                  recommendationPeriodWithEndYear(period, Number(event.target.value), currentYear),
                )
              }
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
    </div>
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
    <RadioGroup<ThemePreference>
      className="theme-options"
      ariaLabel={copy.appearance}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}

function AccentThemeSelector({
  value,
  onChange,
  copy,
}: {
  readonly value: AccentTheme;
  readonly onChange: (value: AccentTheme) => void;
  readonly copy: AppCopy;
}) {
  const options: readonly { value: AccentTheme; label: string }[] = [
    { value: 'purple', label: copy.accentPurple },
    { value: 'red', label: copy.accentRed },
    { value: 'blue', label: copy.accentBlue },
    { value: 'green', label: copy.accentGreen },
  ];
  return (
    <RadioGroup<AccentTheme>
      className="theme-options accent-theme-options"
      ariaLabel={copy.accentTheme}
      value={value}
      onChange={onChange}
      options={options}
    />
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
      <RadioGroup<'genre' | 'theme'>
        className="blacklist-kind"
        ariaLabel={copy.exclusionType}
        value={kind}
        onChange={(next) => setKind(next)}
        options={[
          { value: 'genre', label: copy.genres },
          { value: 'theme', label: copy.themes },
        ]}
      />
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
    import: {
      title: copy.dataImport,
      message: copy.dataImportDescription,
      confirm: copy.dataImport,
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

function SettingsLoadingPage() {
  return (
    <div className="page-content loading-page settings-page">
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
