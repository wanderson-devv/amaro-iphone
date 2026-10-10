import { config, endpoints } from './config.js'

export class SpApiError extends Error {
  detail?: string

  constructor(message: string, detail?: string) {
    super(message)
    this.name = 'SpApiError'
    this.detail = detail
  }
}

type Cache = { token: string; expiresAt: number }

let cache: Cache | null = null
let inflight: Promise<string> | null = null

async function refreshToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new SpApiError(
      `Falha ao obter o token LWA (HTTP ${response.status}).`,
      text.slice(0, 400) || 'Sem corpo de resposta.',
    )
  }

  const payload = JSON.parse(text) as { access_token: string; expires_in?: number }
  cache = {
    token: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000,
  }
  return cache.token
}

export async function getAccessToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 60_000) return cache.token
  if (inflight) return inflight
  inflight = refreshToken().finally(() => {
    inflight = null
  })
  return inflight
}

const amzDate = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

const USER_AGENT = 'WFGestor/1.0 (Language=TypeScript; Platform=node)'

const MIN_INTERVAL_MS = 1100
let gate: Promise<unknown> = Promise.resolve()
let lastRequestAt = 0

function acquireSlot(): Promise<void> {
  const next = gate.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt = Date.now()
  })
  gate = next.catch(() => undefined)
  return next
}

type FetchInit = Parameters<typeof fetch>[1]
type FetchResponse = Awaited<ReturnType<typeof fetch>>

async function call(url: string, makeInit: () => FetchInit): Promise<FetchResponse> {
  let response: FetchResponse | undefined

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, response?.status === 429 ? 1400 : 700))
    }

    await acquireSlot()
    response = await fetch(url, makeInit())

    const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599)
    if (!retryable) break
  }

  return response as FetchResponse
}

async function jsonRequest(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; params?: Record<string, string | undefined> } = {},
) {
  const url = new URL(path, `${endpoints[config.region]}/`)
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value) url.searchParams.set(key, value)
  }

  const token = await getAccessToken()
  const method = options.method ?? 'GET'
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)

  const response = await call(url.toString(), () => {
    const headers: Record<string, string> = {
      'x-amz-access-token': token,
      'x-amz-date': amzDate(),
      'user-agent': USER_AGENT,
      accept: 'application/json',
    }
    if (payload !== undefined) headers['content-type'] = 'application/json'
    return { method, headers, body: payload }
  })

  const text = await response.text()
  if (!response.ok) {
    throw new SpApiError(`A Amazon respondeu HTTP ${response.status} em ${path}.`, explain(text))
  }

  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

export async function spGet(path: string, params: Record<string, string | undefined> = {}) {
  return jsonRequest(path, { params })
}

export async function spPost(path: string, body: unknown) {
  return jsonRequest(path, { method: 'POST', body })
}

export async function spDownload(url: string): Promise<Buffer> {
  const response = await call(url, () => ({
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
  }))

  const buffer = Buffer.from(await response.arrayBuffer())
  if (!response.ok) {
    throw new SpApiError(
      `A Amazon recusou o download do arquivo (HTTP ${response.status}).`,
      explain(buffer.toString('utf8')),
    )
  }
  return buffer
}

function explain(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      errors?: { message?: string; details?: string; code?: string }[]
      code?: string
      message?: string
      details?: string
    }
    const first = parsed.errors?.[0]
    const message = first?.message ?? parsed.message
    const details = first?.details ?? parsed.details
    const code = first?.code ?? parsed.code
    return [code && !message?.includes(code) ? code : '', message, details]
      .filter(Boolean)
      .join(' · ') || body.slice(0, 400)
  } catch {
    return body.slice(0, 400) || 'Sem detalhe do erro.'
  }
}
