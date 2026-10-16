import { describe, expect, it } from 'vitest';
import {
  DATA_EXPORT_APP,
  DATA_EXPORT_VERSION,
  EXCLUDED_STORAGE_KEYS,
  EXPORTED_STORAGE_KEYS,
  buildDataExport,
  parseDataExport,
  serializeDataExport,
  storedValuesFromExport,
  summarizeDataExport,
} from '../src/settings/data-transfer';
import { buildUserPreferenceProfile } from '../src/recommendations/recommendation-engine';
import { createFeedback } from '../src/domain/feedback';
import type { Anime } from '../src/domain/anime';
import type { StorageKey } from '../src/storage/storage-types';

const anime: Anime = {
  id: 1,
  title: { default: 'Anime', english: null, japanese: null, synonyms: [] },
  synopsis: null,
  image: null,
  score: 8,
  userScore: null,
  genres: [{ id: 1, name: 'Action' }],
  themes: [{ id: 1, name: 'Story' }],
  studios: [{ id: 1, name: 'Studio North' }],
  staff: [],
  episodeCount: 12,
  year: 2024,
  season: 'spring',
  status: 'finished_airing',
  type: 'tv',
  popularity: 10,
  memberCount: 1000,
};

const feedback = [
  createFeedback('r-1', anime, 'like', '2026-01-01T00:00:00.000Z'),
  createFeedback('r-2', anime, 'dislike', '2026-01-02T00:00:00.000Z'),
];

const snapshot = {
  version: 1,
  capturedAt: '2026-01-01T00:00:00.000Z',
  providerId: 'mal',
  analyzedAnimeCount: 100,
  ratedAnimeCount: 80,
  averageScore: 7.5,
  genres: [{ name: 'Action', score: 90, count: 10 }],
  themes: [],
  studios: [],
};

const STORED = {
  feedback,
  preferences: { theme: 'light', language: 'fr' },
  activeProvider: 'anilist',
  manual_top_3_ranking: [3, 1, 2],
  manual_top_3_pool_signature: 'mal_abc',
  profileHistory: { mal: { snapshots: [snapshot] } },
  animeData: { entries: [{ title: 'Private List Entry' }] },
  'animeData:mal': { entries: [{ title: 'Private Mal Entry' }] },
  'animeData:anilist': { entries: [{ title: 'Private Anilist Entry' }] },
  profile: { id: 9, username: 'secret_user', avatarUrl: null },
  session: { accessToken: 'super-secret-token', expiresAt: null },
  malClientId: 'mal-client-secret',
  anilistClientId: 'anilist-client-secret',
  updateCheck: { latest: '9.9.9' },
};

function exported() {
  return buildDataExport(STORED, '2026-02-01T00:00:00.000Z');
}

describe('buildDataExport', () => {
  it('carries everything AnimeLens collects', () => {
    const data = exported().data;

    expect(data.feedback).toHaveLength(2);
    expect(data.preferences.language).toBe('fr');
    expect(data.activeProvider).toBe('anilist');
    expect(data.manualTop3Ranking).toEqual([3, 1, 2]);
    expect(data.manualTop3PoolSignature).toBe('mal_abc');
    expect(data.profileHistory.mal?.snapshots).toHaveLength(1);
  });

  it('never leaks provider content, credentials, or account identity', () => {
    const json = serializeDataExport(exported());

    for (const secret of [
      'Private List Entry',
      'Private Mal Entry',
      'Private Anilist Entry',
      'secret_user',
      'super-secret-token',
      'mal-client-secret',
      'anilist-client-secret',
      '9.9.9',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it('reads only the allow-listed storage keys', () => {
    for (const key of EXCLUDED_STORAGE_KEYS) {
      expect(EXPORTED_STORAGE_KEYS).not.toContain(key as (typeof EXPORTED_STORAGE_KEYS)[number]);
    }
  });

  it('omits keys that were never written', () => {
    const empty = buildDataExport({}, '2026-02-01T00:00:00.000Z');

    expect(empty.data.feedback).toEqual([]);
    expect(empty.data.manualTop3Ranking).toBeNull();
    expect(empty.data.manualTop3PoolSignature).toBeNull();
    expect(empty.data.activeProvider).toBeNull();
    expect(empty.data.profileHistory).toEqual({});
  });

  it('drops malformed stored values instead of failing the export', () => {
    const damaged = buildDataExport(
      {
        feedback: [feedback[0], { nonsense: true }],
        preferences: 'not-an-object',
        activeProvider: 'not-a-provider',
        manual_top_3_ranking: ['a'],
        profileHistory: { mal: { snapshots: [{ broken: true }] } },
      },
      '2026-02-01T00:00:00.000Z',
    );

    expect(damaged.data.feedback).toHaveLength(1);
    expect(damaged.data.activeProvider).toBeNull();
    expect(damaged.data.manualTop3Ranking).toBeNull();
    expect(damaged.data.profileHistory).toEqual({});
    expect(damaged.data.preferences.theme).toBe('dark');
  });

  it('stamps the export with the app, a version, and the time', () => {
    const built = exported();

    expect(built.app).toBe(DATA_EXPORT_APP);
    expect(built.version).toBe(DATA_EXPORT_VERSION);
    expect(built.exportedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('summarizeDataExport', () => {
  it('counts feedback and profile snapshots', () => {
    const summary = summarizeDataExport(exported().data);

    expect(summary.feedback).toBe(2);
    expect(summary.profileSnapshots).toBe(1);
  });
});

describe('parseDataExport', () => {
  it('round-trips a freshly built export', () => {
    const built = exported();
    const parsed = parseDataExport(JSON.parse(serializeDataExport(built)));

    expect(parsed).not.toBeNull();
    expect(parsed?.data.feedback).toEqual(built.data.feedback);
    expect(parsed?.data.manualTop3Ranking).toEqual([3, 1, 2]);
    expect(parsed?.data.profileHistory).toEqual(built.data.profileHistory);
  });

  it('rejects anything that is not an AnimeLens export', () => {
    expect(parseDataExport(null)).toBeNull();
    expect(parseDataExport('{}')).toBeNull();
    expect(parseDataExport([])).toBeNull();
    expect(parseDataExport({ app: 'somethingelse', version: 1 })).toBeNull();
  });

  it('rejects a version it cannot read rather than guessing', () => {
    const built = exported();

    expect(parseDataExport({ ...built, version: DATA_EXPORT_VERSION + 1 })).toBeNull();
    expect(parseDataExport({ ...built, version: 0 })).toBeNull();
  });

  it('rejects an export with a tampered payload', () => {
    const built = exported();

    expect(parseDataExport({ ...built, exportedAt: 42 })).toBeNull();
    expect(
      parseDataExport({ ...built, data: { ...built.data, feedback: [{ animeMalId: 'x' }] } }),
    ).toBeNull();
    expect(
      parseDataExport({ ...built, data: { ...built.data, activeProvider: 'notreal' } }),
    ).toBeNull();
    expect(
      parseDataExport({
        ...built,
        data: { ...built.data, profileHistory: { mal: { snapshots: [{ v: 1 }] } } },
      }),
    ).toBeNull();
  });

  it('ignores a snapshot belonging to an unknown provider', () => {
    const built = exported();

    const parsed = parseDataExport({
      ...built,
      data: { ...built.data, profileHistory: { madeup: { snapshots: [snapshot] } } },
    });

    expect(parsed?.data.profileHistory).toEqual({});
  });
});

describe('storedValuesFromExport', () => {
  it('maps a parsed export back onto storage keys', () => {
    const parsed = parseDataExport(JSON.parse(serializeDataExport(exported())));
    const values = storedValuesFromExport(parsed!);

    expect(values.feedback).toHaveLength(2);
    expect(values.preferences.language).toBe('fr');
    expect(values.activeProvider).toBe('anilist');
    expect(values.manualTop3Ranking).toEqual([3, 1, 2]);
    expect(values.manualTop3PoolSignature).toBe('mal_abc');
    expect(values.profileHistory.mal?.snapshots).toHaveLength(1);
  });

  it('reports absent optional values as null instead of empty strings', () => {
    const values = storedValuesFromExport(buildDataExport({}, '2026-02-01T00:00:00.000Z'));

    expect(values.activeProvider).toBeNull();
    expect(values.manualTop3Ranking).toBeNull();
    expect(values.manualTop3PoolSignature).toBeNull();
  });
});

describe('restored feedback still drives the engine', () => {
  const watched = [
    {
      anime,
      status: 'completed' as const,
      userScore: 9,
      episodesWatched: 12,
      priority: null,
      isRewatching: false,
      updatedAt: null,
      notes: null,
    },
  ];

  it('is counted again after a round trip', () => {
    const restored = storedValuesFromExport(exported()).feedback;

    expect(restored).toHaveLength(2);
    expect(buildUserPreferenceProfile(watched, restored).feedbackCount).toBe(2);
    expect(buildUserPreferenceProfile(watched).feedbackCount).toBe(0);
  });

  it('is silently ignored by the engine if the feature snapshot is dropped', () => {
    const stripped = feedback.map((item) => ({ ...item, features: undefined }));

    expect(buildUserPreferenceProfile(watched, feedback).feedbackCount).toBe(2);
    expect(buildUserPreferenceProfile(watched, stripped).feedbackCount).toBe(0);
  });
});

describe('excluded keys', () => {
  it('lists every provider-owned or secret key the export must skip', () => {
    expect([...EXCLUDED_STORAGE_KEYS].sort()).toEqual(
      [
        'anilistClientId',
        'animeData',
        'animeData:anilist',
        'animeData:mal',
        'malClientId',
        'profile',
        'session',
        'updateCheck',
      ].sort(),
    );
  });

  it('covers every key declared by storage', () => {
    const declared: readonly StorageKey[] = [
      'session',
      'profile',
      'animeData',
      'animeData:mal',
      'animeData:anilist',
      'feedback',
      'preferences',
      'malClientId',
      'anilistClientId',
      'activeProvider',
      'manual_top_3_ranking',
      'manual_top_3_pool_signature',
      'profileHistory',
      'updateCheck',
    ];
    const covered = new Set<string>([...EXPORTED_STORAGE_KEYS, ...EXCLUDED_STORAGE_KEYS]);

    expect(declared.filter((key) => !covered.has(key))).toEqual([]);
  });
});
