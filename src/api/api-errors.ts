export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'invalid_response'
  | 'network_error'
  | 'token_expired'
  | 'unknown';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    options: {
      readonly code: ApiErrorCode;
      readonly status?: number | null;
      readonly retryAfterSeconds?: number | null;
      readonly cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
