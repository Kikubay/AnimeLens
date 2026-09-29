import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppCopy } from '../../i18n';
import { GRID_SLOT_COUNT, type TopPickCandidate } from '../../profile/top-picks';
import { Badge, Button, Modal } from './ui';

interface GridPickerModalProps {
  readonly open: boolean;
  /** Every rated entry, in rank order, as a starting pool. */
  readonly candidates: readonly TopPickCandidate[];
  /**
   * Boxes to pre-fill, in box order. Seeded on open so "Change my picks" lets
   * the user tweak a grid they already built instead of starting over. Session
   * state only — nothing is read from storage.
   */
  readonly initial?: readonly TopPickCandidate[];
  readonly copy: AppCopy;
  readonly onClose: () => void;
  /** All nine boxes are filled. */
  readonly onComplete: (chosen: readonly TopPickCandidate[]) => void;
}

const EMPTY_GRID: readonly (TopPickCandidate | null)[] = Array.from(
  { length: GRID_SLOT_COUNT },
  () => null,
);

/**
 * Lets the user fill all nine grid boxes by hand.
 *
 * Box-first: click a box to make it active, then click an anime in the list to
 * place it there. Boxes can be filled in any order and revisited to swap their
 * contents, and the active box advances to the next empty one by itself.
 *
 * Nothing here is persisted — the selection lives in the caller's state for this
 * session only, so the next time the card is opened the user starts fresh. That
 * is deliberate: a 3x3 collage is a personal curation, not a stored ranking.
 */
export function GridPickerModal({
  open,
  candidates,
  initial,
  copy,
  onClose,
  onComplete,
}: GridPickerModalProps) {
  const mountedRef = useRef(true);
  /** Sparse by design: any box may be filled before the ones around it. */
  const [slots, setSlots] = useState<readonly (TopPickCandidate | null)[]>(EMPTY_GRID);
  const [activeSlot, setActiveSlot] = useState<number | null>(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Opens seeded from `initial` (so an existing grid is preserved), or empty on
  // a first visit. `initialIds` keeps the identity stable while the user
  // rearranges boxes, which must not re-seed them mid-edit.
  const initialIds = useMemo(() => (initial ?? []).map((pick) => pick.id).join(','), [initial]);
  useEffect(() => {
    if (!open) return;
    const seeded = (initial ?? []).slice(0, GRID_SLOT_COUNT);
    setSlots(Array.from({ length: GRID_SLOT_COUNT }, (_, index) => seeded[index] ?? null));
    setActiveSlot(0);
    setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIds]);

  const filled = useMemo(
    () => slots.filter((slot): slot is TopPickCandidate => slot !== null),
    [slots],
  );
  /** Anime id -> the box it currently occupies. */
  const placedIn = useMemo(() => {
    const map = new Map<number, number>();
    slots.forEach((slot, index) => {
      if (slot !== null) map.set(slot.id, index);
    });
    return map;
  }, [slots]);
  const isComplete = filled.length >= GRID_SLOT_COUNT;

  const nextEmpty = (from: number): number | null => {
    for (let step = 1; step <= GRID_SLOT_COUNT; step += 1) {
      const candidate = (from + step) % GRID_SLOT_COUNT;
      if (slots[candidate] === null) return candidate;
    }
    return null;
  };

  const place = (candidate: TopPickCandidate) => {
    if (isComplete || activeSlot === null) return;
    const next = [...slots];
    // Moving an anime that is already placed vacates its previous box, so a
    // title can never occupy two boxes at once.
    const previous = placedIn.get(candidate.id);
    if (previous !== undefined && previous !== activeSlot) next[previous] = null;
    next[activeSlot] = candidate;
    setSlots(next);
    setActiveSlot(nextEmpty(activeSlot));
    const placed = next.filter((slot): slot is TopPickCandidate => slot !== null);
    if (placed.length >= GRID_SLOT_COUNT && mountedRef.current) onComplete(placed);
  };

  const clearSlot = (index: number) => {
    if (isComplete) return;
    setSlots((current) => current.map((slot, at) => (at === index ? null : slot)));
    setActiveSlot(index);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    // Placed entries stay listed whatever the filter, so a box can always be
    // swapped without clearing the search first.
    const kept = candidates.filter((candidate) => {
      if (placedIn.has(candidate.id)) return true;
      return needle.length === 0 || candidate.title.toLocaleLowerCase().includes(needle);
    });
    return needle.length === 0 ? kept : kept.slice(0, 60);
  }, [candidates, placedIn, query]);

  return (
    <Modal
      open={open}
      title={copy.tasteCardGridTitle}
      onClose={onClose}
      closeLabel={copy.closeLabel}
      className="modal-top-picks"
    >
      <p className="modal-copy">{copy.tasteCardGridIntro(filled.length, GRID_SLOT_COUNT)}</p>

      <ol className="grid-slots" aria-label={copy.tasteCardGridTitle}>
        {slots.map((slot, index) => (
          <li key={index}>
            <button
              type="button"
              className={`grid-slot${slot === null ? ' is-open' : ' is-filled'}${
                activeSlot === index ? ' is-active' : ''
              }`}
              aria-pressed={activeSlot === index}
              onClick={() => {
                setActiveSlot(index);
                setQuery('');
              }}
            >
              <span className="grid-slot-index">{index + 1}</span>
              {slot === null ? (
                <span className="grid-slot-empty">{copy.tasteCardGridSlot(index + 1)}</span>
              ) : (
                <span className="grid-slot-title">{slot.title}</span>
              )}
            </button>
          </li>
        ))}
      </ol>

      <p className="grid-hint">
        {activeSlot === null
          ? copy.tasteCardGridAllFilled
          : copy.tasteCardGridActive(copy.tasteCardGridSlot(activeSlot + 1))}
        {activeSlot !== null && slots[activeSlot] !== null && (
          <button type="button" className="grid-hint-clear" onClick={() => clearSlot(activeSlot)}>
            {copy.tasteCardGridEmptyBox}
          </button>
        )}
      </p>

      <input
        className="mal-client-id-input grid-search"
        type="search"
        value={query}
        placeholder={copy.tasteCardGridSearch}
        aria-label={copy.tasteCardGridSearch}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <div className="top-picks-candidates" role="listbox" aria-label={copy.tasteCardGridSearch}>
        {visible.length === 0 ? (
          <p className="top-picks-empty">{copy.tasteCardGridNoMatches}</p>
        ) : (
          visible.map((candidate) => {
            const placed = placedIn.get(candidate.id);
            return (
              <button
                type="button"
                role="option"
                aria-selected={placed !== undefined}
                className={`top-picks-candidate${placed !== undefined ? ' is-chosen' : ''}`}
                key={candidate.id}
                disabled={isComplete}
                onClick={() => place(candidate)}
              >
                <span className="top-picks-candidate-score">{candidate.score}</span>
                <span className="top-picks-candidate-title">{candidate.title}</span>
                {placed !== undefined && (
                  <Badge tone="accent" className="top-picks-chosen">
                    {copy.tasteCardGridSlot(placed + 1)}
                  </Badge>
                )}
              </button>
            );
          })
        )}
      </div>

      <p className="top-picks-hint">{copy.tasteCardGridNotPersisted}</p>
      <div className="confirmation-actions">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {copy.cancel}
        </Button>
        <Button size="sm" onClick={() => onComplete(filled)} disabled={!isComplete}>
          {copy.tasteCardGridDone}
        </Button>
      </div>
    </Modal>
  );
}
