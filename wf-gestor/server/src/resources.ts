import { config } from './config.js'
import { SpApiError, spGet } from './spapi.js'

export type ResourceKey = 'orders' | 'settlements' | 'inventory' | 'listings' | 'finance'

export type ResourceResult = { count: number; detail: string }

export const resourceKeys: ResourceKey[] = ['orders', 'settlements', 'inventory', 'listings', 'finance']

const iso = (since: string) => new Date(`${since}T00:00:00Z`).toISOString()

const stamp = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z')

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
  const finance = await fetchFinance(since)
  return {
    count: finance.events,
    detail: `${finance.events} eventos de repasse e taxas · extrato de ${finance.count} pedidos`,
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
    detail: summaries.length
      ? `${units} unidades FBA em estoque`
      : 'sem estoque FBA �?" a loja opera com envio próprio (MFN)',
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

export type FinanceOrder = {
  skus: string[]
  units: number
  taxes: number
  commission: number
  fees: number
  refunds: number
}

export type FinanceAd = { date: string; amount: number }

export type FinanceResult = ResourceResult & {
  orders: Record<string, FinanceOrder>
  ads: FinanceAd[]
  skus: { sku: string; units: number; revenue: number }[]
  events: number
  source: string
  fetchedAt: string
}

const COMMISSION_FEES = new Set([
  'Commission',
  'GiftwrapCommission',
  'RefundCommission',
  'TaxRemittanceCommission',
])

const CHARGE_REVENUE = new Set(['Principal', 'ShippingCharge', 'GiftWrap'])
const CHARGE_TAX = new Set(['Tax', 'ShippingTax', 'GiftWrapTax'])

const FINANCE_TTL_MS = 300_000
const FINANCE_MAX_PAGES = 12
const FINANCE_MIN_INTERVAL_MS = 1500
const FINANCE_BLOCK_MS = 120_000
const FINANCE_FALLBACK_MAX_ORDERS = 30
const FINANCE_ORDER_TTL_MS = 600_000
const FINANCE_WINDOW_MS = 179 * 86400000

type FinanceOrderCacheEntry = {
  entry: FinanceOrder | null
  events: number
  skuTotals: { sku: string; units: number; revenue: number }[]
  expiresAt: number
}

const financeOrderCache = new Map<string, FinanceOrderCacheEntry>()
let financeCache: { key: string; expiresAt: number; value: FinanceResult } | null = null
let financeInFlight: { key: string; promise: Promise<FinanceResult> } | null = null
let financeNextSlot = 0
let financeListBlockedUntil = 0

function applyCachedOrder(acc: FinanceAccumulator, orderId: string, cached: FinanceOrderCacheEntry) {
  acc.events += cached.events
  if (cached.entry) {
    const target = entryOf(acc, orderId)
    for (const sku of cached.entry.skus) if (!target.skus.includes(sku)) target.skus.push(sku)
    target.units += cached.entry.units
    target.taxes += cached.entry.taxes
    target.commission += cached.entry.commission
    target.fees += cached.entry.fees
    target.refunds += cached.entry.refunds
  }
  for (const item of cached.skuTotals) {
    const current = acc.skuTotals.get(item.sku) ?? { units: 0, revenue: 0 }
    current.units += item.units
    current.revenue += item.revenue
    acc.skuTotals.set(item.sku, current)
  }
}

function financeQuotaError(): SpApiError {
  const seconds = Math.max(1, Math.ceil((financeListBlockedUntil - Date.now()) / 1000))
  return new SpApiError(
    'Cota da lista de eventos do Finances (HTTP 403).',
    `A Amazon recusou a consulta em lote �?" nova tentativa em ${seconds}s.`,
  )
}

async function financeSlot(): Promise<void> {
  const wait = financeNextSlot - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  financeNextSlot = Date.now() + FINANCE_MIN_INTERVAL_MS
}

async function financeListSlot(): Promise<void> {
  if (financeListBlockedUntil > Date.now()) throw financeQuotaError()
  await financeSlot()
}

type Money = { CurrencyAmount?: string | number }

const money = (value: Money | undefined) => Number(value?.CurrencyAmount ?? 0) || 0

type FinanceAccumulator = {
  orders: Map<string, FinanceOrder>
  adTotals: Map<string, number>
  skuTotals: Map<string, { units: number; revenue: number }>
  events: number
}

function createAccumulator(): FinanceAccumulator {
  return { orders: new Map(), adTotals: new Map(), skuTotals: new Map(), events: 0 }
}

function entryOf(acc: FinanceAccumulator, orderId: string): FinanceOrder {
  const current = acc.orders.get(orderId)
  if (current) return current
  const created: FinanceOrder = { skus: [], units: 0, taxes: 0, commission: 0, fees: 0, refunds: 0 }
  acc.orders.set(orderId, created)
  return created
}

function addFee(entry: FinanceOrder, type: string, amount: number) {
  if (!amount) return
  if (COMMISSION_FEES.has(type)) entry.commission -= amount
  else entry.fees -= amount
}

function accumulateItem(acc: FinanceAccumulator, entry: FinanceOrder, item: Record<string, unknown>) {
  const sku = String(item.SellerSKU ?? '')
  if (sku && !entry.skus.includes(sku)) entry.skus.push(sku)
  entry.units += Number(item.QuantityShipped ?? 0) || 0

  for (const charge of (item.ItemChargeList ?? item.ItemChargeAdjustmentList ?? []) as (Record<string, unknown> & {
    ChargeType?: string
    ChargeAmount?: Money
  })[]) {
    const type = String(charge.ChargeType ?? '')
    const value = money(charge.ChargeAmount)
    if (CHARGE_TAX.has(type)) entry.taxes += value
    else if (CHARGE_REVENUE.has(type) && value < 0) entry.refunds += value
  }

  for (const fee of (item.ItemFeeList ?? item.ItemFeeAdjustmentList ?? []) as (Record<string, unknown> & {
    FeeType?: string
    FeeAmount?: Money
  })[]) {
    addFee(entry, String(fee.FeeType ?? ''), money(fee.FeeAmount))
  }

  if (sku) {
    const skuEntry = acc.skuTotals.get(sku) ?? { units: 0, revenue: 0 }
    skuEntry.units += Number(item.QuantityShipped ?? 0) || 0
    for (const charge of (item.ItemChargeList ?? []) as (Record<string, unknown> & {
      ChargeType?: string
      ChargeAmount?: Money
    })[]) {
      if (String(charge.ChargeType ?? '') === 'Principal') skuEntry.revenue += money(charge.ChargeAmount)
    }
    acc.skuTotals.set(sku, skuEntry)
  }
}

function accumulateEvents(acc: FinanceAccumulator, events: Record<string, unknown[]>) {
  for (const [name, list] of Object.entries(events)) {
    if (!Array.isArray(list) || !list.length) continue
    acc.events += list.length

    if (name === 'ProductAdsPaymentEventList') {
      for (const event of list as (Record<string, unknown> & {
        postedDate?: string
        transactionValue?: Money
      })[]) {
        const day = (event.postedDate ?? '').slice(0, 10)
        if (!day) continue
        acc.adTotals.set(day, (acc.adTotals.get(day) ?? 0) + Math.abs(money(event.transactionValue)))
      }
      continue
    }

    if (name === 'ServiceFeeEventList') {
      for (const event of list as Record<string, unknown>[]) {
        const orderId = String(event.AmazonOrderId ?? '')
        if (!orderId) continue
        const entry = entryOf(acc, orderId)
        const sku = String(event.SellerSKU ?? '')
        if (sku && !entry.skus.includes(sku)) entry.skus.push(sku)
        for (const fee of (event.FeeList ?? []) as (Record<string, unknown> & {
          FeeType?: string
          FeeAmount?: Money
        })[]) {
          addFee(entry, String(fee.FeeType ?? ''), money(fee.FeeAmount))
        }
      }
      continue
    }

    if (!name.includes('Shipment')) continue

    for (const event of list as Record<string, unknown>[]) {
      const orderId = String(event.AmazonOrderId ?? '')
      if (!orderId) continue
      const entry = entryOf(acc, orderId)

      for (const item of (event.ShipmentItemList ?? event.ShipmentItemAdjustmentList ?? []) as Record<
        string,
        unknown
      >[]) {
        accumulateItem(acc, entry, item)
      }

      for (const fee of (event.FeeList ?? []) as (Record<string, unknown> & {
        FeeType?: string
        FeeAmount?: Money
      })[]) {
        addFee(entry, String(fee.FeeType ?? ''), money(fee.FeeAmount))
      }
    }
  }
}

async function listFinanceEvents(acc: FinanceAccumulator, start: number, end: number): Promise<void> {
  for (let windowStart = start; windowStart < end; windowStart += FINANCE_WINDOW_MS) {
    const windowEnd = Math.min(windowStart + FINANCE_WINDOW_MS, end)
    let nextToken: string | undefined
    let pages = 0

    do {
      const params: Record<string, string> = {
        PostedAfter: stamp(windowStart),
        PostedBefore: stamp(windowEnd),
        MaxResultsPerPage: '100',
      }
      if (nextToken) params.NextToken = nextToken

      await financeListSlot()

      const response = (await spGet('/finances/v0/financialEvents', params)) as SpPayload<{
        FinancialEvents?: Record<string, unknown[]>
        NextToken?: string
      }>
      const payload = unwrap<{ FinancialEvents?: Record<string, unknown[]>; NextToken?: string }>(response)
      accumulateEvents(acc, payload.FinancialEvents ?? {})

      nextToken = payload.NextToken
      pages += 1
    } while (nextToken && pages < FINANCE_MAX_PAGES)
  }
}

async function listOrderIds(since: string, cap: number): Promise<{ id: string; date: string }[]> {
  const found: { id: string; date: string }[] = []
  let nextToken: string | undefined

  for (let page = 0; page < 10; page += 1) {
    const response = (await spGet('/orders/v0/orders', {
      MarketplaceIds: config.marketplaceId,
      CreatedAfter: iso(since),
      MaxOrdersPerPage: '100',
      NextToken: nextToken,
    })) as SpPayload<{ Orders?: { AmazonOrderId?: string; PurchaseDate?: string }[]; NextToken?: string }>

    const payload = unwrap<{ Orders?: { AmazonOrderId?: string; PurchaseDate?: string }[]; NextToken?: string }>(
      response,
    )
    for (const order of payload.Orders ?? []) {
      if (order.AmazonOrderId) found.push({ id: order.AmazonOrderId, date: order.PurchaseDate ?? '' })
    }

    nextToken = payload.NextToken
    if (!nextToken || (payload.Orders ?? []).length === 0) break
  }

  return found.sort((a, b) => b.date.localeCompare(a.date)).slice(0, cap)
}

async function fetchFinancePerOrder(acc: FinanceAccumulator, since: string): Promise<number> {
  const orders = await listOrderIds(since, FINANCE_FALLBACK_MAX_ORDERS)
  let failures: Error | null = null

  for (const order of orders) {
    const cached = financeOrderCache.get(order.id)
    if (cached && cached.expiresAt > Date.now()) {
      applyCachedOrder(acc, order.id, cached)
      continue
    }

    const eventsBefore = acc.events
    const skusBefore = new Map([...acc.skuTotals].map(([sku, value]) => [sku, { ...value }]))

    await financeSlot()
    try {
      const response = (await spGet(`/finances/v0/orders/${encodeURIComponent(order.id)}/financialEvents`, {})) as SpPayload<{
        FinancialEvents?: Record<string, unknown[]>
      }>
      const payload = unwrap<{ FinancialEvents?: Record<string, unknown[]> }>(response)
      accumulateEvents(acc, payload.FinancialEvents ?? {})

      const entry = acc.orders.get(order.id)
      const skuTotals = [...acc.skuTotals.entries()]
        .map(([sku, value]) => ({
          sku,
          units: value.units - (skusBefore.get(sku)?.units ?? 0),
          revenue: value.revenue - (skusBefore.get(sku)?.revenue ?? 0),
        }))
        .filter((item) => item.units !== 0 || item.revenue !== 0)

      if (financeOrderCache.size > 400) financeOrderCache.clear()
      financeOrderCache.set(order.id, {
        entry: entry ? { ...entry, skus: [...entry.skus] } : null,
        events: acc.events - eventsBefore,
        skuTotals,
        expiresAt: Date.now() + FINANCE_ORDER_TTL_MS,
      })
    } catch (error) {
      if (error instanceof SpApiError && error.message.includes('403')) {
        financeListBlockedUntil = Date.now() + FINANCE_BLOCK_MS
        throw financeQuotaError()
      }
      failures ??= error instanceof Error ? error : new Error('falha ao ler o extrato do pedido')
    }
  }

  if (failures && acc.orders.size === 0) throw failures
  return orders.length
}

async function buildFinanceResult(since: string, key: string): Promise<FinanceResult> {
  const parsedStart = Date.parse(`${since}T00:00:00Z`)
  const start = Number.isNaN(parsedStart) ? Date.now() - 30 * 86400000 : parsedStart
  const end = Date.now() - 120_000

  const acc = createAccumulator()
  let source = 'lista'

  try {
    await listFinanceEvents(acc, start, end)
  } catch (error) {
    if (!(error instanceof SpApiError) || !error.message.includes('403')) throw error
    financeListBlockedUntil = Date.now() + FINANCE_BLOCK_MS
    source = 'por pedido'
    await fetchFinancePerOrder(acc, since)
  }

  const ads: FinanceAd[] = [...acc.adTotals.entries()]
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const skus = [...acc.skuTotals.entries()]
    .map(([sku, value]) => ({ sku, units: value.units, revenue: Math.round(value.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  const result: FinanceResult = {
    count: acc.orders.size,
    orders: Object.fromEntries(
      [...acc.orders.entries()].map(([orderId, value]) => [
        orderId,
        {
          skus: value.skus,
          units: value.units,
          taxes: Math.round(value.taxes * 100) / 100,
          commission: Math.round(Math.max(0, value.commission) * 100) / 100,
          fees: Math.round(Math.max(0, value.fees) * 100) / 100,
          refunds: Math.round(value.refunds * 100) / 100,
        },
      ]),
    ),
    ads,
    skus,
    events: acc.events,
    source,
    detail: `${acc.orders.size} pedidos com extrato · ${acc.events} eventos · ${skus.length} SKUs · ${ads.length} cobranças de Ads${source === 'por pedido' ? ' · lido por pedido' : ''}`,
    fetchedAt: new Date().toISOString(),
  }

  financeCache = { key, expiresAt: Date.now() + FINANCE_TTL_MS, value: result }
  return result
}

export async function fetchFinance(since: string): Promise<FinanceResult> {
  const key = `finance:${since}`
  if (financeCache && financeCache.key === key && financeCache.expiresAt > Date.now()) {
    return financeCache.value
  }
  if (financeInFlight && financeInFlight.key === key) return financeInFlight.promise

  const promise = buildFinanceResult(since, key).finally(() => {
    if (financeInFlight?.key === key) financeInFlight = null
  })
  financeInFlight = { key, promise }
  promise.catch(() => undefined)
  return promise
}

export const handlers: Record<ResourceKey, (since: string) => Promise<ResourceResult>> = {
  orders: fetchOrders,
  settlements: fetchSettlements,
  inventory: fetchInventory,
  listings: fetchListings,
  finance: fetchFinance,
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

const DETAIL_TTL_MS = 60_000
const DETAIL_ENRICH_LIMIT = 8
const ITEM_CACHE_MAX = 400
const itemCache = new Map<string, DetailedItem[]>()
let detailCache: { key: string; expiresAt: number; value: DetailedResult } | null = null

type RawOrder = {
  AmazonOrderId?: string
  PurchaseDate?: string
  LastUpdateDate?: string
  OrderStatus?: string
  OrderTotal?: { Amount?: string; CurrencyCode?: string }
  NumberOfItemsShipped?: number
  NumberOfItemsUnshipped?: number
}

export type DetailedItem = {
  title?: string
  sku?: string
  asin?: string
  qty: number
  price: number
}

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

export type DetailedResult = {
  count: number
  detail: string
  orders: DetailedOrder[]
  enriched: number
  fetchedAt: string
}

async function readOrderItems(orderId: string): Promise<DetailedItem[] | null> {
  if (itemsUnavailable) return null

  const cached = itemCache.get(orderId)
  if (cached) return cached

  try {
    const response = (await spGet(`/orders/v0/orders/${orderId}/order-items`)) as SpPayload<{
      OrderItems?: {
        Title?: string
        SellerSKU?: string
        ASIN?: string
        QuantityOrdered?: number
        ItemPrice?: { Amount?: string }
      }[]
    }>

    const items = (unwrap<{ OrderItems?: { Title?: string }[] }>(response).OrderItems ?? []).map(
      (item) => {
        const raw = item as {
          Title?: string
          SellerSKU?: string
          ASIN?: string
          QuantityOrdered?: number
          ItemPrice?: { Amount?: string }
        }
        return {
          title: raw.Title,
          sku: raw.SellerSKU,
          asin: raw.ASIN,
          qty: Number(raw.QuantityOrdered ?? 1) || 1,
          price: Number(raw.ItemPrice?.Amount ?? 0) || 0,
        } satisfies DetailedItem
      },
    )

    itemCache.set(orderId, items)
    if (itemCache.size > ITEM_CACHE_MAX) {
      const oldest = itemCache.keys().next().value
      if (oldest) itemCache.delete(oldest)
    }
    return items
  } catch (error) {
    if (error instanceof SpApiError && error.message.includes('403')) itemsUnavailable = true
    return null
  }
}

async function readProductTitle(orderId: string): Promise<string | undefined> {
  const items = await readOrderItems(orderId)
  return items?.[0]?.title
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

export async function fetchOrdersDetailed(since: string): Promise<DetailedResult> {
  if (detailCache && detailCache.key === since && detailCache.expiresAt > Date.now()) {
    return detailCache.value
  }

  const createdAfter = new Date(`${since}T00:00:00Z`).toISOString()
  const collected: RawOrder[] = []
  let nextToken: string | undefined

  for (let page = 0; page < 10; page += 1) {
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
    if (!nextToken || orders.length === 0) break
  }

  const orders: DetailedOrder[] = collected
    .map((order) => ({
      id: order.AmazonOrderId ?? '',
      purchasedAt: order.PurchaseDate ?? '',
      updatedAt: order.LastUpdateDate ?? '',
      status: order.OrderStatus ?? '',
      amount: Number(order.OrderTotal?.Amount ?? 0),
      currency: order.OrderTotal?.CurrencyCode ?? 'BRL',
      units: (order.NumberOfItemsShipped ?? 0) + (order.NumberOfItemsUnshipped ?? 0),
      items: [] as DetailedItem[],
    }))
    .filter((order) => order.id && order.purchasedAt)
    .sort((a, b) => (b.purchasedAt > a.purchasedAt ? 1 : -1))

  let enriched = 0
  if (!itemsUnavailable) {
    for (const order of orders.slice(0, DETAIL_ENRICH_LIMIT)) {
      const items = await readOrderItems(order.id)
      if (items?.length) {
        order.items = items
        const qty = items.reduce((sum, item) => sum + item.qty, 0)
        if (qty > 0) order.units = qty
        enriched += 1
      }
      if (itemsUnavailable) break
    }
  }

  const value: DetailedResult = {
    count: orders.length,
    detail: itemsUnavailable
      ? `${orders.length} pedidos · itens detalhados aguardando aprovação da Amazon`
      : `${orders.length} pedidos desde ${since} · ${enriched} com itens detalhados`,
    orders,
    enriched,
    fetchedAt: new Date().toISOString(),
  }

  detailCache = { key: since, expiresAt: Date.now() + DETAIL_TTL_MS, value }
  return value
}

