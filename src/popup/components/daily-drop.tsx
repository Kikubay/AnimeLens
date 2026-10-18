import type { RecommendationReason } from '../../domain/recommendation';
import type { AppCopy } from '../../locales';
import type { DailyDropItem, DailyDropView } from '../../recommendations/daily-drop';
import { AnimeGrid, type AnimeCardData } from './anime';
import { Badge, Button, Progress } from './ui';

interface DailyDropSectionProps {
  readonly view: DailyDropView;
  readonly onSelect: (anime: AnimeCardData) => void;
  readonly onClaim: (anime: AnimeCardData) => void;
  readonly claimingId: number | null;
  readonly copy: AppCopy;
}

export function DailyDropSection({
  view,
  onSelect,
  onClaim,
  claimingId,
  copy,
}: DailyDropSectionProps) {
  const claimedCount = view.items.filter((item) => item.state === 'claimed').length;
  const isComplete = view.items.length > 0 && claimedCount === view.items.length;

  return (
    <>
      <section className="recommendation-section daily-drop" aria-labelledby="daily-drop-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.dailyDropEyebrow}</p>
            <h2 id="daily-drop-title">{copy.dailyDropTitle}</h2>
          </div>
          {isComplete ? (
            <Badge tone="success">{copy.dailyDropClaimed}</Badge>
          ) : (
            <span className="section-count">{copy.dailyDropRemaining(view.unclaimedCount)}</span>
          )}
        </div>
        <Progress
          value={(claimedCount / Math.max(1, view.items.length)) * 100}
          label={copy.dailyDropTitle}
        />
        {isComplete && <p className="daily-drop-complete">{copy.dailyDropComplete}</p>}
        <AnimeGrid
          anime={view.items.map(toCardData)}
          onSelect={onSelect}
          renderFooter={(anime) => renderClaimControl(anime, view, claimingId, onClaim, copy)}
          copy={copy}
        />
      </section>
      {view.missed.length > 0 && (
        <section
          className="recommendation-section daily-drop-missed"
          aria-labelledby="daily-drop-missed-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{copy.dailyDropMissedTitle}</p>
              <h2 id="daily-drop-missed-title">{copy.dailyDropMissed(view.missed.length)}</h2>
            </div>
          </div>
          <AnimeGrid anime={view.missed.map(toCardData)} onSelect={onSelect} copy={copy} />
        </section>
      )}
    </>
  );
}

function renderClaimControl(
  anime: AnimeCardData,
  view: DailyDropView,
  claimingId: number | null,
  onClaim: (anime: AnimeCardData) => void,
  copy: AppCopy,
): React.ReactNode {
  if (claimedIdsOf(view).has(anime.id)) {
    return (
      <Badge tone="success" className="daily-drop-state">
        {copy.dailyDropClaimed}
      </Badge>
    );
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      className="daily-drop-claim"
      disabled={claimingId !== null}
      onClick={() => onClaim(anime)}
    >
      {claimingId === anime.id ? copy.dailyDropClaiming : copy.dailyDropClaim}
    </Button>
  );
}

function claimedIdsOf(view: DailyDropView): ReadonlySet<number> {
  return new Set(
    view.items
      .filter((item) => item.state === 'claimed')
      .map((item) => item.recommendation.anime.id),
  );
}

function toCardData(item: DailyDropItem): AnimeCardData {
  return {
    ...item.recommendation.anime,
    compatibility: item.recommendation.compatibilityScore,
    recommendation: headlineOf(item.recommendation.reasons[0]),
    reasons: item.recommendation.reasons,
    category: item.recommendation.category,
  };
}

function headlineOf(reason: RecommendationReason | undefined): string | undefined {
  if (reason === undefined) return undefined;
  const detail = reason.detail;
  return detail === undefined || detail === null || detail.length === 0
    ? reason.label
    : `${reason.label} ${detail}`;
}
