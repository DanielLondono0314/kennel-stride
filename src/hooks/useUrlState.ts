import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

type Serializable = string | number | boolean | null | undefined;

export function useUrlState<T extends Serializable>(
  key: string,
  defaultValue: T,
  options?: { replace?: boolean }
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams();

  const rawValue = params.get(key);
  const value = (rawValue !== null ? rawValue : String(defaultValue ?? "")) as T;

  const setValue = useCallback(
    (newValue: T) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newValue === null || newValue === undefined || newValue === defaultValue) {
            next.delete(key);
          } else {
            next.set(key, String(newValue));
          }
          return next;
        },
        { replace: options?.replace ?? true }
      );
    },
    [key, defaultValue, setParams, options?.replace]
  );

  return [value, setValue];
}
