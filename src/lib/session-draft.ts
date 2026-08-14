export type SessionDraft<T> = {
  value: T;
  savedAt: string;
};

export function readSessionDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft<T> | T;
    return parsed && typeof parsed === "object" && "value" in parsed
      ? (parsed as SessionDraft<T>).value
      : parsed as T;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeSessionDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    key,
    JSON.stringify({ value, savedAt: new Date().toISOString() } satisfies SessionDraft<T>),
  );
}

export function clearSessionDraft(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}
