import cors from '@fastify/cors'
import Fastify from 'fastify'
import { config, isConfigured, missingKeys } from './config.js'
import { handlers, resourceKeys } from './resources.js'
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
