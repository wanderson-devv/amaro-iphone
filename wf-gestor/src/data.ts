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
  partial?: boolean
  costUnknown?: boolean
}
