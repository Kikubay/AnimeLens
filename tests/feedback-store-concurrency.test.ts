import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import { createFeedback } from '../src/domain/feedback';
import { ChromeFeedbackStore } from '../src/feedback/feedback-store';
import type { AnimeLensStorage, StorageKey } from '../src/storage/storage-types';
import type { StorageAdapter } from '../src/storage/storage-adapter';

const baseAnime: Anime = {
  id: 1,
  title: { default: 'Concurrency test', english: null, japanese: null, synonyms: [] },
  synopsis: null,
  image: null,
  score: 8,
  userScore: null,
  genres: [],
  themes: [],
  studios: [],
  staff: [],
  episodeCount: 12,
  year: 2024,
  season: 'spring',
  status: 'finished_airing',
  type: 'tv',
  popularity: 1,
  memberCount: 1,
};

class DelayedStorage implements StorageAdapter {
  values: Partial<AnimeLensStorage> = {};
  async get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return this.values[key];
  }
  async set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.values[key] = value;
  }
  async remove(key: StorageKey): Promise<void> {
    delete this.values[key];
  }
}

describe('ChromeFeedbackStore concurrency', () => {
  it('does not lose unrelated feedback when writes overlap', async () => {
    const store = new ChromeFeedbackStore(new DelayedStorage());
    await Promise.all([
      store.save(
        createFeedback('r-1', { ...baseAnime, id: 1 }, 'like', '2026-01-01T00:00:00.000Z'),
      ),
      store.save(
        createFeedback('r-2', { ...baseAnime, id: 2 }, 'dislike', '2026-01-01T00:00:00.000Z'),
      ),
    ]);

    const feedback = await store.list();
    expect(feedback.map((item) => item.recommendationId).sort()).toEqual(['r-1', 'r-2']);
  });
});
