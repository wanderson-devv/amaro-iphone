import { useCallback, useEffect, useRef, useState } from 'react'
import { readProxyUrl } from './amazon/connector'

export type LiveSale = {
  id: string
  purchasedAt: string
  status: string
  amount: number
  currency: string
  units: number
  product?: string
}

export type LiveStatus = 'inicial' | 'live' | 'sem-proxy' | 'aguardando-credenciais' | 'erro'

export type LiveFeed = { sales: LiveSale[]; pending: LiveSale[] }

export type LiveState = {
  status: LiveStatus
  message: string
  hint?: string
  sales: LiveSale[]
  pending: LiveSale[]
  updatedAt: number
}

const SEEN_KEY = 'wf.live.seen'
const SEEDED_KEY = 'wf.live.seeded'
const MAX_SEEN = 80

class LiveError extends Error {
  status: LiveStatus
  hint?: string

  constructor(status: LiveStatus, message: string, hint?: string) {
    super(message)
    this.status = status
    this.hint = hint
  }
}

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, MAX_SEEN)))
  } catch {
    /* armazenamento indisponível */
  }
}

function readSeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1'
  } catch {
    return false
  }
}

function writeSeeded() {
  try {
    localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    /* armazenamento indisponível */
  }
}

export async function fetchLiveSales(): Promise<{ sales: LiveSale[]; detail: string }> {
  const base = readProxyUrl()
  if (!base) {
    throw new LiveError(
      'sem-proxy',
      'Proxy SP-API não configurado.',
      'Informe o endereço do proxy na tela Integrações.',
    )
  }

  let response: Response
  try {
    response = await fetch(`${base}/amazon/live`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new LiveError(
      'erro',
      'Proxy SP-API indisponível.',
      'Suba o proxy local com “npm run proxy” e tente de novo.',
    )
  }

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    orders?: LiveSale[]
    count?: number
    detail?: string
    error?: string
  }

  if (response.status === 503) {
    throw new LiveError(
      'aguardando-credenciais',
      body.error ?? 'Proxy sem credenciais da Amazon.',
      body.detail,
    )
  }

  if (!response.ok) {
    throw new LiveError('erro', body.error ?? `Proxy respondeu HTTP ${response.status}.`, body.detail)
  }

  const sales = (body.orders ?? [])
    .filter((sale) => Boolean(sale?.id))
    .sort((a, b) => (b.purchasedAt > a.purchasedAt ? 1 : -1))

  return { sales, detail: body.detail ?? `${sales.length} pedidos nas últimas 48 h` }
}

export function useLiveSales(intervalMs = 30000) {
  const [state, setState] = useState<LiveState>({
    status: 'inicial',
    message: 'Lendo vendas na Amazon…',
    sales: [],
    pending: [],
    updatedAt: 0,
  })

  const busy = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true

    try {
      const { sales, detail } = await fetchLiveSales()
      let known = readSeen()
      let pending = sales

      if (!readSeeded()) {
        known = sales.map((sale) => sale.id)
        writeSeen(known)
        writeSeeded()
        pending = []
      } else {
        const knownIds = new Set(known)
        pending = sales.filter((sale) => !knownIds.has(sale.id))
        if (pending.length) writeSeen([...pending.map((sale) => sale.id), ...known])
      }

      setState({ status: 'live', message: detail, sales, pending, updatedAt: Date.now() })
    } catch (error) {
      const failure =
        error instanceof LiveError ? error : new LiveError('erro', (error as Error).message)
      setState((prev) => ({
        ...prev,
        status: failure.status,
        message: failure.message,
        hint: failure.hint,
        updatedAt: Date.now(),
      }))
    } finally {
      busy.current = false
    }
  }, [])

  const acknowledge = useCallback((id?: string) => {
    const ids = id ? [id] : stateRef.current.pending.map((sale) => sale.id)
    if (!ids.length) return
    writeSeen([...ids, ...readSeen()])
    setState((prev) => ({ ...prev, pending: prev.pending.filter((sale) => !ids.includes(sale.id)) }))
  }, [])

  const refresh = useCallback(() => {
    void load()
  }, [load])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, intervalMs)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, load])

  return { ...state, acknowledge, refresh }
}
