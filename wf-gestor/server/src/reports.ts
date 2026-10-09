import { gunzipSync } from 'node:zlib'
import { config } from './config.js'
import { SpApiError, spDownload, spGet, spPost } from './spapi.js'

export type ReportRow = Record<string, string>

export type ReportData = { type: string; headers: string[]; rows: ReportRow[] }

const REPORTS = '/reports/2021-06-30/reports'
const DOCUMENTS = '/reports/2021-06-30/documents'

const REPORT_TTL_MS = 30 * 60_000
const MISS_TTL_MS = 90_000
const POLL_MS = 3000
const WAIT_MS = 120_000
const CREATE_BLOCK_MS = 46_000

const cache = new Map<string, { value: ReportData; expiresAt: number }>()
const misses = new Map<string, number>()
const running = new Map<string, Promise<ReportData>>()
const documentIds = new Map<string, string>()

let createBlockedUntil = 0

function unwrap<T>(response: Record<string, unknown>): T {
  const payload = (response as { payload?: T }).payload
  return (payload ?? response) as T
}

export function is403(error: unknown): boolean {
  return error instanceof SpApiError && error.message.includes('403')
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function createReport(reportType: string, dataStartTime?: string): Promise<string> {
  while (Date.now() < createBlockedUntil) {
    await sleep(Math.min(5000, createBlockedUntil - Date.now()))
  }

  const body: Record<string, unknown> = { reportType, marketplaceIds: [config.marketplaceId] }
  if (dataStartTime) body.dataStartTime = dataStartTime

  try {
    const response = unwrap<{ reportId?: string }>(await spPost(REPORTS, body))
    const reportId = response.reportId
    if (!reportId) throw new SpApiError('A Amazon não devolveu o identificador do relatório.')
    return reportId
  } catch (error) {
    if (error instanceof SpApiError && error.message.includes('HTTP 429')) {
      createBlockedUntil = Date.now() + CREATE_BLOCK_MS
      const wait = Math.ceil(CREATE_BLOCK_MS / 1000)
      throw new SpApiError(
        'A Amazon limitou a geração de relatórios (HTTP 429).',
        `Relatório ${reportType} será liberado em ${wait}s. Recarregue a página em seguida.`,
      )
    }
    throw error
  }
}

async function waitDocument(reportId: string): Promise<string> {
  const deadline = Date.now() + WAIT_MS

  for (;;) {
    const report = unwrap<{ processingStatus?: string; reportDocumentId?: string }>(
      await spGet(`${REPORTS}/${reportId}`),
    )
    const status = report.processingStatus ?? ''

    if (status === 'DONE') {
      if (!report.reportDocumentId) {
        throw new SpApiError('A Amazon concluiu o relatório sem gerar o arquivo.', `reportId ${reportId}`)
      }
      return report.reportDocumentId
    }
    if (status === 'DONE_NO_DATA') {
      throw new SpApiError('A Amazon gerou o relatório sem nenhum dado no período.')
    }
    if (status === 'CANCELLED' || status === 'FATAL') {
      throw new SpApiError(
        `A Amazon cancelou o relatório ${reportId}.`,
        `processingStatus=${status}`,
      )
    }
    if (Date.now() > deadline) {
      throw new SpApiError(
        'Tempo esgotado aguardando o relatório da Amazon.',
        `reportId ${reportId} · status ${status || 'desconhecido'} · tente novamente em alguns segundos`,
      )
    }

    await sleep(POLL_MS)
  }
}

async function download(documentId: string): Promise<string> {
  const document = unwrap<{ url?: string; compressionAlgorithm?: string }>(
    await spGet(`${DOCUMENTS}/${documentId}`),
  )
  if (!document.url) {
    throw new SpApiError('A Amazon não devolveu o endereço do arquivo do relatório.', `documentId ${documentId}`)
  }

  const buffer = await spDownload(document.url)
  const gzipped =
    document.compressionAlgorithm === 'GZIP' || (buffer[0] === 0x1f && buffer[1] === 0x8b)
  return (gzipped ? gunzipSync(buffer) : buffer).toString('utf8')
}

export function parseTabbed(text: string): { headers: string[]; rows: ReportRow[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerAt = lines.findIndex((line) => line.includes('\t'))
  if (headerAt < 0) throw new SpApiError('O relatório da Amazon não veio em formato de tabela.')

  const headers = lines[headerAt].split('\t').map((name) => name.trim())
  const rows: ReportRow[] = []

  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim()) continue
    const cells = line.split('\t')
    const row: ReportRow = {}
    headers.forEach((name, index) => {
      if (name) row[name] = (cells[index] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

async function build(key: string, reportType: string, dataStartTime?: string): Promise<ReportData> {
  let reportId = documentIds.get(key)

  try {
    if (!reportId) {
      reportId = await createReport(reportType, dataStartTime)
      documentIds.set(key, reportId)
    }

    const documentId = await waitDocument(reportId)
    const data = parseTabbed(await download(documentId))
    documentIds.delete(key)

    const value: ReportData = { type: reportType, ...data }
    cache.set(key, { value, expiresAt: Date.now() + REPORT_TTL_MS })
    return value
  } catch (error) {
    const timeout = error instanceof SpApiError && error.message.includes('Tempo esgotado')
    if (!timeout) documentIds.delete(key)
    misses.set(key, Date.now() + MISS_TTL_MS)
    throw error
  }
}

export async function runReport(reportType: string, dataStartTime?: string): Promise<ReportData> {
  const key = `${reportType}|${dataStartTime ?? ''}`

  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const missed = misses.get(key)
  if (missed && missed > Date.now()) {
    throw new SpApiError(
      'Relatório da Amazon indisponível por alguns segundos.',
      'Uma geração anterior falhou; aguarde e recarregue a página.',
    )
  }

  const inFlight = running.get(key)
  if (inFlight) return inFlight

  const promise = build(key, reportType, dataStartTime).finally(() => {
    if (running.get(key) === promise) running.delete(key)
  })
  running.set(key, promise)
  promise.catch(() => undefined)
  return promise
}
