import { ApiError } from './api-errors';
import { isRetryableStatus, parseRetryAfterSeconds } from './retry-after';

export interface HttpResponse<T> {
  readonly status: number;
  readonly headers: Headers;
  readonly data: T;
}

export interface HttpClient {
  get<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>>;
  post<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>>;
  patch<T>(url: string, options?: RequestInit): Promise<HttpResponse<T>>;
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  get<T>(url: string, options: RequestInit = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  post<T>(url: string, options: RequestInit = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' });
  }

  patch<T>(url: string, options: RequestInit = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH' });
  }

  private async request<T>(url: string, options: RequestInit): Promise<HttpResponse<T>> {
    let response: Response;
    try {
      response = await this.fetcher(url, options);
    } catch (error) {
      throw new ApiError('The API request could not be completed.', {
        code: 'network_error',
        cause: error,
      });
    }

    if (!response.ok) throw await toApiError(response);

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (error) {
      throw new ApiError('The API returned an invalid JSON response.', {
        code: 'invalid_response',
        status: response.status,
        cause: error,
      });
    }

    return { status: response.status, headers: response.headers, data };
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const payload = await readErrorPayload(response);
  const message = payload?.message ?? `The API request failed with status ${response.status}.`;
  // MAL and GitHub both send the HTTP-date form, and dropping it loses the only hint at how long the rate-limit window lasts.
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));

  const code =
    response.status === 400
      ? 'bad_request'
      : response.status === 401
        ? 'unauthorized'
        : response.status === 403
          ? 'forbidden'
          : response.status === 404
            ? 'not_found'
            : response.status === 429
              ? 'rate_limited'
              : isRetryableStatus(response.status)
                ? // 5xx and 408 are transport failures, so they belong with retryable network errors rather than `unknown`.
                  'network_error'
                : 'unknown';

  return new ApiError(message, {
    code,
    status: response.status,
    retryAfterSeconds,
    cause: payload,
  });
}

async function readErrorPayload(response: Response): Promise<{ readonly message?: string } | null> {
  try {
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null) return null;
    // AniList hides its message under `{ errors: [{ message }] }`, so unwrap that instead of reporting a bare "status 400".
    if ('message' in value) {
      const message = value.message;
      return typeof message === 'string' ? { message } : null;
    }
    if ('errors' in value && Array.isArray(value.errors)) {
      const messages = value.errors
        .map((error: unknown) =>
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { readonly message?: unknown }).message
            : null,
        )
        .filter((message: unknown): message is string => typeof message === 'string');
      if (messages.length > 0) return { message: messages.join('; ') };
    }
  } catch {
    // An error response is allowed to have no body at all, so this swallow is deliberate.
  }
  return null;
}
