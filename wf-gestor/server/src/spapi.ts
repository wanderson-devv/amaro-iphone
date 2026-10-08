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

export async function getAccessToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 60_000) return cache.token

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

const amzDate = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

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

export async function spGet(path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(path, `${endpoints[config.region]}/`)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  const token = await getAccessToken()
  const headers = {
    'x-amz-access-token': token,
    'x-amz-date': amzDate(),
    'user-agent': 'WFGestor/1.0 (Language=TypeScript; Platform=node)',
    accept: 'application/json',
  }

  let text = ''
  let status = 0

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, status === 429 ? 1400 : 700))
      headers['x-amz-date'] = amzDate()
    }

    await acquireSlot()
    const response = await fetch(url, { headers })
    text = await response.text()
    status = response.status

    const retryable = status === 429 || (status >= 500 && status <= 599)
    if (!retryable) break
  }

  if (!status || status < 200 || status >= 300) {
    throw new SpApiError(`A Amazon respondeu HTTP ${status} em ${path}.`, explain(text))
  }

  return text ? (JSON.parse(text) as Record<string, unknown>) : {}
}

function explain(body: string) {
  try {
    const parsed = JSON.parse(body) as { errors?: { message?: string; details?: string }[] }
    const first = parsed.errors?.[0]
    return [first?.message, first?.details].filter(Boolean).join(' · ') || body.slice(0, 400)
  } catch {
    return body.slice(0, 400) || 'Sem detalhe do erro.'
  }
}
