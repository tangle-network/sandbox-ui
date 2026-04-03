"use client";

import * as React from "react";

export interface AuthUser {
  customer_id: string;
  email: string;
  name?: string;
  tier: string;
  github?: {
    login: string;
    connected: boolean;
  } | null;
  session_expires_at?: string;
}

export interface UseAuthOptions {
  apiBaseUrl: string;
  revalidateOnFocus?: boolean;
  shouldRetryOnError?: boolean;
}

export interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

/**
 * Hook for managing authentication state.
 * Fetches user session from the API and provides loading/error states.
 */
export function useAuth({
  apiBaseUrl,
  revalidateOnFocus = false,
  shouldRetryOnError = false,
}: UseAuthOptions): UseAuthResult {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const fetchSession = React.useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/auth/session`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Not authenticated");
      }

      const data = await res.json();
      if (data.success && data.data) {
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setUser(null);

      if (shouldRetryOnError) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(fetchSession, 5000);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [apiBaseUrl, shouldRetryOnError]);

  React.useEffect(() => {
    fetchSession();
    return () => {
      abortRef.current?.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchSession]);

  React.useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      fetchSession();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [revalidateOnFocus, fetchSession]);

  return {
    user,
    isLoading,
    isError: !!error,
    error,
    mutate: fetchSession,
  };
}

/**
 * Creates a fetcher function that includes auth credentials.
 * Uses both cookie-based session and localStorage API key for backwards compatibility.
 */
export function createAuthFetcher(_apiBaseUrl: string) {
  return async function authFetcher<T = unknown>(
    url: string,
    options?: RequestInit,
  ): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...options?.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    return res.json();
  };
}

/**
 * Hook to get the API key from localStorage.
 * For backwards compatibility with API key-based auth.
 */
export function useApiKey(): string | null {
  const [apiKey, setApiKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setApiKey(localStorage.getItem("apiKey"));
    }
  }, []);

  return apiKey;
}
