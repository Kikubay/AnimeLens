import type { Anime } from '../../domain/anime';
import type { UserProfile } from '../../domain/user-profile';

export const defaultMockProfile: UserProfile = {
  id: 18422971,
  username: 'alex.mori',
  avatarUrl: null,
  joinedAt: null,
  location: null,
  timeZone: null,
};

export const defaultMockAnime: readonly Anime[] = [
  {
    id: 52991,
    title: {
      default: 'Sousou no Frieren',
      english: "Frieren: Beyond Journey's End",
      japanese: '葬送のフリーレン',
      synonyms: ['Frieren'],
    },
    synopsis: 'An elf mage begins a journey after the end of a great adventure.',
    image: null,
    score: 9.3,
    userScore: 9,
    genres: [{ id: 2, name: 'Adventure' }],
    themes: [{ id: 8, name: 'Fantasy' }],
    studios: [{ id: 11, name: 'Madhouse' }],
    staff: [],
    episodeCount: 28,
    year: 2023,
    season: 'fall',
    status: 'finished_airing',
    type: 'tv',
    popularity: 1,
    memberCount: 500000,
  },
];
