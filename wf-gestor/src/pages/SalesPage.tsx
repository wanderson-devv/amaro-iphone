import { useMemo, useState } from 'react'
import { Download, Filter, Search, X } from 'lucide-react'
import { brl, num, pct, sales as demoSales } from '../data'
import {
  ALL_ORDERS_SINCE,
  FINANCE_SINCE,
  allocateAds,
  enrichSales,
  useAmazonFinance,
  useAmazonSales,
  useAmazonSkus,
} from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

const channels = ['Todos', 'Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop']
const statuses = ['Todos', 'Recebido', 'A liberar', 'Em disputa', 'Devolvido']

export default function SalesPage() {
  const [channel, setChannel] = useState('Todos')
  const [status, setStatus] = useState('Todos')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const amazon = useAmazonSales(ALL_ORDERS_SINCE)
  const finance = useAmazonFinance(FINANCE_SINCE)
  const skuMeta = useAmazonSkus()
  const usingReal = amazon.status === 'live' || (amazon.status !== 'inicial' && amazon.sales.length > 0)
  const source = usingReal ? enrichSales(amazon.sales, finance.orders, skuMeta.skus) : demoSales
  const adsTotal = usingReal ? finance.ads.reduce((sum, item) => sum + item.amount, 0) : 0
  const enriched = usingReal ? allocateAds(source, adsTotal) : source

  const filtered = useMemo(
    () =>
      enriched.filter((sale) => {
        const matchesChannel = channel === 'Todos' || sale.channel === channel
        const matchesStatus = status === 'Todos' || sale.status === status
        const haystack = `${sale.id} ${sale.product} ${sale.sku} ${sale.externalSku}`.toLowerCase()
        return matchesChannel && matchesStatus && haystack.includes(query.toLowerCase())
      }),
    [enriched, channel, status, query],
  )

  const rows = filtered
  const selected = selectedId ? (rows.find((sale) => sale.id === selectedId) ?? null) : null

  const knownRows = rows.filter((sale) => sale.partial === false)
  const hasNet = usingReal ? knownRows.length > 0 : true
  const hasCost = usingReal ? knownRows.length > 0 && knownRows.every((sale) => !sale.costUnknown) : true
  const hasProfit = hasNet && hasCost

  const totals = rows.reduce(
    (acc, sale) => ({
      gross: acc.gross + sale.gross,
      net: acc.net + (sale.partial === false ? sale.net : 0),
      profit: acc.profit + (sale.partial === false ? sale.costUnknown ? 0 : sale.profit : 0),
      qty: acc.qty + sale.qty,
    }),
    { gross: 0, net: 0, profit: 0, qty: 0 },
  )

  const margin = totals.gross > 0 ? (totals.profit / totals.gross) * 100 : 0
  const costLabel = 'informe o custo dos SKUs em Catálogo'
  const feeLabel = 'aguardando o extrato financeiro'
  const coverage = rows.length ? knownRows.length / rows.length : 1
  const netHint = coverage >= 1 ? 'após taxas e impostos' : `extrato de ${knownRows.length} de ${rows.length} pedidos`

  return (
    <>
      <PageHeader
        eyebrow="Venda a venda"
        title="Página de vendas"
        description="Cada pedido com o extrato completo: comissões, taxas, impostos, custo do produto, lucro e margem."
        action={
          <button className="primary">
            <Download size={17} /> Exportar CSV
          </button>
        }
      />

      <section className="metrics">
        <StatTile label="Pedidos filtrados" value={num(filtered.length)} hint={`${num(totals.qty)} unidades`} />
        <StatTile label="Faturamento" value={brl(totals.gross)} hint="bruto no recorte" />
        <StatTile
          label="Líquido do marketplace"
          value={hasNet ? brl(totals.net) : '—'}
          hint={hasNet ? netHint : feeLabel}
        />
        <StatTile
          label="Lucro"
          value={hasProfit ? brl(totals.profit) : '—'}
          hint={hasProfit ? `margem de ${pct(margin)}` : hasNet ? costLabel : feeLabel}
          tone="positive"
        />
      </section>

      {!usingReal && (
        <div className="data-mode is-demo">
          <b>Modo demonstração.</b> {amazon.message}
          {amazon.hint ? ` · ${amazon.hint}` : ''}
        </div>
      )}
      {usingReal && amazon.status !== 'live' && (
        <div className="data-mode is-demo">
          <b>Última leitura disponível.</b> {amazon.message}
          {amazon.hint ? ` · ${amazon.hint}` : ''}
        </div>
      )}
      {usingReal && finance.status !== 'live' && (
        <div className="data-mode is-demo">
          <b>Extrato financeiro indisponível.</b> {finance.message}
          {finance.hint ? ` · ${finance.hint}` : ''}
        </div>
      )}

      <Panel
        title="Vendas realizadas"
        hint="Filtros combináveis"
        className="sales-panel"
        action={
          <div className="filter-row">
            <label className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pedido, produto ou SKU"
              />
            </label>
            <label className="select-box">
              <Filter size={14} />
              <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                {channels.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="select-box">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statuses.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <div className="table-scroll">
          <table className="wide">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Data</th>
                <th>Produto / SKU</th>
                <th>Canal</th>
                <th>Qtd</th>
                <th>Venda</th>
                <th>Taxas</th>
                <th>Custo</th>
                <th>Imposto</th>
                <th>Lucro</th>
                <th>Margem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((sale) => (
                <tr key={sale.id} onClick={() => setSelectedId(sale.id)} className="clickable">
                  <td className="order">{sale.id}</td>
                  <td className="mono">{new Date(`${sale.date}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <b>{sale.product}</b>
                    <small className="sub">{sale.sku === '—' ? `${sale.qty} un.` : sale.sku}</small>
                  </td>
                  <td>
                    <span className="channel">{sale.channel}</span>
                  </td>
                  <td>{sale.qty}</td>
                  <td>{brl(sale.gross)}</td>
                  <td className="muted">{sale.partial ? '—' : brl(sale.commission + sale.fees)}</td>
                  <td className="muted">{sale.costUnknown ? '—' : brl(sale.cost)}</td>
                  <td className="muted">{sale.partial ? '—' : brl(sale.taxes)}</td>
                  <td className={sale.partial || sale.costUnknown ? 'muted' : sale.profit >= 0 ? 'profit' : 'loss'}>
                    {sale.partial || sale.costUnknown ? '—' : brl(sale.profit)}
                  </td>
                  <td>{sale.partial || sale.costUnknown ? '—' : pct(sale.margin)}</td>
                  <td>
                    <Tag value={sale.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty">
                    Nenhum pedido corresponde aos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">Extrato do pedido</span>
                <h2>{selected.id}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedId(null)} aria-label="Fechar">
                <X size={17} />
              </button>
            </header>

            <div className="drawer-summary">
              <div>
                <span>Produto</span>
                <b>{selected.product}</b>
              </div>
              <div>
                <span>SKU interno / externo</span>
                <b>
                  {selected.sku} · {selected.externalSku}
                </b>
              </div>
              <div>
                <span>ASIN</span>
                <b className="mono">{selected.asin}</b>
              </div>
              <div>
                <span>Canal e status</span>
                <b>
                  {selected.channel} · <Tag value={selected.status} />
                </b>
              </div>
            </div>

            <div className="breakdown">
              {[
                ['Preço unitário', brl(selected.unitPrice)],
                ['Quantidade', num(selected.qty)],
                ['Faturamento bruto', brl(selected.gross)],
                ['(−) Comissão do marketplace', selected.partial ? '—' : `− ${brl(selected.commission)}`],
                ['(−) Taxas de serviço', selected.partial ? '—' : `− ${brl(selected.fees)}`],
                ['(−) Impostos', selected.partial ? '—' : `− ${brl(selected.taxes)}`],
                ['Líquido recebido', selected.partial ? '—' : brl(selected.net)],
                ['(−) Custo do produto', selected.costUnknown ? '—' : `− ${brl(selected.cost)}`],
                ['(−) Investimento em Ads', selected.partial ? '—' : `− ${brl(selected.ads)}`],
              ].map(([label, value]) => (
                <div key={label} className={label.startsWith('(') ? 'deduction' : ''}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
              <div className={`total ${!selected.partial && !selected.costUnknown && selected.profit < 0 ? 'is-loss' : ''}`}>
                <span>Lucro da venda</span>
                <b>{selected.partial || selected.costUnknown ? '—' : brl(selected.profit)}</b>
              </div>
              <div className="total">
                <span>Margem líquida</span>
                <b>{selected.partial || selected.costUnknown ? '—' : pct(selected.margin)}</b>
              </div>
              {selected.partial && (
                <p className="breakdown-note">
                  O extrato deste pedido ainda não foi publicado pela Amazon — comissões, taxas e impostos aparecem
                  aqui assim que saírem.
                </p>
              )}
              {!selected.partial && selected.costUnknown && (
                <p className="breakdown-note">
                  Informe o custo de {selected.sku} na aba Catálogo para calcular lucro e margem deste pedido.
                </p>
              )}
            </div>

            <div className="drawer-footer">
              <span>Conciliação</span>
              <Tag value={selected.settlement} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
