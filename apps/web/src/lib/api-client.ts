import axios, { type AxiosRequestConfig } from 'axios';
import {
  readCurrentRefreshVersion,
  runRefreshWithLock,
} from './auth-refresh-coordination';

// Base URL shared by all API requests.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000/api/v1';

// Main client used for normal API requests.
// Its response interceptor handles eligible 401 responses.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate client used only for refreshing the access token.
// It does not use apiClient's response interceptor.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Holds the currently running refresh operation.
// Concurrent requests share this Promise instead of starting new refreshes.
let refreshPromise: Promise<void> | null = null;

// Coordinates token refresh across tabs using a shared browser lock.
// Reuses the same Promise for concurrent refreshes inside this tab.
function refreshAccessToken(
  expectedVersion: string | null
): Promise<void> {
  // If the browser does not support Web Locks, we cannot safely coordinate refreshes.
  if(
    typeof navigator === 'undefined' ||
    !navigator.locks
  ){
    return Promise.reject(
      new ApiRequestError(
         'Automatic session refresh requires a secure context and Web Locks support.',
      )
    )
  }

  if (!refreshPromise) {
    refreshPromise = runRefreshWithLock(
      expectedVersion,
      () => refreshClient.post('/auth/refresh'),
    ).finally(() => {
      // Clear the shared Promise so future refreshes can start a new one.
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Adds a flag to Axios request configuration to prevent retry loops.
type RetryRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _refreshVersion?: string | null;
};

// Records the refresh version that existed when each request started.
apiClient.interceptors.request.use((config) => {
  const retryableConfig = config as typeof config & {
    _refreshVersion?: string | null;
  };

  retryableConfig._refreshVersion = readCurrentRefreshVersion();

  return config;
});


// Requests to these endpoints must not trigger automatic token refresh.
const excludedAuthPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
];

// Intercepts responses from apiClient.
// Successful responses pass through unchanged.
// Eligible 401 errors trigger one shared refresh, then retry the original request.
apiClient.interceptors.response.use(
  // Pass successful responses to the original caller.
  (response) => response,

  // Handle rejected HTTP requests, including 401 responses.
  async (error: unknown) => {
    // Only handle errors created by Axios.
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    // Keep the original request so we can retry it after refreshing.
    const originalRequest =
      error.config as RetryRequestConfig | undefined;

    const requestUrl = originalRequest?.url;

    // Decide whether this error should bypass automatic refresh.
    const shouldSkipRefresh =
      error.response?.status !== 401 ||
      !originalRequest ||
      !requestUrl ||
      originalRequest._retry === true ||
      excludedAuthPaths.some((path) =>
        requestUrl.includes(path),
      );

    // Pass through non-401 errors, excluded endpoints,
    // missing request configurations, and already-retried requests.
    if (shouldSkipRefresh) {
      throw error;
    }

    // Mark the request so it cannot be retried more than once.
    originalRequest._retry = true;

    // Read the refresh version that existed when this request started.
    const expectedVersion = originalRequest._refreshVersion ?? null;
    await refreshAccessToken(expectedVersion);

    // Retry the original request after refresh succeeds.
    return apiClient.request(originalRequest);
  },
);

// Describes the successful response format returned by our backend.
type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
};

// Maps field names to their validation error messages.
type FieldErrors = Record<string, string>;

// Represents a normalized API error for use by the UI.
export class ApiRequestError extends Error {
  public readonly statusCode?: number;
  public readonly fieldErrors: FieldErrors;

  // Creates an API error with a message, optional HTTP status, and field errors.
  constructor(
    message: string,
    statusCode?: number,
    fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

// Checks whether an unknown value is a non-null, non-array object.
// This lets TypeScript safely narrow the value before reading its properties.
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Extracts a useful error message from a backend payload,
// or returns a fallback when the payload has no usable message.
function getErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  const message = payload.message;

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string => typeof item === 'string',
    );

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  return fallback;
}

// Extracts validation errors returned as { field, message } objects.
function getFieldErrors(payload: unknown): FieldErrors {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) {
    return {};
  }

  const fieldErrors: FieldErrors = {};

  for (const item of payload.errors) {
    if (
      isRecord(item) &&
      typeof item.field === 'string' &&
      typeof item.message === 'string'
    ) {
      fieldErrors[item.field] = item.message;
    }
  }

  return fieldErrors;
}

// Sends an API request, unwraps the backend's success envelope,
// and converts Axios failures into ApiRequestError for the UI.
export async function apiRequest<T>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<T> {
  try {
    const response = await apiClient.request<ApiSuccessEnvelope<T>>({
      ...config,
      url,
    });

    const envelope: unknown = response.data;

    if (
      !isRecord(envelope) ||
      envelope.success !== true ||
      !('data' in envelope)
    ) {
      throw new ApiRequestError(
        'Unexpected response from the server.',
        response.status,
      );
    }

    return envelope.data as T;
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const payload: unknown = error.response?.data;

      const fallback = error.response
        ? `Request failed with status ${error.response.status}.`
        : 'Unable to connect to the server. Check your connection and try again.';

      throw new ApiRequestError(
        getErrorMessage(payload, fallback),
        error.response?.status,
        getFieldErrors(payload),
      );
    }

    throw new ApiRequestError('An unexpected error occurred.');
  }
}
