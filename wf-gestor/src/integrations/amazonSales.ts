import { useCallback, useEffect, useRef, useState } from 'react'
import type { Sale, SaleStatus } from '../data'
import { proxyHint, readProxyUrl } from './amazon/connector'

export type DetailedItem = { title?: string; sku?: string; asin?: string; qty: number; price: number }

export type DetailedOrder = {
  id: string
  purchasedAt: string
  updatedAt: string
  status: string
  amount: number
  currency: string
  units: number
  items: DetailedItem[]
}

export type AmazonSalesStatus = 'inicial' | 'live' | 'sem-proxy' | 'aguardando-credenciais' | 'erro'

export type AmazonSalesState = {
  status: AmazonSalesStatus
  message: string
  hint?: string
  sales: Sale[]
  updatedAt: number
}

export class AmazonSalesError extends Error {
  status: AmazonSalesStatus
  hint?: string

  constructor(status: AmazonSalesStatus, message: string, hint?: string) {
    super(message)
    this.status = status
    this.hint = hint
  }
}

export const isoDay = (date: Date = new Date()) => date.toISOString().slice(0, 10)

export const ALL_ORDERS_SINCE = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)

const mapStatus = (status: string): SaleStatus => {
  if (status === 'Canceled') return 'Devolvido'
  if (status === 'Pending' || status === 'Unshipped' || status === 'PartiallyShipped') return 'A liberar'
  return 'Recebido'
}

export function mapDetailedOrder(order: DetailedOrder): Sale {
  const first = order.items[0]
  const qty = order.items.length
    ? order.items.reduce((sum, item) => sum + item.qty, 0)
    : order.units || 1
  const units = qty > 0 ? qty : 1
  const gross = Number(order.amount) || 0

  return {
    id: order.id,
    date: order.purchasedAt.slice(0, 10),
    channel: 'Amazon',
    product: first?.title ?? 'Pedido na Amazon',
    sku: first?.sku ?? '—',
    externalSku: first?.sku ?? '—',
    asin: first?.asin ?? '—',
    qty: units,
    unitPrice: Math.round((gross / units) * 100) / 100,
    gross,
    commission: 0,
    fees: 0,
    taxes: 0,
    ads: 0,
    cost: 0,
    net: 0,
    profit: 0,
    margin: 0,
    status: mapStatus(order.status),
    settlement: 'Pendente',
    partial: true,
  }
}

export async function fetchAmazonSales(since: string): Promise<{ sales: Sale[]; detail: string }> {
  const base = readProxyUrl()
  if (!base) {
    throw new AmazonSalesError(
      'sem-proxy',
      'Proxy SP-API não configurado.',
      'Informe o endereço do proxy na tela Integrações.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${base}/amazon/orders-detailed?since=${encodeURIComponent(since)}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new AmazonSalesError('erro', 'Proxy SP-API indisponível.', proxyHint())
  }

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    orders?: DetailedOrder[]
    detail?: string
    error?: string
  }

  if (response.status === 503) {
    throw new AmazonSalesError(
      'aguardando-credenciais',
      body.error ?? 'Proxy sem credenciais da Amazon.',
      body.detail,
    )
  }

  if (!response.ok) {
    throw new AmazonSalesError(
      'erro',
      body.error ?? `Proxy respondeu HTTP ${response.status}.`,
      body.detail,
    )
  }

  const sales = (body.orders ?? [])
    .filter((order) => Boolean(order?.id))
    .map(mapDetailedOrder)

  return { sales, detail: body.detail ?? `${sales.length} pedidos reais` }
}

export function useAmazonSales(since: string): AmazonSalesState & { refresh: () => void } {
  const [state, setState] = useState<AmazonSalesState>({
    status: 'inicial',
    message: 'Lendo pedidos da Amazon…',
    sales: [],
    updatedAt: 0,
  })
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = (requestId.current += 1)

    try {
      const { sales, detail } = await fetchAmazonSales(since)
      if (id === requestId.current) setState({ status: 'live', message: detail, sales, updatedAt: Date.now() })
    } catch (error) {
      const failure =
        error instanceof AmazonSalesError
          ? error
          : new AmazonSalesError('erro', (error as Error).message)
      if (id === requestId.current) {
        setState((prev) => ({
          ...prev,
          status: failure.status,
          message: failure.message,
          hint: failure.hint,
          updatedAt: Date.now(),
        }))
      }
    }
  }, [since])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (state.status !== 'erro') return
    const retry = setTimeout(() => {
      void load()
    }, 45_000)
    return () => clearTimeout(retry)
  }, [state.status, state.updatedAt, load])

  return { ...state, refresh }
}
