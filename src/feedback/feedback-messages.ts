import type { Anime } from '../domain/anime';
import type { DislikeReason, FeedbackValue, RecommendationFeedback } from '../domain/feedback';

export type FeedbackMessage =
  | {
      readonly type: 'feedback.submit';
      readonly recommendationId: string;
      readonly anime: Anime;
      readonly value: FeedbackValue;
      readonly reasons?: readonly DislikeReason[];
    }
  | { readonly type: 'feedback.list' };

export type FeedbackMessageResponse =
  | { readonly ok: true; readonly feedback: readonly RecommendationFeedback[] }
  | { readonly ok: false; readonly message: string };

export async function submitRecommendationFeedback(
  recommendationId: string,
  anime: Anime,
  value: FeedbackValue,
  reasons: readonly DislikeReason[] = [],
): Promise<readonly RecommendationFeedback[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'feedback.submit',
    recommendationId,
    anime,
    value,
    reasons,
  })) as FeedbackMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.feedback;
}

export async function requestFeedback(): Promise<readonly RecommendationFeedback[]> {
  const response = (await chrome.runtime.sendMessage({
    type: 'feedback.list',
  })) as FeedbackMessageResponse;
  if (!response.ok) throw new Error(response.message);
  return response.feedback;
}

export function isFeedbackMessage(value: unknown): value is FeedbackMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  if (value.type === 'feedback.list') return true;
  if (value.type !== 'feedback.submit') return false;
  return (
    'recommendationId' in value &&
    typeof value.recommendationId === 'string' &&
    value.recommendationId.length > 0 &&
    'anime' in value &&
    'value' in value &&
    (value.value === 'like' ||
      value.value === 'dislike' ||
      value.value === 'seen' ||
      value.value === 'not_now')
  );
}
