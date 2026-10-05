import { AmazonSpApiConnector, MockAmazonConnector } from './amazon/connector'
import type { ChannelConnector, SyncState } from './types'
import { SyncError, syncResources } from './types'

const STORAGE_KEY = 'wf.lastSync.Amazon'

const since30d = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

export function getAmazonConnector(): ChannelConnector {
  return import.meta.env.VITE_SP_API_PROXY ? new AmazonSpApiConnector() : new MockAmazonConnector()
}

export function idleStates(): SyncState[] {
  return syncResources.map((item) => ({ resource: item.key, status: 'aguardando', count: 0 }))
}

export function readLastSync(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
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
    const message = error instanceof Error ? error.message : 'Falha ao contactar o canal.'
    states[0].status = 'erro'
    states[0].detail = message
    emit()
    return { ok: false, message, hint: error instanceof SyncError ? error.hint : undefined }
  }

  for (const [index, item] of syncResources.entries()) {
    states[index].status = 'em curso'
    states[index].detail = 'consultando…'
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
  try {
    localStorage.setItem(STORAGE_KEY, stamp)
  } catch {
    /* armazenamento indisponível */
  }

  const total = states.reduce((sum, item) => sum + item.count, 0)
  return {
    ok: true,
    message: `${connector.mode === 'simulado' ? 'Sincronização simulada' : 'Sincronização'} concluída · ${total} registros · ${stamp}`,
    hint: health.detail,
  }
}
