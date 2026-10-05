import { useState } from 'react'
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

type View =
  | 'Visão geral'
  | 'Vendas'
  | 'Catálogo'
  | 'Financeiro'
  | 'Análises'
  | 'Operação'
  | 'Integrações'

const nav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Vendas', icon: ShoppingBag },
  { label: 'Catálogo', icon: PackageSearch },
  { label: 'Financeiro', icon: WalletCards },
  { label: 'Análises', icon: LineChart },
  { label: 'Operação', icon: Boxes },
  { label: 'Integrações', icon: Plug },
]

export default function App() {
  const [view, setView] = useState<View>('Visão geral')

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
      default:
        return <DashboardPage onNavigate={(next) => setView(next as View)} />
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
          <span className="workspace-dot">N</span>
          <div>
            <small>Empresa ativa</small>
            <b>Nuvem Casa & Cia</b>
          </div>
          <ChevronDown size={15} />
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
          <button>
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
          <button className="channel-picker">
            <span className="all-channels">+</span> Todos os canais <ChevronDown size={15} />
          </button>
          <div className="header-tools">
            <button className="icon-button" aria-label="Notificações">
              <Bell size={19} />
              <i />
            </button>
            <span className="period">01 mai - 30 mai 2026</span>
          </div>
        </header>
        <div className="page" key={view}>
          {render()}
        </div>
      </section>
    </main>
  )
}
