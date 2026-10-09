import { brl, num, pct } from '../data'
import { FINANCE_SINCE, useAmazonFinance, useAmazonSkus, useAppDbWriteError } from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

export default function CatalogPage() {
  const finance = useAmazonFinance(FINANCE_SINCE)
  const { skus: skuMeta, save } = useAmazonSkus()
  const dbError = useAppDbWriteError()

  const amazonSkus = finance.skus
  const totalUnits = amazonSkus.reduce((sum, item) => sum + item.units, 0)
  const totalRevenue = amazonSkus.reduce((sum, item) => sum + item.revenue, 0)
  const comCusto = amazonSkus.filter((item) => skuMeta[item.sku]?.cost != null).length

  return (
    <>
      <PageHeader
        eyebrow="Gerenciamento"
        title="Catálogo e associações"
        description="SKUs reais encontrados no extrato financeiro da Amazon, com custo e nome informados por você."
      />

      <section className="metrics">
        <StatTile label="SKUs no extrato" value={num(amazonSkus.length)} hint="vindos da Amazon" />
        <StatTile label="Unidades vendidas" value={num(totalUnits)} hint="no período do extrato" />
        <StatTile label="Receita no extrato" value={brl(totalRevenue)} hint="bruto por SKU" />
        <StatTile
          label="Com custo cadastrado"
          value={`${comCusto}/${amazonSkus.length}`}
          hint="permite calcular margem"
          tone={comCusto === amazonSkus.length && amazonSkus.length > 0 ? 'positive' : 'attention'}
        />
      </section>

      <Panel
        title="SKUs da Amazon"
        hint={finance.status === 'live' ? 'Vindos do extrato financeiro real' : 'Extrato financeiro'}
        className="sales-panel"
      >
        {finance.status === 'inicial' && <p className="breakdown-note">Lendo o extrato financeiro da Amazon…</p>}
        {finance.status !== 'inicial' && amazonSkus.length === 0 && (
          <p className="breakdown-note">
            {finance.message}
            {finance.hint ? ` · ${finance.hint}` : ''}
          </p>
        )}
        {amazonSkus.length > 0 && (
          <div className="table-scroll">
            <table className="wide">
              <thead>
                <tr>
                  <th>SKU Amazon</th>
                  <th>Unidades</th>
                  <th>Receita no extrato</th>
                  <th>Nome do produto</th>
                  <th>Custo unitário</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {amazonSkus.map((item) => {
                  const meta = skuMeta[item.sku] ?? {}
                  const cost = meta.cost
                  return (
                    <tr key={item.sku}>
                      <td className="order">{item.sku}</td>
                      <td>{num(item.units)}</td>
                      <td>{brl(item.revenue)}</td>
                      <td>
                        <input
                          className="sku-input"
                          value={meta.name ?? ''}
                          placeholder="nome do produto"
                          onChange={(event) => save(item.sku, { ...meta, name: event.target.value || undefined })}
                        />
                      </td>
                      <td>
                        <input
                          className="sku-input short"
                          inputMode="decimal"
                          value={meta.cost ?? ''}
                          placeholder="0,00"
                          onChange={(event) => {
                            const parsed = Number(event.target.value.replace(',', '.'))
                            save(item.sku, {
                              ...meta,
                              cost: event.target.value === '' || Number.isNaN(parsed) ? undefined : parsed,
                            })
                          }}
                        />
                      </td>
                      <td>{cost != null ? <Tag value="Conciliado" /> : <Tag value="Pendente" />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="breakdown-note">
          Nome e custo ficam salvos no banco do proxy (SQLite no servidor) e alimentam Lucro e Margem em todas as
          telas — de qualquer dispositivo.
        </p>
        {dbError && (
          <p className="breakdown-note is-error">
            Falha ao salvar no banco: {dbError} — verifique se o proxy está rodando; o valor digitado vale só nesta
            sessão.
          </p>
        )}
      </Panel>

      <section className="footnote">
        Cobertura de custo: {amazonSkus.length ? pct((comCusto / amazonSkus.length) * 100) : pct(0)} dos SKUs com extrato.
      </section>
    </>
  )
}
