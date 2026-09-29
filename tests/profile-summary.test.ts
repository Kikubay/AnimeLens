import { describe, expect, it } from 'vitest';
import type { Anime, AnimeListEntry } from '../src/domain/anime';
import { createFeedback } from '../src/domain/feedback';
import { buildUserPreferenceProfile } from '../src/recommendations/recommendation-engine';
import { emptyProfileSummary, profileSummaryFromModel } from '../src/profile/profile-types';
import { buildTasteCardModel } from '../src/profile/taste-card-types';
import { applyManualRanking } from '../src/profile/top-picks';

function anime(id: number, genre: string, theme: string, studio: string): Anime {
  return {
    id: id,
    title: { default: `Anime ${id}`, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    score: 8,
    userScore: null,
    genres: [{ id: id, name: genre }],
    themes: [{ id: id, name: theme }],
    studios: [{ id: id, name: studio }],
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

function entry(
  id: number,
  score: number,
  genre: string,
  theme: string,
  studio: string,
): AnimeListEntry {
  return {
    anime: { ...anime(id, genre, theme, studio), userScore: score },
    status: 'completed',
    userScore: score,
    episodesWatched: 12,
    priority: null,
    isRewatching: false,
    updatedAt: null,
    notes: null,
  };
}

describe('profileSummaryFromModel', () => {
  it('derives analyzed count, average score, favorite dimensions, and detected preferences', () => {
    const entries = [
      entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(2, 9, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(3, 8, 'Drama', 'Characters', 'Studio South'),
    ];
    const summary = profileSummaryFromModel(buildUserPreferenceProfile(entries));

    expect(summary.analyzedAnimeCount).toBe(3);
    expect(summary.ratedAnimeCount).toBe(3);
    expect(summary.averageScore).toBe(9);
    expect(summary.favoriteGenres[0]).toMatchObject({ name: 'Fantasy', score: 90 });
    expect(summary.favoriteThemes[0]?.name).toBe('Worldbuilding');
    expect(summary.favoriteStudios[0]?.name).toBe('Studio North');
    expect(summary.detectedPreferences.length).toBeGreaterThan(0);
    expect(summary.hasData).toBe(true);
  });

  it('exposes the taste card Top 3 plan alongside the other signals', () => {
    // The spec case: two 10/10s lock slots 1 and 2, so exactly one 9/10 slot
    // is left for the user to fill from the five-way tie.
    const entries = [
      entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(2, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      ...[3, 4, 5, 6, 7].map((id) => entry(id, 9, 'Action', 'Chase', 'Studio East')),
    ];
    const summary = profileSummaryFromModel(
      buildUserPreferenceProfile(entries),
      'en',
      entries,
      'mal',
    );

    expect(summary.topPicks.openSlots).toBe(1);
    expect(summary.topPicks.locked.map((pick) => pick.id)).toEqual([1, 2]);
    expect(summary.topPicks.candidates).toHaveLength(5);
    expect(summary.topPicks.boundaryScore).toBe(9);
    expect(summary.topPicks.picks).toHaveLength(3);
    expect(summary.topPicks.signature.startsWith('mal_')).toBe(true);
  });

  it('leaves all three slots open when every top score is tied', () => {
    const entries = [1, 2, 3, 4].map((id) =>
      entry(id, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
    );
    const summary = profileSummaryFromModel(
      buildUserPreferenceProfile(entries),
      'en',
      entries,
      'mal',
    );

    // No score is strictly above the boundary, so the user ranks all three.
    expect(summary.topPicks.openSlots).toBe(3);
    expect(summary.topPicks.locked).toHaveLength(0);
    expect(summary.topPicks.candidates).toHaveLength(4);
  });

  it('never exposes notes, watch progress, or list status on a pick', () => {
    const withPrivateData: AnimeListEntry = {
      ...entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      notes: 'rewatch in winter, private thoughts',
      episodesWatched: 26,
      updatedAt: '2026-02-02T00:00:00.000Z',
    };
    const summary = profileSummaryFromModel(buildUserPreferenceProfile([withPrivateData]), 'en', [
      withPrivateData,
    ]);

    expect(Object.keys(summary.topPicks.picks[0] ?? {}).sort()).toEqual([
      'id',
      'imageUrl',
      'largeImageUrl',
      'score',
      'title',
      'updatedAt',
    ]);
    expect(JSON.stringify(summary.topPicks)).not.toContain('private thoughts');
  });

  it('returns an empty plan when the list is empty', () => {
    const summary = profileSummaryFromModel(buildUserPreferenceProfile([]), 'en', []);

    expect(summary.topPicks.picks).toEqual([]);
    expect(summary.topPicks.openSlots).toBe(0);
    expect(emptyProfileSummary().topPicks.picks).toEqual([]);
  });
  it('renders the manual tie-break ranking on the card when one is supplied', () => {
    const entries = [
      entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(2, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(3, 9, 'Action', 'Chase', 'Studio East'),
      entry(4, 9, 'Action', 'Chase', 'Studio East'),
      entry(5, 9, 'Action', 'Chase', 'Studio East'),
    ];
    const profile = buildUserPreferenceProfile(entries);
    const summary = profileSummaryFromModel(profile, 'en', entries, 'mal');
    expect(summary.topPicks.needsChoice).toBe(true);

    // Without an override the card uses the plan's most-recently-updated fill.
    const automatic = buildTasteCardModel(summary, null, 'mal');
    expect(automatic.topPicks.map((pick) => pick.title)).toEqual(['Anime 1', 'Anime 2', 'Anime 3']);

    // With the user's choice, the third slot is the anime they picked.
    const manual = buildTasteCardModel(
      summary,
      null,
      'mal',
      applyManualRanking(summary.topPicks, [5]),
    );
    expect(manual.topPicks.map((pick) => pick.title)).toEqual(['Anime 1', 'Anime 2', 'Anime 5']);
  });

  it('exposes less appreciated genres from negative ratings and feedback', () => {
    const entries = [entry(1, 2, 'Horror', 'Gore', 'Studio Dark')];
    const feedback = [
      createFeedback(
        'r-2',
        anime(2, 'Horror', 'Gore', 'Studio Dark'),
        'dislike',
        '2026-01-01T00:00:00.000Z',
      ),
    ];
    const summary = profileSummaryFromModel(buildUserPreferenceProfile(entries, feedback));

    expect(summary.lessLikedGenres[0]).toMatchObject({ name: 'Horror' });
    expect(summary.favoriteGenres).toEqual([]);
  });

  it('ranks mixed-signal genres as less liked when their net sentiment dips below average', () => {
    const entries = [
      entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(2, 9, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(3, 9, 'Drama', 'Characters', 'Studio South'),
      entry(4, 1, 'Comedy', 'Gag', 'Studio Joke'),
    ];
    const summary = profileSummaryFromModel(buildUserPreferenceProfile(entries));

    expect(summary.lessLikedGenres[0]).toMatchObject({ name: 'Comedy' });
    expect(summary.favoriteGenres.map((item) => item.name)).toEqual(['Fantasy', 'Drama']);
  });

  it('moves a genre into the less-liked ranking as soon as it receives a dislike', () => {
    const entries = [
      entry(1, 10, 'Fantasy', 'Worldbuilding', 'Studio North'),
      entry(2, 2, 'Horror', 'Gore', 'Studio Dark'),
      entry(3, 7, 'Comedy', 'Gag', 'Studio Joke'),
    ];
    const base = profileSummaryFromModel(buildUserPreferenceProfile(entries, []));
    expect(base.lessLikedGenres.map((item) => item.name)).toEqual(['Horror']);

    const dislike = createFeedback(
      'r-9',
      anime(9, 'Comedy', 'Gag', 'Studio Joke'),
      'dislike',
      '2026-01-02T00:00:00.000Z',
    );
    const updated = profileSummaryFromModel(buildUserPreferenceProfile(entries, [dislike]));

    expect(updated.lessLikedGenres.map((item) => item.name)).toEqual(['Horror', 'Comedy']);
    const comedy = updated.lessLikedGenres.find((item) => item.name === 'Comedy');
    expect(comedy?.negative).toBeGreaterThan(0);
  });

  it('returns an explicit empty summary without inventing preferences', () => {
    const summary = emptyProfileSummary();

    expect(summary).toEqual({
      analyzedAnimeCount: 0,
      ratedAnimeCount: 0,
      averageScore: null,
      favoriteGenres: [],
      favoriteThemes: [],
      favoriteStudios: [],
      lessLikedGenres: [],
      detectedPreferences: [],
      topPicks: emptyProfileSummary().topPicks,
      hasData: false,
    });
  });
});
