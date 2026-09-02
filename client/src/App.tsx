import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { Activity, AlertTriangle, BadgeDollarSign, Banknote, Box, Boxes, CalendarDays, CheckCircle, CreditCard, FileText, Gauge, LayoutDashboard, Menu, Pencil, Plus, Search, Settings, ShoppingCart, Sparkles, Trash2, Truck, Users, Wrench, X } from 'lucide-react'
import { api } from './services/api'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'
import type { FinancialEntry, FinancialEntryType, PaymentMethod, Product, PurchaseOrder, PurchaseOrderStatus, ServiceOrder, ServiceOrderStatus } from './lib/types'
import { completeSale, consumePartInServiceOrder, createCustomer, createFinancialEntry, createProduct, createServiceOrder, createSupplier, cancelFinancialEntry, deleteProduct, deleteSupplier, payFinancialEntry, adjustStock, updateProduct, updateServiceOrderStatus } from './services/operations'

type Page = 'dashboard' | 'pdv' | 'orders' | 'customers' | 'products' | 'stock' | 'financial' | 'purchases' | 'guarantees' | 'reports' | 'settings'
type CartLine = { product: Product; quantity: number }

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currency = (value: number) => money.format(value)
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const dayKey = (value: Date | string) => { const d = typeof value === 'string' ? new Date(value) : value; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const today = () => dayKey(new Date())
const daysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days + 1); return dayKey(d) }

const pageMeta: Record<Page, { label: string; icon: typeof LayoutDashboard }> = {
  dashboard: { label: 'Visao geral', icon: LayoutDashboard }, pdv: { label: 'Ponto de venda', icon: ShoppingCart }, orders: { label: 'Ordens de servico', icon: Wrench }, customers: { label: 'Clientes', icon: Users }, products: { label: 'Produtos', icon: Box }, stock: { label: 'Estoque', icon: Boxes }, financial: { label: 'Financeiro', icon: BadgeDollarSign }, purchases: { label: 'Compras', icon: Truck }, guarantees: { label: 'Garantias', icon: Box }, reports: { label: 'Relatorios', icon: FileText }, settings: { label: 'Configuracoes', icon: Settings },
}

function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>([] as unknown as T)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => { setLoading(true); fetcher().then(setData).catch(() => {}).finally(() => setLoading(false)) }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading, reload }
}

function App() {
  const { user, loading: authLoading, logout } = useAuth()
  const [page, setPage] = useState<Page>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); setPage('pdv') }
      if (event.key === 'F7') { event.preventDefault(); setPage('stock') }
      if (event.key === 'F8') { event.preventDefault(); setPage('orders') }
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  }, [])

  if (authLoading) return <div className="login-page"><div className="login-card"><span>Carregando...</span></div></div>
  if (!user) return <Login />

  const meta = pageMeta[page]
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Wrench size={19} /></div>
          <div><strong>AMARO IPHONE</strong><span>GESTAO ONLINE</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav>
          {(Object.keys(pageMeta) as Page[]).map((key) => {
            const item = pageMeta[key]; const Icon = item.icon
            return <button key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(key); setMenuOpen(false) }}><Icon size={18} />{item.label}</button>
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="connection online"><Activity size={13} />ONLINE</span>
          <p>{user.name}</p>
          <button className="text-button" onClick={logout}>Sair</button>
        </div>
      </aside>
      {menuOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div><span className="eyebrow">OPERACAO ONLINE</span><h1>{meta.label}</h1></div>
          <div className="topbar-status"><span className="status-pill online"><i />Online</span></div>
        </header>
        <section className="content">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'pdv' && <PointOfSale />}
          {page === 'orders' && <ServiceOrdersPage />}
          {page === 'customers' && <CustomersPage />}
          {page === 'products' && <ProductsPage />}
          {page === 'stock' && <StockPage />}
          {page === 'financial' && <FinancialPage />}
          {page === 'purchases' && <PurchasesPage />}
          {page === 'guarantees' && <GuaranteesPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'settings' && <SettingsPage onNavigate={setPage} />}
        </section>
      </main>
    </div>
  )
}

function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { data: sales, reload } = useApiData(() => api.sales.list(), [])
  const { data: orders } = useApiData(() => api.serviceOrders.list(), [])
  const { data: products } = useApiData(() => api.products.list(), [])
  const [periodStart, setPeriodStart] = useState(today())
  const [periodEnd, setPeriodEnd] = useState(today())
  const [rangeDays, setRangeDays] = useState<number | undefined>()
  const hasCustomRange = !rangeDays && periodStart !== periodEnd
  const periodLabel = rangeDays ? `Ultimos ${rangeDays} dias` : hasCustomRange ? `${periodStart.split('-').reverse().join('/')} a ${periodEnd.split('-').reverse().join('/')}` : periodEnd.split('-').reverse().join('/')
  const salesForDay = sales.filter((s) => { const d = dayKey(s.createdAt); return s.status === 'completed' && d >= periodStart && d <= periodEnd })
  const salesToday = salesForDay.reduce((sum, s) => sum + s.total, 0)
  const grossProfit = salesForDay.reduce((t, s) => t + s.total - s.items.reduce((c, i) => c + (i.unitCost ?? 0) * i.quantity, 0), 0)
  const grossMargin = salesToday ? grossProfit / salesToday * 100 : 0
  const lowStock = products.filter((p) => p.stockQty <= p.minStock)
  const cards = [
    { label: rangeDays || hasCustomRange ? 'Faturamento do periodo' : 'Faturamento do dia', value: currency(salesToday), note: `${salesForDay.length} venda${salesForDay.length === 1 ? '' : 's'} · ${periodLabel}` },
    { label: 'Lucro bruto', value: currency(grossProfit), note: `Margem: ${grossMargin.toFixed(1).replace('.', ',')}%` },
    { label: 'OS em andamento', value: String(orders.filter((o) => !['Entregue', 'Pronto para entrega'].includes(o.status)).length), note: `${orders.filter((o) => o.status === 'Aguardando aprovacao').length} aguardando aprovacao` },
  ]
  return (
    <>
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <span className="welcome-kicker"><Sparkles size={14} />CENTRAL DE COMANDO</span>
          <h2>Operacao sob controle, sem perder o ritmo.</h2>
          <p>Acompanhe vendas, rentabilidade e alertas da sua loja em tempo real.</p>
        </div>
        <div className="active-period"><span>PERIODO ATIVO</span><strong>{periodLabel}</strong><small>{salesForDay.length} venda{salesForDay.length === 1 ? '' : 's'}</small></div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => onNavigate('orders')}><Wrench size={16} />Nova OS</button>
          <button className="primary-button" onClick={() => onNavigate('pdv')}><ShoppingCart size={16} />Nova venda <kbd>F2</kbd></button>
        </div>
      </div>
      <div className="metric-grid">
        {cards.map((card) => <article className="metric-card" key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}
      </div>
      <div className="dashboard-grid">
        <article className="panel activity-panel">
          <div className="panel-header">
            <div><span className="eyebrow">MOVIMENTO</span><h2>Vendas do periodo</h2></div>
            <div className="dashboard-filters">
              <div className="sales-date-filter">
                <CalendarDays size={16} />
                <label>De<input type="date" value={periodStart} max={periodEnd} onChange={(e) => { setPeriodStart(e.target.value); setRangeDays(undefined) }} /></label>
                <label>Ate<input type="date" value={periodEnd} min={periodStart} onChange={(e) => { setPeriodEnd(e.target.value); setRangeDays(undefined) }} /></label>
              </div>
              <div className="period-presets">{[7, 15, 30].map((days) => <button key={days} className={rangeDays === days ? 'active' : ''} onClick={() => { setRangeDays(days); setPeriodStart(daysAgo(days)); setPeriodEnd(today()) }}>{days}d</button>)}</div>
            </div>
          </div>
          {salesForDay.slice().reverse().map((sale) => (
            <div className="activity-row" key={sale.uuid}>
              <span className="document-mark">#{String(sale.number).padStart(4, '0')}</span>
              <div><strong>Venda concluida</strong><small>{formatDate(sale.createdAt)} · {sale.paymentMethod}</small></div>
              <b>{currency(sale.total)}</b>
              <button className="delete-product" title="Cancelar venda" onClick={async () => { if (window.confirm(`Cancelar venda #${String(sale.number).padStart(4, '0')}? O estoque sera devolvido.`)) { await api.sales.cancel(sale.uuid); reload() } }}><X size={15} /></button>
            </div>
          ))}
          {salesForDay.length === 0 && <Empty title="Nenhuma venda neste periodo" text="Escolha as datas ou conclua uma venda no PDV." />}
        </article>
        <article className="panel alert-panel">
          <div className="panel-header"><div><span className="eyebrow">ATENCAO</span><h2>Estoque para repor</h2></div></div>
          {lowStock.slice(0, 6).map((product) => (
            <div className="stock-alert" key={product.uuid}>
              <div className="product-symbol"><Box size={17} /></div>
              <div><strong>{product.name}</strong><small>Minimo: {product.minStock} {product.unit}</small></div>
              <b className={product.stockQty === 0 ? 'danger' : ''}>{product.stockQty} {product.unit}</b>
            </div>
          ))}
          {lowStock.length === 0 && <Empty title="Estoque sob controle" text="Nenhum produto abaixo do minimo." />}
        </article>
      </div>
    </>
  )
}

function PointOfSale() {
  const { data: products } = useApiData(() => api.products.list(), [])
  const { data: customers } = useApiData(() => api.customers.list(), [])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerUuid, setCustomerUuid] = useState('')
  const [discount, setDiscount] = useState(0)
  const [surcharge, setSurcharge] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const filtered = products.filter((p) => [p.name, p.code, p.sku, p.barcode].filter(Boolean).some((v) => v!.toLowerCase().includes(search.toLowerCase()))).slice(0, 9)
  const subtotal = cart.reduce((s, l) => s + l.product.salePrice * l.quantity, 0)
  const total = Math.max(0, subtotal - discount + surcharge)
  const addProduct = (product: Product) => {
    if (product.stockQty < 1) return setNotice(`${product.name} esta sem estoque.`)
    setCart((c) => { const f = c.find((l) => l.product.uuid === product.uuid); return f ? c.map((l) => l.product.uuid === product.uuid ? { ...l, quantity: Math.min(product.stockQty, l.quantity + 1) } : l) : [...c, { product, quantity: 1 }] })
    setSearch(''); setNotice('')
  }
  const finish = async () => {
    setBusy(true)
    try {
      const sale = await completeSale({ items: cart.map((l) => ({ productUuid: l.product.uuid, quantity: l.quantity })), customerUuid: customerUuid || undefined, discount, surcharge, paymentMethod })
      setCart([]); setDiscount(0); setSurcharge(0); setNotice(`Venda #${String(sale.number).padStart(4, '0')} concluida.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Nao foi possivel concluir a venda.') } finally { setBusy(false) }
  }
  return (
    <>
      <div className="pdv-header">
        <div><span className="eyebrow">PONTO DE VENDA</span><p>Rapido e online.</p></div>
        <select value={customerUuid} onChange={(e) => setCustomerUuid(e.target.value)}>
          <option value="">Consumidor final</option>
          {customers.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
        </select>
      </div>
      <div className="pdv-layout">
        <article className="panel product-finder">
          <label className="search-field"><Search size={18} /><input autoFocus placeholder="Nome, codigo, SKU ou codigo de barras" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <div className="product-results">
            {filtered.map((p) => <button key={p.uuid} className="product-result" onClick={() => addProduct(p)}><span><b>{p.name}</b><small>{p.code} · {p.stockQty} {p.unit}</small></span><strong>{currency(p.salePrice)}</strong><Plus size={17} /></button>)}
            {products.length === 0 && <Empty title="Cadastre produtos" text="Use o modulo Produtos." />}
          </div>
        </article>
        <article className="panel cart-panel">
          <div className="panel-header"><div><span className="eyebrow">CARRINHO</span><h2>{cart.length} item{cart.length === 1 ? '' : 'ns'}</h2></div><button className="text-button" onClick={() => setCart([])}>Limpar</button></div>
          <div className="cart-lines">
            {cart.map((line) => (
              <div className="cart-line" key={line.product.uuid}>
                <div><strong>{line.product.name}</strong><small>{currency(line.product.salePrice)} cada</small></div>
                <div className="quantity">
                  <button onClick={() => setCart((c) => c.map((e) => e.product.uuid === line.product.uuid ? { ...e, quantity: Math.max(1, e.quantity - 1) } : e))}>−</button>
                  <b>{line.quantity}</b>
                  <button onClick={() => setCart((c) => c.map((e) => e.product.uuid === line.product.uuid ? { ...e, quantity: Math.min(line.product.stockQty, e.quantity + 1) } : e))}>+</button>
                </div>
                <b>{currency(line.product.salePrice * line.quantity)}</b>
                <button className="icon-button" onClick={() => setCart((c) => c.filter((e) => e.product.uuid !== line.product.uuid))}><Trash2 size={15} /></button>
              </div>
            ))}
            {cart.length === 0 && <Empty title="Carrinho vazio" text="Selecione um produto." />}
          </div>
          {cart.length > 0 && (
            <div className="checkout">
              <div className="checkout-adjustments">
                <label>Desconto R$<input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label>
                <label>Taxa R$<input type="number" min="0" step="0.01" value={surcharge} onChange={(e) => setSurcharge(Number(e.target.value))} /></label>
                <label>Pagamento<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>{(['Dinheiro', 'PIX', 'Debito', 'Credito', 'Crediario', 'Transferencia'] as PaymentMethod[]).map((m) => <option key={m}>{m}</option>)}</select></label>
              </div>
              <div className="total-line"><span>Total</span><strong>{currency(total)}</strong></div>
              <button className="primary-button checkout-button" onClick={finish} disabled={busy || !cart.length}>{busy ? 'Finalizando...' : 'Finalizar venda'}</button>
            </div>
          )}
        </article>
      </div>
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function CustomersPage() {
  const { data: customers, reload } = useApiData(() => api.customers.list(), [])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim()
    if (!name) return
    await createCustomer({ name, document: String(data.get('document') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? '') })
    reload(); event.currentTarget.reset(); setNotice('Cliente cadastrado.')
  }
  const visible = customers.filter((c) => [c.name, c.document, c.phone].some((v) => v?.toLowerCase().includes(query.toLowerCase())))
  return (
    <>
      <div className="split-page">
        <article className="panel form-panel">
          <div className="panel-header"><div><span className="eyebrow">CADASTRO RAPIDO</span><h2>Novo cliente</h2></div></div>
          <form onSubmit={submit}>
            <label>Nome completo<input name="name" required placeholder="Nome ou razao social" /></label>
            <div className="form-row"><label>CPF / CNPJ<input name="document" placeholder="Opcional" /></label><label>Telefone<input name="phone" placeholder="(00) 00000-0000" /></label></div>
            <label>E-mail<input type="email" name="email" placeholder="Opcional" /></label>
            <button className="primary-button" type="submit"><Plus size={16} />Cadastrar cliente</button>
          </form>
        </article>
        <article className="panel list-panel">
          <div className="panel-header"><div><span className="eyebrow">BASE DE DADOS</span><h2>{customers.length} clientes</h2></div><label className="mini-search"><Search size={16} /><input placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
          <div className="data-list">
            {visible.map((c) => (
              <div className="data-row" key={c.uuid}><span className="avatar">{c.name.slice(0, 1)}</span><div><strong>{c.name}</strong><small>{c.document || 'Sem doc.'} · {c.phone || 'Sem tel.'}</small></div><small>{formatDate(c.createdAt)}</small></div>
            ))}
            {!visible.length && <Empty title="Nenhum cliente" text="Cadastre o primeiro cliente." />}
          </div>
        </article>
      </div>
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function ProductsPage() {
  const { data: products, reload } = useApiData(() => api.products.list(), [])
  const [notice, setNotice] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | undefined>()
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim()
    if (!name) return
    await createProduct({ code: String(data.get('code') ?? '').trim() || `PRD-${Date.now()}`, sku: String(data.get('sku') ?? ''), barcode: String(data.get('barcode') ?? ''), name, category: String(data.get('category') ?? ''), cost: Number(data.get('cost') ?? 0), salePrice: Number(data.get('price') ?? 0), minStock: Number(data.get('minimum') ?? 0), unit: String(data.get('unit') ?? 'UN') })
    const initialStock = Number(data.get('stock') ?? 0)
    if (initialStock > 0) { const products = await api.products.list(); const last = products[products.length - 1]; if (last) await adjustStock(last.uuid, initialStock, 'Estoque inicial') }
    reload(); event.currentTarget.reset(); setNotice('Produto criado.')
  }
  return (
    <>
      <div className="split-page product-page">
        <article className="panel form-panel">
          <div className="panel-header"><div><span className="eyebrow">CATALOGO</span><h2>Novo produto</h2></div></div>
          <form onSubmit={submit}>
            <label>Nome<input name="name" required placeholder="Ex.: Tela iPhone 13" /></label>
            <div className="form-row"><label>Codigo interno<input name="code" placeholder="Gerado se vazio" /></label><label>SKU<input name="sku" /></label></div>
            <div className="form-row"><label>Custo<input name="cost" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Preco de venda<input name="price" type="number" min="0" step="0.01" defaultValue="0" /></label></div>
            <div className="form-row"><label>Estoque minimo<input name="minimum" type="number" min="0" step="1" defaultValue="0" /></label><label>Estoque inicial<input name="stock" type="number" min="0" step="1" defaultValue="0" /></label></div>
            <div className="form-row"><label>Unidade<select name="unit"><option>UN</option><option>PC</option><option>MT</option></select></label><label>Codigo de barras<input name="barcode" /></label></div>
            <button className="primary-button" type="submit"><Plus size={16} />Cadastrar produto</button>
          </form>
        </article>
        <article className="panel list-panel">
          <div className="panel-header"><div><span className="eyebrow">CATALOGO</span><h2>{products.length} produtos</h2></div></div>
          <div className="data-list">
            {products.map((p) => (
              <div className="product-admin-row" key={p.uuid}>
                <div className="product-symbol"><Box size={17} /></div>
                <div className="grow"><strong>{p.name}</strong><small>{p.code} · Venda: {currency(p.salePrice)}</small></div>
                <b className={p.stockQty <= p.minStock ? 'danger' : ''}>{p.stockQty} {p.unit}</b>
                <button className="edit-product" onClick={() => setEditingProduct(p)}><Pencil size={15} /></button>
                <button className="delete-product" onClick={async () => { if (window.confirm(`Excluir "${p.name}"?`)) { try { await deleteProduct(p.uuid); reload(); setNotice('Produto removido.') } catch (e: any) { setNotice('Erro ao excluir: ' + (e.message || 'desconhecido')) } } }}><Trash2 size={16} /></button>
              </div>
            ))}
            {!products.length && <Empty title="Catalogo vazio" text="Cadastre produtos." />}
          </div>
        </article>
      </div>
      {editingProduct && <EditProductModal product={editingProduct} onClose={() => setEditingProduct(undefined)} onMessage={setNotice} onReload={reload} />}
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function EditProductModal({ product, onClose, onMessage, onReload }: { product: Product; onClose: () => void; onMessage: (msg: string) => void; onReload: () => void }) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await updateProduct(product.uuid, { name: String(data.get('name') ?? ''), code: String(data.get('code') ?? ''), sku: String(data.get('sku') ?? ''), barcode: String(data.get('barcode') ?? ''), category: String(data.get('category') ?? ''), cost: Number(data.get('cost') ?? 0), salePrice: Number(data.get('price') ?? 0), minStock: Number(data.get('minimum') ?? 0), unit: String(data.get('unit') ?? 'UN') })
      onReload(); onClose(); onMessage('Produto atualizado.')
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Falha.') }
  }
  return (
    <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={onClose} />
      <article className="edit-product-modal">
        <div className="panel-header"><div><span className="eyebrow">EDITAR</span><h2>{product.name}</h2></div><button className="icon-button" onClick={onClose}><X size={17} /></button></div>
        <form onSubmit={submit}>
          <label>Nome<input name="name" required defaultValue={product.name} /></label>
          <div className="form-row"><label>Codigo<input name="code" defaultValue={product.code} /></label><label>SKU<input name="sku" defaultValue={product.sku} /></label></div>
          <div className="form-row"><label>Custo<input name="cost" type="number" min="0" step="0.01" defaultValue={product.cost} /></label><label>Preco<input name="price" type="number" min="0" step="0.01" defaultValue={product.salePrice} /></label></div>
          <div className="form-row"><label>Estoque minimo<input name="minimum" type="number" min="0" step="1" defaultValue={product.minStock} /></label><label>Unidade<select name="unit" defaultValue={product.unit}><option>UN</option><option>PC</option><option>MT</option></select></label></div>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Salvar</button></div>
        </form>
      </article>
    </div>
  )
}

function ServiceOrdersPage() {
  const { data: customers } = useApiData(() => api.customers.list(), [])
  const { data: orders, reload } = useApiData(() => api.serviceOrders.list(), [])
  const { data: products } = useApiData(() => api.products.list(), [])
  const [selected, setSelected] = useState<ServiceOrder | undefined>()
  const [notice, setNotice] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const customerUuid = String(data.get('customerUuid') ?? '')
    if (!customerUuid) return setNotice('Selecione o cliente.')
    const order = await createServiceOrder({ customerUuid, equipment: String(data.get('equipment') ?? ''), brand: String(data.get('brand') ?? ''), model: String(data.get('model') ?? ''), reportedIssue: String(data.get('issue') ?? ''), expectedDelivery: String(data.get('expectedDelivery') ?? '') || undefined, technician: String(data.get('technician') ?? '') })
    reload(); event.currentTarget.reset(); setSelected(order); setNotice(`OS #${String(order.number).padStart(4, '0')} aberta.`)
  }
  return (
    <>
      <div className="orders-layout">
        <article className="panel form-panel compact-form">
          <div className="panel-header"><div><span className="eyebrow">RECEPCAO</span><h2>Abrir OS</h2></div></div>
          <form onSubmit={submit}>
            <label>Cliente<select name="customerUuid" required><option value="">Selecione</option>{customers.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}</select></label>
            <label>Equipamento<input name="equipment" required placeholder="Ex.: iPhone 13" /></label>
            <div className="form-row"><label>Marca<input name="brand" /></label><label>Modelo<input name="model" /></label></div>
            <label>Defeito<textarea name="issue" required placeholder="Descreva o defeito" /></label>
            <div className="form-row"><label>Previsao<input name="expectedDelivery" type="date" /></label><label>Tecnico<input name="technician" /></label></div>
            <button className="primary-button" type="submit"><Plus size={16} />Abrir OS</button>
          </form>
        </article>
        <article className="panel list-panel order-list">
          <div className="panel-header"><div><span className="eyebrow">PAINEL</span><h2>{orders.length} OS</h2></div></div>
          <div className="data-list">
            {orders.slice().reverse().map((o) => (
              <button className={`order-row ${selected?.uuid === o.uuid ? 'selected' : ''}`} key={o.uuid} onClick={() => setSelected(o)}>
                <span className="document-mark">#{String(o.number).padStart(4, '0')}</span>
                <span className="grow"><b>{o.equipment}</b><small>{o.reportedIssue}</small></span>
                <span className="order-status">{o.status}</span>
              </button>
            ))}
            {!orders.length && <Empty title="Nenhuma OS" text="Registre a entrada de um equipamento." />}
          </div>
        </article>
        <article className="panel order-detail">
          {selected ? <OrderDetail order={selected} products={products} onMessage={setNotice} onReload={reload} /> : <Empty title="Selecione uma OS" text="Detalhes aparecerao aqui." />}
        </article>
      </div>
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function OrderDetail({ order, products, onMessage, onReload }: { order: ServiceOrder; products: Product[]; onMessage: (msg: string) => void; onReload: () => void }) {
  const [productUuid, setProductUuid] = useState('')
  const [quantity, setQuantity] = useState(1)
  const changeStatus = async (status: ServiceOrderStatus) => { await updateServiceOrderStatus(order.uuid, status); onReload(); onMessage('Status atualizado.') }
  const consume = async () => { if (!productUuid) return; try { await consumePartInServiceOrder(order.uuid, productUuid, quantity); setProductUuid(''); setQuantity(1); onReload(); onMessage('Peca consumida.') } catch (error) { onMessage(error instanceof Error ? error.message : 'Falha.') } }
  return (
    <div className="detail-content">
      <div><span className="eyebrow">OS #{String(order.number).padStart(4, '0')}</span><h2>{order.equipment}</h2><p>{order.reportedIssue}</p></div>
      <label>Status<select value={order.status} onChange={(e) => void changeStatus(e.target.value as ServiceOrderStatus)}>{['Entrada', 'Diagnostico', 'Aguardando aprovacao', 'Aguardando peca', 'Em reparo', 'Testes', 'Pronto para entrega', 'Entregue'].map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="detail-meta"><span>Tecnico: <b>{order.technician || 'Nao atribuido'}</b></span><span>Garantia: <b>{order.warrantyDays} dias</b></span><span>Total: <b>{currency(order.total)}</b></span></div>
      <div className="parts-box">
        <div className="panel-header"><div><span className="eyebrow">PECAS</span></div></div>
        {order.items.map((item, i) => <div className="part-line" key={i}><span>{item.quantity}x {item.name}</span><b>{currency(item.total)}</b></div>)}
        <div className="consume-part">
          <select value={productUuid} onChange={(e) => setProductUuid(e.target.value)}><option value="">Selecionar peca</option>{products.filter((p) => p.stockQty > 0).map((p) => <option key={p.uuid} value={p.uuid}>{p.name} ({p.stockQty})</option>)}</select>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <button className="secondary-button" disabled={!productUuid} onClick={consume}>Consumir</button>
        </div>
      </div>
    </div>
  )
}

function StockPage() {
  const { data: products } = useApiData(() => api.products.list(), [])
  return (
    <div className="stock-layout">
      <article className="panel stock-overview">
        <div className="panel-header"><div><span className="eyebrow">SALDOS</span><h2>Posicao de estoque</h2></div><span className="total-products">{products.length} SKUs</span></div>
        <div className="stock-table">
          <div className="table-header"><span>Produto</span><span>Disponivel</span><span>Minimo</span><span>Status</span></div>
          {products.map((p) => (
            <div className="table-row" key={p.uuid}>
              <span><b>{p.name}</b><small>{p.code}</small></span>
              <b>{p.stockQty} {p.unit}</b>
              <span>{p.minStock}</span>
              <span className={p.stockQty === 0 ? 'tag critical' : p.stockQty <= p.minStock ? 'tag warning' : 'tag'}>{p.stockQty === 0 ? 'Sem estoque' : p.stockQty <= p.minStock ? 'Repor' : 'Normal'}</span>
            </div>
          ))}
          {!products.length && <Empty title="Sem produtos" text="Cadastre produtos primeiro." />}
        </div>
      </article>
      <article className="panel movement-panel">
        <div className="panel-header"><div><span className="eyebrow">MOVIMENTACOES</span><h2>Historico</h2></div></div>
        <Empty title="Historico de movimentacoes" text="Entradas e vendas aparecerao aqui." />
      </article>
    </div>
  )
}

function FinancialPage() {
  const { data: entries, reload } = useApiData(() => api.financial.list(), [])
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'all' | FinancialEntryType>('all')
  const [payingEntry, setPayingEntry] = useState<FinancialEntry | undefined>()
  const [payAmount, setPayAmount] = useState('')
  const receivables = entries.filter((e) => e.type === 'receivable')
  const payables = entries.filter((e) => e.type === 'payable')
  const totalReceivable = receivables.reduce((s, e) => s + e.amount - e.paidAmount, 0)
  const totalPayable = payables.reduce((s, e) => s + e.amount - e.paidAmount, 0)
  const overdueCount = entries.filter((e) => e.status === 'overdue').length
  const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const description = String(data.get('description') ?? '').trim()
    if (!description) return
    await createFinancialEntry({ type: String(data.get('type')) as FinancialEntryType, description, amount: Number(data.get('amount') ?? 0), dueDate: String(data.get('dueDate')), supplierName: String(data.get('supplierName') ?? '') || undefined })
    reload(); event.currentTarget.reset(); setNotice('Conta registrada.')
  }
  const handlePay = async () => { if (!payingEntry || !Number(payAmount)) return; try { await payFinancialEntry(payingEntry.uuid, Number(payAmount), 'Dinheiro'); setPayingEntry(undefined); setPayAmount(''); reload(); setNotice('Pagamento registrado.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha.') } }
  const handleCancel = async (entry: FinancialEntry) => { if (!window.confirm(`Cancelar "${entry.description}"?`)) return; try { await cancelFinancialEntry(entry.uuid); reload(); setNotice('Cancelada.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha.') } }
  return (
    <>
      <div className="section-header"><div className="section-header-content"><div><span className="eyebrow">FINANCEIRO</span><h2>Contas a pagar e receber</h2></div>
        <div className="financial-summary">
          <div className="summary-pill receivable"><Banknote size={14} /><span>A receber</span><strong>{currency(totalReceivable)}</strong></div>
          <div className="summary-pill payable"><CreditCard size={14} /><span>A pagar</span><strong>{currency(totalPayable)}</strong></div>
          {overdueCount > 0 && <div className="summary-pill overdue"><AlertTriangle size={14} /><span>Vencidas</span><strong>{overdueCount}</strong></div>}
        </div>
      </div></div>
      <div className="financial-layout">
        <article className="panel form-panel">
          <div className="panel-header"><div><span className="eyebrow">LANCAMENTO</span><h2>Nova conta</h2></div></div>
          <form onSubmit={submit}>
            <label>Tipo<select name="type"><option value="receivable">A receber</option><option value="payable">A pagar</option></select></label>
            <label>Descricao<input name="description" required placeholder="Descricao" /></label>
            <div className="form-row"><label>Valor R$<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Vencimento<input name="dueDate" type="date" required /></label></div>
            <label>Fornecedor / Cliente<input name="supplierName" placeholder="Opcional" /></label>
            <button className="primary-button" type="submit"><Plus size={16} />Registrar</button>
          </form>
        </article>
        <article className="panel list-panel">
          <div className="panel-header"><div><span className="eyebrow">PENDENCIAS</span><h2>{filtered.length} conta{filtered.length === 1 ? '' : 's'}</h2></div>
            <div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas</button><button className={filter === 'receivable' ? 'active' : ''} onClick={() => setFilter('receivable')}>Receber</button><button className={filter === 'payable' ? 'active' : ''} onClick={() => setFilter('payable')}>Pagar</button></div>
          </div>
          <div className="data-list">
            {filtered.map((entry) => (
              <div className={`financial-row ${entry.status === 'overdue' ? 'overdue' : ''}`} key={entry.uuid}>
                <span className={entry.type === 'receivable' ? 'financial-icon receivable' : 'financial-icon payable'}>{entry.type === 'receivable' ? <Banknote size={16} /> : <CreditCard size={16} />}</span>
                <div><strong>{entry.description}</strong><small>Venc: {entry.dueDate.split('-').reverse().join('/')}</small></div>
                <div className="financial-amounts"><b>{currency(entry.amount)}</b>{entry.paidAmount > 0 && <small>Pago: {currency(entry.paidAmount)}</small>}</div>
                <span className={`tag ${entry.status}`}>{entry.status === 'paid' ? 'Quitada' : entry.status === 'overdue' ? 'Vencida' : entry.status === 'partial' ? 'Parcial' : 'Pendente'}</span>
                {entry.status !== 'paid' && <button className="edit-product" onClick={() => { setPayingEntry(entry); setPayAmount(String(entry.amount - entry.paidAmount)) }}><CheckCircle size={15} /></button>}
                <button className="delete-product" onClick={() => handleCancel(entry)}><Trash2 size={16} /></button>
              </div>
            ))}
            {!filtered.length && <Empty title="Nenhuma conta" text="Registre uma conta." />}
          </div>
        </article>
      </div>
      {payingEntry && (
        <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setPayingEntry(undefined)} />
          <article className="edit-product-modal">
            <div className="panel-header"><div><span className="eyebrow">QUITAR</span><h2>{payingEntry.description}</h2></div><button className="icon-button" onClick={() => setPayingEntry(undefined)}><X size={17} /></button></div>
            <div className="modal-form">
              <label>Valor<input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>
              <p className="form-help">Restante: {currency(payingEntry.amount - payingEntry.paidAmount)}</p>
              <div className="modal-actions"><button className="secondary-button" onClick={() => setPayingEntry(undefined)}>Cancelar</button><button className="primary-button" onClick={handlePay}>Confirmar</button></div>
            </div>
          </article>
        </div>
      )}
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function PurchasesPage() {
  const { data: suppliers, reload: reloadSup } = useApiData(() => api.suppliers.list(), [])
  const { data: orders } = useApiData(() => api.purchaseOrders.list(), [])
  const [selected, setSelected] = useState<PurchaseOrder | undefined>()
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'all' | PurchaseOrderStatus>('all')
  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const submitSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') ?? '').trim()
    if (!name) return
    await createSupplier({ name, document: String(data.get('document') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? ''), address: String(data.get('address') ?? '') })
    reloadSup(); event.currentTarget.reset(); setNotice('Fornecedor cadastrado.')
  }
  return (
    <>
      <div className="section-header"><div className="section-header-content"><div><span className="eyebrow">COMPRAS</span><h2>Pedidos de compra</h2></div></div></div>
      <div className="split-page">
        <article className="panel form-panel">
          <div className="panel-header"><div><span className="eyebrow">FORNECEDORES</span><h2>Novo fornecedor</h2></div></div>
          <form onSubmit={submitSupplier}>
            <label>Nome<input name="name" required placeholder="Razao social" /></label>
            <div className="form-row"><label>Documento<input name="document" /></label><label>Telefone<input name="phone" /></label></div>
            <label>E-mail<input type="email" name="email" /></label>
            <button className="primary-button" type="submit"><Plus size={16} />Cadastrar</button>
          </form>
        </article>
        <article className="panel list-panel">
          <div className="panel-header"><div><span className="eyebrow">FORNECEDORES</span><h2>{suppliers.length}</h2></div></div>
          <div className="data-list">
            {suppliers.map((s) => (
              <div className="data-row" key={s.uuid}><span className="avatar">{s.name.slice(0, 1)}</span><div><strong>{s.name}</strong><small>{s.document || 'Sem doc.'}</small></div>
                <button className="delete-product" onClick={async () => { if (window.confirm(`Excluir "${s.name}"?`)) { await deleteSupplier(s.uuid); reloadSup(); setNotice('Removido.') } }}><Trash2 size={16} /></button>
              </div>
            ))}
            {!suppliers.length && <Empty title="Nenhum fornecedor" text="Cadastre o primeiro." />}
          </div>
        </article>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div><span className="eyebrow">PEDIDOS</span><h2>{filtered.length} pedido{filtered.length === 1 ? '' : 's'}</h2></div>
          <div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button><button className={filter === 'draft' ? 'active' : ''} onClick={() => setFilter('draft')}>Rascunho</button><button className={filter === 'received' ? 'active' : ''} onClick={() => setFilter('received')}>Recebido</button></div>
        </div>
        <div className="data-list">
          {filtered.map((o) => (
            <button className={`order-row ${selected?.uuid === o.uuid ? 'selected' : ''}`} key={o.uuid} onClick={() => setSelected(o)}>
              <span className="document-mark">#{String(o.number).padStart(4, '0')}</span>
              <span className="grow"><b>{o.supplierName}</b><small>{o.items.length} itens · {currency(o.total)}</small></span>
              <span className="order-status">{o.status}</span>
            </button>
          ))}
          {!filtered.length && <Empty title="Nenhum pedido" text="Crie um pedido de compra." />}
        </div>
      </div>
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function GuaranteesPage() {
  const { data: orders } = useApiData(() => api.serviceOrders.list(), [])
  const { data: customers } = useApiData(() => api.customers.list(), [])
  const delivered = orders.filter((o) => o.status === 'Entregue')
  const customerName = (uuid: string) => customers.find((c) => c.uuid === uuid)?.name ?? 'N/D'
  const [selected, setSelected] = useState<ServiceOrder | undefined>()
  const getWarranty = (o: ServiceOrder) => { const end = new Date(o.updatedAt); end.setDate(end.getDate() + o.warrantyDays); const now = new Date(); if (now > end) return { status: 'Expirada', color: '#dd5054' }; const d = Math.ceil((end.getTime() - now.getTime()) / 86400000); return { status: `${d} dia${d === 1 ? '' : 's'}`, color: '#44b27a' } }
  return (
    <>
      <div className="section-header"><div className="section-header-content"><div><span className="eyebrow">GARANTIAS</span><h2>Acompanhamento de garantia</h2></div></div></div>
      <div className="orders-layout">
        <article className="panel list-panel order-list">
          <div className="panel-header"><div><span className="eyebrow">OS ENTREGUES</span><h2>{delivered.length} com garantia</h2></div></div>
          <div className="data-list">
            {delivered.map((o) => { const w = getWarranty(o); return (
              <button className={`order-row ${selected?.uuid === o.uuid ? 'selected' : ''}`} key={o.uuid} onClick={() => setSelected(o)}>
                <span className="document-mark">#{String(o.number).padStart(4, '0')}</span>
                <span className="grow"><b>{o.equipment}</b><small>{customerName(o.customerUuid)} · {o.warrantyDays}d</small></span>
                <span className="order-status" style={{ color: w.color }}>{w.status}</span>
              </button>
            )})}
            {!delivered.length && <Empty title="Nenhuma OS entregue" text="Complete uma OS." />}
          </div>
        </article>
        <article className="panel order-detail">
          {selected ? (
            <div className="detail-content">
              <div><span className="eyebrow">GARANTIA OS #{String(selected.number).padStart(4, '0')}</span><h2>{selected.equipment}</h2><p>{customerName(selected.customerUuid)}</p></div>
              <div className="detail-meta"><span>Equipamento: <b>{selected.equipment}</b></span><span>Tecnico: <b>{selected.technician || 'N/D'}</b></span><span>Dias: <b>{selected.warrantyDays}</b></span></div>
              {selected.items.length > 0 && <div className="parts-box"><div className="panel-header"><div><span className="eyebrow">PECAS</span></div></div>{selected.items.map((item, i) => <div className="part-line" key={i}><span>{item.quantity}x {item.name}</span><b>{currency(item.total)}</b></div>)}</div>}
            </div>
          ) : <Empty title="Selecione uma OS" text="Detalhes da garantia." />}
        </article>
      </div>
    </>
  )
}

function ReportsPage() {
  const { data: sales } = useApiData(() => api.sales.list(), [])
  const { data: products } = useApiData(() => api.products.list(), [])
  const { data: entries } = useApiData(() => api.financial.list(), [])
  const [reportType, setReportType] = useState<'sales' | 'financial' | 'stock'>('sales')
  const [periodStart, setPeriodStart] = useState(today())
  const [periodEnd, setPeriodEnd] = useState(today())
  const filteredSales = sales.filter((s) => { const d = dayKey(s.createdAt); return s.status === 'completed' && d >= periodStart && d <= periodEnd })
  const totalSales = filteredSales.reduce((s, x) => s + x.total, 0)
  const totalProfit = filteredSales.reduce((t, s) => t + s.total - s.items.reduce((c, i) => c + (i.unitCost ?? 0) * i.quantity, 0), 0)
  const paymentStats = filteredSales.reduce((a, s) => { a[s.paymentMethod] = (a[s.paymentMethod] || 0) + s.total; return a }, {} as Record<string, number>)
  const receivableTotal = entries.filter((e) => e.type === 'receivable').reduce((s, e) => s + e.amount - e.paidAmount, 0)
  const payableTotal = entries.filter((e) => e.type === 'payable').reduce((s, e) => s + e.amount - e.paidAmount, 0)
  const overdueEntries = entries.filter((e) => e.status === 'overdue')
  const lowStock = products.filter((p) => p.stockQty <= p.minStock).sort((a, b) => a.stockQty - b.stockQty)
  return (
    <>
      <div className="section-header"><div className="section-header-content"><div><span className="eyebrow">RELATORIOS</span><h2>Analises e indicadores</h2></div></div></div>
      <div className="report-tabs"><button className={reportType === 'sales' ? 'active' : ''} onClick={() => setReportType('sales')}>Vendas</button><button className={reportType === 'financial' ? 'active' : ''} onClick={() => setReportType('financial')}>Financeiro</button><button className={reportType === 'stock' ? 'active' : ''} onClick={() => setReportType('stock')}>Estoque</button></div>
      {reportType === 'sales' && (
        <>
          <div className="dashboard-filters" style={{ marginBottom: 16 }}><div className="sales-date-filter"><CalendarDays size={16} /><label>De<input type="date" value={periodStart} max={periodEnd} onChange={(e) => setPeriodStart(e.target.value)} /></label><label>Ate<input type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} /></label></div></div>
          <div className="metric-grid">
            <article className="metric-card"><span>Faturamento</span><strong>{currency(totalSales)}</strong><small>{filteredSales.length} venda{filteredSales.length === 1 ? '' : 's'}</small></article>
            <article className="metric-card"><span>Lucro bruto</span><strong>{currency(totalProfit)}</strong><small>Margem: {totalSales ? ((totalProfit / totalSales) * 100).toFixed(1) : '0'}%</small></article>
            <article className="metric-card"><span>Ticket medio</span><strong>{filteredSales.length ? currency(totalSales / filteredSales.length) : currency(0)}</strong></article>
          </div>
          <div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><span className="eyebrow">POR PAGAMENTO</span></div></div>{Object.entries(paymentStats).map(([m, t]) => <div className="activity-row" key={m}><div><strong>{m}</strong></div><b>{currency(t as number)}</b></div>)}{!Object.keys(paymentStats).length && <Empty title="Sem vendas" text="Ajuste o periodo." />}</div>
        </>
      )}
      {reportType === 'financial' && (
        <>
          <div className="metric-grid">
            <article className="metric-card"><span>A receber</span><strong>{currency(receivableTotal)}</strong></article>
            <article className="metric-card"><span>A pagar</span><strong>{currency(payableTotal)}</strong></article>
            <article className="metric-card"><span>Saldo</span><strong>{currency(receivableTotal - payableTotal)}</strong></article>
            <article className="metric-card"><span>Vencidas</span><strong className={overdueEntries.length ? 'danger' : ''}>{overdueEntries.length}</strong></article>
          </div>
          <div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><span className="eyebrow">VENCIDAS</span></div></div>{overdueEntries.map((e) => <div className="activity-row" key={e.uuid}><div><strong>{e.description}</strong><small>{e.dueDate.split('-').reverse().join('/')}</small></div><b className="danger">{currency(e.amount - e.paidAmount)}</b></div>)}{!overdueEntries.length && <Empty title="Nenhuma vencida" text="Tudo em dia." />}</div>
        </>
      )}
      {reportType === 'stock' && (
        <>
          <div className="metric-grid"><article className="metric-card"><span>SKUs</span><strong>{products.length}</strong></article><article className="metric-card"><span>Estoque baixo</span><strong className={lowStock.length ? 'danger' : ''}>{lowStock.length}</strong></article></div>
          <div className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><span className="eyebrow">ESTOQUE BAIXO</span></div></div>{lowStock.map((p) => <div className="activity-row" key={p.uuid}><div><strong>{p.name}</strong><small>Min: {p.minStock} {p.unit}</small></div><b className={p.stockQty === 0 ? 'danger' : ''}>{p.stockQty} {p.unit}</b></div>)}{!lowStock.length && <Empty title="Estoque saudavel" text="Nenhum abaixo do minimo." />}</div>
        </>
      )}
    </>
  )
}

async function exportAllToExcel() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const [sales, products, entries, customers, orders] = await Promise.all([
    api.sales.list(),
    api.products.list(),
    api.financial.list(),
    api.customers.list(),
    api.serviceOrders.list(),
  ])

  const customerMap = new Map(customers.map(c => [c.uuid, c.name]))
  const salesRows = sales.filter(s => s.status === 'completed').map(s => ({
    Data: s.createdAt.split('T')[0],
    Cliente: customerMap.get(s.customerUuid || '') || '-',
    Itens: s.items.map(i => `${i.name} x${i.quantity}`).join(', '),
    FormaPagamento: s.paymentMethod,
    Subtotal: s.subtotal,
    Desconto: s.discount,
    Acrescimo: s.surcharge,
    Total: s.total,
  }))
  const wsSales = XLSX.utils.json_to_sheet(salesRows)
  XLSX.utils.book_append_sheet(wb, wsSales, 'Vendas')

  const stockRows = products.map(p => ({
    Codigo: p.code,
    SKU: p.sku,
    Nome: p.name,
    Categoria: p.category,
    PrecoCusto: p.cost,
    PrecoVenda: p.salePrice,
    Estoque: p.stockQty,
    EstoqueMinimo: p.minStock,
    Unidade: p.unit,
  }))
  const wsStock = XLSX.utils.json_to_sheet(stockRows)
  XLSX.utils.book_append_sheet(wb, wsStock, 'Estoque')

  const financialRows = entries.map(e => ({
    Tipo: e.type === 'receivable' ? 'A Receber' : 'A Pagar',
    Descricao: e.description,
    Valor: e.amount,
    Pago: e.paidAmount,
    Saldo: e.amount - e.paidAmount,
    Vencimento: e.dueDate,
    Status: e.status,
    FormaPagamento: e.paymentMethod || '-',
  }))
  const wsFinancial = XLSX.utils.json_to_sheet(financialRows)
  XLSX.utils.book_append_sheet(wb, wsFinancial, 'Financeiro')

  const customerRows = customers.map(c => ({
    Nome: c.name,
    Documento: c.document,
    Telefone: c.phone,
    Email: c.email || '-',
    Notas: c.notes || '-',
  }))
  const wsCustomers = XLSX.utils.json_to_sheet(customerRows)
  XLSX.utils.book_append_sheet(wb, wsCustomers, 'Clientes')

  const orderRows = orders.map(o => ({
    Numero: `OS-${String(o.number).padStart(4, '0')}`,
    Equipamento: o.equipment,
    Marca: o.brand || '-',
    Modelo: o.model || '-',
    Problema: o.reportedIssue,
    Status: o.status,
    Tecnico: o.technician || '-',
    Total: o.total,
    Previsao: o.expectedDelivery || '-',
  }))
  const wsOrders = XLSX.utils.json_to_sheet(orderRows)
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Ordens de Servico')

  const now = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `Amaro_Iphone_Relatorios_${now}.xlsx`)
}

function SettingsPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      await exportAllToExcel()
      setNotice('Relatorios exportados com sucesso!')
    } catch {
      setNotice('Erro ao exportar relatorios.')
    } finally {
      setExporting(false)
    }
  }
  return (
    <>
      <div className="settings-grid">
        <article className="panel settings-card"><span className="eyebrow">RELATORIOS</span><h2>Exportar dados</h2><p>Baixe todas as planilhas (Vendas, Estoque, Financeiro, Clientes, OS) em um arquivo Excel.</p><button className="secondary-button" onClick={handleExport} disabled={exporting}>{exporting ? 'Exportando...' : 'Baixar relatorios em Excel'}</button></article>
        <article className="panel settings-card"><span className="eyebrow">NAVEGACAO</span><h2>Modulos do sistema</h2><p>Acesse todas as funcionalidades pelo menu lateral.</p><button className="secondary-button" onClick={() => onNavigate('dashboard')}>Ir para Dashboard</button></article>
        <article className="panel settings-card"><span className="eyebrow">SOBRE</span><h2>Amaro Iphone</h2><p>Sistema de gestao online para loja e assistencia tecnica.</p></article>
      </div>
      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
    </>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><Gauge size={25} /><strong>{title}</strong><p>{text}</p></div>
}

function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return <div className="notice"><span>{text}</span><button onClick={onDismiss}><X size={16} /></button></div>
}

function AppWithAuth() {
  return <AuthProvider><App /></AuthProvider>
}

export default AppWithAuth
