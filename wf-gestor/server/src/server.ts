import cors from '@fastify/cors'
import Fastify from 'fastify'
import { config, isConfigured, missingKeys } from './config.js'
import { fetchLive, fetchOrdersDetailed, handlers, resourceKeys } from './resources.js'
import { SpApiError } from './spapi.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') })

app.get('/health', async () => ({ ok: true, service: 'wf-gestor-proxy' }))

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

    const since =
      request.query.since ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

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

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
