import { useCallback, useEffect, useRef, useState } from 'react'
import type { Sale } from '../data'
import { products } from '../data'
import { readProxyUrl } from './amazon/connector'
import { ALL_ORDERS_SINCE } from './amazonSales'

export type FinanceOrder = {
  skus: string[]
  units: number
  taxes: number
  commission: number
  fees: number
  refunds: number
}

export type FinanceAd = { date: string; amount: number }

export type FinanceStatus = 'inicial' | 'live' | 'sem-proxy' | 'aguardando-credenciais' | 'erro'

export type FinanceState = {
  status: FinanceStatus
  message: string
  hint?: string
  source?: string
  orders: Record<string, FinanceOrder>
  ads: FinanceAd[]
  skus: { sku: string; units: number; revenue: number }[]
  updatedAt: number
}

export type AmazonSkuInfo = { name?: string; cost?: number }

class FinanceError extends Error {
  status: FinanceStatus
  hint?: string

  constructor(status: FinanceStatus, message: string, hint?: string) {
    super(message)
    this.status = status
    this.hint = hint
  }
}

const SKU_KEY = 'wf.amazonSkus'

const dayIso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)

export const FINANCE_SINCE = dayIso(-179)

export function readAmazonSkus(): Record<string, AmazonSkuInfo> {
  try {
    const raw = localStorage.getItem(SKU_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, AmazonSkuInfo>) : {}
  } catch {
    return {}
  }
}

export function writeAmazonSku(sku: string, info: AmazonSkuInfo) {
  const current = readAmazonSkus()
  current[sku] = info
  try {
    localStorage.setItem(SKU_KEY, JSON.stringify(current))
  } catch {
    /* armazenamento indisponível */
  }
}

export function useAmazonSkus() {
  const [skus, setSkus] = useState<Record<string, AmazonSkuInfo>>(() => readAmazonSkus())

  const save = useCallback((sku: string, info: AmazonSkuInfo) => {
    writeAmazonSku(sku, info)
    setSkus(readAmazonSkus())
  }, [])

  return { skus, save }
}

export async function fetchAmazonFinance(
  since: string = ALL_ORDERS_SINCE,
): Promise<{ finance: FinanceState; detail: string }> {
  const base = readProxyUrl()
  if (!base) {
    throw new FinanceError(
      'sem-proxy',
      'Proxy SP-API não configurado.',
      'Informe o endereço do proxy na tela Integrações.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${base}/amazon/finance?since=${encodeURIComponent(since)}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new FinanceError(
      'erro',
      'Proxy SP-API indisponível.',
      'Suba o proxy local com “npm run proxy” para usar o extrato financeiro.',
    )
  }

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    count?: number
    orders?: Record<string, FinanceOrder>
    ads?: FinanceAd[]
    skus?: { sku: string; units: number; revenue: number }[]
    detail?: string
    source?: string
    error?: string
  }

  if (response.status === 503) {
    throw new FinanceError(
      'aguardando-credenciais',
      body.error ?? 'Proxy sem credenciais da Amazon.',
      body.detail,
    )
  }

  if (!response.ok) {
    throw new FinanceError('erro', body.error ?? `HTTP ${response.status}.`, body.detail)
  }

  const detail = body.detail ?? `${body.count ?? 0} pedidos com extrato`
  return {
    detail,
    finance: {
      status: 'live',
      message: detail,
      source: body.source,
      orders: body.orders ?? {},
      ads: body.ads ?? [],
      skus: body.skus ?? [],
      updatedAt: Date.now(),
    },
  }
}

export function useAmazonFinance(since: string = ALL_ORDERS_SINCE): FinanceState & { refresh: () => void } {
  const [state, setState] = useState<FinanceState>({
    status: 'inicial',
    message: 'Lendo extrato financeiro…',
    orders: {},
    ads: [],
    skus: [],
    updatedAt: 0,
  })
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = (requestId.current += 1)
    try {
      const { finance } = await fetchAmazonFinance(since)
      if (id === requestId.current) setState(finance)
    } catch (error) {
      const failure = error instanceof FinanceError ? error : new FinanceError('erro', (error as Error).message)
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

const round = (value: number) => Math.round(value * 100) / 100

export function enrichSales(
  sales: Sale[],
  financeOrders: Record<string, FinanceOrder>,
  skuInfo: Record<string, AmazonSkuInfo>,
): Sale[] {
  return sales.map((sale) => {
    const info = financeOrders[sale.id]
    if (!info) return sale

    const rawSku = info.skus[0] ?? ''
    const hasSku = Boolean(rawSku) && rawSku !== '-' && rawSku !== '—'
    const sku = hasSku ? rawSku : sale.sku
    const catalog = products.find((item) => item.sku.toUpperCase() === sku.toUpperCase())
    const meta = hasSku ? skuInfo[sku] : undefined
    const costUnit = meta?.cost ?? catalog?.cost
    const cost = costUnit == null ? 0 : round(costUnit * sale.qty)
    const net = round(sale.gross + info.refunds - info.taxes - info.commission - info.fees)

    return {
      ...sale,
      sku,
      externalSku: hasSku ? sku : sale.externalSku,
      product: meta?.name ?? catalog?.name ?? (hasSku ? sku : sale.product),
      commission: info.commission,
      fees: info.fees,
      taxes: info.taxes,
      cost,
      net,
      profit: round(net - cost),
      margin: sale.gross > 0 ? ((net - cost) / sale.gross) * 100 : 0,
      costUnknown: costUnit == null,
      partial: false,
    }
  })
}

export function allocateAds(sales: Sale[], adsTotal: number): Sale[] {
  if (!(adsTotal > 0)) return sales
  const known = sales.filter((sale) => sale.partial === false)
  const grossTotal = known.reduce((sum, sale) => sum + sale.gross, 0)
  if (!(grossTotal > 0)) return sales

  return sales.map((sale) => {
    if (sale.partial !== false) return sale
    const ads = round(adsTotal * (sale.gross / grossTotal))
    const profit = round(sale.net - sale.cost - ads)
    return {
      ...sale,
      ads,
      profit,
      margin: sale.gross > 0 ? (profit / sale.gross) * 100 : 0,
    }
  })
}
