import { config } from './config.js'
import { SpApiError, spGet } from './spapi.js'

export type ResourceKey = 'orders' | 'settlements' | 'inventory' | 'listings'

export type ResourceResult = { count: number; detail: string }

export const resourceKeys: ResourceKey[] = ['orders', 'settlements', 'inventory', 'listings']

const iso = (since: string) => new Date(`${since}T00:00:00Z`).toISOString()

async function fetchOrders(since: string): Promise<ResourceResult> {
  let nextToken: string | undefined
  let count = 0
  let latest = ''

  for (let page = 0; page < 10; page += 1) {
    const payload = (await spGet('/orders/v0/orders', {
      MarketplaceIds: config.marketplaceId,
      CreatedAfter: iso(since),
      MaxOrdersPerPage: '100',
      NextToken: nextToken,
    })) as { Orders?: { PurchaseDate?: string }[]; NextToken?: string }

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
    const payload = (await spGet('/finance/v0/financialEvents', {
      PostedAfter: iso(since),
    })) as { FinancialEvents?: Record<string, unknown[]> }

    const events = payload.FinancialEvents ?? {}
    const count = Object.values(events).reduce(
      (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
      0,
    )
    return { count, detail: count ? 'eventos financeiros lidos' : 'sem eventos no período' }
  } catch (error) {
    if (!(error instanceof SpApiError)) throw error

    const payload = (await spGet('/finance/v2024-06-19/summaries', {
      marketplaceIds: config.marketplaceId,
      postedAfter: iso(since),
    })) as { summaries?: unknown[]; items?: unknown[] }

    const count = (payload.summaries ?? payload.items ?? []).length
    return { count, detail: `${count} resumos financeiros (API atual)` }
  }
}

async function fetchInventory(since: string): Promise<ResourceResult> {
  const base = {
    marketplaceIds: config.marketplaceId,
    details: 'true',
    startDateTime: iso(since),
  }

  let payload: { summaries?: { sellerSku?: string; totalQuantity?: number }[] }
  try {
    payload = (await spGet('/fba/inventory/v1/summaries', {
      ...base,
      granularityType: 'Marketplace',
      granularityId: config.marketplaceId,
    })) as typeof payload
  } catch (error) {
    if (!(error instanceof SpApiError)) throw error
    payload = (await spGet('/fba/inventory/v1/summaries', base)) as typeof payload
  }

  const summaries = payload.summaries ?? []
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

  const payload = (await spGet('/listings/2021-08-01/items', {
    marketplaceIds: config.marketplaceId,
    sellerId: config.sellerId,
    includedData: 'identifiers',
    locale: 'pt_BR',
  })) as { items?: unknown[] }

  const count = (payload.items ?? []).length
  return { count, detail: count ? 'anúncios ativos na loja' : 'nenhum anúncio retornado' }
}

export const handlers: Record<ResourceKey, (since: string) => Promise<ResourceResult>> = {
  orders: fetchOrders,
  settlements: fetchSettlements,
  inventory: fetchInventory,
  listings: fetchListings,
}
