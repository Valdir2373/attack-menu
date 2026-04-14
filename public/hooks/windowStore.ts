import { useState, useCallback, Dispatch, SetStateAction } from "react";


const _snap = new Map<string, Record<string, unknown>>();

export function snapSet(id: string, key: string, value: unknown): void {
  let s = _snap.get(id);
  if (!s) { s = {}; _snap.set(id, s); }
  s[key] = value;
}

export function snapGet<T>(id: string, key: string, fallback: T): T {
  const s = _snap.get(id);
  return (s !== undefined && key in s ? s[key] : fallback) as T;
}

export function snapClear(id: string): void {
  _snap.delete(id);
}


const _svc = new Map<string, unknown>();

export function svcSet(id: string, value: unknown): void {
  _svc.set(id, value);
}

export function svcGet<T>(id: string): T | undefined {
  return _svc.get(id) as T | undefined;
}

export function svcClear(id: string): void {
  _svc.delete(id);
}


const _cbs = new Map<string, Map<string, (...a: unknown[]) => void>>();

export function cbSet(id: string, key: string, fn: (...a: unknown[]) => void): void {
  let m = _cbs.get(id);
  if (!m) { m = new Map(); _cbs.set(id, m); }
  m.set(key, fn);
}

export function cbCall(id: string, key: string, ...a: unknown[]): void {
  _cbs.get(id)?.get(key)?.(...a);
}


export function useWindowState<T>(
  id: string,
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => snapGet(id, key, defaultValue));

  const set: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      setState((prev) => {
        const next =
          typeof action === "function"
            ? (action as (s: T) => T)(prev)
            : action;
        snapSet(id, key, next);
        return next;
      });
    },
    [id, key],
  );

  return [state, set];
}

