import { useState } from 'react'
import { CalendarClock, FileCheck2, PackageCheck, Tag as TagIcon, Upload } from 'lucide-react'
import { brl, num, repricer, shipments, stock } from '../data'
import { PageHeader, Panel, StatTile, Tag, TabBar } from '../components/ui'

const tabs = ['Inventário FBA e FULL', 'Envios DBA / FBA', 'Notas fiscais', 'Precificadora']

export default function OperationsPage() {
  const [tab, setTab] = useState(tabs[0])
  const [notice, setNotice] = useState('')
  const [rules, setRules] = useState(repricer)

  const totalFba = stock.reduce((sum, item) => sum + item.fba, 0)
  const totalFull = stock.reduce((sum, item) => sum + item.full, 0)
  const lowStock = stock.filter((item) => item.coverage < 10).length
  const incoming = stock.reduce((sum, item) => sum + item.incoming, 0)

  const pendingInvoice = shipments.filter((item) => item.invoice === 'Pendente').length
  const toSchedule = shipments.filter((item) => item.pickup === 'A agendar').length
  const withoutLabel = shipments.filter((item) => !item.label).length

  const act = (message: string) => setNotice(message)

  const toggleRule = (sku: string) => {
    setRules((current) =>
      current.map((rule) => (rule.sku === sku ? { ...rule, state: rule.state === 'Ativo' ? 'Pausado' : 'Ativo' } : rule)),
    )
    setNotice('Regra de precificação atualizada e registrada no histórico.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Estoque, envios e fiscal"
        description="Posição por modelo de fulfillment, etiquetas e coletas em lote, controle fiscal por pedido e precificação automática."
        action={
          <button className="primary" onClick={() => act('Sincronização manual acionada para os canais conectados.')}>
            <PackageCheck size={17} /> Sincronizar agora
          </button>
        }
      />

      <TabBar items={tabs} active={tab} onChange={setTab} />

      {tab === 'Inventário FBA e FULL' && (
        <>
          <section className="metrics">
            <StatTile label="Estoque FBA" value={num(totalFba)} hint="armazenado pela Amazon" />
            <StatTile label="Estoque FULL / próprio" value={num(totalFull)} hint="logística própria e partners" />
            <StatTile label="Em trânsito" value={num(incoming)} hint="envios a chegar" />
            <StatTile label="Reposição urgente" value={num(lowStock)} hint="cobertura abaixo de 10 dias" tone="attention" />
          </section>

          <Panel title="Posição por SKU" hint="Entradas, saídas e cobertura" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Produto</th>
                    <th>FBA</th>
                    <th>FULL / próprio</th>
                    <th>Reservado</th>
                    <th>Disponível</th>
                    <th>Em trânsito</th>
                    <th>Cobertura</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item) => {
                    const available = item.fba + item.full - item.reserved
                    const level = item.coverage === 0 ? 'Ruptura' : item.coverage < 10 ? 'Baixo' : 'Saudável'
                    return (
                      <tr key={item.sku}>
                        <td className="order">{item.sku}</td>
                        <td>
                          <b>{item.name}</b>
                        </td>
                        <td>{num(item.fba)}</td>
                        <td>{num(item.full)}</td>
                        <td className="muted">{num(item.reserved)}</td>
                        <td className="profit">{num(available)}</td>
                        <td className="muted">{item.incoming ? num(item.incoming) : '—'}</td>
                        <td>{num(item.coverage)} dias</td>
                        <td>
                          <span className={`tag ${level === 'Saudável' ? 'tag-ok' : level === 'Baixo' ? 'tag-info' : 'tag-bad'}`}>
                            {level}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="footnote">
            O alerta de reposição considera a velocidade de venda dos últimos 30 dias e o estoque já a caminho.
          </section>
        </>
      )}

      {tab === 'Envios DBA / FBA' && (
        <>
          <section className="metrics">
            <StatTile label="Coletas a agendar" value={num(toSchedule)} hint="pedidos DBA elegíveis" tone="attention" />
            <StatTile label="Etiquetas pendentes" value={num(withoutLabel)} hint="download em lote disponível" tone="attention" />
            <StatTile label="XML pendente" value={num(pendingInvoice)} hint="pré-requisito para coleta" tone="attention" />
            <StatTile label="Frete do período" value={brl(shipments.reduce((sum, item) => sum + item.freight, 0))} hint="custo por pedido" />
          </section>

          <div className="button-row inline">
            <button className="primary" onClick={() => act(`${withoutLabel} etiquetas geradas em lote e prontas para download.`)}>
              <TagIcon size={16} /> Gerar etiquetas em lote
            </button>
            <button className="ghost lg" onClick={() => act(`${toSchedule} pedidos enviados para agendamento de coleta.`)}>
              <CalendarClock size={16} /> Agendar coletas
            </button>
            <button className="ghost lg" onClick={() => act('Upload de XML de nota fiscal selecionado.')}>
              <Upload size={16} /> Enviar XML
            </button>
          </div>

          <Panel title="Pedidos para expedição" hint="Modelo de logística por pedido" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Expedição</th>
                    <th>Pedido</th>
                    <th>Modelo</th>
                    <th>Nota fiscal</th>
                    <th>Coleta</th>
                    <th>Etiqueta</th>
                    <th>Frete</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((item) => (
                    <tr key={item.id}>
                      <td className="order">{item.id}</td>
                      <td className="mono">{item.order}</td>
                      <td>
                        <span className="channel">{item.model}</span>
                      </td>
                      <td>
                        <Tag value={item.invoice} />
                      </td>
                      <td>
                        <Tag value={item.pickup} />
                      </td>
                      <td>
                        <span className={item.label ? 'tag tag-ok' : 'tag tag-warn'}>{item.label ? 'Disponível' : 'Pendente'}</span>
                      </td>
                      <td>{item.freight ? brl(item.freight) : '—'}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => act(`Etiqueta do pedido ${item.order} baixada em PDF.`)}
                          disabled={item.invoice === 'Pendente'}
                        >
                          {item.invoice === 'Pendente' ? 'XML pendente' : 'Baixar etiqueta'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="notice">
            <FileCheck2 size={18} />
            <div>
              <b>Ordem de execução validada</b>
              <p>
                A validação do XML vem antes do agendamento de coleta. Pedidos sem nota fiscal aceita ficam bloqueados até a
                regularização.
              </p>
            </div>
          </section>
        </>
      )}

      {tab === 'Notas fiscais' && (
        <>
          <section className="metrics">
            <StatTile label="Aceitas" value={num(shipments.filter((s) => s.invoice === 'Aceita').length)} hint="conforme o marketplace" tone="positive" />
            <StatTile label="Pendentes" value={num(pendingInvoice)} hint="aguardando upload ou análise" tone="attention" />
            <StatTile label="Não necessárias" value={num(shipments.filter((s) => s.invoice === 'Não necessária').length)} hint="isenção do canal" />
            <StatTile label="DANFEs gerados" value={num(shipments.filter((s) => s.invoice === 'Aceita').length)} hint="PDF por conversão" />
          </section>

          <Panel title="Status fiscal por pedido" hint="Rastreabilidade completa" className="sales-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Modelo</th>
                    <th>XML</th>
                    <th>Status fiscal</th>
                    <th>Arquivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((item) => (
                    <tr key={item.id}>
                      <td className="order">{item.order}</td>
                      <td>
                        <span className="channel">{item.model}</span>
                      </td>
                      <td className="muted">{item.invoice === 'Pendente' ? 'ausente' : 'vinculado'}</td>
                      <td>
                        <Tag value={item.invoice} />
                      </td>
                      <td className="mono">{item.invoice === 'Aceita' ? `${item.order}-nfe.pdf` : '—'}</td>
                      <td>
                        <button className="text-button" onClick={() => act(`DANFE do pedido ${item.order} gerado em PDF.`)}>
                          Baixar DANFE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {tab === 'Precificadora' && (
        <>
          <section className="metrics">
            <StatTile label="Regras ativas" value={`${rules.filter((r) => r.state === 'Ativo').length}/${rules.length}`} hint="monitoramento contínuo" />
            <StatTile label="Na Buy Box" value={num(rules.filter((r) => r.buyBox <= r.current).length)} hint="preço competitivo" tone="positive" />
            <StatTile label="Abaixo do concorrente" value={num(rules.filter((r) => r.current > r.buyBox).length)} hint="ajuste automático" tone="attention" />
            <StatTile label="Última varredura" value="há 4 min" hint="preços concorrentes" />
          </section>

          <Panel
            title="Limites de preço"
            hint="Ajuste automático entre mínimo e máximo"
            action={
              <button className="ghost" onClick={() => act('Dry-run executado: nenhuma alteração publicada.')}>
                Simular alterações
              </button>
            }
            className="sales-panel"
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Produto</th>
                    <th>Preço atual</th>
                    <th>Mínimo</th>
                    <th>Máximo</th>
                    <th>Buy Box</th>
                    <th>Sugestão</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const suggestion = Math.min(Math.max(rule.buyBox, rule.minimum), rule.maximum)
                    const change = suggestion - rule.current
                    return (
                      <tr key={rule.sku}>
                        <td className="order">{rule.sku}</td>
                        <td>
                          <b>{rule.name}</b>
                        </td>
                        <td>{brl(rule.current)}</td>
                        <td className="muted">{brl(rule.minimum)}</td>
                        <td className="muted">{brl(rule.maximum)}</td>
                        <td>{brl(rule.buyBox)}</td>
                        <td className={change === 0 ? 'muted' : change < 0 ? 'loss' : 'profit'}>
                          {change === 0 ? 'manter' : brl(change)}
                        </td>
                        <td>
                          <button className="text-button" onClick={() => toggleRule(rule.sku)}>
                            {rule.state}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <section className="footnote">
            Guardas da precificadora: limites mínimos e máximos obrigatórios, simulação antes da publicação e registro de toda
            alteração enviada ao marketplace.
          </section>
        </>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button className="toast-close" onClick={() => setNotice('')}>
            Fechar
          </button>
        </div>
      )}
    </>
  )
}
