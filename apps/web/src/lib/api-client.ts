import axios, { type AxiosRequestConfig } from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
};

type FieldErrors = Record<string, string>;

export class ApiRequestError extends Error {
  public readonly statusCode?: number;
  public readonly fieldErrors: FieldErrors;

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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

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