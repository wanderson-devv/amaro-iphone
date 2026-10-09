import { useEffect, useReducer } from 'react'
import { readProxyUrl } from './amazon/connector'

export type SkuInfo = { name?: string; cost?: number }

export type AppDbState = {
  skus: Record<string, SkuInfo>
  snapshot: Record<string, number> | null
  lastSync: string | null
  autoSync: boolean
}

type DbStateResponse = {
  ok?: boolean
  error?: string
  skus?: { sku: string; name?: string; cost?: number }[]
  snapshot?: Record<string, number> | null
  lastSync?: string | null
  autoSync?: boolean
}

const LEGACY_SKUS = 'wf.amazonSkus'
const LEGACY_SNAPSHOT = 'wf.amazon.sync'
const LEGACY_LAST_SYNC = 'wf.lastSync.Amazon'
const LEGACY_AUTOSYNC = 'wf.autoSync'

let state: AppDbState = { skus: {}, snapshot: null, lastSync: null, autoSync: true }
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = readProxyUrl()
  const response = await fetch(`${base}${path}`, {
    ...init,
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
}

function apply(body: DbStateResponse) {
  const skus: Record<string, SkuInfo> = {}
  for (const row of body.skus ?? []) {
    if (!row?.sku) continue
    skus[row.sku] = { name: row.name, cost: row.cost }
  }
  state = {
    skus,
    snapshot: body.snapshot ?? null,
    lastSync: body.lastSync ?? null,
    autoSync: body.autoSync ?? true,
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
    apply(await request<DbStateResponse>('/db/state'))
  } catch {
    /* proxy off — estado vazio até ele responder */
  }
  await migrateLegacy()
}

export async function saveSkuInfo(sku: string, info: SkuInfo) {
  state = { ...state, skus: { ...state.skus, [sku]: info } }
  emit()
  try {
    await request(`/db/skus/${encodeURIComponent(sku)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: info.name ?? null, cost: info.cost ?? null }),
    })
    writeError = null
  } catch (error) {
    writeError = error instanceof Error ? error.message : 'Falha ao salvar no banco do proxy.'
  }
  emit()
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
    await request('/db/state', { method: 'PUT', body: JSON.stringify(body) })
    writeError = null
  } catch (error) {
    writeError = error instanceof Error ? error.message : 'Falha ao salvar no banco do proxy.'
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
