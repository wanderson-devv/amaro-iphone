import { useMemo, useState } from 'react'
import { brl, num, pct } from '../data'
import { FINANCE_SINCE, useAmazonFinance, useAmazonSkus } from '../integrations'
import { PageHeader, Panel, StatTile, TabBar } from '../components/ui'

const tabs = ['Curva ABC', 'Produtos rentáveis']

type SkuRow = {
  sku: string
  name: string
  units: number
  revenue: number
  avgPrice: number
  cost: number | null
  margin: number | null
  share: number
  cumulative: number
  curve: 'A' | 'B' | 'C'
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState(tabs[0])
  const finance = useAmazonFinance(FINANCE_SINCE)
  const { skus: skuMeta } = useAmazonSkus()

  const rows: SkuRow[] = useMemo(() => {
    const sorted = [...finance.skus].sort((a, b) => b.revenue - a.revenue)
    const total = sorted.reduce((sum, item) => sum + item.revenue, 0)
    let accumulator = 0
    return sorted.map((item) => {
      const share = total > 0 ? (item.revenue / total) * 100 : 0
      accumulator += share
      const meta = skuMeta[item.sku]
      const cost = meta?.cost ?? null
      const avgPrice = item.units > 0 ? item.revenue / item.units : 0
      const margin = cost != null && avgPrice > 0 ? ((avgPrice - cost) / avgPrice) * 100 : null
      const curve: SkuRow['curve'] = accumulator <= 80 ? 'A' : accumulator <= 95 ? 'B' : 'C'
      return {
        sku: item.sku,
        name: meta?.name || item.sku,
        units: item.units,
        revenue: item.revenue,
        avgPrice,
        cost,
        margin,
        share,
        cumulative: accumulator,
        curve,
      }
    })
  }, [finance.skus, skuMeta])

  const totalRevenue = rows.reduce((sum, item) => sum + item.revenue, 0)
  const totalUnits = rows.reduce((sum, item) => sum + item.units, 0)
  const comMargem = rows.filter((item) => item.margin != null)
  const melhorMargem = comMargem.length
    ? comMargem.reduce((best, item) => ((item.margin ?? -Infinity) > (best.margin ?? -Infinity) ? item : best))
    : null
  const semCusto = rows.length - comMargem.length
  const vazio = finance.status !== 'live' && rows.length === 0

  return (
    <>
      <PageHeader
        eyebrow="Analítico"
        title="Análises de desempenho"
        description="Curva ABC e rentabilidade calculadas sobre a receita real de cada SKU no extrato da Amazon."
      />

      <TabBar items={tabs} active={tab} onChange={setTab} />

      {vazio && (
        <div className="data-mode is-demo">
          <b>Sem dados no momento.</b> {finance.message}
          {finance.hint ? ` · ${finance.hint}` : ''}
        </div>
      )}

      {tab === 'Curva ABC' && (
        <>
          <section className="metrics">
            <StatTile label="SKUs com faturamento" value={num(rows.length)} hint="no extrato" />
            <StatTile label="Receita total" value={brl(totalRevenue)} hint="recorte do extrato" />
            <StatTile label="Unidades" value={num(totalUnits)} hint="somadas por SKU" />
            <StatTile
              label="Concentração curva A"
              value={pct(rows.filter((item) => item.curve === 'A').reduce((sum, item) => sum + item.share, 0))}
              hint="participação no faturamento"
              tone="positive"
            />
          </section>

          <Panel title="Classificação por faturamento" hint="Acumulado decrescente" className="sales-panel">
            {rows.length === 0 ? (
              <p className="breakdown-note">Nenhum SKU com faturamento no extrato.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>Unidades</th>
                      <th>Faturamento</th>
                      <th>Participação</th>
                      <th>Acumulado</th>
                      <th>Curva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product, index) => (
                      <tr key={product.sku}>
                        <td className="mono">{index + 1}</td>
                        <td>
                          <b>{product.name}</b>
                        </td>
                        <td className="order">{product.sku}</td>
                        <td>{num(product.units)}</td>
                        <td>{brl(product.revenue)}</td>
                        <td>
                          <div className="mini-bar">
                            <i style={{ width: `${Math.min(product.share * 2.4, 100)}%` }} className={`fill-${product.curve}`} />
                          </div>
                          <small className="sub">{pct(product.share)}</small>
                        </td>
                        <td className="mono">{pct(product.cumulative)}</td>
                        <td>
                          <span className={`curve-chip curve-chip-${product.curve}`}>{product.curve}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <section className="footnote">
            Leitura operacional: concentre estoque e capital nas curvas A e B; revise preço, descrição ou logística da curva C.
          </section>
        </>
      )}

      {tab === 'Produtos rentáveis' && (
        <>
          <section className="metrics">
            <StatTile label="SKUs ativos" value={num(rows.length)} hint="com faturamento" />
            <StatTile
              label="Melhor margem"
              value={melhorMargem?.margin != null ? pct(melhorMargem.margin) : '—'}
              hint={melhorMargem ? melhorMargem.name : 'cadastre custos em Catálogo'}
              tone="positive"
            />
            <StatTile
              label="Sem custo cadastrado"
              value={num(semCusto)}
              hint="margem indisponível"
              tone={semCusto > 0 ? 'attention' : undefined}
            />
            <StatTile label="Receita total" value={brl(totalRevenue)} hint="recorte analisado" />
          </section>

          <Panel title="Rentabilidade por produto" hint="Preço médio, custo e margem real" className="sales-panel">
            {rows.length === 0 ? (
              <p className="breakdown-note">Nenhum SKU com faturamento no extrato.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Curva</th>
                      <th>Faturamento</th>
                      <th>Unidades</th>
                      <th>Preço médio</th>
                      <th>Custo</th>
                      <th>Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => (
                      <tr key={product.sku}>
                        <td>
                          <b>{product.name}</b>
                          <small className="sub">{product.sku}</small>
                        </td>
                        <td>
                          <span className={`curve-chip curve-chip-${product.curve}`}>{product.curve}</span>
                        </td>
                        <td>{brl(product.revenue)}</td>
                        <td>{num(product.units)}</td>
                        <td>{brl(product.avgPrice)}</td>
                        <td>{product.cost != null ? brl(product.cost) : '—'}</td>
                        <td
                          className={
                            product.margin == null ? 'muted' : product.margin > 50 ? 'profit' : product.margin < 20 ? 'loss' : ''
                          }
                        >
                          {product.margin != null ? pct(product.margin) : 'sem custo'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {semCusto > 0 && (
            <section className="footnote">
              {semCusto} SKU{semCusto > 1 ? 's' : ''} sem custo informado — cadastre em Catálogo para liberar a margem.
            </section>
          )}
        </>
      )}
    </>
  )
}
