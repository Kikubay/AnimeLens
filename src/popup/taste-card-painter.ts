import type { AppCopy } from '../locales';
import {
  DEFAULT_TASTE_CARD_RENDER_OPTIONS,
  TASTE_CARD_FORMATS,
  type TasteCardFormat,
  type TasteCardModel,
  type TasteCardRenderOptions,
} from '../profile/taste-card-types';
import {
  DEFAULT_TASTE_CARD_COVER_SCALE,
  TASTE_CARD_COVER_SCALE_RANGE,
  type TasteCardPicksLayout,
} from '../settings/settings-types';

// Painted with canvas primitives rather than a DOM-to-SVG snapshot, which sidesteps XML well-formedness, blob-URL rasterization and canvas origin-cleanliness. The modal previews the very PNG that gets shared, so "what you see" can't drift from "what you share".

const FONT_STACK = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const COLORS = {
  text: '#f4f2ed',
  muted: '#a09ea8',
  dim: '#75737c',
  accent: '#b8a5ff',
  accentStrong: '#987cf4',
  cyan: '#86c8c5',
  line: 'rgba(255, 255, 255, 0.12)',
  track: 'rgba(255, 255, 255, 0.10)',
} as const;

interface CardMetrics {
  readonly padX: number;
  readonly padTop: number;
  readonly padBottom: number;
  readonly brandMark: number;
  readonly brandName: number;
  readonly brandTag: number;
  readonly avatar: number;
  readonly monogram: number;
  readonly eyebrow: number;
  readonly name: number;
  readonly statValue: number;
  readonly statLabel: number;
  readonly statPadX: number;
  readonly statPadY: number;
  readonly statRadius: number;
  readonly sectionLabel: number;
  readonly genreName: number;
  readonly genreScore: number;
  readonly trackHeight: number;
  readonly pickRow: number;
  readonly pickTitle: number;
  readonly pickScore: number;
  readonly pickRank: number;
  readonly pickCover: number;
  readonly footer: number;
  readonly blockGap: number;
  readonly gapIdentity: number;
  readonly gapText: number;
  readonly gapStatValue: number;
  readonly gapGenres: number;
  readonly gapStats: number;
  readonly gapPicks: number;
  readonly gapPickLabel: number;
}

const BASE_METRICS: CardMetrics = {
  padX: 72,
  padTop: 64,
  padBottom: 48,
  brandMark: 54,
  brandName: 30,
  brandTag: 21,
  avatar: 184,
  monogram: 82,
  eyebrow: 22,
  name: 76,
  statValue: 56,
  statLabel: 22,
  statPadX: 24,
  statPadY: 26,
  statRadius: 24,
  sectionLabel: 22,
  genreName: 34,
  genreScore: 28,
  trackHeight: 16,
  pickRow: 68,
  pickTitle: 30,
  pickScore: 26,
  pickRank: 30,
  pickCover: 56,
  footer: 22,
  blockGap: 24,
  gapIdentity: 24,
  gapText: 12,
  gapStatValue: 8,
  gapGenres: 22,
  gapStats: 20,
  gapPicks: 12,
  gapPickLabel: 20,
};

// Tall has 90px more room than portrait, spent on larger type and covers.
const TALL_OVERRIDES: Partial<CardMetrics> = {
  padTop: 68,
  padBottom: 56,
  brandMark: 56,
  avatar: 204,
  monogram: 90,
  name: 80,
  pickCover: 64,
  pickRow: 80,
  gapPickLabel: 22,
  gapPicks: 14,
};

// Square is the same composition with a tighter vertical rhythm.
const SQUARE_OVERRIDES: Partial<CardMetrics> = {
  padX: 64,
  padTop: 46,
  padBottom: 38,
  brandMark: 46,
  brandName: 27,
  brandTag: 19,
  avatar: 136,
  monogram: 62,
  eyebrow: 20,
  name: 62,
  statValue: 46,
  statLabel: 20,
  statPadX: 20,
  statPadY: 20,
  statRadius: 20,
  sectionLabel: 20,
  genreName: 28,
  genreScore: 24,
  trackHeight: 13,
  pickRow: 50,
  pickTitle: 25,
  pickScore: 22,
  pickRank: 24,
  pickCover: 40,
  footer: 20,
  gapIdentity: 18,
  gapText: 10,
  gapStatValue: 6,
  gapGenres: 18,
  gapStats: 16,
  gapPicks: 10,
  gapPickLabel: 16,
};

const METRICS: Readonly<Record<TasteCardFormat, CardMetrics>> = {
  tall: { ...BASE_METRICS, ...TALL_OVERRIDES },
  portrait: BASE_METRICS,
  square: { ...BASE_METRICS, ...SQUARE_OVERRIDES },
};

const GRID_CELL = 60;
// The cover-size search stops here rather than at "barely fits", so the slider's maximum still looks composed rather than cramped.
export const MIN_COMFORTABLE_GAP = 6;
const COVER_ROW_PADDING = 10;
// Visible on a shared image, still far below the content.
const GRID_COLOR = 'rgba(255, 255, 255, 0.055)';

export interface TasteCardImages {
  /** `null` renders the user's monogram. */
  readonly avatar: CanvasImageSource | null;
  /** `null` renders a fallback glyph tile. */
  readonly brand: CanvasImageSource | null;
  /** Positionally aligned with `model.topPicks`. */
  readonly picks: readonly (CanvasImageSource | null)[];
}

export interface PaintTasteCardInput {
  readonly model: TasteCardModel;
  readonly format: TasteCardFormat;
  readonly images: TasteCardImages;
  readonly copy: AppCopy;
  readonly options?: TasteCardRenderOptions;
  readonly scale?: number;
}

interface CardBlock {
  readonly height: number;
  readonly paint: (top: number) => void;
}

export interface TasteCardLayout {
  readonly content: number;
  readonly available: number;
  /** Space shared between consecutive blocks; 0 when the content overflows. */
  readonly gap: number;
  readonly blocks: readonly string[];
}

interface ResolvedLayout {
  readonly metrics: CardMetrics;
  readonly picks: boolean;
  readonly genres: boolean;
  readonly picksGeometry: PicksGeometry;
}

export interface PicksGeometry {
  readonly layout: TasteCardPicksLayout;
  /** List: cover edge and row pitch. Triangle: podium heights. Grid: cell edge. */
  readonly cover: number;
  readonly row: number;
  readonly top: number;
  readonly side: number;
  /** Excludes the section label. */
  readonly body: number;
}

// The 3x3 layout is a full-card composition, not a block in the stack.
export const GRID_COLUMNS = 3;
export const GRID_ROWS = 3;
const GRID_SLOT_COUNT = GRID_COLUMNS * GRID_ROWS;
const GRID_GUTTER = 10;
const GRID_MARGIN = 12;
const GRID_BRAND_STRIP = 64;

interface GridLayout {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
}

// Cells stay square, so on a tall card the vertical slack is unavoidable — it's split evenly above and below rather than dumped at the bottom, with the brand strip reserved so the mark can't land on the last row.
function resolveGridLayout(metrics: CardMetrics, format: TasteCardFormat): GridLayout {
  const { width, height } = TASTE_CARD_FORMATS[format];
  const usableWidth = width - GRID_MARGIN * 2;
  // The brand strip caps the grid height, but is excluded from the centring: counting it there would bias the grid upward by half the strip, which is the lopsided look this layout avoids.
  const cappedHeight = availableHeight(format, metrics) - GRID_BRAND_STRIP;
  const cell = Math.floor(
    Math.min(
      (usableWidth - GRID_GUTTER * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
      (cappedHeight - GRID_GUTTER * (GRID_ROWS - 1)) / GRID_ROWS,
    ),
  );
  const gridWidth = cell * GRID_COLUMNS + GRID_GUTTER * (GRID_COLUMNS - 1);
  const gridHeight = cell * GRID_ROWS + GRID_GUTTER * (GRID_ROWS - 1);
  return {
    cell,
    originX: Math.round((width - gridWidth) / 2),
    originY: Math.round((height - gridHeight) / 2),
  };
}

// Ratios are relative to the list cover size, chosen so the podium costs about the same vertical space at every slider position — it buys much bigger artwork by dropping the per-row title.
const TRIANGLE_TOP_RATIO = 2.0;
const TRIANGLE_SIDE_RATIO = 1.5;
const TRIANGLE_GUTTER = 20;

function resolveLayout(
  model: TasteCardModel,
  format: TasteCardFormat,
  options: TasteCardRenderOptions,
): ResolvedLayout {
  // Clamped to what fits, so a large slider value degrades the spacing instead of pushing the footer off the canvas.
  const effectiveMax = maxFittingCoverScale(model, format, options);
  return buildGeometry(model, format, options, clampCoverScale(options.coverScale, effectiveMax));
}

function buildGeometry(
  model: TasteCardModel,
  format: TasteCardFormat,
  options: TasteCardRenderOptions,
  scale: number,
): ResolvedLayout {
  const metrics = METRICS[format];
  const base = metrics.pickCover * scale;

  // Measured, never assumed, so the fit test stays authoritative.
  const top = Math.round(base * TRIANGLE_TOP_RATIO);
  const side = Math.round(base * TRIANGLE_SIDE_RATIO);
  const listCover = Math.round(base);
  const listRow = Math.max(metrics.pickRow, listCover + COVER_ROW_PADDING);
  const count = Math.max(0, model.topPicks.length);
  const layout: TasteCardPicksLayout =
    options.picksLayout === 'triangle' || options.picksLayout === 'grid'
      ? options.picksLayout
      : 'list';
  const triangleBody = count === 0 ? 0 : top + TRIANGLE_GUTTER + side;
  const listBody = count * listRow + Math.max(0, count - 1) * metrics.gapPicks;
  // The grid sizes itself to the space it is given, so it cannot overflow.
  const gridBody = gridCellSize(metrics, format) * GRID_ROWS + GRID_GUTTER * (GRID_ROWS - 1);

  return {
    metrics,
    // The grid replaces the stack outright, so section toggles do not apply.
    picks: options.showPicks && (layout === 'grid' || count > 0),
    genres: options.showGenres && layout !== 'grid',
    picksGeometry: {
      layout,
      cover: layout === 'triangle' ? top : listCover,
      row: listRow,
      top,
      side,
      body: layout === 'triangle' ? triangleBody : layout === 'grid' ? gridBody : listBody,
    },
  };
}

function gridCellSize(metrics: CardMetrics, format: TasteCardFormat): number {
  return resolveGridLayout(metrics, format).cell;
}

function clampCoverScale(value: number, ceiling: number): number {
  const { min, max } = TASTE_CARD_COVER_SCALE_RANGE;
  const upper = Math.min(max, Math.max(min, ceiling));
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TASTE_CARD_COVER_SCALE;
  return Math.min(upper, Math.max(min, value));
}

// Height is the only binding constraint and content height grows monotonically with the scale, so the binary search is exact. Doubles as the UI's slider maximum, which is why hiding a section visibly widens the range instead of silently clipping.
export function maxFittingCoverScale(
  model: TasteCardModel,
  format: TasteCardFormat,
  options: TasteCardRenderOptions = DEFAULT_TASTE_CARD_RENDER_OPTIONS,
): number {
  const { min, max } = TASTE_CARD_COVER_SCALE_RANGE;
  const fits = (scale: number): boolean => {
    const { metrics, picks, genres, picksGeometry } = buildGeometry(model, format, options, scale);
    const heights = [
      metrics.brandMark,
      identityHeight(metrics),
      statsHeight(metrics),
      ...(genres ? [genresHeight(model, metrics)] : []),
      ...(picks ? [picksHeight(metrics, picksGeometry)] : []),
      footerHeight(metrics),
    ];
    const content = heights.reduce((total, value) => total + value, 0);
    const space = availableHeight(format, metrics);
    if (content > space) return false;
    return (space - content) / Math.max(1, heights.length - 1) >= MIN_COMFORTABLE_GAP;
  };
  let low = min;
  let high = max;
  // 20 iterations resolves the 0.01 precision the slider stores.
  for (let step = 0; step < 20; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * 100) / 100;
}

// Exported so the fit can be asserted in tests without a canvas: an overflow silently clips the footer, which is invisible until someone shares the card.
export function measureTasteCardLayout(
  model: TasteCardModel,
  format: TasteCardFormat,
  options: TasteCardRenderOptions = DEFAULT_TASTE_CARD_RENDER_OPTIONS,
): TasteCardLayout {
  const { metrics, picks, genres, picksGeometry } = resolveLayout(model, format, options);
  if (picksGeometry.layout === 'grid') {
    const available = TASTE_CARD_FORMATS[format].height;
    return {
      content: available,
      available,
      gap: 0,
      blocks: ['grid', 'brand'],
    };
  }
  const names = [
    'brand',
    'identity',
    'stats',
    ...(genres ? ['genres'] : []),
    ...(picks ? ['picks'] : []),
    'footer',
  ];
  const heights = [
    metrics.brandMark,
    identityHeight(metrics),
    statsHeight(metrics),
    ...(genres ? [genresHeight(model, metrics)] : []),
    ...(picks ? [picksHeight(metrics, picksGeometry)] : []),
    footerHeight(metrics),
  ];
  const content = heights.reduce((total, value) => total + value, 0);
  const space = availableHeight(format, metrics);
  const gap = heights.length <= 1 ? 0 : Math.max(0, (space - content) / (heights.length - 1));
  return { content, available: space, gap, blocks: names };
}

function availableHeight(format: TasteCardFormat, metrics: CardMetrics): number {
  return TASTE_CARD_FORMATS[format].height - metrics.padTop - metrics.padBottom;
}

// Painted at the format's nominal size and scaled by the context, with leftover vertical space shared evenly between blocks, like a `space-between` flex layout.
export function paintTasteCard(
  context: CanvasRenderingContext2D,
  input: PaintTasteCardInput,
): void {
  const { model, format, images, copy, scale = 1 } = input;
  const { metrics, picks, genres, picksGeometry } = resolveLayout(
    model,
    format,
    input.options ?? DEFAULT_TASTE_CARD_RENDER_OPTIONS,
  );
  const { width, height } = TASTE_CARD_FORMATS[format];

  context.save();
  if (scale !== 1) context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  // Raster assets are magnified at scale > 1, so ask for the best resampling available.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const blocks: CardBlock[] = [
    {
      height: metrics.brandMark,
      paint: (top) => paintBrand(context, model, metrics, images, width, top),
    },
    {
      height: identityHeight(metrics),
      paint: (top) => paintIdentity(context, model, metrics, images, width, top, copy),
    },
    {
      height: statsHeight(metrics),
      paint: (top) => paintStats(context, model, metrics, width, top, copy),
    },
  ];
  if (genres) {
    blocks.push({
      height: genresHeight(model, metrics),
      paint: (top) => paintGenres(context, model, metrics, width, top, copy),
    });
  }
  if (picks) {
    blocks.push({
      height: picksHeight(metrics, picksGeometry),
      paint: (top) =>
        paintTopPicks(context, model, metrics, images, width, top, copy, picksGeometry),
    });
  }
  blocks.push({
    height: footerHeight(metrics),
    paint: (top) => paintFooter(context, model, metrics, width, top, copy),
  });

  const content = blocks.reduce((total, block) => total + block.height, 0);
  const gap = Math.max(
    0,
    (height - metrics.padTop - metrics.padBottom - content) / (blocks.length - 1),
  );

  // Tracks the avatar so the card's brightest point sits behind it.
  const avatarCenterY = metrics.padTop + blocks[0].height + gap + metrics.avatar / 2;
  paintBackground(context, width, height, avatarCenterY);

  if (picksGeometry.layout === 'grid') {
    // A wall of covers with only the brand mark: the artwork is the whole card.
    paintPickGrid(context, model, images, format);
    paintGridBrand(context, metrics, width, height);
    context.restore();
    return;
  }

  let y = metrics.padTop;
  for (const block of blocks) {
    block.paint(y);
    y += block.height + gap;
  }
  context.restore();
}

// Bottom-up: gradient, glows, faint grid, then a vignette falling to near-black so the card reads as a lit surface.
function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  avatarCenterY: number,
): void {
  const base = context.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#17141f');
  base.addColorStop(0.52, '#0c0c10');
  base.addColorStop(1, '#08080a');
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  paintGlow(context, width * 0.12, height * -0.08, 900, 620, [
    [0, 'rgba(152, 124, 244, 0.42)'],
    [0.62, 'rgba(0, 0, 0, 0)'],
  ]);
  paintGlow(context, width * 1.04, height * 0.06, 760, 560, [
    [0, 'rgba(134, 200, 197, 0.26)'],
    [0.6, 'rgba(0, 0, 0, 0)'],
  ]);
  paintGlow(context, width * 0.5, height * 1.18, 1100, 900, [
    [0, 'rgba(152, 124, 244, 0.22)'],
    [0.66, 'rgba(0, 0, 0, 0)'],
  ]);

  context.save();
  context.strokeStyle = GRID_COLOR;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= width; x += GRID_CELL) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += GRID_CELL) {
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
  }
  context.stroke();
  context.restore();

  context.save();
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(184, 165, 255, 0.18)';
  context.beginPath();
  context.arc(width - 130, -180, 380, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(134, 200, 197, 0.14)';
  context.beginPath();
  context.arc(width - 130, -180, 284, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  // Centre lift follows the avatar so the brightest point sits behind it.
  paintGlow(context, width * 0.5, avatarCenterY, width * 0.66, height * 0.34, [
    [0, 'rgba(184, 165, 255, 0.20)'],
    [0.55, 'rgba(152, 124, 244, 0.07)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  paintGlow(context, width * 0.5, height * 0.5, width * 0.78, height * 0.72, [
    [0, 'rgba(0, 0, 0, 0)'],
    [0.58, 'rgba(0, 0, 0, 0)'],
    [1, 'rgba(0, 0, 0, 0.62)'],
  ]);
}

function paintGlow(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  stops: readonly (readonly [number, string])[],
): void {
  context.save();
  context.translate(centerX, centerY);
  context.scale(1, radiusY / radiusX);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusX, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function paintBrand(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  images: TasteCardImages,
  width: number,
  top: number,
): void {
  const size = metrics.brandMark;
  const left = metrics.padX;
  const centerY = top + size / 2;
  const radius = Math.round(size * 0.29);

  if (images.brand !== null) {
    context.save();
    pathRoundRect(context, left, top, size, size, radius);
    context.clip();
    context.drawImage(images.brand, left, top, size, size);
    context.restore();
  } else {
    pathRoundRect(context, left, top, size, size, radius);
    context.fillStyle = 'rgba(152, 124, 244, 0.12)';
    context.fill();
    context.strokeStyle = 'rgba(184, 165, 255, 0.45)';
    context.lineWidth = 2;
    context.stroke();
    setFont(context, 700, Math.round(size * 0.55));
    context.fillStyle = COLORS.accent;
    context.textAlign = 'center';
    context.fillText('A', left + size / 2, centerY);
    context.textAlign = 'left';
  }

  setFont(context, 700, metrics.brandName);
  setLetterSpacing(context, '0.01em');
  context.fillStyle = COLORS.text;
  context.fillText('AnimeLens', left + size + 16, centerY);
  setLetterSpacing(context, '0px');

  // Stated up front, since someone outside the extension has no other way to know which provider these stats came from.
  const provider = model.providerName;
  if (provider !== null && provider.length > 0) {
    const text = ellipsize(context, provider, width * 0.4);
    setFont(context, 600, metrics.brandTag);
    setLetterSpacing(context, '0.12em');
    const chipWidth = context.measureText(text).width + 36;
    const chipHeight = Math.round(metrics.brandTag * 2);
    const chipX = width - metrics.padX - chipWidth;
    pathRoundRect(context, chipX, centerY - chipHeight / 2, chipWidth, chipHeight, chipHeight / 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.03)';
    context.fill();
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = COLORS.muted;
    context.textAlign = 'center';
    context.fillText(text, chipX + chipWidth / 2, centerY);
    setLetterSpacing(context, '0px');
    context.textAlign = 'left';
  }
}

function paintIdentity(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  images: TasteCardImages,
  width: number,
  top: number,
  copy: AppCopy,
): void {
  const centerX = width / 2;
  const size = metrics.avatar;
  const centerY = top + size / 2;
  const radius = size / 2;

  // Bloom goes down first so it sits behind the portrait.
  context.save();
  context.shadowColor = 'rgba(152, 124, 244, 0.55)';
  context.shadowBlur = metrics.avatar * 0.28;
  context.fillStyle = 'rgba(184, 165, 255, 0.30)';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (images.avatar !== null) {
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();
    const intrinsic = imageSize(images.avatar);
    const cover = Math.max(size / intrinsic.width, size / intrinsic.height);
    const drawWidth = intrinsic.width * cover;
    const drawHeight = intrinsic.height * cover;
    context.drawImage(
      images.avatar,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
  } else {
    const fill = context.createLinearGradient(
      centerX - radius,
      centerY - radius,
      centerX + radius,
      centerY + radius,
    );
    fill.addColorStop(0, '#2a2440');
    fill.addColorStop(1, '#16141d');
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    setFont(context, 700, metrics.monogram);
    context.fillStyle = COLORS.accent;
    context.textAlign = 'center';
    context.fillText(model.monogram, centerX, centerY);
    context.textAlign = 'left';
  }

  // Stroked over the portrait edge, not under it.
  context.save();
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(184, 165, 255, 0.55)';
  context.beginPath();
  context.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(11, 11, 14, 0.9)';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  let y = top + size + metrics.gapIdentity;
  const eyebrowHeight = lineHeight(metrics.eyebrow, 1.35);
  setFont(context, 700, metrics.eyebrow);
  setLetterSpacing(context, '0.22em');
  context.fillStyle = COLORS.cyan;
  context.textAlign = 'center';
  context.fillText(copy.tasteCardSubtitle.toLocaleUpperCase(), centerX, y + eyebrowHeight / 2);
  setLetterSpacing(context, '0px');
  y += eyebrowHeight + metrics.gapText;

  const nameHeight = lineHeight(metrics.name, 1.05);
  const maxNameWidth = width - metrics.padX * 2;
  // An empty name means the provider profile had no username to show.
  const displayName = model.displayName === '' ? copy.tasteCardDefaultName : model.displayName;
  const name = ellipsize(context, displayName, maxNameWidth);
  setFont(context, 800, fitFontSize(context, name, maxNameWidth, metrics.name, 40));
  context.fillStyle = COLORS.text;
  context.fillText(name, centerX, y + nameHeight / 2);
  context.textAlign = 'left';
}

function paintTopPicks(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  images: TasteCardImages,
  width: number,
  top: number,
  copy: AppCopy,
  geometry: PicksGeometry,
): void {
  const labelHeight = lineHeight(metrics.sectionLabel, 1.35);
  drawSectionLabel(context, copy.tasteCardTopRated, metrics, width, top, labelHeight);
  const bodyTop = top + labelHeight + metrics.gapPickLabel;
  if (geometry.layout === 'triangle') {
    paintPickTriangle(context, model, metrics, images, width, bodyTop, geometry);
    return;
  }
  paintPickList(context, model, metrics, images, width, bodyTop, geometry);
}

// A cell with no artwork stays a dim placeholder rather than being filled with something else, so a partial grid reads as incomplete instead of misleading.
function paintPickGrid(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  images: TasteCardImages,
  format: TasteCardFormat,
): void {
  const metrics = METRICS[format];
  const { cell, originX, originY } = resolveGridLayout(metrics, format);

  for (let index = 0; index < GRID_SLOT_COUNT; index += 1) {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const x = originX + column * (cell + GRID_GUTTER);
    const y = originY + row * (cell + GRID_GUTTER);
    const image = images.picks[index] ?? null;

    if (image === null) {
      pathRoundRect(context, x, y, cell, cell, GRID_GUTTER);
      context.fillStyle = 'rgba(255, 255, 255, 0.04)';
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      context.lineWidth = 2;
      context.stroke();
      continue;
    }
    context.save();
    pathRoundRect(context, x, y, cell, cell, GRID_GUTTER);
    context.clip();
    const intrinsic = imageSize(image);
    const cover = Math.max(cell / intrinsic.width, cell / intrinsic.height);
    const drawWidth = intrinsic.width * cover;
    const drawHeight = intrinsic.height * cover;
    context.drawImage(
      image,
      x + (cell - drawWidth) / 2,
      y + (cell - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
  }
}

function paintGridBrand(
  context: CanvasRenderingContext2D,
  metrics: CardMetrics,
  width: number,
  height: number,
): void {
  const size = Math.max(16, Math.round(width * 0.022));
  const margin = GRID_MARGIN + Math.round(size * 0.2);
  const baselineY = height - margin - size / 2;
  context.save();
  // A soft scrim keeps the mark legible over a bright cover.
  const scrim = context.createLinearGradient(0, baselineY - size, 0, height);
  scrim.addColorStop(0, 'rgba(8, 8, 10, 0)');
  scrim.addColorStop(1, 'rgba(8, 8, 10, 0.72)');
  context.fillStyle = scrim;
  context.fillRect(0, height - size * 3, width, size * 3);

  const dot = size * 0.34;
  context.beginPath();
  context.arc(metrics.padX + dot / 2, baselineY, dot / 2, 0, Math.PI * 2);
  context.fillStyle = 'rgba(184, 165, 255, 0.7)';
  context.fill();
  setFont(context, 600, size);
  context.fillStyle = 'rgba(244, 242, 237, 0.72)';
  context.textAlign = 'left';
  context.fillText('AnimeLens', metrics.padX + dot + size * 0.45, baselineY);
  context.restore();
}

function paintPickList(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  images: TasteCardImages,
  width: number,
  top: number,
  geometry: PicksGeometry,
): void {
  const { cover, row } = geometry;
  const contentWidth = width - metrics.padX * 2;
  const scoreWidth = 64;
  const rankInset = cover + 14 + metrics.pickRank + 14;
  const titleWidth = contentWidth - rankInset - scoreWidth;
  let y = top;

  model.topPicks.forEach((pick, index) => {
    const centerY = y + row / 2;
    const coverTop = centerY - cover / 2;
    drawCover(context, images.picks[index] ?? null, metrics, metrics.padX, coverTop, cover);

    const rankX = metrics.padX + cover + 14;
    const rank = String(index + 1);
    const radius = metrics.pickRank / 2;
    context.beginPath();
    context.arc(rankX + radius, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(184, 165, 255, 0.14)';
    context.fill();
    setFont(context, 700, Math.round(metrics.pickRank * 0.5));
    context.fillStyle = COLORS.accent;
    context.textAlign = 'center';
    context.fillText(rank, rankX + radius, centerY);
    context.textAlign = 'left';

    setFont(context, 600, metrics.pickTitle);
    context.fillStyle = COLORS.text;
    context.fillText(ellipsize(context, pick.title, titleWidth), metrics.padX + rankInset, centerY);

    setFont(context, 700, metrics.pickScore);
    context.fillStyle = COLORS.cyan;
    context.textAlign = 'right';
    context.fillText(String(pick.score), width - metrics.padX, centerY);
    context.textAlign = 'left';
    y += row + metrics.gapPicks;
  });
}

// Trades the titles for markedly bigger thumbnails, with rank and score overlaid on each cover so no vertical space is spent.
function paintPickTriangle(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  images: TasteCardImages,
  width: number,
  top: number,
  geometry: PicksGeometry,
): void {
  const contentWidth = width - metrics.padX * 2;
  const centerX = metrics.padX + contentWidth / 2;
  const { top: topSize, side: sideSize } = geometry;

  const baseWidth = sideSize * 2 + TRIANGLE_GUTTER;
  const baseLeft = metrics.padX + (contentWidth - baseWidth) / 2;
  const slots: readonly { x: number; y: number; size: number }[] = [
    { x: centerX - topSize / 2, y: top, size: topSize },
    { x: baseLeft, y: top + topSize + TRIANGLE_GUTTER, size: sideSize },
    {
      x: baseLeft + sideSize + TRIANGLE_GUTTER,
      y: top + topSize + TRIANGLE_GUTTER,
      size: sideSize,
    },
  ];

  model.topPicks.forEach((pick, index) => {
    const slot = slots[index];
    if (slot === undefined) return;
    const isWinner = index === 0;
    drawCover(context, images.picks[index] ?? null, metrics, slot.x, slot.y, slot.size, pick.title);
    if (isWinner) {
      // The halo is what makes the winner read as the pick rather than just the biggest tile.
      context.save();
      context.lineWidth = Math.max(2, Math.round(slot.size * 0.035));
      context.strokeStyle = COLORS.accent;
      pathRoundRect(
        context,
        slot.x - 1,
        slot.y - 1,
        slot.size + 2,
        slot.size + 2,
        Math.max(6, Math.round(slot.size * 0.18)),
      );
      context.stroke();
      context.restore();
    }
    drawPickBadge(context, slot.x, slot.y, slot.size, String(index + 1), metrics, isWinner);
    drawPickBadge(
      context,
      slot.x,
      slot.y,
      slot.size,
      String(pick.score),
      metrics,
      isWinner,
      'score',
    );
  });
}

function drawPickBadge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  label: string,
  metrics: CardMetrics,
  isWinner: boolean,
  corner: 'rank' | 'score' = 'rank',
): void {
  const fontSize = Math.max(11, Math.round(size * (corner === 'rank' ? 0.15 : 0.13)));
  setFont(context, 700, fontSize);
  const textWidth = context.measureText(label).width;
  const padX = Math.max(4, Math.round(fontSize * 0.5));
  const height = Math.round(fontSize * 1.7);
  const width = textWidth + padX * 2;
  const inset = Math.max(3, Math.round(size * 0.05));
  const left = corner === 'rank' ? x + inset : x + size - inset - width;
  const topY = corner === 'rank' ? y + inset : y + size - inset - height;

  pathRoundRect(context, left, topY, width, height, height / 2);
  context.fillStyle = 'rgba(11, 11, 14, 0.78)';
  context.fill();
  context.strokeStyle = isWinner ? 'rgba(184, 165, 255, 0.65)' : 'rgba(255, 255, 255, 0.18)';
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = corner === 'rank' ? COLORS.accent : COLORS.cyan;
  context.textAlign = 'center';
  context.fillText(label, left + width / 2, topY + height / 2);
  context.textAlign = 'left';
  void metrics;
}

// Falls back to a muted tile when the provider had no art or the download failed, so a row never renders as a hole.
function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  metrics: CardMetrics,
  left: number,
  top: number,
  size: number,
  /** Printed inside the tile when there's no artwork — the podium has nowhere else to show the title. */
  fallbackTitle?: string,
): void {
  const radius = Math.max(6, Math.round(size * 0.18));
  if (image !== null) {
    context.save();
    pathRoundRect(context, left, top, size, size, radius);
    context.clip();
    const intrinsic = imageSize(image);
    const cover = Math.max(size / intrinsic.width, size / intrinsic.height);
    const drawWidth = intrinsic.width * cover;
    const drawHeight = intrinsic.height * cover;
    context.drawImage(
      image,
      left + (size - drawWidth) / 2,
      top + (size - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
    return;
  }
  pathRoundRect(context, left, top, size, size, radius);
  context.fillStyle = 'rgba(255, 255, 255, 0.07)';
  context.fill();
  context.strokeStyle = COLORS.line;
  context.lineWidth = 1;
  context.stroke();
  if (fallbackTitle === undefined) return;
  const fontSize = Math.max(10, Math.round(size * 0.11));
  setFont(context, 600, fontSize);
  context.fillStyle = COLORS.muted;
  context.textAlign = 'center';
  const maxWidth = size * 0.78;
  const lines = wrapText(context, fallbackTitle, maxWidth, 3);
  const lineHeightPx = fontSize * 1.25;
  const startY = top + size / 2 - ((lines.length - 1) * lineHeightPx) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, left + size / 2, startY + index * lineHeightPx);
  });
  context.textAlign = 'left';
  void metrics;
}

function paintStats(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  width: number,
  top: number,
  copy: AppCopy,
): void {
  const contentWidth = width - metrics.padX * 2;
  const tileWidth = (contentWidth - metrics.gapStats * 2) / 3;
  const tileHeight = statsHeight(metrics);
  const averageScore =
    model.stats.averageScore === null ? '—' : model.stats.averageScore.toFixed(1);
  const tiles: readonly { value: string; label: string; accent: boolean }[] = [
    { value: String(model.stats.analyzedCount), label: copy.tasteCardAnalyzed, accent: false },
    { value: averageScore, label: copy.tasteCardAverageScore, accent: true },
    { value: String(model.stats.ratedCount), label: copy.tasteCardRated, accent: false },
  ];

  tiles.forEach((tile, index) => {
    const x = metrics.padX + index * (tileWidth + metrics.gapStats);
    pathRoundRect(context, x, top, tileWidth, tileHeight, metrics.statRadius);
    context.fillStyle = 'rgba(255, 255, 255, 0.04)';
    context.fill();
    context.strokeStyle = COLORS.line;
    context.lineWidth = 2;
    context.stroke();

    const valueHeight = lineHeight(metrics.statValue, 1);
    const labelHeight = lineHeight(metrics.statLabel, 1.3);
    context.textAlign = 'center';
    setFont(context, 800, metrics.statValue);
    context.fillStyle = tile.accent ? COLORS.accent : COLORS.text;
    context.fillText(
      ellipsize(context, tile.value, tileWidth - metrics.statPadX * 2),
      x + tileWidth / 2,
      top + metrics.statPadY + valueHeight / 2,
    );
    setFont(context, 600, metrics.statLabel);
    context.fillStyle = COLORS.muted;
    context.fillText(
      ellipsize(context, tile.label, tileWidth - metrics.statPadX * 2),
      x + tileWidth / 2,
      top + metrics.statPadY + valueHeight + metrics.gapStatValue + labelHeight / 2,
    );
    context.textAlign = 'left';
  });
}

function paintGenres(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  width: number,
  top: number,
  copy: AppCopy,
): void {
  const labelHeight = lineHeight(metrics.sectionLabel, 1.35);
  drawSectionLabel(context, copy.tasteCardTopGenres, metrics, width, top, labelHeight, {
    text: copy.tasteCardAffinity,
    size: Math.round(metrics.sectionLabel * 0.86),
  });

  let y = top + labelHeight + metrics.gapGenres;
  if (model.topGenres.length === 0) {
    const emptyHeight = lineHeight(metrics.genreName, 1.35);
    setFont(context, 500, metrics.genreName);
    context.fillStyle = COLORS.muted;
    context.fillText(copy.tasteCardNoGenres, metrics.padX, y + emptyHeight / 2);
    return;
  }

  const nameHeight = lineHeight(metrics.genreName, 1.35);
  const trackWidth = width - metrics.padX * 2;
  for (const genre of model.topGenres) {
    context.fillStyle = COLORS.text;
    setFont(context, 700, metrics.genreName);
    context.fillText(
      ellipsize(context, genre.name, trackWidth - 120),
      metrics.padX,
      y + nameHeight / 2,
    );
    context.fillStyle = COLORS.accent;
    setFont(context, 700, metrics.genreScore);
    context.textAlign = 'right';
    context.fillText(`${genre.score}%`, width - metrics.padX, y + nameHeight / 2);
    context.textAlign = 'left';

    const trackTop = y + nameHeight + metrics.gapText;
    pathRoundRect(
      context,
      metrics.padX,
      trackTop,
      trackWidth,
      metrics.trackHeight,
      metrics.trackHeight / 2,
    );
    context.fillStyle = COLORS.track;
    context.fill();
    const fillWidth = Math.max(0, Math.min(trackWidth, (trackWidth * genre.score) / 100));
    if (fillWidth > 0) {
      const fill = context.createLinearGradient(metrics.padX, 0, metrics.padX + trackWidth, 0);
      fill.addColorStop(0, COLORS.accentStrong);
      fill.addColorStop(1, COLORS.cyan);
      pathRoundRect(
        context,
        metrics.padX,
        trackTop,
        fillWidth,
        metrics.trackHeight,
        metrics.trackHeight / 2,
      );
      context.fillStyle = fill;
      context.fill();
    }
    y += genreRowHeight(metrics) + metrics.gapGenres;
  }
}

// The muted qualifier is what tells a viewer what the percentages actually measure.
function drawSectionLabel(
  context: CanvasRenderingContext2D,
  label: string,
  metrics: CardMetrics,
  width: number,
  top: number,
  labelHeight: number,
  qualifier?: { readonly text: string; readonly size: number },
): void {
  const centerY = top + labelHeight / 2;
  const text = label.toLocaleUpperCase();
  setFont(context, 700, metrics.sectionLabel);
  setLetterSpacing(context, '0.18em');
  context.fillStyle = COLORS.muted;
  context.fillText(text, metrics.padX, centerY);
  let ruleStart = metrics.padX + context.measureText(text).width + 18;
  setLetterSpacing(context, '0px');

  if (qualifier !== undefined) {
    setFont(context, 500, qualifier.size);
    context.fillStyle = COLORS.dim;
    context.fillText(qualifier.text, ruleStart, centerY);
    ruleStart += context.measureText(qualifier.text).width + 18;
  }

  const ruleEnd = width - metrics.padX;
  if (ruleEnd - ruleStart <= 24) return;
  const rule = context.createLinearGradient(ruleStart, 0, ruleEnd, 0);
  rule.addColorStop(0, 'rgba(184, 165, 255, 0.55)');
  rule.addColorStop(1, 'rgba(184, 165, 255, 0)');
  context.fillStyle = rule;
  context.fillRect(ruleStart, centerY - 1, ruleEnd - ruleStart, 2);
}

function paintFooter(
  context: CanvasRenderingContext2D,
  model: TasteCardModel,
  metrics: CardMetrics,
  width: number,
  top: number,
  copy: AppCopy,
): void {
  const centerY = top + footerHeight(metrics) / 2;
  const dot = 12;
  context.beginPath();
  context.arc(metrics.padX + dot / 2, centerY, dot / 2, 0, Math.PI * 2);
  context.fillStyle = COLORS.accent;
  context.fill();

  setFont(context, 600, metrics.footer);
  context.fillStyle = COLORS.muted;
  const brand = copy.tasteCardFooter;
  context.fillText(brand, metrics.padX + dot + 12, centerY);

  // No tagline simply leaves the right side empty rather than falling back to filler text.
  const brandEnd = metrics.padX + dot + 12 + context.measureText(brand).width;
  const available = width - metrics.padX - brandEnd - 24;
  if (model.headline !== null && available > 24) {
    setFont(context, 600, metrics.footer);
    context.fillStyle = COLORS.dim;
    context.textAlign = 'right';
    context.fillText(ellipsize(context, model.headline, available), width - metrics.padX, centerY);
    context.textAlign = 'left';
  }
}

function identityHeight(metrics: CardMetrics): number {
  return (
    metrics.avatar +
    metrics.gapIdentity +
    lineHeight(metrics.eyebrow, 1.35) +
    metrics.gapText +
    lineHeight(metrics.name, 1.05)
  );
}

function statsHeight(metrics: CardMetrics): number {
  return (
    metrics.statPadY * 2 +
    lineHeight(metrics.statValue, 1) +
    metrics.gapStatValue +
    lineHeight(metrics.statLabel, 1.3)
  );
}

function genresHeight(model: TasteCardModel, metrics: CardMetrics): number {
  const label = lineHeight(metrics.sectionLabel, 1.35);
  if (model.topGenres.length === 0)
    return label + metrics.gapGenres + lineHeight(metrics.genreName, 1.35);
  const rows =
    model.topGenres.length * genreRowHeight(metrics) +
    (model.topGenres.length - 1) * metrics.gapGenres;
  return label + metrics.gapGenres + rows;
}

function picksHeight(metrics: CardMetrics, geometry: PicksGeometry): number {
  return lineHeight(metrics.sectionLabel, 1.35) + metrics.gapPickLabel + geometry.body;
}

function genreRowHeight(metrics: CardMetrics): number {
  return lineHeight(metrics.genreName, 1.35) + metrics.gapText + metrics.trackHeight;
}

function footerHeight(metrics: CardMetrics): number {
  return lineHeight(metrics.footer, 1.3);
}

function lineHeight(size: number, factor: number): number {
  return Math.round(size * factor);
}

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const candidate = image as { width?: number; height?: number };
  const width = typeof candidate.width === 'number' && candidate.width > 0 ? candidate.width : 1;
  const height =
    typeof candidate.height === 'number' && candidate.height > 0 ? candidate.height : 1;
  return { width, height };
}

function setFont(context: CanvasRenderingContext2D, weight: number, size: number): void {
  context.font = `${weight} ${size}px ${FONT_STACK}`;
}

function setLetterSpacing(context: CanvasRenderingContext2D, value: string): void {
  if ('letterSpacing' in context) {
    (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
  }
}

function pathRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, r);
    return;
  }
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function ellipsize(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (context.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (context.measureText(`${text.slice(0, middle)}…`).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${text.slice(0, low)}…`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  let consumed = 0;
  for (const word of words) {
    if (lines.length === maxLines - 1) break;
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (current.length === 0 || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      consumed += 1;
      continue;
    }
    lines.push(current);
    current = word;
    consumed += 1;
  }
  if (current.length > 0 && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) return [''];
  // Anything left over means the title was truncated, so mark the last line.
  if (consumed < words.length) {
    const last = lines.length - 1;
    lines[last] = ellipsize(context, lines[last], maxWidth);
  }
  return lines;
}

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  minimum: number,
): number {
  let current = size;
  setFont(context, 800, current);
  while (current > minimum && context.measureText(text).width > maxWidth) {
    current -= 2;
    setFont(context, 800, current);
  }
  return current;
}
