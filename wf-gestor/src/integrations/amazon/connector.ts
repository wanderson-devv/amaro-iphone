import { sales, stock } from '../../data'
import type { ChannelConnector, FetchResult, ProbeResult, SyncResource } from '../types'
import { SyncError } from '../types'

const PROXY = import.meta.env.VITE_SP_API_PROXY as string | undefined

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const simulatedCount = (resource: SyncResource) => {
  switch (resource) {
    case 'orders':
      return sales.filter((sale) => sale.channel === 'Amazon').length
    case 'settlements':
      return sales.filter((sale) => sale.channel === 'Amazon' && sale.status === 'Recebido').length
    case 'inventory':
      return stock.length
    case 'listings':
      return sales.filter((sale) => sale.channel === 'Amazon').length
    case 'ads':
      return sales.filter((sale) => sale.channel === 'Amazon' && sale.ads > 0).length
    default:
      return 0
  }
}

export class MockAmazonConnector implements ChannelConnector {
  readonly channel = 'Amazon' as const
  readonly mode = 'simulado' as const

  async probe(): Promise<ProbeResult> {
    await wait(420)
    return { ok: true, detail: 'ambiente simulado · nenhuma chamada externa é feita' }
  }

  async fetch(resource: SyncResource): Promise<FetchResult> {
    await wait(620 + Math.random() * 480)
    return { count: simulatedCount(resource), detail: 'gerado localmente' }
  }
}

export class AmazonSpApiConnector implements ChannelConnector {
  readonly channel = 'Amazon' as const
  readonly mode = 'producao' as const

  private get base() {
    return (PROXY ?? '').replace(/\/+$/, '')
  }

  private assertConfigured() {
    if (!this.base) {
      throw new SyncError(
        'Proxy da SP-API não configurado.',
        'Defina VITE_SP_API_PROXY no build. As credenciais LWA ficam no servidor proxy, nunca no navegador.',
      )
    }
  }

  async probe(): Promise<ProbeResult> {
    this.assertConfigured()
    const response = await fetch(`${this.base}/amazon/health`, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new SyncError(
        `Proxy respondeu HTTP ${response.status}.`,
        'Verifique o serviço que faz o proxy da Amazon SP-API e o refresh token do app.',
      )
    }
    const body = (await response.json().catch(() => ({}))) as { detail?: string }
    return { ok: true, detail: body.detail ?? 'proxy SP-API respondendo' }
  }

  async fetch(resource: SyncResource, since: string): Promise<FetchResult> {
    this.assertConfigured()
    const response = await fetch(`${this.base}/amazon/${resource}?since=${encodeURIComponent(since)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new SyncError(
        `Falha ao consultar ${resource} (HTTP ${response.status}).`,
        'Confira os escopos do app em Seller Central para este recurso.',
      )
    }
    const body = (await response.json().catch(() => ({}))) as { count?: number; detail?: string }
    return { count: Number(body.count ?? 0), detail: body.detail ?? 'SP-API' }
  }
}
