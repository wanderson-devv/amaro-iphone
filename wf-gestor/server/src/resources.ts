import { config } from './config.js'
import { SpApiError, spGet } from './spapi.js'

export type ResourceKey = 'orders' | 'settlements' | 'inventory' | 'listings'

export type ResourceResult = { count: number; detail: string }

export const resourceKeys: ResourceKey[] = ['orders', 'settlements', 'inventory', 'listings']

const iso = (since: string) => new Date(`${since}T00:00:00Z`).toISOString()

type SpPayload<T> = { payload?: T } & T

function unwrap<T>(response: Record<string, unknown>): T {
  const payload = (response as { payload?: T }).payload
  return (payload ?? response) as T
}

async function fetchOrders(since: string): Promise<ResourceResult> {
  let nextToken: string | undefined
  let count = 0
  let latest = ''

  for (let page = 0; page < 10; page += 1) {
    const response = (await spGet('/orders/v0/orders', {
      MarketplaceIds: config.marketplaceId,
      CreatedAfter: iso(since),
      MaxOrdersPerPage: '100',
      NextToken: nextToken,
    })) as SpPayload<{ Orders?: { PurchaseDate?: string }[]; NextToken?: string }>

    const payload = unwrap<{ Orders?: { PurchaseDate?: string }[]; NextToken?: string }>(response)
    const orders = payload.Orders ?? []
    count += orders.length
    for (const order of orders) {
      const date = order.PurchaseDate ?? ''
      if (date > latest) latest = date
    }

    nextToken = payload.NextToken
    if (!nextToken || orders.length === 0) break
  }

  return {
    count,
    detail: latest ? `último pedido em ${latest.slice(0, 10)}` : 'nenhum pedido no período',
  }
}

async function fetchSettlements(since: string): Promise<ResourceResult> {
  try {
    const response = (await spGet('/finance/v0/financialEvents', {
      PostedAfter: iso(since),
    })) as SpPayload<{ FinancialEvents?: Record<string, unknown[]> }>

    const events = unwrap<{ FinancialEvents?: Record<string, unknown[]> }>(response).FinancialEvents ?? {}
    const count = Object.values(events).reduce(
      (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
      0,
    )
    return { count, detail: count ? 'eventos financeiros lidos' : 'sem eventos no período' }
  } catch (error) {
    if (!(error instanceof SpApiError)) throw error

    const response = (await spGet('/finance/v2024-06-19/summaries', {
      marketplaceIds: config.marketplaceId,
      postedAfter: iso(since),
    })) as SpPayload<{ summaries?: unknown[]; items?: unknown[] }>

    const payload = unwrap<{ summaries?: unknown[]; items?: unknown[] }>(response)
    const count = (payload.summaries ?? payload.items ?? []).length
    return { count, detail: `${count} resumos financeiros (API atual)` }
  }
}

async function fetchInventory(since: string): Promise<ResourceResult> {
  const sinceDate = Date.parse(`${since}T00:00:00Z`)
  const start = Number.isNaN(sinceDate)
    ? Date.now() - 30 * 86400000
    : Math.max(sinceDate, Date.now() - 90 * 86400000)

  const response = (await spGet('/fba/inventory/v1/summaries', {
    marketplaceIds: config.marketplaceId,
    details: 'true',
    startDateTime: new Date(start).toISOString(),
    granularityType: 'Marketplace',
    granularityId: config.marketplaceId,
  })) as SpPayload<{
    inventorySummaries?: { sellerSku?: string; totalQuantity?: number }[]
    summaries?: { sellerSku?: string; totalQuantity?: number }[]
  }>

  const payload = unwrap<{
    inventorySummaries?: { sellerSku?: string; totalQuantity?: number }[]
    summaries?: { sellerSku?: string; totalQuantity?: number }[]
  }>(response)

  const summaries = payload.inventorySummaries ?? payload.summaries ?? []
  const units = summaries.reduce((sum, item) => sum + Number(item.totalQuantity ?? 0), 0)
  return {
    count: summaries.length,
    detail: summaries.length ? `${units} unidades FBA em estoque` : 'sem alterações no período',
  }
}

async function fetchListings(): Promise<ResourceResult> {
  if (!config.sellerId) {
    throw new SpApiError(
      'SP_API_SELLER_ID não configurado no proxy.',
      'Preencha o sellerId no .env do proxy para listar os anúncios.',
    )
  }

  const response = (await spGet('/listings/2021-08-01/items', {
    marketplaceIds: config.marketplaceId,
    sellerId: config.sellerId,
    includedData: 'identifiers',
    locale: 'pt_BR',
  })) as SpPayload<{ items?: unknown[] }>

  const payload = unwrap<{ items?: unknown[] }>(response)
  const count = (payload.items ?? []).length
  return { count, detail: count ? 'anúncios ativos na loja' : 'nenhum anúncio retornado' }
}

export const handlers: Record<ResourceKey, (since: string) => Promise<ResourceResult>> = {
  orders: fetchOrders,
  settlements: fetchSettlements,
  inventory: fetchInventory,
  listings: fetchListings,
}

export type LiveOrder = {
  id: string
  purchasedAt: string
  updatedAt: string
  status: string
  amount: number
  currency: string
  units: number
  product?: string
}

export type LiveResult = {
  count: number
  detail: string
  orders: LiveOrder[]
  fetchedAt: string
}

const LIVE_TTL_MS = 25_000
const LIVE_WINDOW_MS = 400 * 86400000
const RECENT_MS = 48 * 3600000
const LIVE_LIMIT = 10
let liveCache: { key: string; expiresAt: number; value: LiveResult } | null = null
let itemsUnavailable = false

type RawOrder = {
  AmazonOrderId?: string
  PurchaseDate?: string
  LastUpdateDate?: string
  OrderStatus?: string
  OrderTotal?: { Amount?: string; CurrencyCode?: string }
  NumberOfItemsShipped?: number
  NumberOfItemsUnshipped?: number
}

async function readProductTitle(orderId: string): Promise<string | undefined> {
  if (itemsUnavailable) return undefined
  try {
    const response = (await spGet(`/orders/v0/orders/${orderId}/order-items`)) as SpPayload<{
      OrderItems?: { Title?: string }[]
    }>
    return unwrap<{ OrderItems?: { Title?: string }[] }>(response).OrderItems?.[0]?.Title
  } catch (error) {
    if (error instanceof SpApiError && error.message.includes('403')) itemsUnavailable = true
    return undefined
  }
}

export async function fetchLive(since: string): Promise<LiveResult> {
  if (liveCache && liveCache.key === since && liveCache.expiresAt > Date.now()) {
    return liveCache.value
  }

  const createdAfter = new Date(Date.now() - LIVE_WINDOW_MS).toISOString()
  const collected: RawOrder[] = []
  let nextToken: string | undefined

  for (let page = 0; page < 3; page += 1) {
    const response = (await spGet('/orders/v0/orders', {
      MarketplaceIds: config.marketplaceId,
      CreatedAfter: createdAfter,
      MaxOrdersPerPage: '100',
      NextToken: nextToken,
    })) as SpPayload<{ Orders?: RawOrder[]; NextToken?: string }>

    const payload = unwrap<{ Orders?: RawOrder[]; NextToken?: string }>(response)
    const orders = payload.Orders ?? []
    collected.push(...orders)
    nextToken = payload.NextToken
    if (!nextToken || !orders.length) break
  }

  const orders: LiveOrder[] = collected
    .map((order) => ({
      id: order.AmazonOrderId ?? '',
      purchasedAt: order.PurchaseDate ?? '',
      updatedAt: order.LastUpdateDate ?? '',
      status: order.OrderStatus ?? '',
      amount: Number(order.OrderTotal?.Amount ?? 0),
      currency: order.OrderTotal?.CurrencyCode ?? 'BRL',
      units: (order.NumberOfItemsShipped ?? 0) + (order.NumberOfItemsUnshipped ?? 0),
    }))
    .filter((order) => order.id && order.purchasedAt)
    .sort((a, b) => (b.purchasedAt > a.purchasedAt ? 1 : -1))
    .slice(0, LIVE_LIMIT)

  for (const order of orders.slice(0, 3)) {
    const title = await readProductTitle(order.id)
    if (title) order.product = title
  }

  const recentCutoff = Number.isNaN(Date.parse(since)) ? Date.now() - RECENT_MS : Date.parse(since)
  const recentCount = orders.filter((order) => Date.parse(order.purchasedAt) >= recentCutoff).length

  const value: LiveResult = {
    count: orders.length,
    detail: recentCount
      ? `${recentCount} venda(s) nas últimas 48 h`
      : orders.length
        ? `sem vendas nas últimas 48 h · ${orders.length} pedidos mais recentes`
        : 'sem pedidos no período',
    orders,
    fetchedAt: new Date().toISOString(),
  }

  liveCache = { key: since, expiresAt: Date.now() + LIVE_TTL_MS, value }
  return value
}

