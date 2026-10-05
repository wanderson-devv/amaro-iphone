import { useState } from 'react'
import { CheckCheck, Link2, Plus, Upload, AlertTriangle } from 'lucide-react'
import { brl, num, pct, products, sales, type Channel } from '../data'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

const allChannels: Channel[] = ['Amazon', 'Mercado Livre', 'Shopee', 'TikTok Shop']

const unmatched = sales
  .filter((sale) => sale.settlement !== 'Conciliado' || sale.status === 'Devolvido')
  .slice(0, 4)

export default function CatalogPage() {
  const [linked, setLinked] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState('')

  const withoutChannel = products.filter((product) => product.channels.length < allChannels.length).length

  const associate = (sku: string) => {
    setLinked((current) => ({ ...current, [sku]: true }))
    setNotice(`Associação de ${sku} confirmada e registrada no histórico.`)
  }

  const associateAll = () => {
    const next: Record<string, boolean> = {}
    products.forEach((product) => {
      next[product.sku] = true
    })
    setLinked(next)
    setNotice('Associação em massa concluída: SKUs internos e externos vinculados.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Gerenciamento"
        title="Catálogo e associações"
        description="Cadastro único de produtos com custo, preço e vínculo para cada anúncio dos marketplaces conectados."
        action={
          <div className="button-row">
            <button className="ghost lg">
              <Upload size={16} /> Importar planilha
            </button>
            <button className="primary">
              <Plus size={17} /> Novo produto
            </button>
          </div>
        }
      />

      <section className="metrics">
        <StatTile label="Produtos cadastrados" value={num(products.length)} hint="catálogo interno" />
        <StatTile label="Aguardando vínculo" value={num(withoutChannel)} hint="sem todos os canais" tone="attention" />
        <StatTile label="Vendas sem produto" value={num(unmatched.length)} hint="fila de pendências" tone="attention" />
        <StatTile
          label="Valor do estoque"
          value={brl(products.reduce((sum, item) => sum + item.cost * item.stock, 0))}
          hint="a preço de custo"
        />
      </section>

      <div className="two-col">
        <Panel
          title="Produtos internos"
          hint="Cadastro único"
          action={
            <button className="ghost" onClick={associateAll}>
              <CheckCheck size={15} /> Associar em massa
            </button>
          }
        >
          <div className="table-scroll flush">
            <table>
              <thead>
                <tr>
                  <th>SKU interno</th>
                  <th>Produto</th>
                  <th>Custo</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Canais vinculados</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const done = linked[product.sku]
                  return (
                    <tr key={product.sku}>
                      <td className="order">{product.sku}</td>
                      <td>
                        <b>{product.name}</b>
                        <small className="sub">externo: {product.channels[0] ?? '—'}</small>
                      </td>
                      <td>{brl(product.cost)}</td>
                      <td>{brl(product.price)}</td>
                      <td>{num(product.stock)}</td>
                      <td>
                        <div className="channel-dots">
                          {allChannels.map((channel) => (
                            <span
                              key={channel}
                              title={`${channel}: ${product.channels.includes(channel) || done ? 'vinculado' : 'não vinculado'}`}
                              className={
                                (product.channels.includes(channel) || done) ? 'dot on' : 'dot'
                              }
                            >
                              {channel.slice(0, 2).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {product.channels.length < allChannels.length && !done ? (
                          <button className="text-button" onClick={() => associate(product.sku)}>
                            <Link2 size={14} /> Vincular
                          </button>
                        ) : (
                          <Tag value="Conciliado" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Fila de pendências" hint="Vendas ainda não associadas">
            <ul className="queue">
              {unmatched.map((sale) => (
                <li key={sale.id}>
                  <span className="queue-icon">
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <b>{sale.product}</b>
                    <small>
                      {sale.id} · {sale.channel} · {sale.settlement}
                    </small>
                  </div>
                  <Tag value={sale.status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Regras de associação" hint="Como os vínculos são resolvidos">
            <ol className="rules">
              <li>SKU interno igual ao SKU externo vincula automaticamente.</li>
              <li>Vínculos manuais exigem confirmação e ficam no histórico.</li>
              <li>Variações, kits e duplicidades exigem mapeamento explícito.</li>
              <li>Venda sem produto permanece na fila até ter custo definido.</li>
            </ol>
          </Panel>
        </div>
      </div>

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice('')} className="toast-close">
            Fechar
          </button>
        </div>
      )}

      <section className="footnote">
        Cobertura de catálogo: {pct((products.filter((p) => p.channels.length === allChannels.length).length / products.length) * 100)} dos
        produtos presentes nos quatro canais.
      </section>
    </>
  )
}
