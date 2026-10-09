import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(here, '../data')
mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(resolve(dataDir, 'wf-gestor.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS sku_meta (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    cost REAL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

export type SkuRecord = { sku: string; name?: string; cost?: number }

export const STATE = {
  snapshot: 'sync.snapshot',
  lastSync: 'sync.last',
  autoSync: 'settings.autoSync',
} as const

export function listSkus(): SkuRecord[] {
  const rows = db.prepare('SELECT sku, name, cost FROM sku_meta ORDER BY sku').all() as {
    sku: string
    name: string
    cost: number | null
  }[]
  return rows.map((row) => ({
    sku: row.sku,
    name: row.name || undefined,
    cost: row.cost ?? undefined,
  }))
}

export function replaceSku(sku: string, name: string | undefined, cost: number | null) {
  db.prepare(
    `INSERT INTO sku_meta (sku, name, cost, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(sku) DO UPDATE SET name = excluded.name, cost = excluded.cost, updated_at = excluded.updated_at`,
  ).run(sku, name ?? '', cost, new Date().toISOString())
}

export function importSkus(items: { sku: string; name?: string; cost?: number }[]) {
  const stmt = db.prepare(
    `INSERT INTO sku_meta (sku, name, cost, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(sku) DO NOTHING`,
  )
  const now = new Date().toISOString()
  let inserted = 0
  for (const item of items) {
    if (!item?.sku) continue
    const info = stmt.run(item.sku, item.name ?? '', item.cost ?? null, now)
    inserted += Number(info.changes ?? 0)
  }
  return inserted
}

export function readState(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function readStateJson<T>(key: string): T | null {
  const raw = readState(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function readBoolState(key: string, fallback: boolean): boolean {
  const raw = readState(key)
  if (raw === null) return fallback
  return raw === '1'
}

export function writeState(key: string, value: string) {
  db.prepare(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, new Date().toISOString())
}

export function importState(entries: Record<string, string>) {
  const stmt = db.prepare(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO NOTHING`,
  )
  let inserted = 0
  for (const [key, value] of Object.entries(entries)) {
    if (!key) continue
    const info = stmt.run(key, value, new Date().toISOString())
    inserted += Number(info.changes ?? 0)
  }
  return inserted
}
