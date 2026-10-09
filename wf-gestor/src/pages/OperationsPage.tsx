import { useCallback, useEffect, useState } from 'react'
import { PackageCheck, RefreshCw } from 'lucide-react'
import { num } from '../data'
import { AmazonSpApiConnector } from '../integrations'
import { PageHeader, Panel, StatTile } from '../components/ui'

const SINCE = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

type InventoryState =
  | { status: 'inicial' }
  | { status: 'live'; count: number; detail: string }
  | { status: 'erro'; message: string; hint?: string }

export default function OperationsPage() {
  const [inventory, setInventory] = useState<InventoryState>({ status: 'inicial' })

  const load = useCallback(async () => {
    setInventory({ status: 'inicial' })
    try {
      const connector = new AmazonSpApiConnector()
      const result = await connector.fetch('inventory', SINCE)
      setInventory({ status: 'live', count: result.count, detail: result.detail })
    } catch (error) {
      setInventory({
        status: 'erro',
        message: error instanceof Error ? error.message : 'Falha ao consultar o estoque.',
        hint: error instanceof Error && 'hint' in error ? (error as { hint?: string }).hint : undefined,
      })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unidades = inventory.status === 'live' ? inventory.count : 0

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Estoque"
        description="Posição real de estoque FBA consultada na SP-API. Sem estoque na Amazon, a loja opera com envio próprio."
        action={
          <button className="ghost lg" onClick={() => void load()}>
            <RefreshCw size={16} /> Atualizar
          </button>
        }
      />

      {inventory.status === 'inicial' && <div className="data-mode is-loading">Lendo o estoque FBA da Amazon…</div>}
      {inventory.status === 'erro' && (
        <div className="data-mode is-demo">
          <b>Sem dados no momento.</b> {inventory.message}
          {inventory.hint ? ` · ${inventory.hint}` : ''}
        </div>
      )}

      <section className="metrics">
        <StatTile
          label="Estoque FBA"
          value={num(unidades)}
          hint={inventory.status === 'live' ? 'armazenado pela Amazon' : 'aguardando a Amazon'}
        />
        <StatTile label="Modelo de operação" value={unidades > 0 ? 'FBA + MFN' : 'MFN'} hint="envio próprio" />
      </section>

      <Panel title="Posição de estoque" hint="FBA (Fulfillment by Amazon)">
        {inventory.status === 'live' && inventory.count === 0 && (
          <p className="breakdown-note">
            {inventory.detail || 'Sem unidades em estoque FBA — a loja opera com envio próprio (MFN).'}
          </p>
        )}
        {inventory.status === 'live' && inventory.count > 0 && (
          <p className="breakdown-note">{inventory.detail}</p>
        )}
        {inventory.status === 'inicial' && <p className="breakdown-note">Consultando a Amazon…</p>}
      </Panel>

      <section className="footnote">
        <PackageCheck size={14} /> Os dados vêm direto de <span className="mono">/fba/inventory/v1/summaries</span> no proxy
        local.
      </section>
    </>
  )
}
