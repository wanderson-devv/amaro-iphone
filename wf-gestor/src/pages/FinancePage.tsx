import { useMemo } from 'react'
import { AlertOctagon } from 'lucide-react'
import { brl, num, pct } from '../data'
import {
  allocateAds,
  enrichSales,
  useAmazonFinance,
  useAmazonSales,
  useAmazonSkus,
} from '../integrations'
import { PageHeader, Panel, StatTile } from '../components/ui'

const SINCE = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const round = (value: number) => Math.round(value * 100) / 100

export default function FinancePage() {
  const amazon = useAmazonSales(SINCE)
  const finance = useAmazonFinance(SINCE)
  const skuMeta = useAmazonSkus()

  const rows = useMemo(() => {
    const source = enrichSales(amazon.sales, finance.orders, skuMeta.skus)
    const adsTotal = finance.ads
      .filter((item) => item.date >= SINCE)
      .reduce((sum, item) => sum + item.amount, 0)
    return allocateAds(source, adsTotal)
  }, [amazon.sales, finance.orders, finance.ads, skuMeta.skus])

  const adsTotal = finance.ads
    .filter((item) => item.date >= SINCE)
    .reduce((sum, item) => sum + item.amount, 0)

  const known = rows.filter((sale) => sale.partial === false)

  const totals = useMemo(() => {
    const acc = rows.reduce(
      (sum, sale) => ({
        gross: sum.gross + sale.gross,
        units: sum.units + sale.qty,
        orders: sum.orders + 1,
      }),
      { gross: 0, units: 0, orders: 0 },
    )
    const fees = known.reduce((sum, sale) => sum + sale.commission + sale.fees, 0)
    const taxes = known.reduce((sum, sale) => sum + sale.taxes, 0)
    const refunds = finance.orders
      ? Object.values(finance.orders).reduce((sum, order) => sum + order.refunds, 0)
      : 0
    const net = known.reduce((sum, sale) => sum + sale.net, 0)
    const cost = known.filter((sale) => !sale.costUnknown).reduce((sum, sale) => sum + sale.cost, 0)
    const lucroBruto = round(net - cost)
    const lucroLiquido = round(lucroBruto - adsTotal)
    return {
      ...acc,
      fees: round(fees),
      taxes: round(taxes),
      refunds: round(refunds),
      net: round(net),
      cost: round(cost),
      liquidoMarketplaces: round(net - refunds),
      lucroBruto,
      lucroLiquido,
    }
  }, [rows, known, finance.orders, adsTotal])

  const semExtrato = rows.length - known.length
  const semCusto = known.filter((sale) => sale.costUnknown).length
  const faturamento = totals.gross
  const margem = (value: number) => (faturamento > 0 ? pct((value / faturamento) * 100) : pct(0))
  const ticket = totals.orders > 0 ? faturamento / totals.orders : 0
  const custoVenda = faturamento > 0 ? (totals.cost / faturamento) * 100 : 0

  const lines = [
    { label: 'Faturamento bruto', value: faturamento, kind: 'total', note: `${totals.orders} pedidos nos últimos 30 dias` },
    { label: '(-) Impostos sobre vendas', value: -totals.taxes, kind: 'deduction' },
    { label: '(-) Comissões e taxas de serviço', value: -totals.fees, kind: 'deduction' },
    { label: '(-) Devoluções e estornos', value: -totals.refunds, kind: 'deduction' },
    { label: 'Líquido de marketplaces', value: totals.liquidoMarketplaces, kind: 'sub' },
    { label: '(-) Custo dos produtos vendidos', value: -totals.cost, kind: 'deduction', note: semCusto ? `${semCusto} pedidos ainda sem custo` : undefined },
    { label: 'Lucro bruto', value: totals.lucroBruto, kind: 'result' },
    { label: '(-) Investimento em Ads', value: -adsTotal, kind: 'deduction' },
    { label: 'Lucro líquido operacional', value: totals.lucroLiquido, kind: 'result' },
  ]

  const barSegments = [
    { label: 'Impostos e comissões', value: faturamento > 0 ? ((totals.taxes + totals.fees) / faturamento) * 100 : 0, tone: 'bar-a' },
    { label: 'Custo dos produtos', value: custoVenda, tone: 'bar-b' },
    { label: 'Ads', value: faturamento > 0 ? (adsTotal / faturamento) * 100 : 0, tone: 'bar-c' },
    { label: 'Lucro líquido', value: faturamento > 0 ? (totals.lucroLiquido / faturamento) * 100 : 0, tone: 'bar-d' },
  ]

  const semDados = amazon.status !== 'live' && rows.length === 0

  return (
    <>
      <PageHeader
        eyebrow="Resumo financeiro"
        title="DRE e conciliação"
        description="Do faturamento bruto ao lucro líquido, calculado sobre os pedidos e o extrato financeiro reais da Amazon."
      />

      {semDados && (
        <div className="data-mode is-demo">
          <b>Sem dados no momento.</b> {amazon.message}
          {amazon.hint ? ` · ${amazon.hint}` : ''}
        </div>
      )}
      {amazon.status === 'live' && semExtrato > 0 && (
        <div className="data-mode is-demo">
          <b>{semExtrato} pedido{semExtrato > 1 ? 's' : ''} sem extrato.</b> Comissões, taxas e impostos aparecem assim
          que a Amazon publicar o repasse.
        </div>
      )}

      <section className="metrics">
        <StatTile label="Faturamento bruto" value={brl(faturamento)} hint="últimos 30 dias" />
        <StatTile label="Líquido de marketplaces" value={brl(totals.liquidoMarketplaces)} hint="após taxas e impostos" />
        <StatTile label="Lucro bruto" value={brl(totals.lucroBruto)} hint={`margem ${margem(totals.lucroBruto)}`} tone="positive" />
        <StatTile label="Lucro líquido operacional" value={brl(totals.lucroLiquido)} hint={`margem ${margem(totals.lucroLiquido)}`} tone="positive" />
      </section>

      <div className="two-col">
        <Panel title="Demonstrativo de resultado" hint="Competência dos últimos 30 dias">
          <div className="dre">
            {lines.map((line) => (
              <div key={line.label} className={`dre-line kind-${line.kind}`}>
                <span>
                  {line.label}
                  {line.note && <small>{line.note}</small>}
                </span>
                <b>{brl(line.value)}</b>
              </div>
            ))}
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Composição do resultado" hint="Participação no faturamento">
            <div className="bars">
              {barSegments.map((segment) => (
                <div key={segment.label} className="bar-row">
                  <span>{segment.label}</span>
                  <div className="bar-track">
                    <i className={segment.tone} style={{ width: `${Math.max(0, Math.min(segment.value, 100))}%` }} />
                  </div>
                  <b>{pct(segment.value)}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Indicadores" hint="Saúde financeira">
            <div className="indicator-grid">
              <div>
                <span>Ticket médio</span>
                <b>{brl(ticket)}</b>
              </div>
              <div>
                <span>Custo de venda</span>
                <b>{pct(custoVenda)}</b>
              </div>
              <div>
                <span>Unidades vendidas</span>
                <b>{num(totals.units)}</b>
              </div>
              <div>
                <span>Investimento em Ads</span>
                <b>{brl(adsTotal)}</b>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {semCusto > 0 && (
        <section className="notice">
          <AlertOctagon size={18} />
          <div>
            <b>{semCusto} pedido{semCusto > 1 ? 's' : ''} sem custo de produto</b>
            <p>
              Informe o custo dos SKUs na aba Catálogo para que o lucro e a margem sejam calculados de verdade.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
