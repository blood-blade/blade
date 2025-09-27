import { useEffect, useState, useCallback } from 'react';

interface DebouncedState<T> {
  value: T;
  isDebouncing: boolean;
}

export function useDebouncedState<T>(initialValue: T, delay: number = 500): [T, (value: T) => void, boolean] {
  const [state, setState] = useState<DebouncedState<T>>({
    value: initialValue,
    isDebouncing: false,
  });

  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (state.isDebouncing) {
        setDebouncedValue(state.value);
        setState(prev => ({ ...prev, isDebouncing: false }));
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [state, delay]);

  const setValue = useCallback((value: T) => {
    setState({ value, isDebouncing: true });
  }, []);

  return [debouncedValue, setValue, state.isDebouncing];
}