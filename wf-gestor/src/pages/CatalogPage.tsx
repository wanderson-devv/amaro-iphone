import { useState } from 'react'
import { brl, num, pct } from '../data'
import {
  FINANCE_SINCE,
  useAmazonFinance,
  useAmazonListings,
  useAmazonSkus,
  useAppDb,
  useAppDbWriteError,
} from '../integrations'
import type { AmazonSkuInfo } from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

function formatNum(value: number): string {
  return String(value).replace('.', ',')
}

function parseNum(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '')
  if (text === '') return null
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const normalized =
    lastComma >= 0 && lastDot >= 0
      ? lastComma < lastDot
        ? text.replace(/,/g, '')
        : text.replace(/\./g, '').replace(',', '.')
      : text.replace(',', '.')
  const parsed = Number(normalized)
  if (Number.isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100) / 100
}

function DecimalInput({
  sku,
  meta,
  save,
  field,
  placeholder,
}: {
  sku: string
  meta: AmazonSkuInfo
  save: (sku: string, info: AmazonSkuInfo) => void
  field: 'cost' | 'tax'
  placeholder: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const committed = meta[field] != null ? formatNum(meta[field] as number) : ''

  const onChange = (raw: string) => {
    setDraft(raw)
    const parsed = parseNum(raw)
    if (raw.trim() === '') {
      if (meta[field] != null) save(sku, { ...meta, [field]: undefined })
      return
    }
    if (parsed == null) return
    if (parsed !== meta[field]) save(sku, { ...meta, [field]: parsed })
  }

  return (
    <input
      className="sku-input short"
      inputMode="decimal"
      value={draft ?? committed}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => setDraft(null)}
    />
  )
}

export default function CatalogPage() {
  const finance = useAmazonFinance(FINANCE_SINCE)
  const listings = useAmazonListings()
  const { skus: skuMeta, save } = useAmazonSkus()
  const dbError = useAppDbWriteError()
  const db = useAppDb()

  const salesBySku = new Map(finance.skus.map((item) => [item.sku, item]))
  const listedSkus = new Set(listings.items.map((item) => item.sku))

  const rows = [
    ...listings.items.map((item) => ({
      sku: item.sku,
      title: item.title,
      active: item.active as boolean | undefined,
      units: salesBySku.get(item.sku)?.units ?? 0,
      revenue: salesBySku.get(item.sku)?.revenue ?? 0,
    })),
    ...finance.skus
      .filter((item) => !listedSkus.has(item.sku))
      .map((item) => ({
        sku: item.sku,
        title: undefined as string | undefined,
        active: undefined as boolean | undefined,
        units: item.units,
        revenue: item.revenue,
      })),
  ].sort(
    (a, b) => Number(b.active === true) - Number(a.active === true) || a.sku.localeCompare(b.sku),
  )

  const activeCount = listings.items.filter((item) => item.active).length
  const inactiveCount = listings.items.length - activeCount
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0)
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const comCusto = rows.filter((row) => skuMeta[row.sku]?.cost != null).length
  const comImposto = rows.filter((row) => skuMeta[row.sku]?.tax != null).length
  const loading = listings.status === 'inicial' && finance.status === 'inicial'

  return (
    <>
      <PageHeader
        eyebrow="Gerenciamento"
        title="Catálogo e associações"
        description="Todos os anúncios da sua conta Amazon — ativos e inativos — vindos da SP-API, com as vendas do extrato, nome, custo e alíquota de imposto informados por você."
      />

      <section className="metrics">
        <StatTile
          label="Anúncios na conta"
          value={num(listings.items.length)}
          hint={
            listings.status === 'live'
              ? `${activeCount} ativos · ${inactiveCount} inativos`
              : listings.message
          }
        />
        <StatTile label="Unidades vendidas" value={num(totalUnits)} hint="no período do extrato" />
        <StatTile label="Receita no extrato" value={brl(totalRevenue)} hint="bruto por SKU" />
        <StatTile
          label="Com custo cadastrado"
          value={`${comCusto}/${rows.length}`}
          hint={`${comImposto} com imposto definido`}
          tone={comCusto === rows.length && rows.length > 0 ? 'positive' : 'attention'}
        />
      </section>

      <Panel
        title="Anúncios da Amazon"
        hint={listings.status === 'live' ? listings.message : 'Anúncios e extrato financeiro'}
        className="sales-panel"
      >
        {loading && <p className="breakdown-note">Lendo os anúncios da Amazon…</p>}
        {!loading && rows.length === 0 && (
          <p className="breakdown-note">
            {listings.status === 'erro' ? listings.message : finance.message}
            {(listings.hint ?? finance.hint) ? ` · ${listings.hint ?? finance.hint}` : ''}
          </p>
        )}
        {listings.status === 'erro' && rows.length > 0 && (
          <p className="breakdown-note is-error">
            Falha ao ler os anúncios: {listings.message} — mostrando só o extrato financeiro.
          </p>
        )}
        {rows.length > 0 && (
          <div className="table-scroll">
            <table className="wide">
              <thead>
                <tr>
                  <th>SKU Amazon</th>
                  <th>Anúncio</th>
                  <th>Unidades</th>
                  <th>Receita no extrato</th>
                  <th>Nome do produto</th>
                  <th>Custo unitário</th>
                  <th>Imposto %</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta = skuMeta[row.sku] ?? {}
                  const cost = meta.cost
                  return (
                    <tr key={row.sku}>
                      <td className="order">{row.sku}</td>
                      <td>
                        {row.active === undefined ? (
                          '—'
                        ) : (
                          <Tag value={row.active ? 'Ativo' : 'Inativo'} />
                        )}
                      </td>
                      <td>{num(row.units)}</td>
                      <td>{brl(row.revenue)}</td>
                      <td>
                        <input
                          className="sku-input"
                          value={meta.name ?? ''}
                          placeholder={row.title ?? 'nome do produto'}
                          onChange={(event) => save(row.sku, { ...meta, name: event.target.value || undefined })}
                        />
                      </td>
                      <td>
                        <DecimalInput sku={row.sku} meta={meta} save={save} field="cost" placeholder="0,00" />
                      </td>
                      <td>
                        <DecimalInput sku={row.sku} meta={meta} save={save} field="tax" placeholder="0,0" />
                      </td>
                      <td>{cost != null ? <Tag value="Conciliado" /> : <Tag value="Pendente" />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="breakdown-note">
          Nome, custo e alíquota de imposto (%) ficam salvos no banco {db.backend === 'neon' ? 'Neon (Postgres na nuvem)' : 'local do proxy (SQLite)'}{' '}
          e alimentam Lucro e Margem em todas as telas — de qualquer dispositivo. A alíquota informada substitui o imposto
          do extrato no cálculo do líquido.
        </p>
        {dbError && (
          <p className="breakdown-note is-error">
            Falha ao salvar no banco: {dbError} — verifique se o proxy está rodando; o valor digitado vale só nesta
            sessão.
          </p>
        )}
      </Panel>

      <section className="footnote">
        Cobertura de custo: {rows.length ? pct((comCusto / rows.length) * 100) : pct(0)} · imposto definido em{' '}
        {rows.length ? pct((comImposto / rows.length) * 100) : pct(0)} dos anúncios listados.
      </section>
    </>
  )
}
