import { useState } from 'react'
import { AlertOctagon, ArrowLeftRight, Download } from 'lucide-react'
import { brl, dre, num, payouts, pct } from '../data'
import { PageHeader, Panel, StatTile, Tag, TabBar } from '../components/ui'

const tabs = ['DRE financeiro', 'Conciliação', 'Custos operacionais']

const operatingCosts = [
  { label: 'Software e ferramentas', value: 684.0, fixed: true },
  { label: 'Armazenagem e logística', value: 742.5, fixed: false },
  { label: 'Equipe e terceirizados', value: 1120.0, fixed: true },
  { label: 'Embalagens e suprimentos', value: 318.4, fixed: false },
  { label: 'Taxas bancárias e maquininhas', value: 96.3, fixed: false },
]

export default function FinancePage() {
  const [tab, setTab] = useState(tabs[0])

  const faturamento = dre[0].value
  const liquido = dre.find((line) => line.kind === 'sub')?.value ?? 0
  const lucroBruto = dre.find((line) => line.label === 'Lucro bruto')?.value ?? 0
  const lucroLiquido = dre[dre.length - 1].value

  const divergentes = payouts.filter((payout) => payout.status !== 'Conferido')
  const diferenca = divergentes.reduce((sum, payout) => sum + (payout.expected - payout.paid), 0)
  const conciliado = payouts.filter((payout) => payout.status === 'Conferido').length

  return (
    <>
      <PageHeader
        eyebrow="Resumo financeiro"
        title="DRE e conciliação"
        description="Do faturamento bruto ao lucro líquido, com os repasses de cada marketplace conferidos um a um."
        action={
          <button className="ghost lg">
            <Download size={16} /> Exportar DRE
          </button>
        }
      />

      <TabBar items={tabs} active={tab} onChange={setTab} />

      {tab === 'DRE financeiro' && (
        <>
          <section className="metrics">
            <StatTile label="Faturamento bruto" value={brl(faturamento)} hint="período selecionado" />
            <StatTile label="Líquido de marketplaces" value={brl(liquido)} hint="após taxas e impostos" />
            <StatTile label="Lucro bruto" value={brl(lucroBruto)} hint={`margem ${pct((lucroBruto / faturamento) * 100)}`} tone="positive" />
            <StatTile
              label="Lucro líquido operacional"
              value={brl(lucroLiquido)}
              hint={`margem ${pct((lucroLiquido / faturamento) * 100)}`}
              tone="positive"
            />
          </section>

          <div className="two-col">
            <Panel title="Demonstrativo de resultado" hint="Competência do período">
              <div className="dre">
                {dre.map((line) => (
                  <div key={line.label} className={`dre-line kind-${line.kind}`}>
                    <span>
                      {line.label}
                      {line.note && <small>{line.note}</small>}
                    </span>
                    <b>{brl(line.value)}</b>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="stack">
              <Panel title="Composição do resultado" hint="Participação no faturamento">
                <div className="bars">
                  {[
                    ['Impostos e comissões', 27.6, 'bar-a'],
                    ['Custo dos produtos', 27.6, 'bar-b'],
                    ['Ads e despesas', 13.2, 'bar-c'],
                    ['Lucro líquido', 22.9, 'bar-d'],
                  ].map(([label, value, tone]) => (
                    <div key={label as string} className="bar-row">
                      <span>{label}</span>
                      <div className="bar-track">
                        <i className={tone as string} style={{ width: `${value as number}%` }} />
                      </div>
                      <b>{pct(value as number)}</b>
                    </div>
                  ))}
                </div>
                <p className="hint-text">
                  Política de cálculo versionada: alterações de custo, imposto ou associação geram novo recálculo, mantendo o
                  histórico anterior.
                </p>
              </Panel>

              <Panel title="Indicadores" hint="Saúde financeira">
                <div className="indicator-grid">
                  <div>
                    <span>ROAS médio</span>
                    <b>3,7x</b>
                  </div>
                  <div>
                    <span>Ticket médio</span>
                    <b>{brl(faturamento / 18)}</b>
                  </div>
                  <div>
                    <span>Custo de venda</span>
                    <b>{pct(27.6)}</b>
                  </div>
                  <div>
                    <span>Ponto de equilíbrio</span>
                    <b>{brl(19480)}</b>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {tab === 'Conciliação' && (
        <>
          <section className="metrics">
            <StatTile label="Repasse conferido" value={`${conciliado}/${payouts.length}`} hint="períodos batidos" tone="positive" />
            <StatTile label="Divergência total" value={brl(diferenca)} hint="a investigar" tone="attention" />
            <StatTile label="A receber" value={brl(payouts.find((p) => p.status === 'Pendente')?.expected ?? 0)} hint="agendado pelo canal" />
            <StatTile label="Última conferência" value="há 14 min" hint="sincronização automática" />
          </section>

          <Panel title="Repasses por marketplace" hint="Venda x recebimento" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Repasse</th>
                    <th>Canal</th>
                    <th>Período</th>
                    <th>Esperado</th>
                    <th>Recebido</th>
                    <th>Diferença</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => {
                    const diff = payout.paid - payout.expected
                    return (
                      <tr key={payout.id}>
                        <td className="order">{payout.id}</td>
                        <td>
                          <span className="channel">{payout.channel}</span>
                        </td>
                        <td className="mono">{payout.period}</td>
                        <td>{brl(payout.expected)}</td>
                        <td>{brl(payout.paid)}</td>
                        <td className={diff === 0 ? 'muted' : diff < 0 ? 'loss' : 'profit'}>
                          {diff === 0 ? '—' : brl(diff)}
                        </td>
                        <td>
                          <Tag value={payout.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="notice">
            <AlertOctagon size={18} />
            <div>
              <b>{divergentes.length} repasses com diferença</b>
              <p>
                O total apontado é de {brl(Math.abs(diferenca))}. Cada divergência abre um histórico com motivos de ajuste,
                estornos e taxas cobradas a mais.
              </p>
            </div>
            <button className="ghost">Revisar divergências</button>
          </section>
        </>
      )}

      {tab === 'Custos operacionais' && (
        <>
          <section className="metrics">
            <StatTile
              label="Despesas do mês"
              value={brl(operatingCosts.reduce((sum, item) => sum + item.value, 0))}
              hint="custos fixos e variáveis"
            />
            <StatTile label="Custo fixo mensal" value={brl(operatingCosts.filter((c) => c.fixed).reduce((s, c) => s + c.value, 0))} hint="recorrentes" />
            <StatTile label="Custo variável" value={brl(operatingCosts.filter((c) => !c.fixed).reduce((s, c) => s + c.value, 0))} hint="oscila com volume" />
            <StatTile label="Por pedido" value={brl(operatingCosts.reduce((s, c) => s + c.value, 0) / 18)} hint="sobre 18 pedidos" />
          </section>

          <Panel
            title="Despesas operacionais"
            hint="Entradas manuais com vigência"
            action={
              <button className="primary">
                <ArrowLeftRight size={16} /> Lançar despesa
              </button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Natureza</th>
                    <th>Valor mensal</th>
                    <th>Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {operatingCosts.map((cost) => {
                    const total = operatingCosts.reduce((sum, item) => sum + item.value, 0)
                    return (
                      <tr key={cost.label}>
                        <td>
                          <b>{cost.label}</b>
                        </td>
                        <td>
                          <span className="channel">{cost.fixed ? 'Fixo' : 'Variável'}</span>
                        </td>
                        <td>{brl(cost.value)}</td>
                        <td>{pct((cost.value / total) * 100)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="footnote">
            Despesas cadastradas entram automaticamente no DRE e no cálculo de margem por produto ({num(operatingCosts.length)}{' '}
            categorias ativas).
          </section>
        </>
      )}
    </>
  )
}
