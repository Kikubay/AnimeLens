import type { Anime } from '../../domain/anime';
import type { DislikeReason, FeedbackValue } from '../../domain/feedback';
import type { Recommendation, RecommendationReason } from '../../domain/recommendation';
import type { AppCopy } from '../../locales';
import { Badge, Button, Card, CompatibilityScore, Icon, IconButton, Rating, Tooltip } from './ui';

export interface AnimeCardData extends Anime {
  readonly compatibility: number;
  readonly recommendation: string;
  readonly reasons?: readonly RecommendationReason[];
  readonly category?: Recommendation['category'];
  readonly subtitle?: string;
  readonly posterLabel?: string;
  readonly accent?: string;
  readonly isNew?: boolean;
}

interface AnimeCardProps {
  readonly anime: AnimeCardData;
  readonly featured?: boolean;
  readonly onSelect?: (anime: AnimeCardData) => void;
  readonly onRecommendationFeedback?: (
    anime: AnimeCardData,
    value: FeedbackValue,
    reasons?: readonly DislikeReason[],
  ) => void;
  readonly copy: AppCopy;
}

function animeSubtitle(anime: AnimeCardData): string {
  return (
    anime.subtitle ??
    [
      anime.type.toUpperCase(),
      ...anime.genres.slice(0, 2).map((genre) => genre.name.toUpperCase()),
    ].join(' · ')
  );
}

function posterLabel(anime: AnimeCardData): string {
  return anime.posterLabel ?? anime.title.default;
}

function posterStyle(anime: AnimeCardData): React.CSSProperties {
  return {
    '--poster-accent': anime.accent ?? '#8a7ecf',
  } as React.CSSProperties;
}

function Poster({
  anime,
  featured = false,
  copy,
}: {
  readonly anime: AnimeCardData;
  readonly featured?: boolean;
  readonly copy: AppCopy;
}) {
  const imageUrl = anime.image?.large ?? anime.image?.medium;
  return (
    <div className={featured ? 'featured-poster' : 'poster'} style={posterStyle(anime)}>
      {imageUrl !== null && imageUrl !== undefined ? (
        <img
          className="anime-cover"
          src={imageUrl}
          alt=""
          loading={featured ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <>
          <span className="poster-orbit poster-orbit-one" />
          <span className="poster-orbit poster-orbit-two" />
          <span className="poster-label">{posterLabel(anime)}</span>
          <span className="poster-noise" />
        </>
      )}
      <span className="poster-index">{String(anime.id).padStart(2, '0')}</span>
      {!featured && <CompatibilityScore value={anime.compatibility} compact copy={copy} />}
      {anime.isNew && (
        <Badge tone="accent" className="poster-badge">
          {copy.newLabel}
        </Badge>
      )}
    </div>
  );
}

export function AnimeCard({
  anime,
  featured = false,
  onSelect,
  onRecommendationFeedback,
  copy,
}: AnimeCardProps) {
  return (
    <Card className={`anime-card${featured ? ' anime-card-featured' : ''}`}>
      <button
        className="anime-card-main"
        type="button"
        onClick={() => onSelect?.(anime)}
        aria-label={`${copy.openDetails}: ${anime.title.default}`}
      >
        <Poster anime={anime} copy={copy} />
        <div className="anime-card-content">
          <div className="anime-card-title-row">
            <div>
              <p className="card-kicker">{animeSubtitle(anime)}</p>
              <h3>{anime.title.default}</h3>
            </div>
          </div>
          <div className="anime-meta">
            {anime.score !== null && <Rating value={anime.score} copy={copy} />}
            <span>•</span>
            <span>
              {anime.episodeCount ?? '—'} {copy.episodesShort}
            </span>
          </div>
          <div className="anime-reason" aria-label={copy.recommendationWhy}>
            <Icon name="sparkles" size={12} />
            <span>{anime.recommendation}</span>
          </div>
        </div>
      </button>
      <div className="anime-card-actions">
        <FeedbackButton
          anime={anime}
          value="like"
          icon="thumbs-up"
          label={copy.like}
          onFeedback={onRecommendationFeedback}
        />
        <FeedbackButton
          anime={anime}
          value="dislike"
          icon="thumbs-down"
          label={copy.dislike}
          onFeedback={onRecommendationFeedback}
        />
        <FeedbackButton
          anime={anime}
          value="seen"
          icon="check"
          label={copy.seen}
          onFeedback={onRecommendationFeedback}
        />
        <FeedbackButton
          anime={anime}
          value="not_now"
          icon="moon"
          label={copy.notNow}
          onFeedback={onRecommendationFeedback}
        />
      </div>
    </Card>
  );
}

function FeedbackButton({
  anime,
  value,
  icon,
  label,
  onFeedback,
}: {
  readonly anime: AnimeCardData;
  readonly value: FeedbackValue;
  readonly icon: 'thumbs-up' | 'thumbs-down' | 'check' | 'moon';
  readonly label: string;
  readonly onFeedback?: (anime: AnimeCardData, value: FeedbackValue) => void;
}) {
  return (
    <Tooltip label={label}>
      <IconButton
        icon={icon}
        label={`${label} : ${anime.title.default}`}
        size="sm"
        onClick={() => onFeedback?.(anime, value)}
      />
    </Tooltip>
  );
}

export function AnimeGrid({
  anime,
  onSelect,
  onRecommendationFeedback,
  copy,
}: {
  readonly anime: readonly AnimeCardData[];
  readonly onSelect?: (anime: AnimeCardData) => void;
  readonly onRecommendationFeedback?: (
    anime: AnimeCardData,
    value: FeedbackValue,
    reasons?: readonly DislikeReason[],
  ) => void;
  readonly copy: AppCopy;
}) {
  return (
    <div className="anime-grid">
      {anime.map((item) => (
        <AnimeCard
          anime={item}
          key={item.id}
          onSelect={onSelect}
          onRecommendationFeedback={onRecommendationFeedback}
          copy={copy}
        />
      ))}
    </div>
  );
}

export function FeaturedAnime({ anime, onSelect, onRecommendationFeedback, copy }: AnimeCardProps) {
  return (
    <Card className="featured-recommendation">
      <Poster anime={anime} featured copy={copy} />
      <div className="featured-copy">
        <div className="featured-topline">
          <Badge tone="accent">
            {anime.category === 'hidden-gem' ? copy.hiddenGem : copy.todayPick}
          </Badge>
          <span className="featured-topline-note">{copy.recommendationEngine}</span>
        </div>
        <h2>{anime.title.default}</h2>
        <p className="featured-subtitle">
          {animeSubtitle(anime)} <span>•</span> {anime.episodeCount ?? '—'} {copy.episodesShort}
        </p>
        <p className="featured-description">{anime.synopsis ?? anime.recommendation}</p>
        <div className="featured-footer">
          <CompatibilityScore value={anime.compatibility} copy={copy} />
          <div className="featured-actions">
            <Button size="sm" icon="arrow-right" onClick={() => onSelect?.(anime)}>
              {copy.openDetails}
            </Button>
            <FeedbackButton
              anime={anime}
              value="like"
              icon="thumbs-up"
              label={copy.like}
              onFeedback={onRecommendationFeedback}
            />
            <FeedbackButton
              anime={anime}
              value="dislike"
              icon="thumbs-down"
              label={copy.dislike}
              onFeedback={onRecommendationFeedback}
            />
            <FeedbackButton
              anime={anime}
              value="seen"
              icon="check"
              label={copy.seen}
              onFeedback={onRecommendationFeedback}
            />
            <FeedbackButton
              anime={anime}
              value="not_now"
              icon="moon"
              label={copy.notNow}
              onFeedback={onRecommendationFeedback}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
