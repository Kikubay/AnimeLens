import type { AnimeFormat } from '../domain/anime';
import type { UserProfile, UserTasteProfile } from '../domain/user-profile';
import type { MockAnime } from './components/anime';

export const mockProfile: UserProfile = {
  id: 18422971,
  username: 'alex.mori',
  avatarUrl: null,
  joinedAt: null,
  location: null,
  timeZone: null,
};

export const mockTaste: UserTasteProfile = {
  preferredGenres: new Map([
    ['Psychological', 1],
    ['Sci-Fi', 0.92],
    ['Drama', 0.8],
    ['Mystery', 0.74],
  ]),
  preferredFormats: new Map<AnimeFormat, number>([
    ['tv', 1],
    ['movie', 0.72],
  ]),
  averageScore: 8.1,
  ratedAnimeCount: 42,
};

type MockAnimeInput = Pick<
  MockAnime,
  | 'id'
  | 'subtitle'
  | 'posterLabel'
  | 'accent'
  | 'recommendation'
  | 'genres'
  | 'type'
  | 'score'
  | 'episodeCount'
  | 'compatibility'
> &
  Partial<Omit<MockAnime, 'title'>> & { readonly title: string };

function anime(overrides: MockAnimeInput): MockAnime {
  const { title, ...rest } = overrides;
  return {
    ...rest,
    title: { default: title, english: null, japanese: null, synonyms: [] },
    synopsis: null,
    image: null,
    userScore: null,
    themes: [],
    studios: [],
    staff: [],
    year: null,
    season: null,
    status: 'finished_airing',
    popularity: null,
    memberCount: null,
  };
}

export const mockAnime: readonly MockAnime[] = [
  anime({
    id: 1,
    title: 'PLUTO',
    subtitle: 'MYSTERY · SCI-FI',
    posterLabel: 'PLUTO',
    accent: '#d7a77d',
    synopsis:
      'A quiet, beautifully tense investigation into the nature of memory, grief, and what makes us human.',
    recommendation: 'Because you rated Monster and love slow-burn psychological worlds.',
    genres: [
      { id: 1, name: 'Psychological' },
      { id: 2, name: 'Sci-Fi' },
    ],
    type: 'tv',
    score: 8.5,
    episodeCount: 8,
    compatibility: 96,
    isNew: true,
  }),
  anime({
    id: 2,
    title: 'Sonny Boy',
    subtitle: 'DRAMA · MYSTERY',
    posterLabel: 'SONNY\nBOY',
    accent: '#86b6bd',
    synopsis:
      'A class of students drifts through a surreal dimension where every rule is waiting to be rewritten.',
    recommendation: 'An offbeat match for your taste in existential stories.',
    genres: [
      { id: 3, name: 'Drama' },
      { id: 4, name: 'Mystery' },
    ],
    type: 'tv',
    score: 7.7,
    episodeCount: 12,
    compatibility: 91,
  }),
  anime({
    id: 3,
    title: 'Heavenly Delusion',
    subtitle: 'ADVENTURE · SCI-FI',
    posterLabel: 'TENGOKU\nDAIMAKYO',
    accent: '#c8795c',
    synopsis:
      'Two journeys move toward the same hidden truth in a world that has forgotten its own shape.',
    recommendation: 'You tend to finish intricate worlds with a mystery at their core.',
    genres: [
      { id: 5, name: 'Sci-Fi' },
      { id: 6, name: 'Adventure' },
    ],
    type: 'tv',
    score: 8.1,
    episodeCount: 13,
    compatibility: 88,
  }),
  anime({
    id: 4,
    title: 'Odd Taxi',
    subtitle: 'MYSTERY · DRAMA',
    posterLabel: 'ODD\nTAXI',
    accent: '#7e8cae',
    synopsis:
      'A taxi driver’s ordinary routes become the threads of an unusually sharp urban mystery.',
    recommendation: 'Compact, clever, and built for your high-rated mystery streak.',
    genres: [
      { id: 7, name: 'Mystery' },
      { id: 8, name: 'Drama' },
    ],
    type: 'tv',
    score: 8.7,
    episodeCount: 13,
    compatibility: 86,
  }),
];
