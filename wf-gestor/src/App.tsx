import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Boxes,
  ChevronDown,
  LayoutDashboard,
  LineChart,
  PackageSearch,
  Plug,
  Settings,
  ShoppingBag,
  WalletCards,
} from 'lucide-react'
import DashboardPage from './pages/DashboardPage'
import SalesPage from './pages/SalesPage'
import CatalogPage from './pages/CatalogPage'
import FinancePage from './pages/FinancePage'
import AnalyticsPage from './pages/AnalyticsPage'
import OperationsPage from './pages/OperationsPage'
import IntegrationsPage from './pages/IntegrationsPage'
import SettingsPage from './pages/SettingsPage'
import LiveToast from './components/LiveToast'
import { brl } from './data'
import {
  describeSync,
  loadAppDb,
  startAutoSync,
  useAutoSyncStatus,
  useLiveSales,
  useMinuteTick,
  type LiveSale,
  type LiveStatus,
} from './integrations'

type View =
  | 'Visão geral'
  | 'Vendas'
  | 'Catálogo'
  | 'Financeiro'
  | 'Análises'
  | 'Operação'
  | 'Integrações'
  | 'Configurações'

const nav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Vendas', icon: ShoppingBag },
  { label: 'Catálogo', icon: PackageSearch },
  { label: 'Financeiro', icon: WalletCards },
  { label: 'Análises', icon: LineChart },
  { label: 'Operação', icon: Boxes },
  { label: 'Integrações', icon: Plug },
]

const liveLabels: Record<LiveStatus, string> = {
  inicial: 'Conectando…',
  live: 'Ao vivo',
  'sem-proxy': 'Proxy off',
  'aguardando-credenciais': 'Sem credenciais',
  erro: 'Erro de conexão',
}

const hora = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const hoje = new Date().toDateString() === date.toDateString()
  return hoje
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function App() {
  const [view, setView] = useState<View>('Visão geral')
  const live = useLiveSales(30000)
  const sync = useAutoSyncStatus()
  useMinuteTick()
  const [panelOpen, setPanelOpen] = useState(false)
  const [toasts, setToasts] = useState<LiveSale[]>([])
  const notified = useRef<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const acknowledgeRef = useRef(live.acknowledge)
  acknowledgeRef.current = live.acknowledge

  const goVendas = () => {
    setView('Vendas')
    setPanelOpen(false)
    setToasts([])
    live.acknowledge()
  }

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((sale) => sale.id !== id))
    live.acknowledge(id)
  }

  useEffect(() => {
    const cutoff = Date.now() - 48 * 3600000
    const fresh = live.pending.filter(
      (sale) => !notified.current.has(sale.id) && Date.parse(sale.purchasedAt) >= cutoff,
    )
    if (!fresh.length) return
    fresh.forEach((sale) => notified.current.add(sale.id))
    setToasts((prev) => [...fresh, ...prev].slice(0, 3))
  }, [live.pending])

  useEffect(() => {
    if (!toasts.length) return
    const timer = window.setTimeout(() => {
      const oldest = toasts[toasts.length - 1]
      setToasts((prev) => prev.filter((sale) => sale.id !== oldest.id))
      acknowledgeRef.current(oldest.id)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [toasts])

  useEffect(() => {
    if (!panelOpen) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (panelRef.current?.contains(target)) return
      if (bellRef.current?.contains(target)) return
      setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [panelOpen])

  useEffect(() => {
    void loadAppDb().finally(() => startAutoSync())
  }, [])

  const syncTone = sync.running
    ? 'inicial'
    : !sync.enabled
      ? 'sem-proxy'
      : sync.ok === false
        ? 'erro'
        : sync.ok === true
          ? 'live'
          : 'inicial'
  const syncTitle = [sync.message, sync.hint].filter(Boolean).join(' · ') || 'Sincronização automática com a Amazon'

  const render = () => {
    switch (view) {
      case 'Vendas':
        return <SalesPage />
      case 'Catálogo':
        return <CatalogPage />
      case 'Financeiro':
        return <FinancePage />
      case 'Análises':
        return <AnalyticsPage />
      case 'Operação':
        return <OperationsPage />
      case 'Integrações':
        return <IntegrationsPage />
      case 'Configurações':
        return <SettingsPage />
      default:
        return (
          <DashboardPage
            onNavigate={(next) => setView(next as View)}
            live={{ sales: live.sales, pending: live.pending }}
          />
        )
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#top" onClick={() => setView('Visão geral')}>
          <span>WF</span>
          <b>Gestor</b>
        </a>

        <div className="workspace">
          <span className="workspace-dot">A</span>
          <div>
            <small>Loja conectada</small>
            <b>Amazon.com.br</b>
          </div>
        </div>

        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button className={view === label ? 'active' : ''} key={label} onClick={() => setView(label)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className={view === 'Configurações' ? 'active' : ''} onClick={() => setView('Configurações')}>
            <Settings size={18} />
            Configurações
          </button>
          <div className="profile">
            <span>WF</span>
            <div>
              <b>Wanderson F.</b>
              <small>Administrador</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <section className="content" id="top">
        <header>
          <span className="channel-picker">
            <span className="all-channels">AM</span> Amazon.com.br
          </span>
          <div className="header-tools">
            <span className={`live-chip status-${live.status}`} title={live.message}>
              <i />
              {liveLabels[live.status]}
            </span>
            <button
              ref={bellRef}
              className={panelOpen ? 'icon-button bell-active' : 'icon-button'}
              aria-label={
                live.pending.length
                  ? `Notificações: ${live.pending.length} vendas novas`
                  : 'Notificações'
              }
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((open) => !open)}
            >
              <Bell size={19} />
              {live.pending.length > 0 ? (
                <i className="bell-badge">{live.pending.length > 9 ? '9+' : live.pending.length}</i>
              ) : (
                <i />
              )}
            </button>
            <span className={`live-chip status-${syncTone}`} title={syncTitle}>
              <i />
              {describeSync(sync)}
            </span>
          </div>
          {panelOpen && (
            <div className="live-panel" ref={panelRef}>
              <div className="live-panel-head">
                <div>
                  <span className="eyebrow">Amazon SP-API</span>
                  <h3>Vendas ao vivo</h3>
                </div>
                <span className={`live-chip status-${live.status}`} title={live.message}>
                  <i />
                  {liveLabels[live.status]}
                </span>
              </div>
              <p className="live-panel-status">
                {live.message}
                {live.updatedAt
                  ? ` · atualizado às ${hora(new Date(live.updatedAt).toISOString())}`
                  : ''}
              </p>
              <ul>
                {live.sales.slice(0, 8).map((sale) => (
                  <li
                    key={sale.id}
                    className={live.pending.some((item) => item.id === sale.id) ? 'is-new' : ''}
                  >
                    <div>
                      <b>{sale.product ?? 'Pedido na Amazon'}</b>
                      <small>
                        {hora(sale.purchasedAt)} · {sale.status}
                      </small>
                    </div>
                    <strong>{brl(sale.amount)}</strong>
                  </li>
                ))}
                {!live.sales.length && (
                  <li className="empty">Nenhum pedido nas últimas 48 horas.</li>
                )}
              </ul>
              <div className="live-panel-foot">
                <button
                  className="ghost"
                  onClick={() => live.acknowledge()}
                  disabled={!live.pending.length}
                >
                  Marcar como lidas
                </button>
                <button className="primary" onClick={goVendas}>
                  Ver vendas
                </button>
              </div>
            </div>
          )}
        </header>
        <div className="page" key={view}>
          {render()}
        </div>
      </section>

      <LiveToast sales={toasts} onOpen={goVendas} onClose={closeToast} />
    </main>
  )
}
