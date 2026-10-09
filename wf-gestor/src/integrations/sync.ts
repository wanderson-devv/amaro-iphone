import { AmazonSpApiConnector } from './amazon/connector'
import { getAppDb, saveAppState } from './appDb'
import type { ChannelConnector, SyncState } from './types'
import { SyncError, syncResources } from './types'

const since30d = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

export function getAmazonConnector(): ChannelConnector {
  return new AmazonSpApiConnector()
}

export function idleStates(): SyncState[] {
  return syncResources.map((item) => ({ resource: item.key, status: 'aguardando', count: 0 }))
}

export function readLastSync(): string | null {
  return getAppDb().lastSync
}

export function readSyncSnapshot(): Record<string, number> | null {
  return getAppDb().snapshot
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

  const problems: string[] = []

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
      const message = error instanceof Error ? error.message : 'falha na consulta'
      const quota = /cota/i.test(message)
      const waiting = !quota && /HTTP 403|Unauthorized|Access denied|negado/i.test(message)
      states[index].status = waiting ? 'pendente' : 'erro'
      states[index].detail = waiting
        ? 'aguardando aprovação da Amazon (role pendente)'
        : message
      problems.push(item.label)
    }

    emit()
  }

  const okStates = states.filter((item) => item.status === 'ok')
  const stamp = new Date().toLocaleString('pt-BR')

  if (okStates.length) {
    await saveAppState({
      lastSync: stamp,
      snapshot: Object.fromEntries(okStates.map((item) => [item.resource, item.count])),
    })
  }

  const total = okStates.reduce((sum, item) => sum + item.count, 0)

  if (!okStates.length) {
    return {
      ok: false,
      message: problems.length
        ? `Nenhum recurso disponível · ${problems.join(', ')}`
        : 'Sincronização sem resultados.',
      hint: health.detail,
    }
  }

  return {
    ok: true,
    message: problems.length
      ? `Sincronizado: ${okStates.length}/${states.length} recursos · ${total} registros · ${stamp} · aguardando: ${problems.join(', ')}`
      : `Sincronização concluída · ${total} registros · ${stamp}`,
    hint: health.detail,
  }
}
