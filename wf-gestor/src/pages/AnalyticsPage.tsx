import { useMemo, useState } from 'react'
import { Sparkles, TrendingUp } from 'lucide-react'
import { brl, campaigns, num, pct, products, type Channel } from '../data'
import { PageHeader, Panel, StatTile, TabBar } from '../components/ui'

const tabs = ['Curva ABC', 'Campanhas de Ads', 'Produtos rentáveis']

const curveInfo = {
  A: { share: '80%', label: 'Responsáveis por 80% do faturamento', tone: 'curve-a' },
  B: { share: '15%', label: 'Responsáveis por 15% do faturamento', tone: 'curve-b' },
  C: { share: '5%', label: 'Responsáveis por 5% do faturamento', tone: 'curve-c' },
  Z: { share: '0%', label: 'Sem faturamento ou apenas despesa', tone: 'curve-z' },
} as const

export default function AnalyticsPage() {
  const [tab, setTab] = useState(tabs[0])

  const sorted = useMemo(
    () => [...products].sort((a, b) => b.revenue - a.revenue),
    [],
  )
  const totalRevenue = sorted.reduce((sum, item) => sum + item.revenue, 0)
  let accumulator = 0
  const withShare = sorted.map((product) => {
    const share = totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0
    accumulator += share
    return { ...product, share, cumulative: accumulator }
  })

  const totals = campaigns.reduce(
    (acc, item) => ({ spend: acc.spend + item.spend, sales: acc.sales + item.sales, orders: acc.orders + item.orders }),
    { spend: 0, sales: 0, orders: 0 },
  )
  const roas = totals.sales / totals.spend
  const acos = (totals.spend / totals.sales) * 100
  const maxSpend = Math.max(...campaigns.map((item) => item.spend))

  return (
    <>
      <PageHeader
        eyebrow="Analítico"
        title="Análises de desempenho"
        description="Classificação de curva, retorno de anúncios e a rentabilidade real de cada produto."
        action={
          <button className="ghost lg">
            <Sparkles size={16} /> Gerar relatório
          </button>
        }
      />

      <TabBar items={tabs} active={tab} onChange={setTab} />

      {tab === 'Curva ABC' && (
        <>
          <section className="metrics">
            {(['A', 'B', 'C', 'Z'] as const).map((curve) => (
              <article className={`metric-card curve-card ${curveInfo[curve].tone}`} key={curve}>
                <p>Curva {curve}</p>
                <strong>{curveInfo[curve].share}</strong>
                <span className="tile-hint">{curveInfo[curve].label}</span>
              </article>
            ))}
          </section>

          <Panel title="Classificação por faturamento" hint="Acumulado decrescente" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produto</th>
                    <th>SKU</th>
                    <th>Faturamento</th>
                    <th>Participação</th>
                    <th>Acumulado</th>
                    <th>Curva</th>
                  </tr>
                </thead>
                <tbody>
                  {withShare.map((product, index) => (
                    <tr key={product.sku}>
                      <td className="mono">{index + 1}</td>
                      <td>
                        <b>{product.name}</b>
                      </td>
                      <td className="order">{product.sku}</td>
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
          </Panel>

          <section className="footnote">
            Leitura operacional: concentre estoque e capital nas curvas A e B; revise preço, descrição ou logística da curva Z.
          </section>
        </>
      )}

      {tab === 'Campanhas de Ads' && (
        <>
          <section className="metrics">
            <StatTile label="Investimento" value={brl(totals.spend)} hint="no período" />
            <StatTile label="Vendas atribuídas" value={brl(totals.sales)} hint={`${num(totals.orders)} pedidos`} tone="positive" />
            <StatTile label="ROAS" value={`${num(roas, 2)}x`} hint="retorno por real investido" tone="positive" />
            <StatTile label="ACOS" value={pct(acos)} hint="custo sobre vendas" />
          </section>

          <div className="two-col">
            <Panel title="Desempenho por campanha" hint="Amazon, Mercado Livre, Shopee e TikTok" className="sales-panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Canal</th>
                      <th>Formato</th>
                      <th>Gasto</th>
                      <th>Vendas</th>
                      <th>ROAS</th>
                      <th>ACOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => {
                      const campaignRoas = campaign.sales / campaign.spend
                      const campaignAcos = (campaign.spend / campaign.sales) * 100
                      return (
                        <tr key={campaign.name}>
                          <td>
                            <b>{campaign.name}</b>
                          </td>
                          <td>
                            <span className="channel">{campaign.channel}</span>
                          </td>
                          <td className="muted">{campaign.type}</td>
                          <td>{brl(campaign.spend)}</td>
                          <td>{brl(campaign.sales)}</td>
                          <td className="profit">{num(campaignRoas, 2)}x</td>
                          <td>{pct(campaignAcos)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Gasto e retorno" hint="Comparativo por campanha">
              <div className="bars">
                {campaigns.map((campaign) => (
                  <div key={campaign.name} className="bar-row campaign">
                    <span title={campaign.name}>{campaign.name}</span>
                    <div className="dual-track">
                      <i className="bar-spend" style={{ width: `${(campaign.spend / maxSpend) * 100}%` }} />
                      <i className="bar-sales" style={{ width: `${(campaign.sales / (maxSpend * 6)) * 100}%` }} />
                    </div>
                    <b>{num(campaign.sales / campaign.spend, 1)}x</b>
                  </div>
                ))}
              </div>
              <p className="hint-text">
                O retorno é calculado sobre a margem real da venda, já descontadas comissões, impostos e custo do produto.
              </p>
            </Panel>
          </div>
        </>
      )}

      {tab === 'Produtos rentáveis' && (
        <>
          <section className="metrics">
            <StatTile label="Produtos ativos" value={num(products.filter((p) => p.revenue > 0).length)} hint="com faturamento" />
            <StatTile label="Melhor margem" value={pct(42.6)} hint="Organizador Modular 3L" tone="positive" />
            <StatTile label="Maior devolução" value="7,4%" hint="Suporte Acrílico" tone="attention" />
            <StatTile label="Faturamento total" value={brl(totalRevenue)} hint="recorte analisado" />
          </section>

          <Panel title="Rentabilidade por produto" hint="Faturamento, devoluções e curva" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Curva</th>
                    <th>Faturamento</th>
                    <th>Preço médio</th>
                    <th>Custo</th>
                    <th>Margem estimada</th>
                    <th>Devoluções</th>
                  </tr>
                </thead>
                <tbody>
                  {withShare.map((product) => {
                    const margin = ((product.price - product.cost) / product.price) * 100
                    return (
                      <tr key={product.sku}>
                        <td>
                          <b>{product.name}</b>
                          <small className="sub">{product.sku}</small>
                        </td>
                        <td>
                          <span className={`curve-chip curve-chip-${product.curve}`}>{product.curve}</span>
                        </td>
                        <td>{brl(product.revenue)}</td>
                        <td>{brl(product.price)}</td>
                        <td>{brl(product.cost)}</td>
                        <td className={margin > 50 ? 'profit' : margin < 35 ? 'loss' : ''}>{pct(margin)}</td>
                        <td>
                          {product.refunds > 5 ? (
                            <span className="loss">{product.refunds} devoluções</span>
                          ) : (
                            <span className="muted">{product.refunds} devoluções</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="notice">
            <TrendingUp size={18} />
            <div>
              <b>Recomendação da curva</b>
              <p>
                Suporte Organizador Acrílico combina margem baixa com o maior índice de devolução. Vale revisar descrição,
                embalagem e prazo de entrega antes de ampliar o estoque.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  )
}

export const channelList: Channel[] = ['Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop']
