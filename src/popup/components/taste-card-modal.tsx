import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppCopy } from '../../locales';
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
  cosmeticsForSlot,
  cosmeticRequirementLabel,
  cosmeticRequirementProgress,
  type CosmeticId,
  type CosmeticSlot,
  type CosmeticUnlockContext,
  type TasteCardCosmetics,
} from '../../profile/cosmetics';
import {
  clampTasteCardCoverScale,
  TASTE_CARD_COVER_SCALE_RANGE as COVER_SCALE_RANGE,
  type TasteCardExportFormat,
  type TasteCardPicksLayout,
} from '../../settings/settings-types';
import { Button, Icon, Modal, Skeleton } from './ui';
import { RadioGroup } from './radio-group';
import { maxFittingCoverScale } from '../taste-card-painter';
import {
  copyPngBlobToClipboard,
  downloadPngBlob,
  fetchAssetAsDataUrl,
  fetchBrandAssetAsDataUrl,
  prepareTasteCardPreview,
  renderTasteCardGif,
  renderTasteCardPng,
  type TasteCardPreviewPlan,
} from '../taste-card-image';

const DOWNLOAD_FILENAME = 'AnimeLens_TasteCard';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const LARGE_ART_THRESHOLD = 1.6;

interface TasteCardModalProps {
  readonly open: boolean;
  readonly model: TasteCardModel;
  readonly profile: UserProfile | null;
  readonly copy: AppCopy;
  readonly onClose: () => void;
  readonly onFeedback: (message: string) => void;
  readonly onChangePicks?: () => void;
  readonly options: TasteCardRenderOptions;
  readonly onOptionsChange: (options: TasteCardRenderOptions) => void;
  readonly unlockContext: CosmeticUnlockContext;
  readonly unlocked: ReadonlySet<CosmeticId>;
  readonly onCosmeticsChange: (cosmetics: TasteCardCosmetics) => void;
  readonly exportFormat: TasteCardExportFormat;
  readonly onExportFormatChange: (format: TasteCardExportFormat) => void;
  readonly onRequestGridPicker?: () => void;
}

type ExportAction = 'download' | 'copy';

interface TasteCardAssets {
  readonly avatar: string | null;
  readonly brand: string | null;
  readonly picks: readonly (string | null)[];
}

const EMPTY_ASSETS: TasteCardAssets = { avatar: null, brand: null, picks: [] };

const FORMAT_LABELS: Readonly<Record<TasteCardFormat, (copy: AppCopy) => string>> = {
  tall: (copy) => copy.tasteCardFormatTall,
  portrait: (copy) => copy.tasteCardFormatPortrait,
  square: (copy) => copy.tasteCardFormatSquare,
};

const PICK_LAYOUTS: readonly TasteCardPicksLayout[] = ['list', 'triangle', 'grid'];
const PICK_LAYOUT_LABELS: Readonly<Record<TasteCardPicksLayout, (copy: AppCopy) => string>> = {
  list: (copy) => copy.tasteCardLayoutList,
  triangle: (copy) => copy.tasteCardLayoutTriangle,
  grid: (copy) => copy.tasteCardLayoutGrid,
};

const COSMETIC_SLOTS: readonly CosmeticSlot[] = ['frame', 'palette'];
const SLOT_LABELS: Readonly<Record<CosmeticSlot, (copy: AppCopy) => string>> = {
  frame: (copy) => copy.cosmeticSlotFrame,
  palette: (copy) => copy.cosmeticSlotPalette,
};

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
  unlockContext,
  unlocked,
  onCosmeticsChange,
  exportFormat,
  onExportFormatChange,
  onRequestGridPicker,
}: TasteCardModalProps) {
  const mountedRef = useRef(true);
  const assetsRef = useRef<Promise<TasteCardAssets>>(Promise.resolve(EMPTY_ASSETS));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const planRef = useRef<TasteCardPreviewPlan | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [format, setFormat] = useState<TasteCardFormat>('portrait');
  const [pending, setPending] = useState<'preparing' | 'ready' | 'failed'>('preparing');
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const { showPicks } = options;
  useEffect(() => {
    if (!open) return undefined;
    const avatarUrl = profile?.avatarUrl ?? null;
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

  useEffect(() => {
    if (!open) {
      startRef.current = null;
      setPending('preparing');
      return undefined;
    }
    let disposed = false;
    setErrorMessage(null);

    const prepare = async () => {
      const assets = await assetsRef.current;
      if (disposed || !mountedRef.current) return;
      const canvas = canvasRef.current;
      if (canvas === null) return;
      const plan = await prepareTasteCardPreview(
        canvas,
        { model, format, copy, options },
        { avatarDataUrl: assets.avatar, brandDataUrl: assets.brand, pickDataUrls: assets.picks },
        exportFormat === 'gif' && !reducedMotion,
      );
      if (disposed || !mountedRef.current) return;
      planRef.current = plan;
      plan.paint(0);
      setPending('ready');
      if (plan.loopMs > 0) {
        if (startRef.current === null) startRef.current = performance.now();
        const step = (now: number) => {
          const active = planRef.current;
          const anchor = startRef.current;
          if (active === null || active.loopMs <= 0) return;
          if (anchor !== null) {
            active.paint(((now - anchor) % active.loopMs) / active.loopMs);
          }
          frameRef.current = window.requestAnimationFrame(step);
        };
        frameRef.current = window.requestAnimationFrame(step);
      }
    };

    void prepare().catch((error: unknown) => {
      if (disposed || !mountedRef.current) return;
      setPending('failed');
      setErrorMessage(describeFailure(error, copy));
      console.error('[AnimeLens] taste card render failed', error);
    });

    return () => {
      disposed = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      planRef.current = null;
    };
  }, [open, profile?.avatarUrl, model, format, copy, options, exportFormat, reducedMotion]);

  const spec = TASTE_CARD_FORMATS[format];

  const runExport = useCallback(
    async (action: ExportAction) => {
      if (busy !== null) return;
      setBusy(action);
      try {
        const assets = await assetsRef.current;
        const shared = {
          model,
          format,
          copy,
          avatarDataUrl: assets.avatar,
          brandDataUrl: assets.brand,
          pickDataUrls: assets.picks,
          options,
        };
        const animated = exportFormat === 'gif' && !reducedMotion;
        const blob = animated ? await renderTasteCardGif(shared) : await renderTasteCardPng(shared);
        if (action === 'download') {
          const extension = animated ? 'gif' : 'png';
          downloadPngBlob(blob, `${DOWNLOAD_FILENAME}.${extension}`);
          onFeedback(copy.tasteCardDownloaded);
          return;
        }
        let copyBlob = blob.type === 'image/png' ? blob : null;
        if (copyBlob === null) {
          copyBlob = await renderTasteCardPng(shared);
        }
        const outcome = await copyPngBlobToClipboard(copyBlob);
        if (outcome === 'copied') {
          onFeedback(copy.tasteCardCopied);
          return;
        }
        downloadPngBlob(copyBlob, `${DOWNLOAD_FILENAME}.png`);
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
    [busy, copy, exportFormat, format, model, onFeedback, options, reducedMotion],
  );

  const isReady = pending === 'ready';

  const gridPicks = model.topPicks.length;
  const isGridIncomplete = options.picksLayout === 'grid' && gridPicks < GRID_SLOT_COUNT;
  const canExport = isReady && !isGridIncomplete && model.hasData;

  const selectLayout = (option: TasteCardPicksLayout) => {
    onOptionsChange({ ...options, picksLayout: option });
    if (option === 'grid' && onRequestGridPicker !== undefined) onRequestGridPicker();
  };

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
        aria-busy={pending === 'preparing'}
        aria-label={copy.tasteCardPreviewLabel}
      >
        <canvas ref={canvasRef} className="taste-card-preview" aria-hidden="true" />
        {pending !== 'ready' && <Skeleton className="taste-card-placeholder" />}
        {pending === 'preparing' && (
          <span className="taste-card-busy" role="status" aria-label={copy.tasteCardGenerating}>
            <span className="taste-card-loader" />
          </span>
        )}
      </div>
      <div className="taste-card-controls">
        <RadioGroup<TasteCardFormat>
          className="segmented-control taste-card-formats"
          ariaLabel={copy.tasteCardFormat}
          value={format}
          onChange={setFormat}
          options={TASTE_CARD_FORMAT_ORDER.map((option) => ({
            value: option,
            label: FORMAT_LABELS[option](copy),
          }))}
        />
        <RadioGroup<TasteCardExportFormat>
          className="segmented-control taste-card-export-formats"
          ariaLabel={copy.tasteCardExportFormat}
          value={exportFormat}
          onChange={onExportFormatChange}
          options={[
            { value: 'png', label: copy.tasteCardExportPng },
            { value: 'gif', label: copy.tasteCardExportGif, disabled: reducedMotion },
          ]}
        />
        {exportFormat === 'gif' && !reducedMotion && (
          <p className="taste-card-gif-note">{copy.tasteCardGifHint}</p>
        )}
        {reducedMotion && <p className="taste-card-gif-note">{copy.tasteCardReducedMotion}</p>}
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
          <div className="taste-card-layouts">
            <span className="taste-card-layouts-label">{copy.tasteCardPicksLayout}</span>
            <RadioGroup<TasteCardPicksLayout>
              className="segmented-control"
              ariaLabel={copy.tasteCardPicksLayout}
              value={options.picksLayout}
              onChange={selectLayout}
              options={PICK_LAYOUTS.map((option) => ({
                value: option,
                label: PICK_LAYOUT_LABELS[option](copy),
                disabled: !options.showPicks,
              }))}
            />
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
            {coverCeiling < COVER_SCALE_RANGE.max && (
              <small className="taste-card-slider-note">{copy.tasteCardCoverSizeCapped}</small>
            )}
          </label>
          {COSMETIC_SLOTS.map((slot) => (
            <div className="taste-card-styles" key={slot}>
              <span className="taste-card-layouts-label">{SLOT_LABELS[slot](copy)}</span>
              <RadioGroup<CosmeticId>
                className="taste-card-style-row"
                ariaLabel={SLOT_LABELS[slot](copy)}
                value={options.cosmetics[slot]}
                onChange={(cosmeticId) =>
                  onCosmeticsChange({ ...options.cosmetics, [slot]: cosmeticId })
                }
                itemClassName="taste-card-style"
                options={cosmeticsForSlot(slot).map((cosmetic) => {
                  const isUnlocked = unlocked.has(cosmetic.id);
                  const progress = cosmeticRequirementProgress(cosmetic, unlockContext);
                  return {
                    value: cosmetic.id,
                    label: cosmetic.label(copy),
                    disabled: !isUnlocked,
                    className: isUnlocked ? '' : 'is-locked',
                    title: isUnlocked
                      ? cosmetic.label(copy)
                      : `${cosmetic.label(copy)} · ${cosmeticRequirementLabel(cosmetic, copy)}${
                          progress === null
                            ? ''
                            : ` · ${copy.cosmeticProgress(progress.current, progress.target)}`
                        }`,
                    content: (
                      <>
                        <span
                          className={`taste-card-style-swatch is-${cosmetic.id}`}
                          aria-hidden="true"
                        >
                          {!isUnlocked && <Icon name="lock" size={11} />}
                        </span>
                        {cosmetic.label(copy)}
                      </>
                    ),
                  };
                })}
              />
            </div>
          ))}
        </fieldset>
        <div className="taste-card-actions">
          <Button
            icon="download"
            onClick={() => void runExport('download')}
            disabled={!canExport || busy !== null}
          >
            {busy === 'download'
              ? copy.tasteCardGenerating
              : exportFormat === 'gif' && !reducedMotion
                ? copy.tasteCardDownloadGif
                : copy.tasteCardDownload}
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

function describeFailure(error: unknown, copy: AppCopy): string {
  const reason =
    typeof error === 'object' && error !== null && 'reason' in error
      ? String((error as { reason: unknown }).reason)
      : null;
  if (reason === 'render' || reason === 'encode') return copy.tasteCardRenderFailed;
  if (reason === 'asset') return copy.tasteCardAssetFailed;
  return copy.tasteCardRenderFailed;
}
