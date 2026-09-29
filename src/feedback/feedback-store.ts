import type { Anime } from '../domain/anime';
import {
  createFeedback,
  type FeedbackValue,
  type RecommendationFeedback,
  type DislikeReason,
} from '../domain/feedback';
import type { StorageAdapter } from '../storage/storage-adapter';

export interface FeedbackStore {
  list(): Promise<readonly RecommendationFeedback[]>;
  save(feedback: RecommendationFeedback): Promise<void>;
  remove(recommendationId: string): Promise<void>;
}

export class ChromeFeedbackStore implements FeedbackStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: StorageAdapter) {}

  async list(): Promise<readonly RecommendationFeedback[]> {
    const feedback = await this.storage.get('feedback');
    return feedback ?? [];
  }

  save(feedback: RecommendationFeedback): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.list();
      const next = [
        ...current.filter((item) => item.recommendationId !== feedback.recommendationId),
        feedback,
      ];
      await this.storage.set('feedback', next);
    });
  }

  remove(recommendationId: string): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.list();
      await this.storage.set(
        'feedback',
        current.filter((item) => item.recommendationId !== recommendationId),
      );
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.writeQueue.then(operation);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }
}

export function recordFeedback(
  store: FeedbackStore,
  recommendationId: string,
  anime: Anime,
  value: FeedbackValue,
  createdAt: string,
  options: {
    readonly expiresAt?: string | null;
    readonly reasons?: readonly DislikeReason[];
  } = {},
): Promise<void> {
  return store.save(createFeedback(recommendationId, anime, value, createdAt, options));
}
