export type Channel = 'Amazon' | 'Mercado Livre' | 'Shopee' | 'TikTok Shop'

export const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const num = (value: number, digits = 0) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)

export const pct = (value: number, digits = 1) => `${num(value, digits)}%`

export const brlShort = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)

export const dateBR = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })


export type SaleStatus = 'Recebido' | 'A liberar' | 'Em disputa' | 'Devolvido'

export type Sale = {
  id: string
  date: string
  channel: Channel
  product: string
  sku: string
  externalSku: string
  asin: string
  qty: number
  unitPrice: number
  gross: number
  commission: number
  fees: number
  taxes: number
  ads: number
  cost: number
  net: number
  profit: number
  margin: number
  status: SaleStatus
  settlement: 'Conciliado' | 'Pendente' | 'Divergente'
}

type SaleSeed = {
  id: string
  date: string
  channel: Channel
  product: string
  sku: string
  externalSku: string
  asin?: string
  qty: number
  unitPrice: number
  commissionPct: number
  fee: number
  taxPct: number
  ads: number
  cost: number
  status?: SaleStatus
  settlement?: Sale['settlement']
}

const seed: SaleSeed[] = [
  { id: 'AMZ-88971', date: '2026-05-30', channel: 'Amazon', product: 'Organizador Modular 3L', sku: 'ORG-3L-001', externalSku: 'B0CORG3L', asin: 'B0C9K2ORG1', qty: 2, unitPrice: 94.95, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 6.4, cost: 61.2 },
  { id: 'AMZ-88965', date: '2026-05-30', channel: 'Amazon', product: 'Organizador Modular 3L', sku: 'ORG-3L-001', externalSku: 'B0CORG3L', asin: 'B0C9K2ORG1', qty: 1, unitPrice: 94.95, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 3.2, cost: 30.6 },
  { id: 'AMZ-88958', date: '2026-05-29', channel: 'Amazon', product: 'Suporte Organizador Acrílico', sku: 'SUP-ACR-014', externalSku: 'B0CSUPACR', asin: 'B0C7SUPAC4', qty: 3, unitPrice: 62.5, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 5.1, cost: 74.4, status: 'A liberar' },
  { id: 'MLB-15342', date: '2026-05-30', channel: 'Mercado Livre', product: 'Kit Cabides Eco 30 un.', sku: 'KIT-CAB-030', externalSku: 'MLB-CAB30', qty: 1, unitPrice: 144.5, commissionPct: 16, fee: 6.5, taxPct: 10.2, ads: 8.9, cost: 87.3 },
  { id: 'MLB-15338', date: '2026-05-29', channel: 'Mercado Livre', product: 'Caixa Organizadora M', sku: 'CXO-M-007', externalSku: 'MLB-CXOM', qty: 2, unitPrice: 119.7, commissionPct: 16, fee: 6.5, taxPct: 10.2, ads: 7.4, cost: 132.6, settlement: 'Divergente' },
  { id: 'MLB-15327', date: '2026-05-28', channel: 'Mercado Livre', product: 'Organizador Modular 3L', sku: 'ORG-3L-001', externalSku: 'MLB-ORG3L', qty: 4, unitPrice: 109.9, commissionPct: 16, fee: 6.5, taxPct: 10.2, ads: 12.4, cost: 122.4 },
  { id: 'MLB-15311', date: '2026-05-27', channel: 'Mercado Livre', product: 'Bandeja Sorteadora 4C', sku: 'BAN-4C-022', externalSku: 'MLB-BAN4C', qty: 1, unitPrice: 89.9, commissionPct: 16, fee: 6.5, taxPct: 10.2, ads: 0, cost: 52.8, status: 'Devolvido', settlement: 'Pendente' },
  { id: 'SHP-91206', date: '2026-05-30', channel: 'Shopee', product: 'Caixa Organizadora M', sku: 'CXO-M-007', externalSku: 'SHP-CXOM', qty: 1, unitPrice: 119.7, commissionPct: 14, fee: 3.2, taxPct: 8.5, ads: 4.1, cost: 66.3 },
  { id: 'SHP-91198', date: '2026-05-29', channel: 'Shopee', product: 'Kit Cabides Eco 30 un.', sku: 'KIT-CAB-030', externalSku: 'SHP-KITCAB', qty: 2, unitPrice: 144.5, commissionPct: 14, fee: 3.2, taxPct: 8.5, ads: 9.6, cost: 174.6, status: 'A liberar' },
  { id: 'SHP-91174', date: '2026-05-27', channel: 'Shopee', product: 'Organizador Modular 3L', sku: 'ORG-3L-001', externalSku: 'SHP-ORG3L', qty: 3, unitPrice: 99.9, commissionPct: 14, fee: 3.2, taxPct: 8.5, ads: 7.2, cost: 91.8, settlement: 'Divergente' },
  { id: 'TIK-40218', date: '2026-05-30', channel: 'TikTok Shop', product: 'Suporte Organizador Acrílico', sku: 'SUP-ACR-014', externalSku: 'TIK-SUPACR', qty: 2, unitPrice: 68.9, commissionPct: 8, fee: 2.4, taxPct: 6.4, ads: 11.2, cost: 49.6 },
  { id: 'TIK-40203', date: '2026-05-28', channel: 'TikTok Shop', product: 'Bandeja Sorteadora 4C', sku: 'BAN-4C-022', externalSku: 'TIK-BAN4C', qty: 5, unitPrice: 89.9, commissionPct: 8, fee: 2.4, taxPct: 6.4, ads: 24.6, cost: 132.0, status: 'Em disputa' },
  { id: 'AMZ-88931', date: '2026-05-26', channel: 'Amazon', product: 'Bandeja Sorteadora 4C', sku: 'BAN-4C-022', externalSku: 'B0CBAN4C', asin: 'B0C8BAN4C2', qty: 2, unitPrice: 99.9, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 5.8, cost: 66.0 },
  { id: 'AMZ-88912', date: '2026-05-25', channel: 'Amazon', product: 'Kit Cabides Eco 30 un.', sku: 'KIT-CAB-030', externalSku: 'B0CKITCAB', asin: 'B0C5KITC30', qty: 1, unitPrice: 154.9, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 4.4, cost: 87.3 },
  { id: 'MLB-15294', date: '2026-05-24', channel: 'Mercado Livre', product: 'Suporte Organizador Acrílico', sku: 'SUP-ACR-014', externalSku: 'MLB-SUPACR', qty: 6, unitPrice: 72.9, commissionPct: 16, fee: 6.5, taxPct: 10.2, ads: 14.8, cost: 148.8 },
  { id: 'SHP-91142', date: '2026-05-23', channel: 'Shopee', product: 'Bandeja Sorteadora 4C', sku: 'BAN-4C-022', externalSku: 'SHP-BAN4C', qty: 2, unitPrice: 92.9, commissionPct: 14, fee: 3.2, taxPct: 8.5, ads: 6.6, cost: 66.0, status: 'A liberar' },
  { id: 'AMZ-88890', date: '2026-05-22', channel: 'Amazon', product: 'Caixa Organizadora M', sku: 'CXO-M-007', externalSku: 'B0CCXOM', asin: 'B0C1CXO0M9', qty: 4, unitPrice: 124.9, commissionPct: 15, fee: 4.9, taxPct: 11.75, ads: 16.2, cost: 265.2, settlement: 'Pendente' },
  { id: 'TIK-40176', date: '2026-05-21', channel: 'TikTok Shop', product: 'Organizador Modular 3L', sku: 'ORG-3L-001', externalSku: 'TIK-ORG3L', qty: 3, unitPrice: 104.9, commissionPct: 8, fee: 2.4, taxPct: 6.4, ads: 18.4, cost: 91.8 },
]

const round = (value: number) => Math.round(value * 100) / 100

export const sales: Sale[] = seed.map((item) => {
  const gross = round(item.unitPrice * item.qty)
  const commission = round((gross * item.commissionPct) / 100)
  const taxes = round((gross * item.taxPct) / 100)
  const net = round(gross - commission - item.fee - taxes)
  const profit = round(net - item.cost - item.ads)
  return {
    id: item.id,
    date: item.date,
    channel: item.channel,
    product: item.product,
    sku: item.sku,
    externalSku: item.externalSku,
    asin: item.asin ?? '—',
    qty: item.qty,
    unitPrice: item.unitPrice,
    gross,
    commission,
    fees: item.fee,
    taxes,
    ads: item.ads,
    cost: item.cost,
    net,
    profit,
    margin: round((profit / gross) * 100),
    status: item.status ?? 'Recebido',
    settlement: item.settlement ?? 'Conciliado',
  }
})

export type Product = {
  sku: string
  name: string
  cost: number
  price: number
  stock: number
  curve: 'A' | 'B' | 'C' | 'Z'
  channels: Channel[]
  revenue: number
  refunds: number
}

export const products: Product[] = [
  { sku: 'ORG-3L-001', name: 'Organizador Modular 3L', cost: 30.6, price: 99.9, stock: 412, curve: 'A', channels: ['Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop'], revenue: 14820.4, refunds: 6 },
  { sku: 'KIT-CAB-030', name: 'Kit Cabides Eco 30 un.', cost: 87.3, price: 144.5, stock: 168, curve: 'A', channels: ['Amazon', 'Mercado Livre', 'Shopee'], revenue: 9744.9, refunds: 3 },
  { sku: 'CXO-M-007', name: 'Caixa Organizadora M', cost: 66.3, price: 119.7, stock: 96, curve: 'A', channels: ['Amazon', 'Mercado Livre', 'Shopee'], revenue: 7310.2, refunds: 9 },
  { sku: 'BAN-4C-022', name: 'Bandeja Sorteadora 4C', cost: 33.0, price: 92.9, stock: 231, curve: 'B', channels: ['Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop'], revenue: 5120.6, refunds: 2 },
  { sku: 'SUP-ACR-014', name: 'Suporte Organizador Acrílico', cost: 24.8, price: 68.9, stock: 74, curve: 'B', channels: ['Amazon', 'Mercado Livre', 'TikTok Shop'], revenue: 3890.15, refunds: 11 },
  { sku: 'GAN-PP-005', name: 'Gaveta Plástica 5 un.', cost: 41.2, price: 79.9, stock: 58, curve: 'C', channels: ['Mercado Livre'], revenue: 1640.8, refunds: 1 },
  { sku: 'COL-VD-019', name: 'Colmeia Dobrável V19', cost: 96.5, price: 189.9, stock: 43, curve: 'C', channels: ['Amazon'], revenue: 984.5, refunds: 0 },
  { sku: 'PRS-AL-031', name: 'Prensa de Alface Inox', cost: 58.0, price: 129.9, stock: 12, curve: 'Z', channels: [], revenue: 0, refunds: 4 },
  { sku: 'CJL-TR-002', name: 'Cjolo Térmico 2L', cost: 74.9, price: 159.9, stock: 8, curve: 'Z', channels: ['Shopee'], revenue: 0, refunds: 2 },
]

export type Account = {
  channel: Channel
  status: 'Conectado' | 'Pendente' | 'Desconectado'
  store: string
  since: string
  lastSync: string
  orders: number
}

export const accounts: Account[] = [
  { channel: 'Amazon', status: 'Conectado', store: 'NuvemCasa Oficial', since: '12/02/2026', lastSync: 'há 8 min', orders: 4820 },
  { channel: 'Mercado Livre', status: 'Conectado', store: 'nuvemcasa-oficial', since: '12/02/2026', lastSync: 'há 14 min', orders: 3164 },
  { channel: 'Shopee', status: 'Conectado', store: 'nuvemcasa.br', since: '03/03/2026', lastSync: 'há 21 min', orders: 1742 },
  { channel: 'TikTok Shop', status: 'Pendente', store: 'nuvemcasa', since: '28/05/2026', lastSync: 'aguardando autorização', orders: 0 },
]

export type Payout = {
  id: string
  channel: Channel
  period: string
  expected: number
  paid: number
  status: 'Conferido' | 'Pendente' | 'Divergente'
}

export const payouts: Payout[] = [
  { id: 'RP-2026-0530-A', channel: 'Amazon', period: '26/05 - 30/05', expected: 8412.9, paid: 8412.9, status: 'Conferido' },
  { id: 'RP-2026-0530-M', channel: 'Mercado Livre', period: '26/05 - 30/05', expected: 5128.4, paid: 4986.1, status: 'Divergente' },
  { id: 'RP-2026-0530-S', channel: 'Shopee', period: '26/05 - 30/05', expected: 2974.6, paid: 2974.6, status: 'Pendente' },
  { id: 'RP-2026-0523-A', channel: 'Amazon', period: '19/05 - 25/05', expected: 7960.2, paid: 7960.2, status: 'Conferido' },
  { id: 'RP-2026-0523-M', channel: 'Mercado Livre', period: '19/05 - 25/05', expected: 4802.7, paid: 4802.7, status: 'Conferido' },
  { id: 'RP-2026-0523-T', channel: 'TikTok Shop', period: '19/05 - 25/05', expected: 1844.3, paid: 1702.8, status: 'Divergente' },
]

export type DreLine = {
  label: string
  value: number
  kind: 'total' | 'deduction' | 'result' | 'sub'
  note?: string
}

export const dre: DreLine[] = [
  { label: 'Faturamento bruto', value: 42890.4, kind: 'total', note: 'vendas aprovadas no período' },
  { label: '(-) Impostos sobre vendas', value: -4618.72, kind: 'deduction' },
  { label: '(-) Comissões de marketplaces', value: -6531.44, kind: 'deduction' },
  { label: '(-) Taxas de serviço e antifraude', value: -1204.18, kind: 'deduction' },
  { label: '(-) Logística e fulfillment', value: -2870.55, kind: 'deduction' },
  { label: 'Líquido de marketplaces', value: 27665.51, kind: 'sub' },
  { label: '(-) Custo dos produtos vendidos', value: -11842.9, kind: 'deduction' },
  { label: 'Lucro bruto', value: 15822.61, kind: 'result' },
  { label: '(-) Investimento em Ads', value: -3102.18, kind: 'deduction' },
  { label: '(-) Despesas operacionais fixas', value: -2148.0, kind: 'deduction', note: 'aluguel, softwares, equipe' },
  { label: '(-) Devoluções e reembolsos', value: -726.2, kind: 'deduction' },
  { label: 'Lucro líquido operacional', value: 9846.23, kind: 'result' },
]

export type Campaign = {
  name: string
  channel: Channel
  type: 'Patrocinados' | 'Display' | 'Vídeo' | 'Coleção'
  spend: number
  sales: number
  orders: number
}

export const campaigns: Campaign[] = [
  { name: 'Organizador Modular - Topo', channel: 'Amazon', type: 'Patrocinados', spend: 986.4, sales: 5412.8, orders: 57 },
  { name: 'Kit Cabides - Marca', channel: 'Amazon', type: 'Display', spend: 412.7, sales: 1620.4, orders: 14 },
  { name: 'Caixa Organizadora - Produtos', channel: 'Mercado Livre', type: 'Patrocinados', spend: 742.1, sales: 3188.6, orders: 29 },
  { name: 'Coleção Casa & Organização', channel: 'Mercado Livre', type: 'Coleção', spend: 268.9, sales: 986.2, orders: 9 },
  { name: 'Bandeja Sorteadora - Vídeo', channel: 'Shopee', type: 'Vídeo', spend: 384.5, sales: 1444.1, orders: 18 },
  { name: 'Suporte Acrílico - Vitrine', channel: 'TikTok Shop', type: 'Vídeo', spend: 307.6, sales: 892.3, orders: 16 },
]

export type Stock = {
  sku: string
  name: string
  fba: number
  full: number
  reserved: number
  incoming: number
  coverage: number
}

export const stock: Stock[] = [
  { sku: 'ORG-3L-001', name: 'Organizador Modular 3L', fba: 268, full: 144, reserved: 22, incoming: 300, coverage: 41 },
  { sku: 'KIT-CAB-030', name: 'Kit Cabides Eco 30 un.', fba: 96, full: 72, reserved: 14, incoming: 0, coverage: 18 },
  { sku: 'CXO-M-007', name: 'Caixa Organizadora M', fba: 42, full: 54, reserved: 9, incoming: 120, coverage: 9 },
  { sku: 'BAN-4C-022', name: 'Bandeja Sorteadora 4C', fba: 151, full: 80, reserved: 6, incoming: 0, coverage: 33 },
  { sku: 'SUP-ACR-014', name: 'Suporte Organizador Acrílico', fba: 30, full: 44, reserved: 11, incoming: 0, coverage: 5 },
  { sku: 'GAN-PP-005', name: 'Gaveta Plástica 5 un.', fba: 22, full: 36, reserved: 3, incoming: 0, coverage: 12 },
  { sku: 'PRS-AL-031', name: 'Prensa de Alface Inox', fba: 0, full: 12, reserved: 0, incoming: 0, coverage: 0 },
]

export type Shipment = {
  id: string
  order: string
  channel: Channel
  model: 'DBA' | 'FBA' | 'Self-Ship'
  invoice: 'Aceita' | 'Pendente' | 'Não necessária'
  pickup: 'Agendada' | 'A agendar' | 'Concluída'
  label: boolean
  freight: number
}

export const shipments: Shipment[] = [
  { id: 'ENV-90412', order: 'AMZ-88971', channel: 'Amazon', model: 'DBA', invoice: 'Aceita', pickup: 'Agendada', label: true, freight: 24.9 },
  { id: 'ENV-90411', order: 'AMZ-88965', channel: 'Amazon', model: 'DBA', invoice: 'Pendente', pickup: 'A agendar', label: false, freight: 18.4 },
  { id: 'ENV-90408', order: 'AMZ-88958', channel: 'Amazon', model: 'FBA', invoice: 'Aceita', pickup: 'Concluída', label: true, freight: 0 },
  { id: 'ENV-90402', order: 'AMZ-88931', channel: 'Amazon', model: 'DBA', invoice: 'Não necessária', pickup: 'A agendar', label: false, freight: 22.1 },
  { id: 'ENV-90397', order: 'AMZ-88912', channel: 'Amazon', model: 'FBA', invoice: 'Aceita', pickup: 'Concluída', label: true, freight: 0 },
  { id: 'ENV-90391', order: 'AMZ-88890', channel: 'Amazon', model: 'Self-Ship', invoice: 'Pendente', pickup: 'Concluída', label: false, freight: 31.6 },
]

export type RepricerRule = {
  sku: string
  name: string
  current: number
  minimum: number
  maximum: number
  buyBox: number
  state: 'Ativo' | 'Pausado'
}

export const repricer: RepricerRule[] = [
  { sku: 'ORG-3L-001', name: 'Organizador Modular 3L', current: 94.95, minimum: 84.9, maximum: 112.0, buyBox: 93.5, state: 'Ativo' },
  { sku: 'KIT-CAB-030', name: 'Kit Cabides Eco 30 un.', current: 154.9, minimum: 139.0, maximum: 169.0, buyBox: 157.2, state: 'Ativo' },
  { sku: 'CXO-M-007', name: 'Caixa Organizadora M', current: 124.9, minimum: 112.0, maximum: 139.9, buyBox: 121.4, state: 'Pausado' },
]

export type Task = {
  title: string
  detail: string
  count: string
  tone: 'blue' | 'sky' | 'ice'
}

export const priorities: Task[] = [
  { title: '4 repasses para conferir', detail: 'Diferença entre venda e recebimento', count: 'R$ 285,80', tone: 'blue' },
  { title: '7 anúncios sem custo', detail: 'A margem ainda não está calculada', count: '7 itens', tone: 'sky' },
  { title: '3 SKUs com estoque baixo', detail: 'Cobertura inferior a 10 dias', count: '3 SKUs', tone: 'ice' },
]

export const periods = ['Últimos 7 dias', 'Últimos 30 dias', 'Este mês', 'Mês anterior']

export const revenueSeries = [
  { label: '01', revenue: 1180, profit: 240 },
  { label: '05', revenue: 1640, profit: 360 },
  { label: '09', revenue: 1420, profit: 300 },
  { label: '13', revenue: 2180, profit: 520 },
  { label: '17', revenue: 1960, profit: 470 },
  { label: '21', revenue: 2740, profit: 660 },
  { label: '25', revenue: 2410, profit: 590 },
  { label: '30', revenue: 3280, profit: 820 },
]
