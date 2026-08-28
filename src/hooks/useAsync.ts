import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
};

/** Jednorazowe pobranie z anulowaniem przy odmontowaniu / zmianie deps. */
export function useAsync<T>(
  task: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  enabled = true
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: enabled,
    error: null,
  });
  const taskRef = useRef(task);
  taskRef.current = task;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    taskRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setState({ data: null, loading: false, error });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
