import { describe, expect, it } from 'vitest';
import type { Anime } from '../src/domain/anime';
import { createFeedback } from '../src/domain/feedback';
import { ChromeFeedbackStore } from '../src/feedback/feedback-store';
import type { AnimeLensStorage, StorageKey } from '../src/storage/storage-types';
import type { StorageAdapter } from '../src/storage/storage-adapter';

const anime: Anime = {
  id: 1,
  title: { default: 'Stored anime', english: null, japanese: null, synonyms: [] },
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

class MemoryStorage implements StorageAdapter {
  values: Partial<AnimeLensStorage> = {};
  async get<K extends StorageKey>(key: K): Promise<AnimeLensStorage[K] | undefined> {
    return this.values[key];
  }
  async set<K extends StorageKey>(key: K, value: AnimeLensStorage[K]): Promise<void> {
    this.values[key] = value;
  }
  async remove(key: StorageKey): Promise<void> {
    delete this.values[key];
  }
}

describe('ChromeFeedbackStore', () => {
  it('persists feedback and replaces the previous decision for one recommendation', async () => {
    const store = new ChromeFeedbackStore(new MemoryStorage());
    await store.save(createFeedback('r-1', anime, 'dislike', '2026-01-01T00:00:00.000Z'));
    await store.save(createFeedback('r-1', anime, 'like', '2026-01-02T00:00:00.000Z'));

    await expect(store.list()).resolves.toMatchObject([{ value: 'like' }]);
  });

  it('removes only the requested recommendation feedback', async () => {
    const store = new ChromeFeedbackStore(new MemoryStorage());
    await store.save(createFeedback('r-1', anime, 'like', '2026-01-01T00:00:00.000Z'));
    await store.save(
      createFeedback('r-2', { ...anime, id: 2 }, 'seen', '2026-01-01T00:00:00.000Z'),
    );

    await store.remove('r-1');

    await expect(store.list()).resolves.toMatchObject([{ recommendationId: 'r-2' }]);
  });
});
