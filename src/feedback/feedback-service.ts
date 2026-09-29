import type { DislikeReason } from '../domain/feedback';
import type { Anime } from '../domain/anime';
import type { FeedbackValue, RecommendationFeedback } from '../domain/feedback';
import { recordFeedback, type FeedbackStore } from './feedback-store';

export const NOT_NOW_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class RecommendationFeedbackService {
  constructor(
    private readonly store: FeedbackStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<readonly RecommendationFeedback[]> {
    const feedback = await this.store.list();
    const now = this.now().getTime();
    return feedback.filter(
      (item) =>
        item.expiresAt === undefined || item.expiresAt === null || Date.parse(item.expiresAt) > now,
    );
  }

  async submit(
    recommendationId: string,
    anime: Anime,
    value: FeedbackValue,
    reasons: readonly DislikeReason[] = [],
  ): Promise<readonly RecommendationFeedback[]> {
    const expiresAt =
      value === 'not_now' ? new Date(this.now().getTime() + NOT_NOW_TTL_MS).toISOString() : null;
    await recordFeedback(this.store, recommendationId, anime, value, this.now().toISOString(), {
      expiresAt,
      reasons: value === 'dislike' ? reasons : undefined,
    });
    return this.list();
  }

  async clear(recommendationId: string): Promise<void> {
    await this.store.remove(recommendationId);
  }
}
