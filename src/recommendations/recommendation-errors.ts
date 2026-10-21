import type { AppCopy } from '../locales';

export type RecommendationErrorCopy = Pick<
  AppCopy,
  'recommendationsUnavailable' | 'recommendationsProviderUnavailable' | 'listSessionExpired'
>;

/**
 * The message the reader gets when the dashboard cannot be built.
 *
 * The code is read structurally rather than through `instanceof`, so a failure that crossed a bundle
 * boundary or was rebuilt along the way still lands on the right sentence instead of the generic
 * one, and a downed provider is named instead of being reported as a broken extension.
 */
export function recommendationErrorMessage(
  error: unknown,
  providerName: string,
  copy: RecommendationErrorCopy,
): string {
  const code = errorCode(error);
  if (code === 'network_error' || code === 'rate_limited' || code === 'forbidden') {
    return copy.recommendationsProviderUnavailable(providerName);
  }
  if (code === 'unauthorized' || code === 'session_expired') {
    return copy.listSessionExpired(providerName);
  }
  return copy.recommendationsUnavailable;
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}
