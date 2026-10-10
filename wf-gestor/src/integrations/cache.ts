type Entry = { value: unknown; at: number }

const store = new Map<string, Entry>()

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > maxAgeMs) return null
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T) {
  store.set(key, { value, at: Date.now() })
}
