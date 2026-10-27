import type { AppCopy } from '../locales';
import type { FrameId, PaletteId } from '../profile/cosmetics';
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

const FONT_STACK = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const TAU = Math.PI * 2;

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
export const MIN_COMFORTABLE_GAP = 6;
const COVER_ROW_PADDING = 10;
const GRID_COLOR = 'rgba(255, 255, 255, 0.055)';

interface CardPalette {
  readonly base: readonly [string, string, string];
  readonly glowPrimary: string;
  readonly glowSecondary: string;
  readonly glowFloor: string;
  readonly grid: string;
  readonly arcPrimary: string;
  readonly arcSecondary: string;
  readonly centerLift: readonly [string, string];
  readonly accent: string;
  readonly accentSoft: string;
  readonly accentBright: string;
  readonly arcSweep: readonly [string, string];
}

const PALETTES: Readonly<Record<PaletteId, CardPalette>> = {
  'palette-aurora': {
    base: ['#17141f', '#0c0c10', '#08080a'],
    glowPrimary: 'rgba(152, 124, 244, 0.42)',
    glowSecondary: 'rgba(134, 200, 197, 0.26)',
    glowFloor: 'rgba(152, 124, 244, 0.22)',
    grid: GRID_COLOR,
    arcPrimary: 'rgba(184, 165, 255, 0.18)',
    arcSecondary: 'rgba(134, 200, 197, 0.14)',
    centerLift: ['rgba(184, 165, 255, 0.20)', 'rgba(152, 124, 244, 0.07)'],
    accent: '#b8a5ff',
    accentSoft: 'rgba(152, 124, 244, 0.55)',
    accentBright: '#d6c9ff',
    arcSweep: ['rgba(184, 165, 255, 0.34)', 'rgba(134, 200, 197, 0.30)'],
  },
  'palette-tide': {
    base: ['#0f1c22', '#08111a', '#05090f'],
    glowPrimary: 'rgba(134, 200, 197, 0.40)',
    glowSecondary: 'rgba(112, 168, 224, 0.26)',
    glowFloor: 'rgba(86, 200, 197, 0.20)',
    grid: 'rgba(134, 200, 197, 0.06)',
    arcPrimary: 'rgba(134, 200, 197, 0.20)',
    arcSecondary: 'rgba(112, 168, 224, 0.16)',
    centerLift: ['rgba(134, 200, 197, 0.20)', 'rgba(86, 170, 200, 0.08)'],
    accent: '#86c8c5',
    accentSoft: 'rgba(86, 170, 200, 0.55)',
    accentBright: '#bdeeeb',
    arcSweep: ['rgba(134, 200, 197, 0.36)', 'rgba(112, 168, 224, 0.30)'],
  },
  'palette-ember': {
    base: ['#201419', '#11090c', '#0a0608'],
    glowPrimary: 'rgba(214, 124, 92, 0.40)',
    glowSecondary: 'rgba(226, 160, 110, 0.24)',
    glowFloor: 'rgba(184, 84, 110, 0.20)',
    grid: 'rgba(255, 214, 180, 0.05)',
    arcPrimary: 'rgba(226, 160, 110, 0.20)',
    arcSecondary: 'rgba(214, 124, 92, 0.16)',
    centerLift: ['rgba(226, 160, 110, 0.20)', 'rgba(184, 110, 84, 0.08)'],
    accent: '#e2a06e',
    accentSoft: 'rgba(214, 124, 92, 0.55)',
    accentBright: '#f9d3aa',
    arcSweep: ['rgba(226, 160, 110, 0.38)', 'rgba(214, 124, 92, 0.30)'],
  },
  'palette-mono': {
    base: ['#1b1b1f', '#0e0e11', '#080809'],
    glowPrimary: 'rgba(184, 184, 196, 0.24)',
    glowSecondary: 'rgba(150, 150, 162, 0.16)',
    glowFloor: 'rgba(196, 196, 208, 0.12)',
    grid: 'rgba(255, 255, 255, 0.07)',
    arcPrimary: 'rgba(226, 226, 236, 0.16)',
    arcSecondary: 'rgba(184, 184, 196, 0.14)',
    centerLift: ['rgba(220, 220, 232, 0.14)', 'rgba(180, 180, 192, 0.06)'],
    accent: '#d8d8e0',
    accentSoft: 'rgba(196, 196, 208, 0.55)',
    accentBright: '#f0f0f6',
    arcSweep: ['rgba(226, 226, 238, 0.32)', 'rgba(184, 184, 196, 0.28)'],
  },
};

function paletteFor(palette: PaletteId | undefined): CardPalette {
  return PALETTES[palette ?? 'palette-aurora'] ?? PALETTES['palette-aurora'];
}

function clampLoopProgress(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  const looped = value - Math.floor(value);
  return looped >= 1 ? 0 : looped;
}

const AVATAR_PULSE_CYCLES: Readonly<Record<PaletteId, number>> = {
  'palette-aurora': 5,
  'palette-tide': 3,
  'palette-ember': 2,
  'palette-mono': 3,
};

const EMBER_PARTICLE_COUNT = 26;
const CHROMATIC_CYCLES: Readonly<Record<PaletteId, number>> = {
  'palette-aurora': 2,
  'palette-tide': 1,
  'palette-ember': 1,
  'palette-mono': 0,
};

interface TasteCardMotion {
  readonly palette: PaletteId;
  readonly frame: FrameId | undefined;
  readonly progress: number;
  readonly animated: boolean;
}

export function resolveMotion(
  input: PaintTasteCardInput,
  options: TasteCardRenderOptions,
): TasteCardMotion {
  const cosmetics = options.cosmetics ?? undefined;
  return {
    palette: cosmetics?.palette ?? 'palette-aurora',
    frame: cosmetics?.frame,
    progress: clampLoopProgress(input.progress),
    animated: input.progress !== undefined,
  };
}

function hash01(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function noise2(x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fractX = x - cellX;
  const fractY = y - cellY;
  const u = fractX * fractX * (3 - 2 * fractX);
  const v = fractY * fractY * (3 - 2 * fractY);
  const a = hash01(cellX, cellY);
  const b = hash01(cellX + 1, cellY);
  const c = hash01(cellX, cellY + 1);
  const d = hash01(cellX + 1, cellY + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function loopNoise(x: number, progress: number, seed: number): number {
  const angle = TAU * progress;
  return noise2(x + 3.1 * Math.cos(angle), seed + 3.1 * Math.sin(angle));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function harmonic(progress: number, amplitude: number, phase: number): number {
  return amplitude * (Math.sin(TAU * progress + TAU * phase) - Math.sin(TAU * phase));
}

export interface TasteCardImages {
  readonly avatar: CanvasImageSource | null;
  readonly brand: CanvasImageSource | null;
  readonly picks: readonly (CanvasImageSource | null)[];
}

export interface PaintTasteCardInput {
  readonly model: TasteCardModel;
  readonly format: TasteCardFormat;
  readonly images: TasteCardImages;
  readonly copy: AppCopy;
  readonly options?: TasteCardRenderOptions;
  readonly scale?: number;
  readonly progress?: number;
}

interface CardBlock {
  readonly height: number;
  readonly paint: (top: number) => void;
}

export interface TasteCardLayout {
  readonly content: number;
  readonly available: number;
  readonly gap: number;
  readonly blocks: readonly string[];
}

interface ResolvedLayout {
  readonly metrics: CardMetrics;
  readonly picks: boolean;
  readonly genres: boolean;
  readonly picksGeometry: PicksGeometry;
}

interface PicksGeometry {
  readonly layout: TasteCardPicksLayout;
  readonly cover: number;
  readonly row: number;
  readonly top: number;
  readonly side: number;
  readonly body: number;
}

const GRID_COLUMNS = 3;
const GRID_ROWS = 3;
const GRID_SLOT_COUNT = GRID_COLUMNS * GRID_ROWS;
const GRID_GUTTER = 10;
const GRID_MARGIN = 12;
const GRID_BRAND_STRIP = 64;

interface GridLayout {
  readonly cell: number;
  readonly originX: number;
  readonly originY: number;
}

function resolveGridLayout(metrics: CardMetrics, format: TasteCardFormat): GridLayout {
  const { width, height } = TASTE_CARD_FORMATS[format];
  const usableWidth = width - GRID_MARGIN * 2;
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

const TRIANGLE_TOP_RATIO = 2.0;
const TRIANGLE_SIDE_RATIO = 1.5;
const TRIANGLE_GUTTER = 20;

function resolveLayout(
  model: TasteCardModel,
  format: TasteCardFormat,
  options: TasteCardRenderOptions,
): ResolvedLayout {
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
  const gridBody = gridCellSize(metrics, format) * GRID_ROWS + GRID_GUTTER * (GRID_ROWS - 1);

  return {
    metrics,
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
  for (let step = 0; step < 20; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * 100) / 100;
}

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

export function paintTasteCard(
  context: CanvasRenderingContext2D,
  input: PaintTasteCardInput,
): void {
  const { model, format, images, copy, scale = 1 } = input;
  const options = input.options ?? DEFAULT_TASTE_CARD_RENDER_OPTIONS;
  const motion = resolveMotion(input, options);
  const palette = paletteFor(options.cosmetics?.palette);
  const { metrics, picks, genres, picksGeometry } = resolveLayout(model, format, options);
  const { width, height } = TASTE_CARD_FORMATS[format];

  context.save();
  if (scale !== 1) context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const blocks: CardBlock[] = [
    {
      height: metrics.brandMark,
      paint: (top) => paintBrand(context, model, metrics, images, width, top),
    },
    {
      height: identityHeight(metrics),
      paint: (top) => paintIdentity(context, model, metrics, images, width, top, copy, motion),
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

  const avatarCenterY = metrics.padTop + blocks[0].height + gap + metrics.avatar / 2;
  paintBackground(context, width, height, avatarCenterY, palette, motion);

  if (picksGeometry.layout === 'grid') {
    paintPickGrid(context, images, format);
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

function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  avatarCenterY: number,
  palette: CardPalette,
  motion: TasteCardMotion,
): void {
  const progress = motion.progress;
  if (motion.animated && motion.palette === 'palette-mono') {
    paintMonoBackground(context, width, height, motion);
    return;
  }

  const base = context.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, palette.base[0]);
  base.addColorStop(0.52, palette.base[1]);
  base.addColorStop(1, palette.base[2]);
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  paintThemeGlowLayer(context, width, height, palette, motion);

  if (motion.animated && motion.palette === 'palette-aurora') {
    paintAuroraRibbons(context, width, height, motion);
  }
  if (motion.animated && motion.palette === 'palette-tide') {
    paintTideRipples(context, width, height, motion);
  }

  if (motion.animated && motion.palette === 'palette-ember') {
    paintEmberGrid(context, width, height, motion);
  } else {
    paintGrid(context, width, height, palette.grid);
  }

  paintThemeArcs(context, width, palette, motion);

  const breathe = 1 + 0.05 * Math.sin(TAU * progress);
  paintGlow(context, width * 0.5, avatarCenterY, width * 0.66 * breathe, height * 0.34 * breathe, [
    [0, palette.centerLift[0]],
    [0.55, palette.centerLift[1]],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
  paintGlow(context, width * 0.5, height * 0.5, width * 0.78, height * 0.72, [
    [0, 'rgba(0, 0, 0, 0)'],
    [0.58, 'rgba(0, 0, 0, 0)'],
    [1, 'rgba(0, 0, 0, 0.62)'],
  ]);

  if (motion.animated && motion.palette === 'palette-ember') {
    paintEmberParticles(context, width, height, motion);
  }
}

function paintGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: string,
): void {
  context.save();
  context.strokeStyle = style;
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
}

function paintThemeGlowLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: CardPalette,
  motion: TasteCardMotion,
): void {
  const isEmber = motion.animated && motion.palette === 'palette-ember';
  const flicker = isEmber ? 0.78 + 0.22 * loopNoise(0.5, motion.progress, 7) : 1;
  const glowAlpha = (color: string): number | undefined =>
    isEmber ? rampAlpha(color, flicker) : undefined;
  paintGlow(
    context,
    width * 0.12 + harmonic(motion.progress, 46, 0.07),
    height * -0.08 + harmonic(motion.progress, -30, 0.19),
    900,
    620,
    [
      [0, palette.glowPrimary],
      [0.62, 'rgba(0, 0, 0, 0)'],
    ],
    glowAlpha(palette.glowPrimary),
  );
  paintGlow(
    context,
    width * 1.04 + harmonic(motion.progress, -38, 0.42),
    height * 0.06 + harmonic(motion.progress, 24, 0.31),
    760,
    560,
    [
      [0, palette.glowSecondary],
      [0.6, 'rgba(0, 0, 0, 0)'],
    ],
    glowAlpha(palette.glowSecondary),
  );
  paintGlow(
    context,
    width * 0.5 + harmonic(motion.progress, 20, 0.55),
    height * 1.18 + harmonic(motion.progress, -14, 0.63),
    1100,
    900,
    [
      [0, palette.glowFloor],
      [0.66, 'rgba(0, 0, 0, 0)'],
    ],
    glowAlpha(palette.glowFloor),
  );
}

function rampAlpha(color: string, factor: number): number {
  const match = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return match === null ? 1 : Number(match[1]) * factor;
}

function paintThemeArcs(
  context: CanvasRenderingContext2D,
  width: number,
  palette: CardPalette,
  motion: TasteCardMotion,
): void {
  const progress = motion.progress;
  context.save();
  context.lineWidth = 2;
  context.strokeStyle = palette.arcPrimary;
  context.beginPath();
  context.arc(width - 130, -180, 380, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = palette.arcSecondary;
  context.beginPath();
  context.arc(width - 130, -180, 284, 0, Math.PI * 2);
  context.stroke();
  paintArcSweep(context, width - 130, -180, 380, 2, progress * TAU, 1.9, palette.arcSweep[0]);
  paintArcSweep(
    context,
    width - 130,
    -180,
    284,
    2,
    TAU - progress * TAU + Math.PI,
    1.4,
    palette.arcSweep[1],
  );
  context.restore();
}

function paintMonoBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motion: TasteCardMotion,
): void {
  context.fillStyle = '#050506';
  context.fillRect(0, 0, width, height);

  const breathe = 0.09 + 0.05 * (0.5 + 0.5 * Math.sin(TAU * motion.progress * 3));
  context.save();
  context.strokeStyle = `rgba(240, 240, 246, ${breathe})`;
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
}

function paintEmberGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motion: TasteCardMotion,
): void {
  context.save();
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += GRID_CELL) {
    const flicker = 0.45 + 0.55 * loopNoise(x * 0.037, motion.progress, 11 + x);
    context.strokeStyle = `rgba(255, ${Math.round(120 + 70 * flicker)}, 70, ${
      (0.03 + 0.06 * flicker).toFixed(3)
    })`;
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += GRID_CELL) {
    const flicker = 0.45 + 0.55 * loopNoise(y * 0.041, motion.progress, 29 + y);
    context.strokeStyle = `rgba(255, ${Math.round(120 + 70 * flicker)}, 70, ${
      (0.03 + 0.06 * flicker).toFixed(3)
    })`;
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
  context.restore();
}

function paintAuroraRibbons(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motion: TasteCardMotion,
): void {
  const layers: readonly {
    readonly seed: number;
    readonly baseY: number;
    readonly span: number;
    readonly alpha: number;
    readonly driftCycles: number;
    readonly colors: readonly [string, string];
  }[] = [
    { seed: 11, baseY: 0.3, span: 0.17, alpha: 0.17, driftCycles: 3, colors: ['#3ddc97', '#59e0c0'] },
    { seed: 23, baseY: 0.43, span: 0.24, alpha: 0.13, driftCycles: 2, colors: ['#59e0c0', '#8f7bff'] },
    { seed: 37, baseY: 0.58, span: 0.19, alpha: 0.1, driftCycles: 2, colors: ['#8f7bff', '#ff8fd0'] },
    { seed: 53, baseY: 0.22, span: 0.11, alpha: 0.09, driftCycles: 3, colors: ['#a7f3d0', '#6ee7f0'] },
  ];

  context.save();
  context.globalCompositeOperation = 'lighter';
  for (const layer of layers) {
    const steps = 26;
    const drift = 18 * Math.sin(TAU * motion.progress * layer.driftCycles + layer.seed);
    const edgeTop: number[] = [];
    const edgeBottom: number[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const x = (step / steps) * (width + 80) - 40;
      const undulation =
        (loopNoise(x * 0.004, motion.progress, layer.seed) - 0.5) * height * 0.16;
      const wave = 12 * Math.sin(x * 0.006 + TAU * motion.progress * layer.driftCycles + layer.seed);
      const yTop = height * layer.baseY + drift + undulation + wave;
      const thickness =
        height * layer.span * (0.7 + 0.3 * loopNoise(x * 0.002 + layer.seed, motion.progress, layer.seed + 5));
      edgeTop.push(yTop);
      edgeBottom.push(yTop + thickness);
    }

    const yMin = Math.min(...edgeTop);
    const yMax = Math.max(...edgeBottom);
    const gradient = context.createLinearGradient(0, yMin, 0, yMax);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.55, `${layer.colors[0]}55`);
    gradient.addColorStop(1, `${layer.colors[1]}00`);
    context.globalAlpha = layer.alpha;
    context.fillStyle = gradient;
    context.beginPath();
    edgeTop.forEach((y, index) => {
      const x = (index / steps) * (width + 80) - 40;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    for (let index = edgeBottom.length - 1; index >= 0; index -= 1) {
      const x = (index / steps) * (width + 80) - 40;
      context.lineTo(x, edgeBottom[index]);
    }
    context.closePath();
    context.fill();
  }
  context.restore();
}

function paintTideRipples(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motion: TasteCardMotion,
): void {
  const paintDeco = (target: CanvasRenderingContext2D) => {
    const streaks: readonly {
      readonly baseY: number;
      readonly span: number;
      readonly color: string;
      readonly driftCycles: number;
    }[] = [
      { baseY: 0.26, span: 0.1, color: 'rgba(110, 231, 240, 0.1)', driftCycles: 2 },
      { baseY: 0.52, span: 0.14, color: 'rgba(86, 170, 200, 0.14)', driftCycles: 1 },
      { baseY: 0.74, span: 0.11, color: 'rgba(134, 200, 197, 0.12)', driftCycles: 2 },
    ];
    target.save();
    for (const streak of streaks) {
      const gradient = target.createLinearGradient(0, height * streak.baseY, 0, height * (streak.baseY + streak.span));
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.5, streak.color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      target.fillStyle = gradient;
      const steps = 24;
      target.beginPath();
      for (let step = 0; step <= steps; step += 1) {
        const x = (step / steps) * width;
        const y =
          height * streak.baseY +
          16 * Math.sin(x * 0.008 + TAU * motion.progress * streak.driftCycles) +
          9 * Math.sin(x * 0.017 - TAU * motion.progress * streak.driftCycles * 2);
        if (step === 0) target.moveTo(x, y);
        else target.lineTo(x, y);
      }
      for (let step = steps; step >= 0; step -= 1) {
        const x = (step / steps) * width;
        const y =
          height * (streak.baseY + streak.span) +
          20 * Math.sin(x * 0.007 + TAU * motion.progress * streak.driftCycles + 1.3);
        target.lineTo(x, y);
      }
      target.closePath();
      target.fill();
    }
    target.restore();
  };

  const amplitude = 7;
  const stripHeight = 6;
  const snapshot = decoSnapshot(width, height, paintDeco);
  if (snapshot === null) {
    paintDeco(context);
    return;
  }
  for (let y = 0; y < height; y += stripHeight) {
    const offset =
      amplitude * Math.sin(y / 95 + TAU * motion.progress) +
      3 * Math.sin(y / 47 - TAU * motion.progress * 2);
    context.drawImage(snapshot, 0, y, width, stripHeight, offset, y, width, stripHeight);
  }
}

let decoBufferElement: HTMLCanvasElement | null = null;

function decoSnapshot(
  width: number,
  height: number,
  paintDeco: (target: CanvasRenderingContext2D) => void,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (decoBufferElement === null) {
    try {
      decoBufferElement = document.createElement('canvas');
    } catch {
      return null;
    }
  }
  const buffer = decoBufferElement;
  if (buffer.width !== width || buffer.height !== height) {
    buffer.width = width;
    buffer.height = height;
  }
  const bufferContext = buffer.getContext('2d');
  if (bufferContext === null) return null;
  bufferContext.setTransform(1, 0, 0, 1, 0, 0);
  bufferContext.clearRect(0, 0, width, height);
  bufferContext.save();
  paintDeco(bufferContext);
  bufferContext.restore();
  return buffer;
}

function paintEmberParticles(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  motion: TasteCardMotion,
): void {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < EMBER_PARTICLE_COUNT; index += 1) {
    const seedX = hash01(index, 1);
    const seedY = hash01(index, 2);
    const seedSway = hash01(index, 3);
    const seedSize = hash01(index, 4);
    const seedHue = hash01(index, 5);
    const riseCycles = 2 + Math.floor(seedY * 3);
    const swayCycles = 1 + Math.floor(seedSway * 3);
    const ascent = fract(motion.progress * riseCycles + seedY);
    const y = height * (1.02 - ascent * 1.12);
    const x =
      seedX * width + (6 + 14 * seedSway) * Math.sin(TAU * (motion.progress * swayCycles + seedSway));
    const fadeIn = Math.min(1, ascent * 8);
    const fadeOut = Math.min(1, Math.max(0, (1 - ascent) * 2.4));
    const flicker = 0.72 + 0.28 * Math.sin(TAU * motion.progress * (1 + Math.floor(seedSize * 2)) + seedHue * TAU);
    const alpha = fadeIn * fadeOut * flicker * (0.35 + 0.4 * seedSize);
    const radius = (1.6 + seedSize * 2.6) * (width / 1080);
    const hue = Math.round(12 + seedHue * 26);
    if (alpha <= 0.01 || y < -8) continue;
    context.fillStyle = `hsl(${hue} 96% 62% / ${(alpha * 0.28).toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, radius * 3.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `hsl(${hue} 96% ${Math.round(58 + seedSize * 14)}% / ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function paintGlow(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  stops: readonly (readonly [number, string])[],
  alpha: number = 1,
): void {
  context.save();
  context.globalAlpha = alpha;
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

function paintArcSweep(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  lineWidth: number,
  startAngle: number,
  span: number,
  style: string,
): void {
  context.strokeStyle = style;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(centerX, centerY, radius, startAngle, startAngle + span);
  context.stroke();
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
  motion: TasteCardMotion,
): void {
  const centerX = width / 2;
  const size = metrics.avatar;
  const centerY = top + size / 2;
  const radius = size / 2;
  const mono = motion.palette === 'palette-mono';
  const palette = paletteFor(motion.palette);

  context.save();
  context.shadowColor = mono ? 'rgba(228, 228, 236, 0.4)' : 'rgba(152, 124, 244, 0.55)';
  context.shadowBlur = metrics.avatar * 0.28;
  context.fillStyle = palette.centerLift[0];
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
    context.fillStyle = palette.accent;
    context.textAlign = 'center';
    context.fillText(model.monogram, centerX, centerY);
    context.textAlign = 'left';
  }

  paintAvatarFrame(context, centerX, centerY, radius, palette, motion);

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
  const displayName = model.displayName === '' ? copy.tasteCardDefaultName : model.displayName;
  const name = ellipsize(context, displayName, maxNameWidth);
  setFont(context, 800, fitFontSize(context, name, maxNameWidth, metrics.name, 40));
  context.fillStyle = COLORS.text;
  context.fillText(name, centerX, y + nameHeight / 2);
  context.textAlign = 'left';
}

export const AVATAR_FRAME_LIMIT = 16;

function paintAvatarFrame(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: CardPalette,
  motion: TasteCardMotion,
): void {
  const accent = palette.accent;
  const progress = motion.progress;
  const mono = motion.palette === 'palette-mono';
  context.save();
  strokeRing(context, centerX, centerY, radius, 0, 4, 'rgba(11, 11, 14, 0.9)');

  switch (motion.frame ?? 'frame-classic') {
    case 'frame-classic':
      strokeRing(context, centerX, centerY, radius, 4, 8, 'rgba(184, 165, 255, 0.55)');
      if (!mono) {
        paintDashRing(
          context,
          centerX,
          centerY,
          radius,
          4,
          8,
          [10, 18],
          3,
          progress,
          palette.accentBright,
        );
      }
      break;
    case 'frame-hairline':
      strokeRing(context, centerX, centerY, radius, 7, 2, accent);
      if (!mono) {
        paintDashRing(
          context,
          centerX,
          centerY,
          radius,
          7,
          2,
          [8, 26],
          3,
          progress,
          palette.accentBright,
        );
      }
      break;
    case 'frame-double':
      strokeRing(context, centerX, centerY, radius, 6, 3, accent);
      strokeRing(context, centerX, centerY, radius, 14, 2, palette.accentSoft);
      if (!mono) {
        paintDashRing(
          context,
          centerX,
          centerY,
          radius,
          6,
          3,
          [14, 12],
          3,
          progress,
          palette.accentBright,
        );
        paintDashRing(
          context,
          centerX,
          centerY,
          radius,
          14,
          2,
          [6, 10],
          5,
          progress,
          palette.accentSoft,
        );
      }
      break;
    case 'frame-orbit':
      strokeRing(context, centerX, centerY, radius, 5, 3, accent);
      if (!mono) {
        for (const degrees of [-90, 30, 150]) {
          const angle = (degrees * Math.PI) / 180 + TAU * progress;
          fillDot(
            context,
            centerX + Math.cos(angle) * (radius + 12),
            centerY + Math.sin(angle) * (radius + 12),
            12,
            4,
            accent,
          );
        }
      }
      break;
    case 'frame-prism':
      if (!mono && typeof context.createConicGradient === 'function') {
        const sweep = context.createConicGradient(-Math.PI / 2 + TAU * progress, centerX, centerY);
        sweep.addColorStop(0, accent);
        sweep.addColorStop(0.25, palette.accentSoft);
        sweep.addColorStop(0.5, accent);
        sweep.addColorStop(0.75, palette.accentSoft);
        sweep.addColorStop(1, accent);
        context.strokeStyle = sweep;
        context.lineWidth = 5;
        context.beginPath();
        context.arc(centerX, centerY, radius + 9, 0, Math.PI * 2);
        context.stroke();
      } else {
        strokeRing(context, centerX, centerY, radius, 7, 2, accent);
        if (!mono) {
          paintDashRing(
            context,
            centerX,
            centerY,
            radius,
            7,
            2,
            [8, 26],
            3,
            progress,
            palette.accentBright,
          );
        }
      }
      break;
  }

  if (mono || !motion.animated) {
    context.restore();
    return;
  }
  paintThemeRing(context, centerX, centerY, radius, palette, motion);
  context.restore();
}

function paintThemeRing(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  palette: CardPalette,
  motion: TasteCardMotion,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(TAU * motion.progress * AVATAR_PULSE_CYCLES[motion.palette]);
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = 0.5 * pulse;
  context.lineWidth = 2;
  context.strokeStyle = palette.accentBright;
  context.beginPath();
  context.arc(centerX, centerY, radius + 3, 0, TAU);
  context.stroke();
  context.globalAlpha = 1;
  if (motion.palette === 'palette-aurora') {
    paintChromaticRing(context, centerX, centerY, radius, motion);
  }
  if (motion.palette === 'palette-tide') {
    paintLiquidRing(context, centerX, centerY, radius, motion);
  }
  if (motion.palette === 'palette-ember') {
    paintBurningEdge(context, centerX, centerY, radius, motion);
  }
  context.restore();
}

function paintChromaticRing(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  motion: TasteCardMotion,
): void {
  const hue = (motion.progress * CHROMATIC_CYCLES[motion.palette] * 360) % 360;
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 2.5;
  context.shadowColor = `hsl(${hue} 90% 64% / 0.6)`;
  context.shadowBlur = 24;
  context.strokeStyle = `hsl(${hue} 90% 66% / 0.3)`;
  context.beginPath();
  context.arc(centerX, centerY, radius + 5, 0, TAU);
  context.stroke();
  context.lineWidth = 1.5;
  context.shadowBlur = 12;
  context.strokeStyle = `hsl(${(hue + 140) % 360} 90% 70% / 0.24)`;
  context.beginPath();
  context.arc(centerX, centerY, radius + 11, 0, TAU);
  context.stroke();
  context.restore();
}

function paintLiquidRing(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  motion: TasteCardMotion,
): void {
  context.save();
  context.globalCompositeOperation = 'lighter';
  const segments = 40;
  context.beginPath();
  for (let segment = 0; segment <= segments; segment += 1) {
    const angle = (segment / segments) * TAU;
    const offset =
      1.8 * Math.sin(3 * angle + TAU * motion.progress * 2) +
      1.1 * Math.sin(5 * angle - TAU * motion.progress * 3);
    const ringRadius = radius + 4 + offset;
    const x = centerX + Math.cos(angle) * ringRadius;
    const y = centerY + Math.sin(angle) * ringRadius;
    if (segment === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.strokeStyle = 'rgba(134, 214, 208, 0.42)';
  context.lineWidth = 2.5;
  context.stroke();
  const shine = TAU * motion.progress;
  context.strokeStyle = 'rgba(242, 255, 252, 0.4)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centerX, centerY, radius + 4, shine, shine + 0.9);
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, radius + 4, shine + Math.PI, shine + Math.PI + 0.55);
  context.stroke();
  context.restore();
}

function paintBurningEdge(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  motion: TasteCardMotion,
): void {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let layer = 0; layer < 3; layer += 1) {
    const flicker = loopNoise(layer * 17, motion.progress, 40 + layer * 13);
    const alpha = 0.08 + 0.34 * flicker;
    const hue = 16 + layer * 14;
    const lightness = 60 - layer * 9;
    context.lineWidth = 4 - layer;
    context.shadowColor = `hsl(${hue} 100% ${lightness}% / ${alpha})`;
    context.shadowBlur = 16;
    context.strokeStyle = `hsl(${hue} 100% ${lightness}% / ${alpha.toFixed(3)})`;
    context.beginPath();
    context.arc(centerX, centerY, radius + 5 + layer * 2.5, 0, TAU);
    context.stroke();
  }
  context.restore();
}

function paintDashRing(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  avatarRadius: number,
  offset: number,
  width: number,
  dash: readonly [number, number],
  cyclesPerLoop: number,
  progress: number,
  style: string,
): void {
  if (offset + width / 2 > AVATAR_FRAME_LIMIT) return;
  context.save();
  context.setLineDash([dash[0], dash[1]]);
  context.lineDashOffset = ((progress * cyclesPerLoop) % 1) * (dash[0] + dash[1]);
  context.lineWidth = width;
  context.strokeStyle = style;
  context.beginPath();
  context.arc(centerX, centerY, avatarRadius + offset, 0, TAU);
  context.stroke();
  context.restore();
}

function strokeRing(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  avatarRadius: number,
  offset: number,
  width: number,
  style: string,
): void {
  if (offset + width / 2 > AVATAR_FRAME_LIMIT) return;
  context.lineWidth = width;
  context.strokeStyle = style;
  context.beginPath();
  context.arc(centerX, centerY, avatarRadius + offset, 0, Math.PI * 2);
  context.stroke();
}

function fillDot(
  context: CanvasRenderingContext2D,
  dotX: number,
  dotY: number,
  offset: number,
  radius: number,
  style: string,
): void {
  if (offset + radius > AVATAR_FRAME_LIMIT) return;
  context.fillStyle = style;
  context.beginPath();
  context.arc(dotX, dotY, radius, 0, Math.PI * 2);
  context.fill();
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

function paintPickGrid(
  context: CanvasRenderingContext2D,
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

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  metrics: CardMetrics,
  left: number,
  top: number,
  size: number,
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
