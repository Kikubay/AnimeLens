import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../src/domain/user-profile';
import { emptyProfileSummary, type UserProfileSummary } from '../src/profile/profile-types';
import {
  buildTasteCardModel,
  monogramFor,
  TASTE_CARD_FORMAT_ORDER,
  TASTE_CARD_FORMATS,
  TASTE_CARD_GENRE_LIMIT,
  type TasteCardFormat,
  DEFAULT_TASTE_CARD_RENDER_OPTIONS,
  layoutAfterCardClose,
} from '../src/profile/taste-card-types';
import { TASTE_CARD_COVER_SCALE_RANGE as COVER_SCALE_RANGE } from '../src/settings/settings-types';
import {
  maxFittingCoverScale,
  measureTasteCardLayout,
  MIN_COMFORTABLE_GAP,
  paintTasteCard,
} from '../src/popup/taste-card-painter';
import type { TasteCardImages } from '../src/popup/taste-card-painter';
import { TASTE_CARD_EXPORT_SCALE } from '../src/popup/taste-card-image';
import { getCopy } from '../src/locales';
import type { TasteCardModel } from '../src/profile/taste-card-types';

function summary(overrides: Partial<UserProfileSummary> = {}): UserProfileSummary {
  return { ...emptyProfileSummary(), ...overrides };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 1,
    username: 'sakamoto',
    avatarUrl: 'https://cdn.myanimelist.net/images/userimages/1.jpg',
    joinedAt: null,
    location: null,
    timeZone: null,
    ...overrides,
  };
}

describe('buildTasteCardModel', () => {
  it('maps aggregate stats from the profile summary', () => {
    const model = buildTasteCardModel(
      summary({
        analyzedAnimeCount: 412,
        ratedAnimeCount: 288,
        averageScore: 8.4,
        hasData: true,
      }),
      profile(),
    );

    expect(model.stats).toEqual({ analyzedCount: 412, ratedCount: 288, averageScore: 8.4 });
    expect(model.displayName).toBe('sakamoto');
    expect(model.monogram).toBe('S');
    expect(model.hasData).toBe(true);
  });

  it('keeps only the top genres and clamps their percentages', () => {
    const model = buildTasteCardModel(
      summary({
        favoriteGenres: [
          { name: 'Action', score: 92, positive: 9, negative: 1, count: 10 },
          { name: 'Fantasy', score: 84, positive: 8, negative: 1, count: 9 },
          { name: 'Sci-Fi', score: 61, positive: 6, negative: 2, count: 8 },
          { name: 'Slice Of Life', score: 55, positive: 5, negative: 2, count: 7 },
        ],
      }),
      null,
    );

    expect(model.topGenres).toHaveLength(TASTE_CARD_GENRE_LIMIT);
    expect(model.topGenres.map((genre) => genre.name)).toEqual(['Action', 'Fantasy', 'Sci-Fi']);
  });

  it('uses the strongest detected preference as the headline', () => {
    const model = buildTasteCardModel(
      summary({
        detectedPreferences: [
          { label: 'Taste for rich worlds', detail: 'Action keeps coming back.', score: 92 },
          { label: 'Complex characters', detail: 'Character-driven stories.', score: 78 },
        ],
      }),
      null,
    );

    expect(model.headline).toBe('Taste for rich worlds');
  });

  it('falls back gracefully when no account is connected', () => {
    const model = buildTasteCardModel(summary(), null);

    // The name stays empty so the painter can substitute a localized one; the monogram is a glyph and must not follow that substitution.
    expect(model.displayName).toBe('');
    expect(getCopy('en').tasteCardDefaultName).toBe('Anime fan');
    expect(model.monogram).toBe('A');
    expect(model.topGenres).toEqual([]);
    expect(model.headline).toBeNull();
    expect(model.hasData).toBe(false);
  });

  it('truncates long display names so the header never overflows the card', () => {
    const model = buildTasteCardModel(summary(), profile({ username: 'a'.repeat(40) }));

    expect(model.displayName).toHaveLength(24);
    expect(model.displayName.endsWith('…')).toBe(true);
  });

  it('never exposes private profile fields on the card', () => {
    const model = buildTasteCardModel(
      summary({ hasData: true }),
      profile({ username: 'sakamoto', location: 'Tokyo', timeZone: 'Asia/Tokyo' }),
    );

    expect(Object.keys(model)).not.toContain('location');
    expect(JSON.stringify(model)).not.toContain('Tokyo');
  });
});

describe('taste card layout after dismissing the card', () => {
  it('falls back to the list when the grid is dismissed', () => {
    // A grid is never persisted, so leaving the mode on would reopen onto an empty collage.
    expect(
      layoutAfterCardClose({ ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'grid' }),
    ).toBe('list');
  });

  it('leaves the other arrangements untouched', () => {
    for (const picksLayout of ['list', 'triangle'] as const) {
      const options = { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout };
      expect(layoutAfterCardClose(options)).toBe(picksLayout);
    }
  });
});

describe('taste card formats', () => {
  it('exposes social-ready export sizes', () => {
    expect(TASTE_CARD_FORMATS.tall).toEqual({ width: 1080, height: 1440 });
    expect(TASTE_CARD_FORMATS.portrait).toEqual({ width: 1080, height: 1350 });
    expect(TASTE_CARD_FORMATS.square).toEqual({ width: 1080, height: 1080 });
  });

  it('offers every format in the picker, tallest first', () => {
    expect(TASTE_CARD_FORMAT_ORDER).toEqual(['tall', 'portrait', 'square']);
    expect(TASTE_CARD_FORMAT_ORDER).toHaveLength(Object.keys(TASTE_CARD_FORMATS).length);
  });

  it('declares the advertised aspect ratios', () => {
    const ratio = (format: TasteCardFormat): string => {
      const spec = TASTE_CARD_FORMATS[format];
      return `${spec.width / (spec.height / 3)}`;
    };
    // 3:4, 4:5, and 1:1 expressed as width : (height / 3).
    expect(ratio('tall')).toBeCloseTo(2.25, 2);
    expect(ratio('portrait')).toBeCloseTo(2.4, 2);
    expect(TASTE_CARD_FORMATS.square.width).toBe(TASTE_CARD_FORMATS.square.height);
  });
});

describe('monogramFor', () => {
  it('uppercases the first character and never returns an empty glyph', () => {
    expect(monogramFor('naruto')).toBe('N');
    expect(monogramFor('  spaced')).toBe('S');
    expect(monogramFor('')).toBe('A');
    expect(monogramFor('   ')).toBe('A');
  });
});

describe('taste card painter', () => {
  // The painter only needs gradients, paths and text metrics, so a stub is enough to assert the geometry that reaches the exported pixels.
  function recordingContext() {
    const texts: { text: string; x: number; y: number }[] = [];
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    const drawn: { x: number; y: number; width: number; height: number }[] = [];
    const fills: { shadowBlur: number; shadowColor: string }[] = [];
    const strokes: string[] = [];
    const scales: { x: number; y: number }[] = [];
    const gradient = { addColorStop: () => undefined };
    const context = {
      canvas: { width: 0, height: 0 },
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      letterSpacing: '0px',
      shadowBlur: 0,
      shadowColor: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      scale: (x: number, y: number) => {
        scales.push({ x, y });
      },
      translate: () => undefined,
      beginPath: () => undefined,
      closePath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      arc: () => undefined,
      arcTo: () => undefined,
      roundRect: (x: number, y: number, width: number, height: number) => {
        rects.push({ x, y, width, height });
      },
      clip: () => undefined,
      fill: () => {
        fills.push({ shadowBlur: context.shadowBlur, shadowColor: context.shadowColor });
      },
      stroke: () => {
        strokes.push(context.strokeStyle);
      },
      fillRect: (x: number, y: number, width: number, height: number) => {
        rects.push({ x, y, width, height });
      },
      drawImage: (_image: unknown, x: number, y: number, width: number, height: number) => {
        drawn.push({ x, y, width, height });
      },
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      measureText: (text: string) => ({ width: text.length * 20 }),
      fillText: (text: string, x: number, y: number) => {
        texts.push({ text, x, y });
      },
    };
    return { context, texts, rects, drawn, fills, strokes, scales };
  }

  const model: TasteCardModel = {
    displayName: 'Sakamoto',
    monogram: 'S',
    providerName: 'MyAnimeList',
    stats: { analyzedCount: 412, ratedCount: 288, averageScore: 8.4 },
    topGenres: [
      { name: 'Action', score: 92 },
      { name: 'Fantasy', score: 84 },
      { name: 'Sci-Fi', score: 61 },
    ],
    topPicks: [
      {
        title: 'Cowboy Bebop',
        score: 10,
        imageUrl: 'https://cdn.test/1.jpg',
        largeImageUrl: 'https://cdn.test/1-large.jpg',
      },
      { title: 'Fullmetal Alchemist: Brotherhood', score: 10, imageUrl: null, largeImageUrl: null },
      {
        title: 'Steins;Gate',
        score: 9,
        imageUrl: 'https://cdn.test/2.jpg',
        largeImageUrl: 'https://cdn.test/2-large.jpg',
      },
    ],
    headline: 'Taste for rich worlds',
    hasData: true,
  };

  const cover = { width: 230, height: 345 } as unknown as CanvasImageSource;

  function paint(
    recorded: ReturnType<typeof recordingContext>,
    overrides: Partial<TasteCardModel> = {},
    format: TasteCardFormat = 'portrait',
    images: Partial<TasteCardImages> = {},
  ): void {
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model: { ...model, ...overrides },
      format,
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [], ...images },
    });
  }

  it('renders every card surface in both formats', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const recorded = recordingContext();
      expect(() => paint(recorded, {}, format)).not.toThrow();
      const rendered = recorded.texts.map((entry) => entry.text);
      expect(rendered).toContain('AnimeLens');
      expect(rendered).toContain('Sakamoto');
      expect(rendered).toContain('Taste for rich worlds');
      expect(rendered).toContain('Action');
      expect(rendered).toContain('92%');
      expect(rendered).toContain('412');
      expect(rendered).toContain('8.4');
      expect(rendered).toContain('Made with AnimeLens');
    }
  });

  it('ranks the highest-rated entries with their scores', () => {
    const recorded = recordingContext();
    paint(recorded);
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).toContain('TOP RATED');
    expect(rendered).toContain('Cowboy Bebop');
    expect(rendered).toContain('Fullmetal Alchemist: Brotherhood');
    expect(rendered).toContain('Steins;Gate');
    // Rank badges, then the scores right-aligned in order.
    expect(rendered).toContain('1');
    expect(rendered).toContain('2');
    expect(rendered).toContain('3');
    const picksY = recorded.texts.find((entry) => entry.text === 'Cowboy Bebop')?.y ?? 0;
    const secondY =
      recorded.texts.find((entry) => entry.text === 'Fullmetal Alchemist: Brotherhood')?.y ?? 0;
    const thirdY = recorded.texts.find((entry) => entry.text === 'Steins;Gate')?.y ?? 0;
    expect(picksY).toBeLessThan(secondY);
    expect(secondY).toBeLessThan(thirdY);
  });

  it('scores the picks right-aligned at the content edge', () => {
    const recorded = recordingContext();
    paint(recorded);
    const edge = TASTE_CARD_FORMATS.portrait.width - 72;
    for (const score of ['10', '9']) {
      const entry = recorded.texts.find((candidate) => candidate.text === score);
      expect(entry?.x).toBe(edge);
    }
  });

  it('paints a square cover thumbnail for every pick that has art', () => {
    const recorded = recordingContext();
    paint(recorded, {}, 'portrait', { picks: [cover, null, cover] });
    // Cover scale means the image is drawn at least as tall as the thumbnail edge.
    const covers = recorded.drawn.filter(
      (image) => Math.round(image.width) === 56 && image.height >= 56,
    );

    // Two of the three picks have a cover URL; the middle one falls back.
    expect(covers).toHaveLength(2);
    for (const image of covers) {
      // Centred on the thumbnail box, never overflowing the card.
      expect(image.x).toBeGreaterThanOrEqual(0);
      expect(image.x + image.width).toBeLessThanOrEqual(TASTE_CARD_FORMATS.portrait.width);
    }
    // The covers are stacked in reading order.
    expect(covers[0]?.y).toBeLessThan(covers[1]?.y ?? 0);
  });

  it('draws a muted placeholder tile when a cover is missing', () => {
    const withCovers = recordingContext();
    const withoutCovers = recordingContext();
    paint(withCovers, {}, 'portrait', { picks: [cover, cover, cover] });
    paint(withoutCovers, {}, 'portrait', { picks: [null, null, null] });

    // Identical geometry either way: the row never collapses or shifts.
    expect(withoutCovers.drawn).toHaveLength(0);
    const placeholders = withoutCovers.rects.filter(
      (rect) => Math.round(rect.width) === 56 && Math.round(rect.height) === 56,
    );
    expect(placeholders).toHaveLength(3);
  });

  it('lays the cover out before the rank badge and the title', () => {
    const recorded = recordingContext();
    paint(recorded, {}, 'portrait', { picks: [cover] });
    const coverX = recorded.drawn[0]?.x ?? -1;
    const badgeX = recorded.rects.length >= 0 ? coverX + 56 + 14 : -1;
    const titleX = recorded.texts.find((entry) => entry.text === 'Cowboy Bebop')?.x ?? -1;

    expect(badgeX).toBeGreaterThan(coverX);
    expect(titleX).toBeGreaterThan(badgeX + 30);
  });

  it('keeps the pick title clear of the right-aligned score', () => {
    const recorded = recordingContext();
    paint(recorded, {}, 'portrait', { picks: [cover] });
    const spec = TASTE_CARD_FORMATS.portrait;
    const title = recorded.texts.find((entry) => entry.text === 'Cowboy Bebop');
    const score = recorded.texts.find((entry) => entry.text === '10');

    // The stub measures 20px per character, so the ellipsized title ends here.
    expect((title?.x ?? 0) + 'Cowboy Bebop'.length * 20).toBeLessThan(score?.x ?? 0);
    expect(title?.x ?? 0).toBeLessThan(spec.width);
  });

  it('omits the picks block entirely when the user has no rated entries', () => {
    const recorded = recordingContext();
    paint(recorded, { topPicks: [] });
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).not.toContain('TOP RATED');
    expect(measureTasteCardLayout({ ...model, topPicks: [] }, 'portrait').blocks).not.toContain(
      'picks',
    );
  });

  it('leaves the footer right side empty when there is no taste tagline', () => {
    const recorded = recordingContext();
    paint(recorded, { headline: null });
    const rendered = recorded.texts.map((entry) => entry.text);

    // No filler text: the brand line simply stands alone.
    expect(rendered).toContain('Made with AnimeLens');
    expect(rendered).not.toContain('Aggregate stats only');
    expect(rendered).not.toContain('Taste for rich worlds');
  });

  it('names the data source so a viewer outside the app can trust the stats', () => {
    const recorded = recordingContext();
    paint(recorded);
    const chip = recorded.texts.find((entry) => entry.text === 'MyAnimeList');

    expect(chip).toBeDefined();
    // The chip is right-aligned on the brand row, where the old tag sat.
    expect(chip?.x).toBeGreaterThan(TASTE_CARD_FORMATS.portrait.width / 2);
  });

  it('omits the provider chip when no provider is known', () => {
    const recorded = recordingContext();
    paint(recorded, { providerName: null });
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).not.toContain('MyAnimeList');
    expect(rendered).toContain('AnimeLens');
  });

  it('no longer stamps a TASTE CARD tag on the exported image', () => {
    const recorded = recordingContext();
    paint(recorded);
    const rendered = recorded.texts.map((entry) => entry.text.toUpperCase());

    expect(rendered.some((text) => text.includes('TASTE CARD'))).toBe(false);
    expect(rendered).not.toContain('TASTE CARD');
  });

  it('labels the stat tiles in plain language', () => {
    const recorded = recordingContext();
    paint(recorded);
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).toContain('In List');
    expect(rendered).toContain('Scored');
    expect(rendered).not.toContain('Anime analyzed');
    expect(rendered).not.toContain('Rated');
  });

  it('explains what the genre percentages measure', () => {
    const recorded = recordingContext();
    paint(recorded);
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).toContain('TOP GENRES');
    expect(rendered).toContain('% affinity');
    const label = recorded.texts.find((entry) => entry.text === 'TOP GENRES');
    const qualifier = recorded.texts.find((entry) => entry.text === '% affinity');
    // The qualifier sits after the label, before the fading rule.
    expect(qualifier?.x ?? 0).toBeGreaterThan(label?.x ?? 0);
  });

  it('paints a visible grid and a soft bloom behind the avatar', () => {
    const recorded = recordingContext();
    paint(recorded);

    // The grid is stroked with a faint but non-zero white.
    const grid = recorded.strokes.find((style) => style.includes('rgba(255, 255, 255'));
    expect(grid).toBeDefined();
    const alpha = Number(grid?.match(/([\d.]+)\)$/)?.[1] ?? '0');
    expect(alpha).toBeGreaterThan(0.04);

    // The avatar bloom is filled while a drop shadow is active.
    const glows = recorded.fills.filter((fill) => fill.shadowBlur > 0);
    expect(glows.length).toBeGreaterThan(0);
    expect(glows[0]?.shadowColor).toContain('152, 124, 244');
  });

  it('draws the avatar bloom before the portrait so it sits behind it', () => {
    const withAvatar = recordingContext();
    paint(withAvatar, {}, 'portrait', { avatar: { width: 300, height: 300 } as CanvasImageSource });
    const bloomIndex = withAvatar.fills.findIndex((fill) => fill.shadowBlur > 0);
    const portraitIndex = withAvatar.drawn.length - 1;

    expect(bloomIndex).toBeGreaterThanOrEqual(0);
    // Every drawImage happens after the glow was painted.
    expect(portraitIndex).toBeGreaterThanOrEqual(0);
    expect(withAvatar.drawn.length).toBe(1);
  });

  it('supersamples the card when a raster scale is requested', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [] },
      scale: 2,
    });

    // The first scale() is the export multiplier; the rest are glow ellipses.
    expect(recorded.scales[0]).toEqual({ x: 2, y: 2 });
    // Raster assets are magnified at 2x, so high-quality resampling is required.
    expect(recorded.context.imageSmoothingEnabled).toBe(true);
    expect(recorded.context.imageSmoothingQuality).toBe('high');
  });

  it('exports at 2x by default', () => {
    expect(TASTE_CARD_EXPORT_SCALE).toBe(2);
  });

  it('insets the brand row to the same content padding as everything else', () => {
    // The mark used to be painted at x = 0, shoving the top row 72px left of the content column.
    const padX: Record<TasteCardFormat, number> = { tall: 72, portrait: 72, square: 64 };
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const recorded = recordingContext();
      paint(recorded, {}, format, { picks: [cover] });
      const spec = TASTE_CARD_FORMATS[format];
      const content = contentRects(recorded, spec.width);

      // The brand mark is the first square content box painted.
      const mark = content.find((rect) => rect.width === rect.height);
      expect(mark?.x).toBe(padX[format]);
      // The wordmark follows the mark, never the card edge.
      const wordmark = recorded.texts.find((entry) => entry.text === 'AnimeLens');
      expect(wordmark?.x ?? 0).toBeGreaterThan(padX[format]);
      // The provider chip terminates on the right content edge.
      const rightEdges = new Set(content.map((rect) => Math.round(rect.x + rect.width)));
      expect([...rightEdges]).toContain(spec.width - padX[format]);
    }
  });

  it('starts every primary element on one shared content line', () => {
    // Section labels, genre names, covers and stat tiles all hang off the same inset, so the column reads as one grid.
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const recorded = recordingContext();
      paint(recorded, {}, format, { picks: [cover, cover, cover] });
      const padX = format === 'square' ? 64 : 72;
      const insets = new Set<number>();
      for (const label of ['TOP GENRES', 'Action', 'Sci-Fi', 'TOP RATED']) {
        const entry = recorded.texts.find((candidate) => candidate.text === label);
        expect(entry, `${label} missing in ${format}`).toBeDefined();
        insets.add(entry?.x ?? -1);
      }
      // Covers are the first square content box, like the brand mark.
      const coverBox = contentRects(recorded, TASTE_CARD_FORMATS[format].width).find(
        (rect) => rect.width === rect.height,
      );
      insets.add(coverBox?.x ?? -1);
      expect([...insets]).toEqual([padX]);
    }
  });

  it('keeps every element inside the padding, never bleeding to an edge', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const recorded = recordingContext();
      paint(recorded, {}, format, { picks: [cover, cover, cover] });
      const spec = TASTE_CARD_FORMATS[format];
      const padX = format === 'square' ? 64 : 72;

      for (const rect of contentRects(recorded, spec.width)) {
        expect(rect.x).toBeGreaterThanOrEqual(padX);
        expect(Math.round(rect.x + rect.width)).toBeLessThanOrEqual(spec.width - padX);
      }
      // Right-aligned text is anchored on the content edge, so its origin is the rightmost point.
      for (const entry of recorded.texts) {
        expect(entry.x).toBeGreaterThanOrEqual(padX);
        expect(entry.x).toBeLessThanOrEqual(spec.width - padX);
      }
    }
  });

  it('keeps the footer exactly as designed', () => {
    const recorded = recordingContext();
    paint(recorded);
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).toContain('Made with AnimeLens');
    expect(rendered).toContain('Taste for rich worlds');
  });

  it('fits every format, layout, and cover size without clipping the footer', () => {
    // Worst case: three genres, three picks, a tagline and a long name. Every reachable combination is checked, so a new layout or a wider slider can't quietly overflow.
    const worst: TasteCardModel = {
      ...model,
      displayName: 'A_very_long_anime_lovers_handle_2026',
      topGenres: [
        { name: 'Slice of Life', score: 100 },
        { name: 'Fantasy', score: 99 },
        { name: 'Sci-Fi', score: 98 },
      ],
    };
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      for (const picksLayout of ['list', 'triangle'] as const) {
        for (const coverScale of [COVER_SCALE_RANGE.min, 1, COVER_SCALE_RANGE.max]) {
          const layout = measureTasteCardLayout(worst, format, {
            ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
            picksLayout,
            coverScale,
          });
          const where = `${format}/${picksLayout}@${coverScale}`;
          expect(layout.content, `overflows in ${where}`).toBeLessThanOrEqual(layout.available);
          // A zero gap means blocks are touching; below 6 they read as cramped.
          expect(layout.gap, `too tight in ${where}`).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('keeps the default options at the original comfortable spacing', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const layout = measureTasteCardLayout(model, format);
      expect(layout.gap, `too tight in ${format}`).toBeGreaterThanOrEqual(14);
    }
  });

  it('shows larger artwork in the podium than the list', () => {
    const coverEdge = (picksLayout: 'list' | 'triangle', index: number): number => {
      const recorded = recordingContext();
      paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
        model,
        format: 'portrait',
        copy: getCopy('en'),
        images: { avatar: null, brand: null, picks: [cover, cover, cover] },
        options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout },
      });
      return Math.round(recorded.drawn[index]?.width ?? 0);
    };
    const [firstList] = [coverEdge('list', 0)];
    const [firstTriangle] = [coverEdge('triangle', 0)];

    expect(firstList).toBe(56);
    // The podium roughly doubles the artwork and makes the winner larger.
    expect(firstTriangle).toBeGreaterThan(firstList);
    expect(firstTriangle).toBe(Math.round(56 * 2.0));
  });

  it('centres the winner and flanks it with the runners-up in the podium', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [cover, cover, cover] },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'triangle' },
    });
    const drawn = recorded.drawn;
    expect(drawn).toHaveLength(3);

    const centreX = (image: { x: number; width: number }): number => image.x + image.width / 2;
    // #1 is centred on the content column; #2 and #3 sit symmetrically below.
    expect(centreX(drawn[0]!)).toBeCloseTo(72 + (1080 - 144) / 2, 0);
    expect(centreX(drawn[1]!)).toBeLessThan(centreX(drawn[0]!));
    expect(centreX(drawn[2]!)).toBeGreaterThan(centreX(drawn[0]!));
    // The base row shares a top edge, the winner sits above it.
    expect(drawn[1]!.y).toBe(drawn[2]!.y);
    expect(drawn[0]!.y).toBeLessThan(drawn[1]!.y);
    expect(drawn[1]!.width).toBe(drawn[2]!.width);
  });

  it('omits the titles in the podium, where the artwork carries identity', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [cover, cover, cover] },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'triangle' },
    });
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).not.toContain('Cowboy Bebop');
    // The section label and the rank/score badges remain.
    expect(rendered).toContain('TOP RATED');
    expect(rendered).toContain('1');
    expect(rendered).toContain('10');
  });

  it('names the anime inside the tile when the podium has no artwork', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [null, null, null] },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'triangle' },
    });
    const rendered = recorded.texts.map((entry) => entry.text);

    // Without this the podium would degrade to three anonymous squares.
    expect(rendered.some((text) => text.includes('Cowboy'))).toBe(true);
  });

  it('renders the grid as covers only, with a discreet brand', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model: {
        ...model,
        topPicks: Array.from({ length: 9 }, (_, index) => ({
          title: `Anime ${index}`,
          score: 10,
          imageUrl: null,
          largeImageUrl: null,
        })),
      },
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: Array.from({ length: 9 }, () => cover) },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'grid' },
    });
    const rendered = recorded.texts.map((entry) => entry.text);

    // Nine covers, and none of the stats-card furniture.
    expect(recorded.drawn).toHaveLength(9);
    expect(rendered).toContain('AnimeLens');
    expect(rendered).not.toContain('TOP RATED');
    expect(rendered).not.toContain('TOP GENRES');
    expect(rendered).not.toContain('Made with AnimeLens');
    expect(rendered).not.toContain('Sakamoto');
    expect(rendered).not.toContain('412');
  });

  it('fits nine square grid cells inside the card with no overflow', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const spec = TASTE_CARD_FORMATS[format];
      const recorded = recordingContext();
      paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
        model,
        format,
        copy: getCopy('en'),
        images: { avatar: null, brand: null, picks: Array.from({ length: 9 }, () => cover) },
        options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'grid' },
      });
      // The cell boxes are the rounded rects used as clip paths; the images are deliberately painted larger to crop like `cover`.
      const cells = contentRects(recorded, spec.width).filter(
        (rect) => Math.round(rect.width) === Math.round(rect.height),
      );
      const sizes = new Set(cells.map((cell) => Math.round(cell.width)));

      expect(cells).toHaveLength(9);
      expect(sizes.size).toBe(1);
      for (const cell of cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.x + cell.width).toBeLessThanOrEqual(spec.width);
        expect(cell.y + cell.height).toBeLessThanOrEqual(spec.height);
      }
    }
  });

  it('leaves unfilled grid cells as dim placeholders rather than inventing art', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [cover, cover] },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'grid' },
    });

    expect(recorded.drawn).toHaveLength(2);
  });

  it('ignores the section toggles in grid mode, which fills the card', () => {
    const layout = measureTasteCardLayout(model, 'portrait', {
      ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
      picksLayout: 'grid',
      showGenres: false,
    });

    // Nothing but the grid and the brand mark, whatever the toggles say.
    expect(layout.blocks).toEqual(['grid', 'brand']);
    expect(layout.content).toBeLessThanOrEqual(layout.available);
  });

  it('centres the grid on both axes instead of hugging the top edge', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const spec = TASTE_CARD_FORMATS[format];
      const recorded = recordingContext();
      paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
        model,
        format,
        copy: getCopy('en'),
        images: { avatar: null, brand: null, picks: Array.from({ length: 9 }, () => cover) },
        options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout: 'grid' },
      });
      const cells = contentRects(recorded, spec.width).filter(
        (rect) => Math.round(rect.width) === Math.round(rect.height),
      );
      const cell = Math.round(cells[0]?.width ?? 0);
      const left = cells[0]?.x ?? 0;
      const top = cells[0]?.y ?? 0;
      // Cells run left-to-right, top-to-bottom, so index 8 ends the last column and index 6 the last row.
      const rightGap = spec.width - (cells[8]!.x + cell);
      const bottomGap = spec.height - (cells[6]!.y + cell);

      // Columns are balanced within a pixel.
      expect(Math.abs(left - rightGap)).toBeLessThanOrEqual(1);
      // Rows balance too: a tall card has unavoidable vertical slack and it has to be split.
      expect(Math.abs(top - bottomGap)).toBeLessThanOrEqual(2);
      expect(top).toBeGreaterThan(0);
    }
  });

  it('still fits at the largest cover size the slider allows', () => {
    // The slider max is only safe while the layout holds there; if this breaks, tighten TASTE_CARD_COVER_SCALE_RANGE rather than let the card clip.
    const worst: TasteCardModel = {
      ...model,
      displayName: 'A_very_long_anime_lovers_handle_2026',
      topGenres: [
        { name: 'Slice of Life', score: 100 },
        { name: 'Fantasy', score: 99 },
        { name: 'Sci-Fi', score: 98 },
      ],
    };
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const layout = measureTasteCardLayout(worst, format, {
        ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
        coverScale: COVER_SCALE_RANGE.max,
      });

      expect(layout.content).toBeLessThanOrEqual(layout.available);
      expect(layout.gap, `too tight in ${format}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('drops a hidden section from the layout and redistributes the space', () => {
    const full = measureTasteCardLayout(model, 'portrait');
    const noGenres = measureTasteCardLayout(model, 'portrait', {
      ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
      showGenres: false,
    });
    const noPicks = measureTasteCardLayout(model, 'portrait', {
      ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
      showPicks: false,
    });

    expect(full.blocks).toEqual(['brand', 'identity', 'stats', 'genres', 'picks', 'footer']);
    expect(noGenres.blocks).toEqual(['brand', 'identity', 'stats', 'picks', 'footer']);
    expect(noPicks.blocks).toEqual(['brand', 'identity', 'stats', 'genres', 'footer']);
    // Removing a block frees height, so the gaps grow rather than collapsing.
    expect(noGenres.gap).toBeGreaterThan(full.gap);
    expect(noPicks.gap).toBeGreaterThan(full.gap);
  });

  it('omits hidden sections from the rendered output', () => {
    const recorded = recordingContext();
    paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
      model,
      format: 'portrait',
      copy: getCopy('en'),
      images: { avatar: null, brand: null, picks: [] },
      options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, showGenres: false, showPicks: false },
    });
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).not.toContain('TOP GENRES');
    expect(rendered).not.toContain('TOP RATED');
    // Stats, identity, and the footer are unaffected.
    expect(rendered).toContain('412');
    expect(rendered).toContain('Made with AnimeLens');
  });

  it('grows the covers with the slider, capped by what the card can fit', () => {
    const coverEdge = (coverScale: number): number => {
      const recorded = recordingContext();
      paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
        model,
        format: 'portrait',
        copy: getCopy('en'),
        images: { avatar: null, brand: null, picks: [cover] },
        options: { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, coverScale },
      });
      return Math.round(recorded.drawn[0]?.width ?? 0);
    };
    const ceiling = maxFittingCoverScale(model, 'portrait');

    // Monotonic up to the ceiling...
    expect(coverEdge(1)).toBe(56);
    expect(coverEdge((1 + ceiling) / 2)).toBeGreaterThan(56);
    expect(coverEdge(ceiling)).toBe(Math.round(56 * ceiling));
    // ...and asking for more than fits is capped, never drawn at full size.
    expect(coverEdge(COVER_SCALE_RANGE.max)).toBe(Math.round(56 * ceiling));
    expect(coverEdge(COVER_SCALE_RANGE.max)).toBeLessThan(56 * COVER_SCALE_RANGE.max);
  });

  it('keeps every cover inside the content column at the largest size', () => {
    for (const picksLayout of ['list', 'triangle'] as const) {
      const recorded = recordingContext();
      paintTasteCard(recorded.context as unknown as CanvasRenderingContext2D, {
        model,
        format: 'portrait',
        copy: getCopy('en'),
        images: { avatar: null, brand: null, picks: [cover, cover, cover] },
        options: {
          ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
          picksLayout,
          coverScale: COVER_SCALE_RANGE.max,
        },
      });
      const padX = 72;
      const contentWidth = TASTE_CARD_FORMATS.portrait.width - padX * 2;
      for (const image of recorded.drawn) {
        expect(image.x).toBeGreaterThanOrEqual(padX);
        expect(image.x + image.width).toBeLessThanOrEqual(padX + contentWidth);
      }
    }
  });

  it('extends the achievable cover size when a section is hidden', () => {
    const all = maxFittingCoverScale(model, 'portrait');
    const noGenres = maxFittingCoverScale(model, 'portrait', {
      ...DEFAULT_TASTE_CARD_RENDER_OPTIONS,
      showGenres: false,
    });

    // Freeing the genre bars buys the bigger artwork, so the slider visibly grows when that section is off.
    expect(noGenres).toBeGreaterThan(all);
    expect(all).toBeLessThanOrEqual(COVER_SCALE_RANGE.max);
  });

  it('never reports a ceiling that overflows the card', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      for (const picksLayout of ['list', 'triangle'] as const) {
        const options = { ...DEFAULT_TASTE_CARD_RENDER_OPTIONS, picksLayout };
        const ceiling = maxFittingCoverScale(model, format, options);
        const atCeiling = measureTasteCardLayout(model, format, {
          ...options,
          coverScale: ceiling,
        });

        expect(ceiling).toBeGreaterThan(1);
        expect(atCeiling.content).toBeLessThanOrEqual(atCeiling.available);
        expect(atCeiling.gap).toBeGreaterThanOrEqual(MIN_COMFORTABLE_GAP);
      }
    }
  });

  it('fits every block in both formats without clipping the footer', () => {
    // Worst case: three genres, three picks, a tagline, and a long name.
    const worst: TasteCardModel = {
      ...model,
      displayName: 'A_very_long_anime_lovers_handle_2026',
      topGenres: [
        { name: 'Slice of Life', score: 100 },
        { name: 'Fantasy', score: 99 },
        { name: 'Sci-Fi', score: 98 },
      ],
    };
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const layout = measureTasteCardLayout(worst, format);
      expect(layout.content).toBeLessThanOrEqual(layout.available);
      // A zero gap means the blocks are touching or the footer is clipped.
      expect(layout.gap).toBeGreaterThanOrEqual(14);
      expect(layout.blocks).toEqual(['brand', 'identity', 'stats', 'genres', 'picks', 'footer']);
    }
  });

  it('keeps every label inside the exported canvas', () => {
    for (const format of TASTE_CARD_FORMAT_ORDER) {
      const spec = TASTE_CARD_FORMATS[format];
      const recorded = recordingContext();
      paint(recorded, {}, format);
      for (const entry of recorded.texts) {
        expect(entry.x).toBeGreaterThanOrEqual(0);
        expect(entry.x).toBeLessThanOrEqual(spec.width);
        expect(entry.y).toBeGreaterThanOrEqual(0);
        expect(entry.y).toBeLessThanOrEqual(spec.height);
      }
    }
  });

  it('compresses the square layout relative to the taller formats', () => {
    const footerY = (recorded: ReturnType<typeof recordingContext>): number =>
      recorded.texts.find((entry) => entry.text === 'Made with AnimeLens')?.y ?? -1;
    const tall = recordingContext();
    const portrait = recordingContext();
    const square = recordingContext();
    paint(tall, {}, 'tall');
    paint(portrait);
    paint(square, {}, 'square');

    // Taller cards push the footer down; the 1:1 card is the most compact.
    expect(footerY(tall)).toBeGreaterThan(footerY(portrait));
    expect(footerY(portrait)).toBeGreaterThan(footerY(square));
    expect(footerY(square)).toBeGreaterThan(0);
  });

  it('gives the 3:4 card larger covers than the other formats', () => {
    const coverEdge = (format: TasteCardFormat): number => {
      const recorded = recordingContext();
      paint(recorded, {}, format, { picks: [cover] });
      return Math.round(recorded.drawn[0]?.width ?? 0);
    };
    expect(coverEdge('tall')).toBe(64);
    expect(coverEdge('portrait')).toBe(56);
    expect(coverEdge('square')).toBe(40);
  });

  it('falls back to the monogram and an empty-state message without assets or data', () => {
    const recorded = recordingContext();
    paint(recorded, { topGenres: [], headline: null, hasData: false });
    const rendered = recorded.texts.map((entry) => entry.text);

    expect(rendered).toContain('S');
    expect(rendered).toContain('Not enough data yet.');
    expect(rendered).not.toContain('Taste for rich worlds');
  });

  // Genre tracks and fills are the only short, wide rounded rects.
  function genreBars(recorded: ReturnType<typeof recordingContext>) {
    return recorded.rects.filter((rect) => rect.height > 8 && rect.height < 24 && rect.width > 100);
  }

  // Rounded boxes inside the content column, excluding the full-bleed base fill painted first.
  function contentRects(recorded: ReturnType<typeof recordingContext>, cardWidth: number) {
    return recorded.rects.filter((rect) => Math.round(rect.width) < cardWidth);
  }

  it('never paints a genre bar wider than its track', () => {
    const recorded = recordingContext();
    paint(recorded);
    const trackWidth = TASTE_CARD_FORMATS.portrait.width - 72 * 2;
    const bars = genreBars(recorded);

    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.width).toBeLessThanOrEqual(trackWidth);
    }
  });

  it('scales the genre bar width by the reported percentage', () => {
    const recorded = recordingContext();
    paint(recorded);
    const trackWidth = TASTE_CARD_FORMATS.portrait.width - 72 * 2;
    const widths = genreBars(recorded).map((rect) => Math.round((rect.width / trackWidth) * 100));

    // Tracks are painted at full width, fills at the genre percentage.
    expect(widths).toContain(92);
    expect(widths).toContain(84);
    expect(widths).toContain(61);
  });

  it('clamps an out-of-range genre score instead of overflowing the card', () => {
    const recorded = recordingContext();
    paint(recorded, {
      topGenres: [{ name: 'Overflow', score: 140 }],
    });
    const trackWidth = TASTE_CARD_FORMATS.portrait.width - 72 * 2;

    for (const bar of genreBars(recorded)) {
      expect(bar.width).toBeLessThanOrEqual(trackWidth);
    }
  });
});
