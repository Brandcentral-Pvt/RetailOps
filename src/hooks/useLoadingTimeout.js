import { useState, useEffect, useCallback, useRef } from 'react';

export function useLoadingTimeout(initialLoading = true, timeoutMs = 15000) {
  const [loading, setLoading] = useState(initialLoading);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setTimedOut(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLoading(false);
      setTimedOut(true);
    }, timeoutMs);
  }, [timeoutMs]);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setTimedOut(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { loading, timedOut, startLoading, stopLoading, retry: startLoading };
}

export function useAsyncWithTimeout(asyncFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    setTimedOut(false);

    timerRef.current = setTimeout(() => {
      setLoading(false);
      setTimedOut(true);
      setError(new Error('Request timed out. Please try again.'));
    }, 15000);

    try {
      const result = await asyncFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [asyncFn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { data, loading, error, timedOut, execute, retry: execute };
}
