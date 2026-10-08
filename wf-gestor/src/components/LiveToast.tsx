import { brl } from '../data'
import type { LiveSale } from '../integrations'

const hora = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function LiveToast({
  sales,
  onOpen,
  onClose,
}: {
  sales: LiveSale[]
  onOpen: () => void
  onClose: (id: string) => void
}) {
  if (!sales.length) return null

  return (
    <div className="toast-stack">
      {sales.map((sale) => (
        <div className="toast" key={sale.id} role="status">
          <i className="toast-dot" />
          <div className="toast-body">
            <b>Nova venda!</b>
            <span>
              {sale.product ?? 'Pedido na Amazon'} · {brl(sale.amount)}
            </span>
            <small>
              {hora(sale.purchasedAt)} · Amazon · {sale.status}
            </small>
          </div>
          <button className="toast-close" onClick={onOpen}>
            Ver
          </button>
          <button className="toast-close" onClick={() => onClose(sale.id)} aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
