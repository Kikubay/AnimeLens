import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppCopy } from '../../locales';
import {
  addTopPickChoice,
  isTopPickComplete,
  type TopPickCandidate,
  type TopPickPlan,
} from '../../profile/top-picks';
import { Badge, Button, Modal } from './ui';
import { fetchAssetAsDataUrl } from '../taste-card-image';

// Dozens of tied 10/10s would otherwise fire dozens of parallel CDN requests from a popup; the overflow renders as a selectable monogram.
const MAX_CANDIDATE_COVERS = 24;

interface TopPicksModalProps {
  readonly open: boolean;
  readonly plan: TopPickPlan;
  readonly copy: AppCopy;
  /** Lets the copy differ when re-opening a saved ranking. */
  readonly isReranking: boolean;
  readonly onClose: () => void;
  readonly onComplete: (ranking: readonly number[]) => void;
  readonly onSkip: () => void;
}

// Each click fills the current slot and advances, and locked slots stay read-only so it's obvious which picks are already decided.
export function TopPicksModal({
  open,
  plan,
  copy,
  isReranking,
  onClose,
  onComplete,
  onSkip,
}: TopPicksModalProps) {
  const mountedRef = useRef(true);
  const [chosen, setChosen] = useState<readonly number[]>([]);
  const [covers, setCovers] = useState<ReadonlyMap<number, string>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A re-rank must never pre-fill the previous answer.
  useEffect(() => {
    if (open) setChosen([]);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const wanted = plan.candidates.slice(0, MAX_CANDIDATE_COVERS);
    if (wanted.length === 0) return undefined;
    let disposed = false;
    void Promise.all(wanted.map((candidate) => fetchAssetAsDataUrl(candidate.imageUrl))).then(
      (urls) => {
        if (disposed || !mountedRef.current) return;
        setCovers(
          new Map(
            wanted
              .map((candidate, index) => [candidate.id, urls[index] ?? null] as const)
              .filter((entry): entry is readonly [number, string] => entry[1] !== null),
          ),
        );
      },
    );
    return () => {
      disposed = true;
    };
  }, [open, plan.candidates]);

  const isComplete = isTopPickComplete(chosen, plan);
  const filled = useMemo(
    () => [
      ...plan.locked.map((candidate) => ({ candidate, source: 'locked' as const })),
      ...chosen.map((id) => ({
        candidate: plan.candidates.find((value) => value.id === id),
        source: 'chosen' as const,
      })),
    ],
    [plan.locked, plan.candidates, chosen],
  );

  const choose = (id: number) => {
    const next = addTopPickChoice(chosen, id, plan);
    if (next === null) return;
    setChosen(next);
    if (isTopPickComplete(next, plan)) onComplete(next);
  };

  const boundary = plan.boundaryScore ?? 0;
  const intro = isReranking
    ? copy.topPicksIntroManual(plan.candidates.length, boundary)
    : copy.topPicksIntroTie(plan.candidates.length, boundary);

  return (
    <Modal
      open={open}
      title={copy.topPicksTitle}
      onClose={onClose}
      closeLabel={copy.closeLabel}
      className="modal-top-picks"
    >
      <p className="modal-copy">{intro}</p>

      <ol className="top-picks-slots" aria-label={copy.topPicksTitle}>
        {Array.from({ length: plan.limit }, (_, index) => {
          const entry = filled[index];
          const position = index + 1;
          return (
            <li
              key={position}
              className={`top-picks-slot${
                entry === undefined ? ' is-open' : ` is-${entry.source}`
              }`}
            >
              <span className="top-picks-slot-rank">{position}</span>
              {entry?.candidate === undefined ? (
                <span className="top-picks-slot-empty">{copy.topPicksSelectSlot(position)}</span>
              ) : (
                <>
                  <span className="top-picks-slot-title">{entry.candidate.title}</span>
                  <span className="top-picks-slot-score">{entry.candidate.score}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="top-picks-candidates" role="listbox" aria-label={copy.topPicksTitle}>
        {plan.candidates.length === 0 ? (
          <p className="top-picks-empty">{copy.topPicksNoCandidates}</p>
        ) : (
          plan.candidates.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              cover={covers.get(candidate.id) ?? null}
              isChosen={chosen.includes(candidate.id)}
              onChoose={choose}
              copy={copy}
            />
          ))
        )}
      </div>

      <p className="top-picks-hint">{copy.topPicksDefaultHint}</p>
      <div className="confirmation-actions">
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={isComplete}>
          {copy.topPicksSkipDefault}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {copy.cancel}
        </Button>
      </div>
    </Modal>
  );
}

function CandidateRow({
  candidate,
  cover,
  isChosen,
  onChoose,
  copy,
}: {
  readonly candidate: TopPickCandidate;
  readonly cover: string | null;
  readonly isChosen: boolean;
  readonly onChoose: (id: number) => void;
  readonly copy: AppCopy;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isChosen}
      className={`top-picks-candidate${isChosen ? ' is-chosen' : ''}`}
      disabled={isChosen}
      onClick={() => onChoose(candidate.id)}
    >
      <span className="top-picks-cover">
        {cover === null ? (
          <span aria-hidden="true">{candidate.title.trim().charAt(0).toLocaleUpperCase()}</span>
        ) : (
          <img src={cover} alt="" />
        )}
      </span>
      <span className="top-picks-candidate-title">{candidate.title}</span>
      <span className="top-picks-candidate-score">{candidate.score}</span>
      {isChosen && (
        <Badge tone="accent" className="top-picks-chosen">
          {copy.topPicksChosenBadge}
        </Badge>
      )}
    </button>
  );
}
