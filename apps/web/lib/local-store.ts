// Small JSON-safe localStorage helpers. SSR-safe (no-ops on the server).
// Used to remember user preferences (filters, search, sort, active tab)
// across full navigations/reloads — URL query params alone only survive
// browser back/forward, not a fresh click on a nav link.

export function getStoredJSON<T extends object>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function setStoredJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota/serialization errors — preferences are a nice-to-have.
  }
}
