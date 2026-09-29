import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppCopy } from '../../i18n';
import type { UserProfile } from '../../domain/user-profile';
import {
  TASTE_CARD_FORMAT_ORDER,
  TASTE_CARD_FORMATS,
  type TasteCardFormat,
  type TasteCardModel,
  type TasteCardRenderOptions,
} from '../../profile/taste-card-types';
import { GRID_SLOT_COUNT } from '../../profile/top-picks';
import {
  clampTasteCardCoverScale,
  TASTE_CARD_COVER_SCALE_RANGE as COVER_SCALE_RANGE,
  type TasteCardPicksLayout,
} from '../../settings/settings-types';
import { Button, Modal, Skeleton } from './ui';
import { maxFittingCoverScale } from '../taste-card-painter';
import {
  copyPngBlobToClipboard,
  downloadPngBlob,
  fetchAssetAsDataUrl,
  fetchBrandAssetAsDataUrl,
  renderTasteCardPng,
} from '../taste-card-image';

const DOWNLOAD_FILENAME = 'AnimeLens_TasteCard.png';

/**
 * Above this cover scale the medium variant (~230px wide) would be visibly
 * upscaled, so the full-size image is fetched instead.
 */
const LARGE_ART_THRESHOLD = 1.6;

interface TasteCardModalProps {
  readonly open: boolean;
  readonly model: TasteCardModel;
  readonly profile: UserProfile | null;
  readonly copy: AppCopy;
  readonly onClose: () => void;
  readonly onFeedback: (message: string) => void;
  /**
   * Offered when a saved tie-break ranking exists, so the user can re-open the
   * picker instead of being stuck with their first answer.
   */
  readonly onChangePicks?: () => void;
  /** User-controlled section visibility and cover sizing. */
  readonly options: TasteCardRenderOptions;
  readonly onOptionsChange: (options: TasteCardRenderOptions) => void;
  /**
   * The 3x3 grid needs nine hand-picked entries, so choosing it here hands
   * straight over to the picker rather than showing an empty collage.
   */
  readonly onRequestGridPicker?: () => void;
}

type ExportAction = 'download' | 'copy';

interface TasteCardAssets {
  readonly avatar: string | null;
  readonly brand: string | null;
  /** Cover art per top pick, positionally aligned with `model.topPicks`. */
  readonly picks: readonly (string | null)[];
}

const EMPTY_ASSETS: TasteCardAssets = { avatar: null, brand: null, picks: [] };

/** Format picker labels, kept out of the JSX so adding a format is one entry. */
const FORMAT_LABELS: Readonly<Record<TasteCardFormat, (copy: AppCopy) => string>> = {
  tall: (copy) => copy.tasteCardFormatTall,
  portrait: (copy) => copy.tasteCardFormatPortrait,
  square: (copy) => copy.tasteCardFormatSquare,
};

/** Top Rated arrangements offered in the card content panel. */
const PICK_LAYOUTS: readonly TasteCardPicksLayout[] = ['list', 'triangle', 'grid'];
const PICK_LAYOUT_LABELS: Readonly<Record<TasteCardPicksLayout, (copy: AppCopy) => string>> = {
  list: (copy) => copy.tasteCardLayoutList,
  triangle: (copy) => copy.tasteCardLayoutTriangle,
  grid: (copy) => copy.tasteCardLayoutGrid,
};

/**
 * Shows the shareable card and exports it.
 *
 * The preview is the exported PNG itself, rendered by the canvas painter — no
 * separate DOM card to keep in sync, and no scaled 1080px node fighting the
 * 700px popup for layout. Because the blob already exists, Download and Copy
 * are instant after the first paint.
 */
export function TasteCardModal({
  open,
  model,
  profile,
  copy,
  onClose,
  onFeedback,
  onChangePicks,
  options,
  onOptionsChange,
  onRequestGridPicker,
}: TasteCardModalProps) {
  const mountedRef = useRef(true);
  const assetsRef = useRef<Promise<TasteCardAssets>>(Promise.resolve(EMPTY_ASSETS));
  const pendingRef = useRef<Promise<Blob> | null>(null);
  const [format, setFormat] = useState<TasteCardFormat>('portrait');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setRendering] = useState(false);
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Inline the provider avatar, the brand mark, and the pick covers as data
  // URLs: a canvas can only paint same-origin bitmaps, and both CDNs answer
  // without CORS headers. Covers are skipped when the section is hidden.
  // Only the visibility flag gates the download: depending on the whole
  // `options` object would re-fetch every cover each time the cover-size slider
  // moves, which is pure waste since the URLs do not change.
  const { showPicks } = options;
  useEffect(() => {
    if (!open) return undefined;
    const avatarUrl = profile?.avatarUrl ?? null;
    // A cover drawn far larger than the medium variant would be upscaled and
    // soft, so the resolution follows the size the card actually renders.
    const useLarge =
      Math.min(options.coverScale, maxFittingCoverScale(model, format, options)) >=
      LARGE_ART_THRESHOLD;
    const coverUrls = showPicks
      ? model.topPicks.map((pick) => (useLarge ? pick.largeImageUrl : pick.imageUrl))
      : [];
    assetsRef.current = Promise.all([
      fetchAssetAsDataUrl(avatarUrl),
      fetchBrandAssetAsDataUrl(),
      ...coverUrls.map((url) => fetchAssetAsDataUrl(url)),
    ]).then(([avatar, brand, ...picks]) => ({ avatar, brand, picks }));
    return () => {
      assetsRef.current = Promise.resolve(EMPTY_ASSETS);
    };
  }, [open, profile?.avatarUrl, model, showPicks, options, format]);

  // Re-render whenever the card content, the format, or the assets change.
  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    let objectUrl: string | null = null;
    setRendering(true);
    setErrorMessage(null);
    pendingRef.current = null;

    const run = async () => {
      const assets = await assetsRef.current;
      if (disposed || !mountedRef.current) return;
      const blob = await renderTasteCardPng({
        model,
        format,
        copy,
        avatarDataUrl: assets.avatar,
        brandDataUrl: assets.brand,
        pickDataUrls: assets.picks,
        options,
      });
      if (disposed || !mountedRef.current) return;
      objectUrl = URL.createObjectURL(blob);
      pendingRef.current = Promise.resolve(blob);
      setPreviewUrl(objectUrl);
    };

    void run()
      .catch((error: unknown) => {
        if (disposed || !mountedRef.current) return;
        setPreviewUrl(null);
        setErrorMessage(describeFailure(error, copy));
        console.error('[AnimeLens] taste card render failed', error);
      })
      .finally(() => {
        if (!disposed && mountedRef.current) setRendering(false);
      });

    return () => {
      disposed = true;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [open, model, format, copy, options]);

  const spec = TASTE_CARD_FORMATS[format];

  const runExport = useCallback(
    async (action: ExportAction) => {
      if (busy !== null) return;
      setBusy(action);
      try {
        let blob = pendingRef.current === null ? null : await pendingRef.current;
        if (blob === null) {
          const assets = await assetsRef.current;
          blob = await renderTasteCardPng({
            model,
            format,
            copy,
            avatarDataUrl: assets.avatar,
            brandDataUrl: assets.brand,
            pickDataUrls: assets.picks,
            options,
          });
        }
        if (action === 'download') {
          downloadPngBlob(blob, DOWNLOAD_FILENAME);
          onFeedback(copy.tasteCardDownloaded);
          return;
        }
        const outcome = await copyPngBlobToClipboard(blob);
        if (outcome === 'copied') {
          onFeedback(copy.tasteCardCopied);
          return;
        }
        // Clipboard images are unavailable or denied: fall back to a download so
        // the user still gets the image instead of a dead end.
        downloadPngBlob(blob, DOWNLOAD_FILENAME);
        onFeedback(
          outcome === 'unsupported' ? copy.tasteCardCopyUnsupported : copy.tasteCardCopyFailed,
        );
      } catch (error: unknown) {
        if (mountedRef.current) {
          setErrorMessage(describeFailure(error, copy));
          console.error('[AnimeLens] taste card export failed', error);
        }
      } finally {
        if (mountedRef.current) setBusy(null);
      }
    },
    [busy, copy, format, model, onFeedback, options],
  );

  const isReady = previewUrl !== null && !isRendering;

  // A grid is only exportable once all nine boxes hold an anime; an incomplete
  // collage would download as nine empty placeholders.
  const gridPicks = model.topPicks.length;
  const isGridIncomplete = options.picksLayout === 'grid' && gridPicks < GRID_SLOT_COUNT;
  const canExport = isReady && !isGridIncomplete && model.hasData;

  const selectLayout = (option: TasteCardPicksLayout) => {
    onOptionsChange({ ...options, picksLayout: option });
    if (option === 'grid' && onRequestGridPicker !== undefined) onRequestGridPicker();
  };

  // The ceiling depends on the format, the arrangement, and which sections are
  // visible, so the slider grows as the user frees up room instead of offering a
  // range that would silently clip the card.
  const coverCeiling = maxFittingCoverScale(model, format, options);
  const effectiveScale = Math.min(options.coverScale, coverCeiling);

  return (
    <Modal
      open={open}
      title={copy.tasteCardTitle}
      onClose={onClose}
      closeLabel={copy.closeLabel}
      className="modal-taste-card"
    >
      <p className="modal-copy">{copy.tasteCardIntro}</p>
      <div
        className="taste-card-stage"
        style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
        aria-busy={isRendering}
        aria-label={copy.tasteCardPreviewLabel}
      >
        {previewUrl !== null ? (
          <img className="taste-card-preview" src={previewUrl} alt={copy.tasteCardPreviewLabel} />
        ) : (
          <Skeleton className="taste-card-placeholder" />
        )}
        {isRendering && previewUrl !== null && <span className="taste-card-busy" />}
      </div>
      <div className="taste-card-controls">
        <div
          className="segmented-control taste-card-formats"
          role="radiogroup"
          aria-label={copy.tasteCardFormat}
        >
          {TASTE_CARD_FORMAT_ORDER.map((option) => (
            <button
              type="button"
              role="radio"
              aria-checked={format === option}
              className={format === option ? 'is-selected' : ''}
              key={option}
              onClick={() => setFormat(option)}
            >
              {FORMAT_LABELS[option](copy)}
            </button>
          ))}
        </div>
        <fieldset className="taste-card-options">
          <legend>{copy.tasteCardOptionsTitle}</legend>
          <label className="setting-toggle-row taste-card-option">
            <span>{copy.tasteCardShowGenres}</span>
            <input
              type="checkbox"
              checked={options.showGenres}
              onChange={(event) =>
                onOptionsChange({ ...options, showGenres: event.currentTarget.checked })
              }
            />
          </label>
          <label className="setting-toggle-row taste-card-option">
            <span>{copy.tasteCardShowPicks}</span>
            <input
              type="checkbox"
              checked={options.showPicks}
              onChange={(event) =>
                onOptionsChange({ ...options, showPicks: event.currentTarget.checked })
              }
            />
          </label>
          <div
            className="taste-card-layouts"
            role="radiogroup"
            aria-label={copy.tasteCardPicksLayout}
          >
            <span className="taste-card-layouts-label">{copy.tasteCardPicksLayout}</span>
            <div className="segmented-control">
              {PICK_LAYOUTS.map((option) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={options.picksLayout === option}
                  className={options.picksLayout === option ? 'is-selected' : ''}
                  key={option}
                  disabled={!options.showPicks}
                  onClick={() => selectLayout(option)}
                >
                  {PICK_LAYOUT_LABELS[option](copy)}
                </button>
              ))}
            </div>
          </div>
          <label className="taste-card-slider">
            <span>
              {copy.tasteCardCoverSize}
              <strong>{copy.tasteCardCoverSizeValue(effectiveScale)}</strong>
            </span>
            <input
              type="range"
              min={COVER_SCALE_RANGE.min}
              max={coverCeiling}
              step={0.05}
              value={effectiveScale}
              disabled={!options.showPicks}
              onChange={(event) =>
                onOptionsChange({
                  ...options,
                  coverScale: clampTasteCardCoverScale(event.currentTarget.valueAsNumber),
                })
              }
            />
            {/* Only reachable when a section is taking the space the covers want. */}
            {coverCeiling < COVER_SCALE_RANGE.max && (
              <small className="taste-card-slider-note">{copy.tasteCardCoverSizeCapped}</small>
            )}
          </label>
        </fieldset>
        <div className="taste-card-actions">
          <Button
            icon="download"
            onClick={() => void runExport('download')}
            disabled={!canExport || busy !== null}
          >
            {busy === 'download' ? copy.tasteCardGenerating : copy.tasteCardDownload}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runExport('copy')}
            disabled={!canExport || busy !== null}
          >
            {busy === 'copy' ? copy.tasteCardGenerating : copy.tasteCardCopy}
          </Button>
        </div>
      </div>
      {isGridIncomplete && (
        <p className="taste-card-grid-note">
          {copy.tasteCardGridIntro(gridPicks, GRID_SLOT_COUNT)}
        </p>
      )}
      {errorMessage !== null && (
        <p className="taste-card-error" role="alert">
          {errorMessage}
        </p>
      )}
      {onChangePicks !== undefined && (
        <div className="taste-card-change">
          <Button variant="ghost" size="sm" onClick={onChangePicks}>
            {copy.topPicksChange}
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Maps a failure to a specific, actionable message instead of a generic one. */
function describeFailure(error: unknown, copy: AppCopy): string {
  const reason =
    typeof error === 'object' && error !== null && 'reason' in error
      ? String((error as { reason: unknown }).reason)
      : null;
  if (reason === 'render' || reason === 'encode') return copy.tasteCardRenderFailed;
  if (reason === 'asset') return copy.tasteCardAssetFailed;
  return copy.tasteCardRenderFailed;
}
