import { useEffect, useReducer } from 'react'
import { readProxyUrl } from './amazon/connector'

export type SkuInfo = { name?: string; cost?: number; tax?: number }

export type AppDbState = {
  skus: Record<string, SkuInfo>
  snapshot: Record<string, number> | null
  lastSync: string | null
  autoSync: boolean
  backend: 'neon' | 'sqlite'
}

type DbStateResponse = {
  ok?: boolean
  error?: string
  backend?: string
  skus?: { sku: string; name?: string; cost?: number; tax?: number }[]
  snapshot?: Record<string, number> | null
  lastSync?: string | null
  autoSync?: boolean
}

const LEGACY_SKUS = 'wf.amazonSkus'
const LEGACY_SNAPSHOT = 'wf.amazon.sync'
const LEGACY_LAST_SYNC = 'wf.lastSync.Amazon'
const LEGACY_AUTOSYNC = 'wf.autoSync'

let state: AppDbState = { skus: {}, snapshot: null, lastSync: null, autoSync: true, backend: 'sqlite' }
let writeError: string | null = null
let loaded = false
let migrating = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeAppDb(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getAppDb = (): AppDbState => state
export const getAppDbWriteError = (): string | null => writeError

const SAVE_DEBOUNCE_MS = 300
const RETRY_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)
}

function friendly(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Proxy indisponível (offline ou reiniciando) — os valores seguem salvos aqui e serão reenviados sozinhos.'
  }
  const message = error instanceof Error ? error.message : ''
  return message || 'Falha ao salvar no banco do proxy.'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = readProxyUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })
    const body = (await response.json().catch(() => ({}))) as T
    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

async function requestRetry<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await request<T>(path, init)
    } catch (error) {
      lastError = error
      if (!isNetworkError(error) || attempt === RETRY_ATTEMPTS - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw lastError
}

function apply(body: DbStateResponse) {
  const skus: Record<string, SkuInfo> = {}
  for (const row of body.skus ?? []) {
    if (!row?.sku) continue
    skus[row.sku] = { name: row.name, cost: row.cost, tax: row.tax }
  }
  state = {
    skus,
    snapshot: body.snapshot ?? null,
    lastSync: body.lastSync ?? null,
    autoSync: body.autoSync ?? true,
    backend: body.backend === 'neon' ? 'neon' : 'sqlite',
  }
  emit()
}

function readLegacy() {
  let skus: { sku: string; name?: string; cost?: number }[] = []
  try {
    const raw = localStorage.getItem(LEGACY_SKUS)
    const parsed = raw ? (JSON.parse(raw) as Record<string, SkuInfo>) : {}
    skus = Object.entries(parsed ?? {}).map(([sku, info]) => ({
      sku,
      name: info?.name,
      cost: info?.cost,
      tax: info?.tax,
    }))
  } catch {
    /* sem dado local aproveitável */
  }
  const stateEntries: Record<string, string> = {}
  const snapshot = localStorage.getItem(LEGACY_SNAPSHOT)
  const lastSync = localStorage.getItem(LEGACY_LAST_SYNC)
  const autoSync = localStorage.getItem(LEGACY_AUTOSYNC)
  if (snapshot) stateEntries['sync.snapshot'] = snapshot
  if (lastSync) stateEntries['sync.last'] = lastSync
  if (autoSync !== null) stateEntries['settings.autoSync'] = autoSync
  return { skus, stateEntries }
}

async function migrateLegacy() {
  if (migrating) return
  migrating = true
  try {
    const { skus, stateEntries } = readLegacy()
    if (!skus.length && !Object.keys(stateEntries).length) return
    await request('/db/import', { method: 'POST', body: JSON.stringify({ skus, state: stateEntries }) })
    localStorage.removeItem(LEGACY_SKUS)
    localStorage.removeItem(LEGACY_SNAPSHOT)
    localStorage.removeItem(LEGACY_LAST_SYNC)
    localStorage.removeItem(LEGACY_AUTOSYNC)
    apply(await request<DbStateResponse>('/db/state'))
  } catch {
    /* proxy off — tenta de novo na próxima abertura */
  } finally {
    migrating = false
  }
}

export async function loadAppDb() {
  if (loaded) return
  loaded = true
  try {
    apply(await requestRetry<DbStateResponse>('/db/state'))
  } catch {
    /* proxy off — estado vazio até ele responder */
  }
  await migrateLegacy()
}

const pendingSaves = new Map<string, SkuInfo>()
const debounceTimers = new Map<string, number>()
let flushing = false

async function flushPendingSaves() {
  if (flushing) return
  flushing = true
  try {
    for (;;) {
      const sku = [...pendingSaves.keys()].find((key) => !debounceTimers.has(key))
      if (!sku) break
      const info = pendingSaves.get(sku)
      if (!info) {
        pendingSaves.delete(sku)
        continue
      }
      pendingSaves.delete(sku)
      try {
        await requestRetry(`/db/skus/${encodeURIComponent(sku)}`, {
          method: 'PUT',
          body: JSON.stringify({ name: info.name ?? null, cost: info.cost ?? null, tax: info.tax ?? null }),
        })
        writeError = null
      } catch (error) {
        if (!pendingSaves.has(sku)) pendingSaves.set(sku, info)
        writeError = friendly(error)
        break
      }
    }
  } finally {
    flushing = false
    emit()
  }
}

export function saveSkuInfo(sku: string, info: SkuInfo) {
  state = { ...state, skus: { ...state.skus, [sku]: info } }
  emit()
  pendingSaves.set(sku, info)
  const existing = debounceTimers.get(sku)
  if (existing !== undefined) window.clearTimeout(existing)
  debounceTimers.set(
    sku,
    window.setTimeout(() => {
      debounceTimers.delete(sku)
      void flushPendingSaves()
    }, SAVE_DEBOUNCE_MS),
  )
}

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    if (pendingSaves.size) void flushPendingSaves()
  }, 20_000)
  window.addEventListener('online', () => {
    if (pendingSaves.size) void flushPendingSaves()
  })
}

export async function saveAppState(patch: {
  snapshot?: Record<string, number> | null
  lastSync?: string | null
  autoSync?: boolean
}) {
  state = { ...state, ...patch }
  emit()
  const body: { snapshot?: Record<string, number> | null; lastSync?: string | null; autoSync?: boolean } = {}
  if (patch.snapshot !== undefined) body.snapshot = patch.snapshot
  if (patch.lastSync !== undefined) body.lastSync = patch.lastSync
  if (patch.autoSync !== undefined) body.autoSync = patch.autoSync
  try {
    await requestRetry('/db/state', { method: 'PUT', body: JSON.stringify(body) })
    writeError = null
  } catch (error) {
    writeError = friendly(error)
  }
  emit()
}

export function useAppDb() {
  const [, force] = useReducer((version: number) => version + 1, 0)
  useEffect(() => subscribeAppDb(force), [])
  return state
}

export function useAppDbWriteError(): string | null {
  const [, force] = useReducer((version: number) => version + 1, 0)
  useEffect(() => subscribeAppDb(force), [])
  return writeError
}
