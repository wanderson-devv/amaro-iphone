import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, isConfigured, missingKeys } from './config.js'
import {
  STATE,
  importSkus,
  importState,
  listSkus,
  readBoolState,
  readState,
  readStateJson,
  replaceSku,
  writeState,
} from './db.js'
import { fetchLive, fetchOrdersDetailed, handlers, resourceKeys } from './resources.js'
import { SpApiError } from './spapi.js'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(here, '../../dist')
const hasFront = existsSync(resolve(distDir, 'index.html'))

const app = Fastify({ logger: true })

app.addHook('onRequest', async (request, reply) => {
  if (request.headers['access-control-request-private-network']) {
    reply.header('access-control-allow-private-network', 'true')
  }
})

await app.register(cors, { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') })

if (hasFront) {
  await app.register(fastifyStatic, { root: distDir, index: ['index.html'] })
}

app.get('/health', async () => ({ ok: true, service: 'wf-gestor-proxy' }))

app.get('/db/state', async () => ({
  ok: true,
  skus: listSkus(),
  snapshot: readStateJson<Record<string, number>>(STATE.snapshot),
  lastSync: readState(STATE.lastSync),
  autoSync: readBoolState(STATE.autoSync, true),
}))

app.put<{ Params: { sku: string }; Body: { name?: string | null; cost?: number | null } }>(
  '/db/skus/:sku',
  async (request, reply) => {
    const sku = decodeURIComponent(request.params.sku ?? '').trim()
    if (!sku) return reply.code(400).send({ ok: false, error: 'SKU vazio.' })
    const body = request.body ?? {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const cost = typeof body.cost === 'number' && Number.isFinite(body.cost) ? body.cost : null
    replaceSku(sku, name, cost)
    return { ok: true, sku }
  },
)

app.put<{
  Body: { snapshot?: Record<string, number> | null; lastSync?: string | null; autoSync?: boolean }
}>('/db/state', async (request) => {
  const body = request.body ?? {}
  if (body.snapshot !== undefined) {
    writeState(STATE.snapshot, JSON.stringify(body.snapshot ?? null))
  }
  if (body.lastSync !== undefined) {
    writeState(STATE.lastSync, body.lastSync ?? '')
  }
  if (body.autoSync !== undefined) {
    writeState(STATE.autoSync, body.autoSync ? '1' : '0')
  }
  return { ok: true }
})

app.post<{ Body: { skus?: { sku: string; name?: string; cost?: number }[]; state?: Record<string, string> } }>(
  '/db/import',
  async (request) => {
    const body = request.body ?? {}
    const skus = Array.isArray(body.skus) ? body.skus : []
    const state = body.state && typeof body.state === 'object' && !Array.isArray(body.state) ? body.state : {}
    return { ok: true, insertedSkus: importSkus(skus), insertedState: importState(state) }
  },
)

app.get('/amazon/health', async () => {
  const configured = isConfigured()
  return {
    ok: configured,
    configured,
    marketplaceId: config.marketplaceId,
    region: config.region,
    detail: configured
      ? `proxy SP-API pronto para a loja ${config.marketplaceId}`
      : `credenciais ausentes: ${missingKeys().join(', ')}`,
  }
})

app.get<{ Querystring: { since?: string } }>('/amazon/orders-detailed', async (request, reply) => {
  if (!isConfigured()) {
    return reply.code(503).send({
      ok: false,
      error: 'Proxy sem credenciais da Amazon.',
      detail: `Preencha no .env: ${missingKeys().join(', ')}`,
    })
  }

  const querySince = request.query.since
  const since =
    querySince && /^\d{4}-\d{2}-\d{2}$/.test(querySince)
      ? querySince
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  try {
    const result = await fetchOrdersDetailed(since)
    return { ok: true, resource: 'orders-detailed', since, ...result }
  } catch (error) {
    if (error instanceof SpApiError) {
      return reply.code(502).send({ ok: false, error: error.message, detail: error.detail })
    }
    throw error
  }
})

app.get<{ Querystring: { since?: string } }>('/amazon/live', async (request, reply) => {
  if (!isConfigured()) {
    return reply.code(503).send({
      ok: false,
      error: 'Proxy sem credenciais da Amazon.',
      detail: `Preencha no .env: ${missingKeys().join(', ')}`,
    })
  }

  const querySince = request.query.since
  const bucket = Math.floor((Date.now() - 48 * 3600000) / 30000) * 30000
  const since =
    querySince && !Number.isNaN(Date.parse(querySince))
      ? querySince
      : new Date(bucket).toISOString()

  try {
    const result = await fetchLive(since)
    return { ok: true, resource: 'live', since, ...result }
  } catch (error) {
    if (error instanceof SpApiError) {
      return reply.code(502).send({ ok: false, error: error.message, detail: error.detail })
    }
    throw error
  }
})

app.get<{ Params: { resource: string }; Querystring: { since?: string } }>(
  '/amazon/:resource',
  async (request, reply) => {
    const resource = request.params.resource as (typeof resourceKeys)[number]

    if (!resourceKeys.includes(resource)) {
      return reply.code(404).send({
        ok: false,
        error: `Recurso desconhecido: ${resource}`,
        detail: `Use um destes: ${resourceKeys.join(', ')}`,
      })
    }

    if (!isConfigured()) {
      return reply.code(503).send({
        ok: false,
        error: 'Proxy sem credenciais da Amazon.',
        detail: `Preencha no .env: ${missingKeys().join(', ')}`,
      })
    }

    const querySince = request.query.since
    const since =
      querySince && /^\d{4}-\d{2}-\d{2}$/.test(querySince)
        ? querySince
        : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    try {
      const result = await handlers[resource](since)
      return { ok: true, resource, since, fetchedAt: new Date().toISOString(), ...result }
    } catch (error) {
      if (error instanceof SpApiError) {
        return reply.code(502).send({ ok: false, error: error.message, detail: error.detail })
      }
      throw error
    }
  },
)

app.setNotFoundHandler(async (request, reply) => {
  const path = request.url.split('?')[0]
  const isApi = path.startsWith('/amazon') || path.startsWith('/db') || path.startsWith('/health')
  if (isApi || !hasFront || request.method !== 'GET') {
    return reply.code(404).send({ ok: false, error: `Rota desconhecida: ${path}` })
  }
  return reply
    .type('text/html; charset=utf-8')
    .send(readFileSync(resolve(distDir, 'index.html'), 'utf8'))
})

try {
  await app.listen({ port: config.port, host: config.host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
