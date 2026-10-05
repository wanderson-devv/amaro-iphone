import type { ChannelConnector, FetchResult, ProbeResult, SyncResource } from '../types'
import { SyncError } from '../types'

const STORE_KEY = 'wf.spApiProxy'
const ENV_URL = (import.meta.env.VITE_SP_API_PROXY as string | undefined) ?? ''
const LOCAL_URL = 'http://localhost:8787'
const IS_LOCAL =
  typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')

const normalize = (value: string) => value.trim().replace(/\/+$/, '')

export function readProxyUrl(): string {
  try {
    const stored = localStorage.getItem(STORE_KEY)
    if (stored) return normalize(stored)
  } catch {
    /* armazenamento indisponível */
  }
  return normalize(ENV_URL) || (IS_LOCAL ? LOCAL_URL : '')
}

export function writeProxyUrl(value: string) {
  try {
    localStorage.setItem(STORE_KEY, normalize(value))
  } catch {
    /* armazenamento indisponível */
  }
}

export class AmazonSpApiConnector implements ChannelConnector {
  readonly channel = 'Amazon' as const

  private get base() {
    return readProxyUrl()
  }

  private assertConfigured() {
    if (!this.base) {
      throw new SyncError(
        'URL do proxy da SP-API não informada.',
        'Informe em “Proxy SP-API” o endereço do serviço server/ rodando com suas credenciais LWA.',
      )
    }
  }

  async probe(): Promise<ProbeResult> {
    this.assertConfigured()
    const response = await fetch(`${this.base}/amazon/health`, { headers: { Accept: 'application/json' } })
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      configured?: boolean
      detail?: string
      error?: string
    }

    if (!response.ok || body.configured === false) {
      throw new SyncError(
        body.error ?? `Proxy respondeu HTTP ${response.status}.`,
        body.detail ?? 'Verifique o .env do proxy (SP_API_CLIENT_ID, SP_API_CLIENT_SECRET, SP_API_REFRESH_TOKEN).',
      )
    }

    return { ok: true, detail: body.detail ?? 'proxy SP-API respondendo' }
  }

  async fetch(resource: SyncResource, since: string): Promise<FetchResult> {
    this.assertConfigured()
    const response = await fetch(`${this.base}/amazon/${resource}?since=${encodeURIComponent(since)}`, {
      headers: { Accept: 'application/json' },
    })
    const body = (await response.json().catch(() => ({}))) as {
      count?: number
      detail?: string
      error?: string
    }

    if (!response.ok) {
      throw new SyncError(body.error ?? `Falha ao consultar ${resource} (HTTP ${response.status}).`, body.detail)
    }

    return { count: Number(body.count ?? 0), detail: body.detail ?? 'SP-API' }
  }
}
