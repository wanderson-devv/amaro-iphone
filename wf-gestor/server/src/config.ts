import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile() {
  const file = resolve(process.cwd(), '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const region = (process.env.SP_API_REGION ?? 'na').toLowerCase() as 'na' | 'eu' | 'fe'

export const endpoints: Record<'na' | 'eu' | 'fe', string> = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com',
}

export const config = {
  clientId: process.env.SP_API_CLIENT_ID ?? '',
  clientSecret: process.env.SP_API_CLIENT_SECRET ?? '',
  refreshToken: process.env.SP_API_REFRESH_TOKEN ?? '',
  marketplaceId: process.env.SP_API_MARKETPLACE_ID ?? 'A2Q3Y263D00KWC',
  sellerId: process.env.SP_API_SELLER_ID ?? '',
  region,
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
}

export const isConfigured = () =>
  Boolean(config.clientId && config.clientSecret && config.refreshToken)

export const missingKeys = () =>
  (['SP_API_CLIENT_ID', 'SP_API_CLIENT_SECRET', 'SP_API_REFRESH_TOKEN'] as const).filter(
    (key) => !process.env[key],
  )
