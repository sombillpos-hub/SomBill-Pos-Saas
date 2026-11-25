import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@sombill/api-client/supabase';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
}

/** Minimal async data hook with race protection. `deps` re-trigger loading. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id === seq.current) setDataState(result);
    } catch (e) {
      if (id === seq.current) setError(friendlyError(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => run(true), [run]);
  const setData = useCallback((u: (prev: T | undefined) => T | undefined) => setDataState(u), []);
  return { data, error, loading, reload, setData };
}
