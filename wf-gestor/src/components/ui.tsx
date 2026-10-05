import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: ReactNode
  description: string
  action?: ReactNode
}) {
  return (
    <section className="intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  )
}

export function TabBar({
  items,
  active,
  onChange,
}: {
  items: string[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="tabbar" role="tablist">
      {items.map((item) => (
        <button
          key={item}
          role="tab"
          aria-selected={active === item}
          className={active === item ? 'active' : ''}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export function Panel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          {hint && <span className="eyebrow">{hint}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  info,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'positive' | 'attention'
  info?: string
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <p>
        {label}
        {info && (
          <i className="info-dot" title={info} aria-label={info}>
            <Info size={13} />
          </i>
        )}
      </p>
      <strong>{value}</strong>
      {hint && <span className="tile-hint">{hint}</span>}
    </article>
  )
}

export function Tag({ value }: { value: string }) {
  const tone = ['Recebido', 'Conferido', 'Conectado', 'Aceita', 'Concluída', 'Ativo', 'Conciliado'].includes(value)
    ? 'tag-ok'
    : ['Em disputa', 'Divergente', 'Pendente', 'Desconectado', 'Não necessária'].includes(value)
      ? 'tag-warn'
      : value === 'Devolvido'
        ? 'tag-bad'
        : 'tag-info'
  return <span className={`tag ${tone}`}>{value}</span>
}
