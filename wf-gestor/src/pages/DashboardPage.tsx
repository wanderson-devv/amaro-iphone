import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Info,
  PackageSearch,
  ReceiptText,
} from 'lucide-react'
import { brl, brlShort, dateBR, num, pct, priorities, sales as demoSales, type Sale, type SaleStatus } from '../data'
import { PageHeader, Panel, StatTile } from '../components/ui'
import { useAmazonSales, useAutoSyncStatus, ALL_ORDERS_SINCE, type LiveFeed } from '../integrations'

const DEMO_HOJE = '2026-05-30'
const HOJE = new Date().toISOString().slice(0, 10)

type Range = { start: string; end: string }

const shiftDay = (base: string, days: number) => {
  const date = new Date(`${base}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const monthEnd = (base: string) => {
  const [year, month] = base.split('-').map(Number)
  const last = new Date(year, month, 0)
  return `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

const prevMonth = (base: string) => {
  const [year, month] = base.split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
  const end = monthEnd(start)
  return { start, end }
}

const buildPresets = (base: string): { label: string; range: Range }[] => [
  { label: 'Últimos 3 dias', range: { start: shiftDay(base, -2), end: base } },
  { label: 'Últimos 7 dias', range: { start: shiftDay(base, -6), end: base } },
  { label: 'Últimos 30 dias', range: { start: shiftDay(base, -29), end: base } },
  { label: 'Este mês', range: { start: `${base.slice(0, 7)}-01`, end: monthEnd(base) } },
  { label: 'Mês anterior', range: prevMonth(base) },
  { label: 'Este ano', range: { start: `${base.slice(0, 4)}-01-01`, end: `${base.slice(0, 4)}-12-31` } },
]

const PRESET_DEFAULT = 'Últimos 30 dias'

const fullBR = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const canais = ['Todas', 'Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop']
const situacoes: ('Todos' | SaleStatus)[] = ['Todos', 'Recebido', 'A liberar', 'Em disputa', 'Devolvido']

type Pt = { x: number; y: number }

function linePath(points: Pt[]) {
  if (points.length < 2) return ''
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const mid = (current.x + next.x) / 2
    d += ` C${mid.toFixed(1)} ${current.y.toFixed(1)} ${mid.toFixed(1)} ${next.y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  return d
}

function areaPath(points: Pt[], height: number) {
  if (points.length < 2) return ''
  const last = points[points.length - 1]
  const first = points[0]
  return `${linePath(points)} L${last.x.toFixed(1)} ${height} L${first.x.toFixed(1)} ${height} Z`
}

export default function DashboardPage({
  onNavigate,
  live,
}: {
  onNavigate: (view: string) => void
  live?: LiveFeed
}) {
  const syncStatus = useAutoSyncStatus()
  const amazon = useAmazonSales(ALL_ORDERS_SINCE)
  const usingReal = amazon.status === 'live' || (amazon.status !== 'inicial' && amazon.sales.length > 0)
  const base = usingReal ? HOJE : DEMO_HOJE
  const periodPresets = useMemo(() => buildPresets(base), [base])

  const [query, setQuery] = useState('')
  const [presetLabel, setPresetLabel] = useState(PRESET_DEFAULT)
  const [custom, setCustom] = useState<Range | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Range>({ start: shiftDay(DEMO_HOJE, -2), end: DEMO_HOJE })
  const [canal, setCanal] = useState(canais[0])
  const [situacao, setSituacao] = useState<'Todos' | SaleStatus>('Todos')
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    setCustom(null)
    setPresetLabel(PRESET_DEFAULT)
    setDraft({ start: shiftDay(base, -2), end: base })
  }, [base])

  const refresh = amazon.refresh
  useEffect(() => {
    if (syncStatus.lastSyncAt) refresh()
  }, [syncStatus.lastSyncAt, refresh])

  const periodo: Range = custom ?? periodPresets.find((item) => item.label === presetLabel)!.range
  const triggerLabel = custom ? `${fullBR(custom.start)} — ${fullBR(custom.end)}` : presetLabel

  const applyPreset = (label: string) => {
    const found = periodPresets.find((item) => item.label === label)!
    setPresetLabel(label)
    setCustom(null)
    setDraft(found.range)
    setOpen(false)
  }

  const applyCustom = () => {
    if (!draft.start || !draft.end) return
    const start = draft.start <= draft.end ? draft.start : draft.end
    const end = draft.start <= draft.end ? draft.end : draft.start
    setCustom({ start, end })
    setOpen(false)
  }

  const source = usingReal ? amazon.sales : demoSales
  const hasFinancials = source.some((sale) => !sale.partial)

  const filtered = useMemo(() => {
    return source.filter((sale) => {
      const okPeriodo = sale.date >= periodo.start && sale.date <= periodo.end
      const okCanal = canal === 'Todas' || sale.channel === canal
      const okSituacao = situacao === 'Todos' || sale.status === situacao
      return okPeriodo && okCanal && okSituacao
    })
  }, [source, periodo, canal, situacao])

  const kpi = useMemo(() => {
    const acc = filtered.reduce(
      (sum, sale) => ({
        gross: sum.gross + sale.gross,
        net: sum.net + sale.net,
        cost: sum.cost + sale.cost,
        ads: sum.ads + sale.ads,
        units: sum.units + sale.qty,
        orders: sum.orders + 1,
      }),
      { gross: 0, net: 0, cost: 0, ads: 0, units: 0, orders: 0 },
    )
    const lucroBruto = acc.net - acc.cost
    const lucroPosAds = lucroBruto - acc.ads
    const ratio = (value: number) => (acc.gross > 0 ? (value / acc.gross) * 100 : 0)
    return {
      faturamento: acc.gross,
      liquido: acc.net,
      lucroBruto,
      margem: ratio(lucroBruto),
      vendas: acc.orders,
      unidades: acc.units,
      ticket: acc.orders > 0 ? acc.gross / acc.orders : 0,
      roi: acc.ads > 0 ? (lucroPosAds / acc.ads) * 100 : 0,
      ads: acc.ads,
      tacos: ratio(acc.ads),
      lucroPosAds,
      mpa: ratio(lucroPosAds),
    }
  }, [filtered])

  const daily = useMemo(() => {
    const acc = new Map<string, { revenue: number; net: number; profit: number }>()
    filtered.forEach((sale) => {
      const current = acc.get(sale.date) ?? { revenue: 0, net: 0, profit: 0 }
      current.revenue += sale.gross
      current.net += sale.net
      current.profit += sale.profit
      acc.set(sale.date, current)
    })
    return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, ...value }))
  }, [filtered])

  const dates = filtered.map((sale) => sale.date).sort()
  const range = dates.length
    ? `${fullBR(dates[0])} a ${fullBR(dates[dates.length - 1])}`
    : 'sem movimento no período'

  const channelMix = useMemo(() => {
    const acc = new Map<string, { revenue: number; profit: number }>()
    filtered.forEach((sale) => {
      const current = acc.get(sale.channel) ?? { revenue: 0, profit: 0 }
      current.revenue += sale.gross
      current.profit += sale.profit
      acc.set(sale.channel, current)
    })
    const total = [...acc.values()].reduce((sum, item) => sum + item.revenue, 0)
    return [...acc.entries()]
      .map(([channel, value]) => ({
        channel,
        revenue: value.revenue,
        profit: value.profit,
        share: total > 0 ? Math.round((value.revenue / total) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filtered])

  const peak = daily.reduce<{ date: string; revenue: number } | null>(
    (best, item) => (best && best.revenue >= item.revenue ? best : { date: item.date, revenue: item.revenue }),
    null,
  )
  const weakest = hasFinancials
    ? filtered
        .filter((sale) => sale.gross > 0)
        .reduce<Sale | null>((worst, sale) => (worst && worst.margin <= sale.margin ? worst : sale), null)
    : null

  const width = 900
  const height = 260
  const maxRevenue = Math.max(...daily.map((item) => item.revenue), 1)
  const toPoints = (key: 'revenue' | 'net' | 'profit'): Pt[] =>
    daily.map((item, index) => ({
      x: daily.length > 1 ? (index / (daily.length - 1)) * width : width / 2,
      y: height - (item[key] / maxRevenue) * (height - 18),
    }))

  const visibleSales = filtered
    .filter((sale) => `${sale.id} ${sale.product} ${sale.channel}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)

  const livePendingIds = new Set((live?.pending ?? []).map((sale) => sale.id))
  const filteredIds = new Set(filtered.map((sale) => sale.id))
  const liveRows = (live?.sales ?? [])
    .filter((sale) => {
      const day = sale.purchasedAt.slice(0, 10)
      const inPeriod = day >= periodo.start && day <= periodo.end
      const matchesQuery = `${sale.id} ${sale.product ?? ''}`.toLowerCase().includes(query.toLowerCase())
      return !filteredIds.has(sale.id) && inPeriod && matchesQuery
    })
    .slice(0, 3)

  const pendingFees = 'aguardando a liberação de Fees'
  const pendingAds = 'aguardando a API de Ads'

  const kpis: { label: string; value: string; hint: string; tone?: 'positive' | 'attention'; info?: string }[] = [
    { label: 'Faturamento', value: brl(kpi.faturamento), hint: 'vendas brutas aprovadas', info: 'Soma dos valores de venda antes de taxas, impostos e custos.' },
    { label: 'Líq. do Marketplace', value: hasFinancials ? brl(kpi.liquido) : '—', hint: hasFinancials ? 'após comissões e impostos' : pendingFees, info: 'Valor que o marketplace repassa depois das taxas e impostos.' },
    { label: 'Lucro Bruto', value: hasFinancials ? brl(kpi.lucroBruto) : '—', hint: hasFinancials ? 'líquido menos custo do produto' : pendingFees, tone: hasFinancials ? 'positive' : undefined, info: 'Líquido do marketplace subtraído do custo dos produtos vendidos.' },
    { label: 'Margem', value: hasFinancials ? pct(kpi.margem) : '—', hint: hasFinancials ? 'sobre o faturamento bruto' : pendingFees, info: 'Lucro bruto dividido pelo faturamento bruto.' },
    { label: 'Número de Vendas', value: num(kpi.vendas), hint: 'pedidos no recorte', info: 'Quantidade de pedidos aprovados no período filtrado.' },
    { label: 'Número de Unidades Vendidas', value: num(kpi.unidades), hint: 'itens despachados', info: 'Soma das quantidades de todos os itens vendidos.' },
    { label: 'Ticket Médio', value: brl(kpi.ticket), hint: 'faturamento por pedido', info: 'Faturamento bruto dividido pelo número de vendas.' },
    { label: 'Retorno Sobre Investimento', value: hasFinancials ? pct(kpi.roi) : '—', hint: hasFinancials ? 'lucro em relacao ao Ads' : pendingAds, tone: hasFinancials ? (kpi.roi >= 100 ? 'positive' : 'attention') : undefined, info: 'Lucro pós-Ads dividido pelo investimento em Ads.' },
    { label: 'Valor em Ads', value: hasFinancials ? brl(kpi.ads) : '—', hint: hasFinancials ? 'investimento em anúncios' : pendingAds, info: 'Soma do gasto com campanhas pagas no período.' },
    { label: 'TACOS', value: hasFinancials ? pct(kpi.tacos) : '—', hint: hasFinancials ? 'Ads sobre faturamento' : pendingAds, tone: hasFinancials ? (kpi.tacos <= 10 ? 'positive' : 'attention') : undefined, info: 'Total de Ads dividido pelo faturamento bruto.' },
    { label: 'Lucro bruto pós ADS', value: hasFinancials ? brl(kpi.lucroPosAds) : '—', hint: hasFinancials ? 'descontado o investimento' : pendingAds, tone: hasFinancials ? 'positive' : undefined, info: 'Lucro bruto depois de subtrair o investimento em Ads.' },
    { label: 'MPA', value: hasFinancials ? pct(kpi.mpa) : '—', hint: hasFinancials ? 'margem depois do Ads' : pendingAds, tone: hasFinancials ? 'positive' : undefined, info: 'Margem pós-Ads: lucro pós-Ads sobre o faturamento bruto.' },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Visão consolidada"
        title={
          <>
            Seu negócio está <em>ganhando ritmo.</em>
          </>
        }
        description="Do faturamento ao MPA em um só painel, com filtros que recalculam todos os indicadores."
        action={
          <button className="primary" onClick={() => onNavigate('Financeiro')}>
            Ver DRE completo
          </button>
        }
      />

      <div
        className={`data-mode ${amazon.status === 'inicial' ? 'is-loading' : amazon.status === 'live' ? 'is-live' : 'is-demo'}`}
      >
        {amazon.status === 'inicial' && <>Lendo pedidos reais da Amazon…</>}
        {amazon.status === 'live' && (
          <>
            <b>Dados reais da Amazon.</b> {amazon.message} · atualizado às{' '}
            {new Date(amazon.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </>
        )}
        {amazon.status !== 'inicial' && amazon.status !== 'live' && (
          <>
            <b>{usingReal ? 'Dados reais da última leitura.' : 'Modo demonstração.'}</b> {amazon.message}
            {amazon.hint ? ` · ${amazon.hint}` : ''}
          </>
        )}
      </div>

      <section className="dashboard-filters">
        <span className="range-chip">{range}</span>
        <div className="filter-row">
          <div className="period-picker" ref={pickerRef}>
            <button type="button" className="select-box period-trigger" onClick={() => setOpen((value) => !value)}>
              <span className="filter-label">Período</span>
              <span className="trigger-value">
                <CalendarDays size={14} />
                {triggerLabel}
                <ChevronDown size={14} className={open ? 'chevron up' : 'chevron'} />
              </span>
            </button>

            {open && (
              <div className="period-pop">
                <p className="pop-title">Período personalizado</p>
                <div className="period-presets">
                  {periodPresets.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={!custom && presetLabel === item.label ? 'active' : ''}
                      onClick={() => applyPreset(item.label)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="period-fields">
                  <label>
                    <span>Início</span>
                    <input
                      type="date"
                      value={draft.start}
                      onChange={(event) => setDraft((value) => ({ ...value, start: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input
                      type="date"
                      value={draft.end}
                      onChange={(event) => setDraft((value) => ({ ...value, end: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="period-foot">
                  <span className="period-hint">navegue por meses e anos no calendário</span>
                  <div className="period-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setCustom(null)
                        setPresetLabel(PRESET_DEFAULT)
                        setDraft(periodPresets[2].range)
                        setOpen(false)
                      }}
                    >
                      Limpar
                    </button>
                    <button type="button" className="primary" onClick={applyCustom}>
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <label className="select-box">
            <span className="filter-label">Canal</span>
            <select value={canal} onChange={(event) => setCanal(event.target.value)}>
              {canais.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="select-box">
            <span className="filter-label">Situação</span>
            <select value={situacao} onChange={(event) => setSituacao(event.target.value as SaleStatus)}>
              {situacoes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="metrics kpi-grid">
        {kpis.map((item) => (
          <StatTile
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            tone={item.tone}
            info={item.info}
          />
        ))}
      </section>

      <Panel title="Resumo de Receitas" hint="Movimento diário" className="revenue-panel">
        <div className="chart chart-wide">
          <div className="y-labels">
            {[maxRevenue, maxRevenue * 0.66, maxRevenue * 0.33, 0].map((value) => (
              <span key={value}>{brlShort(value)}</span>
            ))}
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Resumo diário de receitas, líquido e lucro">
            <path className="area area-revenue" d={areaPath(toPoints('revenue'), height)} />
            {hasFinancials && <path className="area area-net" d={areaPath(toPoints('net'), height)} />}
            {hasFinancials && <path className="area area-profit" d={areaPath(toPoints('profit'), height)} />}
            <path className="revenue-line" d={linePath(toPoints('revenue'))} />
            {hasFinancials && <path className="profit-line" d={linePath(toPoints('profit'))} />}
          </svg>
          <div className="chart-labels">
            {daily.map((item) => (
              <span key={item.date}>{dateBR(item.date)}</span>
            ))}
          </div>
        </div>
        <div className="legend">
          <span>
            <i className="revenue-dot" /> Faturamento
          </span>
          {hasFinancials && (
            <span>
              <i className="net-dot" /> Líquido do marketplace
            </span>
          )}
          {hasFinancials && (
            <span>
              <i className="profit-dot" /> Lucro
            </span>
          )}
          <span className="synced">
            {daily.length} dias ·{' '}
            {usingReal
              ? `atualizado ${new Date(amazon.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'base de demonstração'}
          </span>
        </div>
      </Panel>

      <section className="two-col">
        <Panel title="Próximas ações" hint="Atenção requerida" className="focus-panel">
          <div className="action-list">
            {priorities.map((item, index) => (
              <div key={item.title}>
                <span className={`action-icon ${item.tone}`}>
                  {index === 0 ? <ReceiptText size={18} /> : index === 1 ? <PackageSearch size={18} /> : <Boxes size={18} />}
                </span>
                <p>
                  <b>{item.title}</b>
                  <small>{item.detail}</small>
                </p>
                <button onClick={() => onNavigate(index === 0 ? 'Financeiro' : index === 1 ? 'Catálogo' : 'Operação')}>
                  {item.count}
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Participação por canal" hint="Faturamento e lucro">
          <div className="bars">
            {channelMix.map((item) => (
              <div key={item.channel} className="bar-row campaign">
                <span>{item.channel}</span>
                <div className="dual-track">
                  <i className="bar-sales" style={{ width: `${item.share * 2}%` }} />
                  <i
                    className="bar-spend"
                    style={{ width: `${item.revenue > 0 ? (item.profit / item.revenue) * item.share * 2 : 0}%` }}
                  />
                </div>
                <b>{pct(item.share, 0)}</b>
              </div>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="revenue-dot" /> Faturamento
            </span>
            <span>
              <i className="profit-dot" /> Lucro
            </span>
            <span className="synced">{num(filtered.length)} pedidos no recorte</span>
          </div>
        </Panel>
      </section>

      <Panel title="Vendas recentes" hint="Acompanhamento diário" className="sales-panel">
        <label className="search-box standalone">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido ou produto" />
        </label>
        <div className="table-scroll flush">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Produto</th>
                <th>Canal</th>
                <th>Venda</th>
                <th>Lucro</th>
                <th>Margem</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {liveRows.map((sale) => (
                <tr
                  key={sale.id}
                  className={livePendingIds.has(sale.id) ? 'clickable row-new' : 'clickable'}
                  onClick={() => onNavigate('Vendas')}
                >
                  <td className="order">{sale.id}</td>
                  <td>
                    <b>{sale.product ?? 'Pedido na Amazon'}</b>
                    <span className="live-flag">
                      <i /> Ao vivo
                    </span>
                  </td>
                  <td>
                    <span className="channel">Amazon</span>
                  </td>
                  <td>{brl(sale.amount)}</td>
                  <td className="profit">—</td>
                  <td>—</td>
                  <td>
                    <span className="tag tag-info">{sale.status}</span>
                  </td>
                </tr>
              ))}
              {visibleSales.map((sale) => (
                <tr
                  key={sale.id}
                  className={livePendingIds.has(sale.id) ? 'clickable row-new' : 'clickable'}
                  onClick={() => onNavigate('Vendas')}
                >
                  <td className="order">{sale.id}</td>
                  <td>
                    <b>{sale.product}</b>
                    <small className="sub">{sale.qty === 1 ? '1 unidade' : `${sale.qty} unidades`}</small>
                    {livePendingIds.has(sale.id) && (
                      <span className="live-flag">
                        <i /> Ao vivo
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="channel">{sale.channel}</span>
                  </td>
                  <td>{brl(sale.gross)}</td>
                  <td className="profit">{sale.partial ? '—' : brl(sale.profit)}</td>
                  <td>{sale.partial ? '—' : pct(sale.margin)}</td>
                  <td>
                    <span className={`tag ${sale.status === 'Recebido' ? 'tag-ok' : 'tag-info'}`}>{sale.status}</span>
                  </td>
                </tr>
              ))}
              {visibleSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nenhum pedido nos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="notice">
        <CircleHelp size={18} />
        <div>
          <b>Como ler este painel</b>
          <p>
            Os 12 indicadores são recalculados a cada filtro e vêm dos pedidos reais da Amazon quando o proxy está no ar.
            Indicadores marcados com “—” aguardam a liberação das APIs de Fees e Ads pela Amazon — clique em qualquer
            linha para abrir o pedido na página de vendas.
          </p>
        </div>
        <button className="ghost" onClick={() => onNavigate('Análises')}>
          <Info size={15} /> Abrir análises
        </button>
      </section>

      <section className="footnote metrics-note">
        <span>
          <ArrowUpRight size={14} /> Pico de receita em {peak ? dateBR(peak.date) : '—'} com{' '}
          {peak ? brl(peak.revenue) : brl(0)}
        </span>
        <span>
          <ArrowDownRight size={14} />{' '}
          {hasFinancials
            ? weakest
              ? `Menor margem em ${weakest.product}`
              : 'Sem margem calculada no recorte'
            : 'Lucro e margem aguardam a liberação de Fees'}
        </span>
      </section>
    </>
  )
}
