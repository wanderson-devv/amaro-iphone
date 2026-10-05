import { AmazonSpApiConnector } from './amazon/connector'
import type { ChannelConnector, SyncState } from './types'
import { SyncError, syncResources } from './types'

const LAST_SYNC_KEY = 'wf.lastSync.Amazon'
const SNAPSHOT_KEY = 'wf.amazon.sync'

const since30d = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

export function getAmazonConnector(): ChannelConnector {
  return new AmazonSpApiConnector()
}

export function idleStates(): SyncState[] {
  return syncResources.map((item) => ({ resource: item.key, status: 'aguardando', count: 0 }))
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* armazenamento indisponível */
  }
}

export function readLastSync(): string | null {
  return read(LAST_SYNC_KEY)
}

export function readSyncSnapshot(): Record<string, number> | null {
  const raw = read(SNAPSHOT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return null
  }
}

export function hydrateStates(): SyncState[] {
  const snapshot = readSyncSnapshot()
  if (!snapshot) return idleStates()
  return idleStates().map((item) =>
    snapshot[item.resource] === undefined
      ? item
      : {
          ...item,
          status: 'ok',
          count: snapshot[item.resource],
          detail: 'salvo da última sincronização',
        },
  )
}

export type SyncOutcome = { ok: boolean; message: string; hint?: string }

export async function runAmazonSync(onUpdate: (states: SyncState[]) => void): Promise<SyncOutcome> {
  const connector = getAmazonConnector()
  const states = idleStates()
  const emit = () => onUpdate(states.map((item) => ({ ...item })))

  emit()

  let health
  try {
    health = await connector.probe()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao contactar o proxy da Amazon.'
    states[0].status = 'erro'
    states[0].detail = message
    emit()
    return { ok: false, message, hint: error instanceof SyncError ? error.hint : undefined }
  }

  for (const [index, item] of syncResources.entries()) {
    states[index].status = 'em curso'
    states[index].detail = 'consultando a Amazon…'
    emit()

    try {
      const result = await connector.fetch(item.key, since30d())
      states[index].status = 'ok'
      states[index].count = result.count
      states[index].detail = result.detail
    } catch (error) {
      states[index].status = 'erro'
      states[index].detail = error instanceof Error ? error.message : 'falha na consulta'
      emit()
      return {
        ok: false,
        message: states[index].detail ?? 'Sincronização interrompida.',
        hint: error instanceof SyncError ? error.hint : undefined,
      }
    }

    emit()
  }

  const stamp = new Date().toLocaleString('pt-BR')
  write(LAST_SYNC_KEY, stamp)
  write(
    SNAPSHOT_KEY,
    JSON.stringify(Object.fromEntries(states.map((item) => [item.resource, item.count]))),
  )

  const total = states.reduce((sum, item) => sum + item.count, 0)
  return {
    ok: true,
    message: `Sincronização concluída · ${total} registros · ${stamp}`,
    hint: health.detail,
  }
}
