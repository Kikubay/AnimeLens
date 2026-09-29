import { describe, expect, it } from 'vitest';
import {
  isMalAnimeDto,
  normalizeAnime,
  normalizeAnimeListEntry,
  normalizeUserProfile,
} from '../src/api/mal-normalizer';
import type { MalAnimeDto, MalAnimeNodeDto } from '../src/api/mal-types';

const malAnime: MalAnimeDto = {
  id: 52991,
  title: 'Sousou no Frieren',
  alternative_titles: {
    en: "Frieren: Beyond Journey's End",
    ja: '葬送のフリーレン',
    synonyms: ['Frieren'],
  },
  synopsis: '  An elf mage begins a journey after the end of a great adventure.  ',
  main_picture: {
    medium: 'https://example.test/medium.jpg',
    large: 'https://example.test/large.jpg',
  },
  mean: 9.3,
  num_episodes: 28,
  start_date: '2023-09-29',
  start_season: { year: 2023, season: 'fall' },
  media_type: 'tv',
  status: 'finished_airing',
  popularity: 1,
  num_list_users: 500000,
  genres: [
    { id: 10, name: 'Fantasy' },
    { id: 38, name: 'Military' },
    { id: 27, name: 'Shounen' },
  ],
  studios: [{ id: 3, name: 'Madhouse' }],
  staff: [
    {
      person: {
        id: 4,
        name: 'Keiichiro Saito',
        images: { jpg: { image_url: 'https://example.test/staff.jpg' } },
      },
      positions: ['Director'],
    },
  ],
};

describe('MAL normalization', () => {
  it('normalizes a complete anime DTO into the canonical model', () => {
    const anime = normalizeAnime(malAnime, 10);

    expect(anime.id).toBe(52991);
    expect(anime.title.english).toBe("Frieren: Beyond Journey's End");
    expect(anime.synopsis).toBe('An elf mage begins a journey after the end of a great adventure.');
    expect(anime.score).toBe(9.3);
    expect(anime.userScore).toBe(10);
    // The flat `genres` array is split by the official ID taxonomy:
    // Fantasy(10) stays a genre, Military(38) is a theme, Shounen(27) a
    // demographic (kept as a genre).
    expect(anime.genres).toEqual([
      { id: 10, name: 'Fantasy' },
      { id: 27, name: 'Shounen' },
    ]);
    expect(anime.themes).toEqual([{ id: 38, name: 'Military' }]);
    expect(anime.staff[0].positions).toEqual(['Director']);
  });

  it('keeps unknown genre IDs as genres and preserves empty arrays', () => {
    const anime = normalizeAnime({
      id: 9,
      title: 'Unknown Taxonomy',
      genres: [
        { id: 9999, name: 'Future Category' },
        { id: 62, name: 'Isekai' },
      ],
    });

    expect(anime.genres).toEqual([{ id: 9999, name: 'Future Category' }]);
    expect(anime.themes).toEqual([{ id: 62, name: 'Isekai' }]);
    expect(normalizeAnime({ id: 10, title: 'Empty' }).themes).toEqual([]);
  });

  it('normalizes missing and invalid optional values to safe defaults', () => {
    const anime = normalizeAnime({ id: 7, title: 'Minimal', mean: 99, media_type: 'comic' });

    expect(anime.title.default).toBe('Minimal');
    expect(anime.synopsis).toBeNull();
    expect(anime.image).toBeNull();
    expect(anime.score).toBeNull();
    expect(anime.type).toBe('unknown');
    expect(anime.status).toBe('unknown');
    expect(anime.genres).toEqual([]);
  });

  it('maps a user list entry without exposing MAL snake_case fields', () => {
    const entry: MalAnimeNodeDto = {
      node: malAnime,
      list_status: {
        status: 'watching',
        score: 9,
        num_episodes_watched: 12,
        priority: 1,
        is_rewatching: true,
        updated_at: '2026-09-09T10:00:00Z',
        comments: '  keep watching  ',
      },
    };
    const result = normalizeAnimeListEntry(entry);

    expect(result.status).toBe('watching');
    expect(result.userScore).toBe(9);
    expect(result.episodesWatched).toBe(12);
    expect(result.isRewatching).toBe(true);
    expect(result.notes).toBe('keep watching');
    expect(result.anime.userScore).toBe(9);
  });

  it('treats MAL score 0 as unscored, not as a rating', () => {
    const entry: MalAnimeNodeDto = {
      node: malAnime,
      list_status: { status: 'completed', score: 0 },
    };
    const result = normalizeAnimeListEntry(entry);

    expect(result.status).toBe('completed');
    expect(result.userScore).toBeNull();
    expect(result.anime.userScore).toBeNull();
  });

  it('defaults a list entry without list_status to plan_to_watch without a score', () => {
    const result = normalizeAnimeListEntry({ node: malAnime });

    expect(result.status).toBe('plan_to_watch');
    expect(result.userScore).toBeNull();
    expect(result.episodesWatched).toBe(0);
  });

  it('validates the minimum shape before normalization', () => {
    expect(isMalAnimeDto(malAnime)).toBe(true);
    expect(isMalAnimeDto({ id: '52991', title: 'Invalid' })).toBe(false);
    expect(isMalAnimeDto(null)).toBe(false);
  });

  it('normalizes the user profile into domain naming', () => {
    const profile = normalizeUserProfile({ id: 42, name: 'mori', picture: 'avatar.jpg' });

    expect(profile).toEqual({
      id: 42,
      username: 'mori',
      avatarUrl: 'avatar.jpg',
      joinedAt: null,
      location: null,
      timeZone: null,
    });
  });
});
