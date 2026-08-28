import { useCallback, useEffect, useRef, useState } from 'react';

import type { Page } from '../api/types';

type Fetcher<T> = (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>;

export type PaginatedResult<T> = {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

/**
 * Lista stronicowana kursorem Twitcha.
 * `enabled` pozwala wstrzymac pobieranie, dopoki nie znamy np. user_id.
 */
export function usePaginated<T>(
  fetcher: Fetcher<T>,
  deps: unknown[],
  enabled = true
): PaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const abortRef = useRef<AbortController | null>(null);
  /** Chroni przed nalozeniem sie loadMore na trwajace odswiezanie. */
  const busyRef = useRef(false);

  const run = useCallback(
    async (mode: 'initial' | 'more' | 'refresh', from: string | undefined) => {
      if (busyRef.current) return;
      busyRef.current = true;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === 'initial') setLoading(true);
      if (mode === 'more') setLoadingMore(true);
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const page = await fetcherRef.current(from, controller.signal);
        if (controller.signal.aborted) return;
        setItems((prev) => (mode === 'more' ? [...prev, ...page.data] : page.data));
        setCursor(page.cursor);
        setHasMore(Boolean(page.cursor));
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err);
        if (mode !== 'more') setItems([]);
        setHasMore(false);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
        busyRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setItems([]);
      return;
    }
    setCursor(undefined);
    setHasMore(true);
    void run('initial', undefined);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasMore || !cursor || loading || loadingMore || refreshing) return;
    void run('more', cursor);
  }, [enabled, hasMore, cursor, loading, loadingMore, refreshing, run]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    void run('refresh', undefined);
  }, [enabled, run]);

  return { items, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh };
}
