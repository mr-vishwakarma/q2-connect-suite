import { toast } from 'react-toastify';

// In-memory timestamp cache to prevent toast notification floods from parallel failed requests
const recentErrors = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 2500;

export interface NormalizedApiError {
  status: number | null;
  code: string | null;
  message: string;
  isOffline: boolean;
  isTimeout: boolean;
  isAuthError: boolean;
}

interface HttpErrorResponseData {
  message?: string;
  code?: string;
  error?: {
    message?: string;
    code?: string;
  };
}

interface HttpErrorLike {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: HttpErrorResponseData;
  };
}

function asHttpError(error: unknown): HttpErrorLike {
  if (typeof error === 'object' && error !== null) {
    return error as HttpErrorLike;
  }
  return {};
}

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  const err = asHttpError(error);
  return (
    err.response?.data?.message ||
    err.response?.data?.error?.message ||
    err.message ||
    fallback
  );
}

/**
 * Normalizes any Axios, Network, or unknown error into a structured object.
 */
export function normalizeApiError(error: unknown): NormalizedApiError {
  const err = asHttpError(error);
  const isTimeout = err.code === 'ECONNABORTED' || Boolean(err.message?.includes('timeout'));
  const isNetwork = err.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && !navigator.onLine);
  const status = err.response?.status ?? null;
  const backendMessage = err.response?.data?.message || err.response?.data?.error?.message;

  let message = backendMessage || err.message || 'An unexpected error occurred';

  if (isNetwork) {
    message = 'Network unavailable. Check your internet connection.';
  } else if (isTimeout) {
    message = 'Request timed out. Server took too long to respond.';
  } else if (status === 401) {
    message = backendMessage || 'Session expired. Please sign in again.';
  } else if (status === 403) {
    message = backendMessage || 'Access denied. You do not have permission for this resource.';
  } else if (status === 404) {
    message = backendMessage || 'Requested resource could not be found.';
  } else if (status === 409) {
    message = backendMessage || 'Action conflict. The record may have already been updated.';
  } else if (status === 422) {
    message = backendMessage || 'Validation failed. Please verify your input.';
  } else if (status === 429) {
    message = backendMessage || 'Too many requests. Please slow down and try again shortly.';
  } else if (status && status >= 500) {
    message = backendMessage || 'Server is temporarily unavailable. Please try again in a few moments.';
  }

  return {
    status,
    code: err.code || null,
    message,
    isOffline: isNetwork,
    isTimeout,
    isAuthError: status === 401 || status === 403,
  };
}

/**
 * Displays a deduplicated toast for API errors.
 * Silently throttles identical notifications within a 2.5s window.
 */
export function notifyApiError(error: unknown, fallbackMessage?: string) {
  const normalized = normalizeApiError(error);
  const displayMsg = fallbackMessage || normalized.message;
  const dedupKey = `${normalized.status || normalized.code || 'unknown'}:${displayMsg}`;

  const now = Date.now();
  const lastTime = recentErrors.get(dedupKey);

  if (lastTime && (now - lastTime) < DEDUPLICATION_WINDOW_MS) {
    // Suppress duplicate alert
    return normalized;
  }

  recentErrors.set(dedupKey, now);

  // Clean old entries periodically
  if (recentErrors.size > 50) {
    for (const [k, v] of recentErrors.entries()) {
      if (now - v > DEDUPLICATION_WINDOW_MS) recentErrors.delete(k);
    }
  }

  // 401 errors are handled by auth state redirect, suppress disruptive toasts
  if (normalized.status === 401) {
    return normalized;
  }

  if (normalized.isOffline) {
    toast.warn(displayMsg);
  } else if (normalized.status === 429) {
    toast.warn(displayMsg);
  } else {
    toast.error(displayMsg);
  }

  return normalized;
}
