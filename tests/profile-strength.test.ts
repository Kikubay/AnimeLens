import { describe, expect, it } from 'vitest';
import {
  DISCERNING_TASTE_MIN_AVERAGE,
  REFINED_PROFILE_MIN_FEEDBACK,
  RICH_WORLDS_MIN_GENRES,
  evaluateProfileSignals,
  type ProfileSignalInput,
} from '../src/profile/profile-signals';
import { computeProfileStrength } from '../src/profile/profile-strength';
import { emptyProfileSummary, profileSummaryFromModel } from '../src/profile/profile-types';
import { buildUserPreferenceProfile } from '../src/recommendations/recommendation-engine';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import type { UserProfileSummary } from '../src/profile/profile-types';

function anime(id: number, genre: string, theme: string): Anime {
  return {
    id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score: 8,
    userScore: null,
    genres: [{ id, name: genre }],
    themes: [{ id, name: theme }],
    studios: [{ id, name: `Studio ${id}` }],
    staff: [],
    episodeCount: 12,
    year: 2024,
    season: 'spring',
    status: 'finished_airing',
    type: 'tv',
    popularity: 10,
    memberCount: 1000,
  };
}

function entry(id: number, score: number, genre: string, theme: string): AnimeListEntry {
  return {
    anime: { ...anime(id, genre, theme), userScore: score },
    status: 'completed',
    userScore: score,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

function signalInput(overrides: Partial<ProfileSignalInput> = {}): ProfileSignalInput {
  return {
    favoriteGenres: [],
    favoriteThemes: [],
    ratedAnimeCount: 0,
    averageScore: null,
    feedbackCount: 0,
    ...overrides,
  };
}

function summary(overrides: Partial<UserProfileSummary> = {}): UserProfileSummary {
  return { ...emptyProfileSummary(), ...overrides };
}

describe('evaluateProfileSignals', () => {
  it('locks every signal for an empty input', () => {
    const signals = evaluateProfileSignals(signalInput());

    expect(signals).toHaveLength(4);
    expect(signals.every((signal) => !signal.unlocked)).toBe(true);
    expect(signals.every((signal) => signal.progress === 0)).toBe(true);
  });

  it('unlocks rich worlds only once two genres carry a positive signal', () => {
    const one = evaluateProfileSignals(signalInput({ favoriteGenres: [{ name: 'Fantasy' }] }));
    const two = evaluateProfileSignals(
      signalInput({ favoriteGenres: [{ name: 'Fantasy' }, { name: 'Drama' }] }),
    );

    expect(one.find((signal) => signal.key === 'richWorlds')).toMatchObject({
      unlocked: false,
      progress: 50,
    });
    expect(two.find((signal) => signal.key === 'richWorlds')).toMatchObject({
      unlocked: true,
      progress: 100,
    });
    expect(RICH_WORLDS_MIN_GENRES).toBe(2);
  });

  it('unlocks the story signal on a story-driven theme alone', () => {
    const signals = evaluateProfileSignals(
      signalInput({ favoriteThemes: [{ name: 'Psychological' }] }),
    );

    expect(signals.find((signal) => signal.key === 'complexCharacters')).toMatchObject({
      unlocked: true,
      progress: 100,
    });
  });

  it('reports partial progress toward the average score instead of a bare flag', () => {
    const half = evaluateProfileSignals(signalInput({ ratedAnimeCount: 10, averageScore: 4 }));
    const met = evaluateProfileSignals(signalInput({ ratedAnimeCount: 10, averageScore: 9 }));

    expect(half.find((signal) => signal.key === 'discerningTaste')).toMatchObject({
      unlocked: false,
      progress: 50,
    });
    expect(met.find((signal) => signal.key === 'discerningTaste')).toMatchObject({
      unlocked: true,
      progress: 100,
    });
    expect(DISCERNING_TASTE_MIN_AVERAGE).toBe(8);
  });

  it('never unlocks the taste signal without a rating to average', () => {
    const signals = evaluateProfileSignals(signalInput({ ratedAnimeCount: 0, averageScore: 10 }));

    expect(signals.find((signal) => signal.key === 'discerningTaste')).toMatchObject({
      unlocked: false,
      progress: 0,
    });
  });

  it('halves the refined profile progress on a single piece of feedback', () => {
    const one = evaluateProfileSignals(signalInput({ feedbackCount: 1 }));
    const two = evaluateProfileSignals(signalInput({ feedbackCount: 2 }));

    expect(one.find((signal) => signal.key === 'refinedProfile')).toMatchObject({
      unlocked: false,
      progress: 50,
    });
    expect(two.find((signal) => signal.key === 'refinedProfile')).toMatchObject({
      unlocked: true,
      progress: 100,
    });
    expect(REFINED_PROFILE_MIN_FEEDBACK).toBe(2);
  });

  it('keeps every progress value inside 0 to 100', () => {
    const inputs = [
      signalInput(),
      signalInput({
        favoriteGenres: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
        favoriteThemes: [{ name: 'Story' }],
        ratedAnimeCount: 500,
        averageScore: 10,
        feedbackCount: 500,
      }),
    ];

    for (const input of inputs) {
      for (const signal of evaluateProfileSignals(input)) {
        expect(signal.progress, signal.key).toBeGreaterThanOrEqual(0);
        expect(signal.progress, signal.key).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('computeProfileStrength', () => {
  it('reports nothing understood for an empty profile', () => {
    const strength = computeProfileStrength(emptyProfileSummary());

    expect(strength.unlocked).toBe(0);
    expect(strength.total).toBe(4);
    expect(strength.strength).toBe(0);
    expect(strength.nextSignal).not.toBeNull();
    expect(strength.nextSignal?.progress).toBe(0);
  });

  it('agrees exactly with the detected preferences the profile renders', () => {
    const cases: readonly (readonly [string, UserProfileSummary])[] = [
      ['empty', profileSummaryFromModel(buildUserPreferenceProfile([]), 'en', [], 'mal')],
      [
        'one genre',
        profileSummaryFromModel(
          buildUserPreferenceProfile([entry(1, 10, 'Fantasy', 'Worldbuilding')]),
          'en',
          [],
          'mal',
        ),
      ],
      [
        'two genres, high average',
        profileSummaryFromModel(
          buildUserPreferenceProfile([
            entry(1, 10, 'Fantasy', 'Worldbuilding'),
            entry(2, 9, 'Drama', 'Story'),
          ]),
          'en',
          [],
          'mal',
        ),
      ],
      [
        'low average across two genres',
        profileSummaryFromModel(
          buildUserPreferenceProfile([
            entry(1, 3, 'Fantasy', 'Worldbuilding'),
            entry(2, 2, 'Drama', 'Story'),
          ]),
          'en',
          [],
          'mal',
        ),
      ],
    ];

    for (const [label, value] of cases) {
      expect(computeProfileStrength(value).unlocked, label).toBe(value.detectedPreferences.length);
    }
  });

  it('counts a profile that satisfies every gate as fully understood', () => {
    const strength = computeProfileStrength(
      summary({
        analyzedAnimeCount: 50,
        ratedAnimeCount: 40,
        feedbackCount: 6,
        averageScore: 8.6,
        favoriteGenres: [
          { name: 'Fantasy', score: 90, positive: 9, negative: 0, count: 9 },
          { name: 'Drama', score: 85, positive: 8, negative: 0, count: 8 },
        ],
        favoriteThemes: [{ name: 'Story', score: 90, positive: 9, negative: 0, count: 9 }],
      }),
    );

    expect(strength.unlocked).toBe(4);
    expect(strength.total).toBe(4);
    expect(strength.strength).toBe(100);
    expect(strength.nextSignal).toBeNull();
  });

  it('always names a locked signal the user is closest to unlocking', () => {
    const strength = computeProfileStrength(
      summary({ ratedAnimeCount: 10, averageScore: 6.5, feedbackCount: 1 }),
    );

    expect(strength.unlocked).toBe(0);
    expect(strength.nextSignal?.key).toBe('discerningTaste');
    expect(strength.nextSignal?.unlocked).toBe(false);
    expect(strength.nextSignal?.progress).toBeGreaterThan(50);
  });

  it('keeps every signal inside the 0 to 100 progress band', () => {
    for (const rated of [0, 5, 10]) {
      for (const average of [null, 2, 8, 10]) {
        const strength = computeProfileStrength(
          summary({ ratedAnimeCount: rated, averageScore: average, feedbackCount: 3 }),
        );
        for (const signal of strength.signals) {
          expect(
            signal.progress,
            `${rated}/${String(average)}/${signal.key}`,
          ).toBeGreaterThanOrEqual(0);
          expect(signal.progress, `${rated}/${String(average)}/${signal.key}`).toBeLessThanOrEqual(
            100,
          );
        }
      }
    }
  });

  it('localizes every label, requirement, and the counter', () => {
    const profile = summary({ ratedAnimeCount: 10, averageScore: 9 });
    const french = computeProfileStrength(profile, 'fr');
    const english = computeProfileStrength(profile, 'en');

    expect(french.signals.map((signal) => signal.label)).not.toEqual(
      english.signals.map((signal) => signal.label),
    );
    expect(french.signals.map((signal) => signal.requirement)).not.toEqual(
      english.signals.map((signal) => signal.requirement),
    );
  });
});
