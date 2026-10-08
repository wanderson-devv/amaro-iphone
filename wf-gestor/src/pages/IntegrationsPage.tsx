import { useState } from 'react'
import { CheckCircle2, CircleHelp, Link, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { accounts, num, type Channel } from '../data'
import {
  describeSync,
  getAutoSyncStatus,
  readProxyUrl,
  runSyncNow,
  setAutoSyncEnabled,
  syncResources,
  useAutoSyncStatus,
  writeProxyUrl,
} from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

const methods: Record<Channel, string[]> = {
  Amazon: ['Autorização via Selling Partner', 'Sandbox antes de produção', 'Escopos por recurso'],
  'Mercado Livre': ['OAuth do vendedor', 'App oficial registrado', 'Renovação automática do token'],
  Shopee: ['OAuth da loja', 'Assinatura de requisições', 'Ambiente de teste'],
  'TikTok Shop': ['OAuth da loja', 'Escopos de pedidos e catálogo', 'Retentativa com backoff'],
}

const capabilities: Record<Channel, string[]> = {
  Amazon: ['Pedidos e extrato', 'FBA e DBA', 'Anúncios', 'Precificação'],
  'Mercado Livre': ['Pedidos e repasses', 'Anúncios', 'Estoque', 'Custos'],
  Shopee: ['Pedidos e repasses', 'Estoque', 'Custos'],
  'TikTok Shop': ['Pedidos', 'Estoque', 'Custos'],
}

export default function IntegrationsPage() {
  const [state, setState] = useState(accounts)
  const [notice, setNotice] = useState('')
  const autoSync = useAutoSyncStatus()
  const running = autoSync.running
  const amazonStates = autoSync.states
  const [proxyUrl, setProxyUrl] = useState(() => readProxyUrl())
  const configured = Boolean(proxyUrl)

  const saveProxy = () => {
    writeProxyUrl(proxyUrl)
    const saved = readProxyUrl()
    setProxyUrl(saved)
    setNotice(
      saved
        ? `Endereço do proxy salvo: ${saved}. A sincronização usará esse servidor.`
        : 'Campo limpo. Informe o endereço do proxy para sincronizar com a Amazon.',
    )
  }

  const run = async () => {
    if (autoSync.running) return
    await runSyncNow()
    if (getAutoSyncStatus().ok) {
      setState((current) =>
        current.map((account) => (account.channel === 'Amazon' ? { ...account, lastSync: 'agora mesmo' } : account)),
      )
    }
  }

  const connect = (channel: Channel) => {
    setState((current) =>
      current.map((account) =>
        account.channel === channel
          ? { ...account, status: 'Conectado', lastSync: 'agora mesmo' }
          : account,
      ),
    )
    setNotice(`Conexão com ${channel} confirmada. A primeira sincronização foi iniciada.`)
    if (channel === 'Amazon') void run()
  }

  const sync = () => {
    void run()
    setState((current) => current.map((account) => ({ ...account, lastSync: 'agora mesmo' })))
    setNotice('Sincronização solicitada em todos os canais conectados.')
  }

  const syncChannel = (channel: Channel) => {
    if (channel === 'Amazon') {
      void run()
      return
    }
    setState((current) =>
      current.map((account) => (account.channel === channel ? { ...account, lastSync: 'agora mesmo' } : account)),
    )
    setNotice(`Sincronização de ${channel} executada.`)
  }

  const connected = state.filter((account) => account.status === 'Conectado').length
  const orders = state.reduce((sum, account) => sum + account.orders, 0)

  return (
    <>
      <PageHeader
        eyebrow="Integrações"
        title="Contas de marketplace"
        description="Vincule cada loja por autorização oficial, com escopos separados, token protegido e status de sincronização visível."
        action={
          <button className="primary" onClick={sync}>
            <RefreshCw size={17} /> Sincronizar tudo
          </button>
        }
      />

      <section className="metrics">
        <StatTile label="Canais conectados" value={`${connected}/${state.length}`} hint="contas autorizadas" tone="positive" />
        <StatTile label="Pedidos sincronizados" value={num(orders)} hint="acumulado das contas" />
        <StatTile label="Aguardando autorização" value={num(state.filter((a) => a.status === 'Pendente').length)} hint="conclua o OAuth" tone="attention" />
        <StatTile
          label="Próxima varredura"
          value={!autoSync.enabled ? 'pausada' : autoSync.running ? 'agora' : 'em até 5 min'}
          hint={autoSync.enabled ? 'agendamento automático' : 'auto-sync desligado'}
          tone={autoSync.enabled ? undefined : 'attention'}
        />
      </section>

      <Panel
        title="Sincronização Amazon"
        hint="Selling Partner API"
        className="sync-run"
        action={
          <div className="sync-run-actions">
            <Tag value={configured ? 'Proxy ativo' : 'Sem proxy'} />
            <button className="primary" onClick={() => void run()} disabled={running}>
              <RefreshCw size={16} className={running ? 'spin' : ''} />
              {running ? 'Sincronizando…' : 'Executar sincronização'}
            </button>
          </div>
        }
      >
        <div className="proxy-config">
          <label>
            <span>URL do proxy SP-API (servidor wf-gestor/server)</span>
            <input
              value={proxyUrl}
              onChange={(event) => setProxyUrl(event.target.value)}
              placeholder="http://localhost:8787"
              spellCheck={false}
            />
          </label>
          <button className="ghost lg" onClick={saveProxy}>
            <Save size={14} /> Salvar
          </button>
        </div>

        <label className="auto-sync">
          <input
            type="checkbox"
            checked={autoSync.enabled}
            onChange={(event) => {
              setAutoSyncEnabled(event.target.checked)
              setNotice(
                event.target.checked
                  ? 'Sincronização automática ligada: a cada 5 minutos com a aba aberta.'
                  : 'Sincronização automática pausada. Use “Executar sincronização” quando quiser.',
              )
            }}
          />
          <span>
            <b>Sincronização automática</b>
            <small>pedidos, estoque e financeiro a cada 5 minutos e ao voltar para a aba</small>
          </span>
        </label>

        <ul className="sync-run-list">
          {amazonStates.map((item) => {
            const meta = syncResources.find((resource) => resource.key === item.resource)!
            return (
              <li key={item.resource} className={`is-${item.status.replace(/\s+/g, '-')}`}>
                <span className="sync-mark">
                  {item.status === 'ok' ? (
                    <CheckCircle2 size={15} />
                  ) : item.status === 'erro' ? (
                    <CircleHelp size={15} />
                  ) : (
                    <RefreshCw size={15} className={item.status === 'em curso' ? 'spin' : ''} />
                  )}
                </span>
                <b>{meta.label}</b>
                <span className="scope">{meta.scope}</span>
                <span className="result">
                  {item.status === 'ok'
                    ? `${num(item.count)} registros`
                    : item.detail ?? (item.status === 'aguardando' ? 'aguardando' : '')}
                </span>
              </li>
            )
          })}
        </ul>

        <div className="sync-run-foot">
          <span className="sync-mode">
            As credenciais LWA (client_id, client_secret e refresh token) ficam apenas no servidor proxy — o navegador
            recebe somente o resultado de cada consulta.
          </span>
          <span className="last-sync">Última execução: {autoSync.lastSync ?? 'nunca'}</span>
        </div>

        {autoSync.message && (
          <div className={`sync-outcome ${autoSync.ok === true ? 'is-ok' : 'is-error'}`} role="status">
            <b>{autoSync.message}</b>
            {autoSync.hint && <p>{autoSync.hint}</p>}
          </div>
        )}
      </Panel>

      <div className="integration-grid">
        {state.map((account) => (
          <article className="panel integration-card" key={account.channel}>
            <header>
              <span className={`channel-badge badge-${account.channel.toLowerCase().replace(' ', '-')}`}>{account.channel.slice(0, 2).toUpperCase()}</span>
              <div>
                <h2>{account.channel}</h2>
                <small>{account.store}</small>
              </div>
              <Tag value={account.status} />
            </header>

            <dl className="integration-meta">
              <div>
                <dt>Conectado desde</dt>
                <dd>{account.since}</dd>
              </div>
              <div>
                <dt>Última sincronização</dt>
                <dd>{account.lastSync}</dd>
              </div>
              <div>
                <dt>Pedidos</dt>
                <dd>{num(account.orders)}</dd>
              </div>
            </dl>

            <div className="capability-list">
              {capabilities[account.channel].map((item) => (
                <span key={item}>
                  <CheckCircle2 size={13} /> {item}
                </span>
              ))}
            </div>

            <div className="method">
              <ShieldCheck size={14} />
              <span>{methods[account.channel].join(' · ')}</span>
            </div>

            {account.status === 'Conectado' ? (
              <button className="ghost lg full" onClick={() => syncChannel(account.channel)}>
                <RefreshCw size={15} /> Sincronizar canal
              </button>
            ) : (
              <button className="primary full" onClick={() => connect(account.channel)}>
                <Link size={16} /> Autorizar conta
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="two-col">
        <Panel title="Escopo de dados por canal" hint="Menor privilégio por integração">
          <div className="scope-list">
            {state.map((account) => (
              <div key={account.channel}>
                <b>{account.channel}</b>
                <p>{methods[account.channel].join(' · ')}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Saúde das sincronizações" hint="Atraso e falhas ficam visíveis">
          <ul className="sync-health">
            <li>
              <span className={`dot ${autoSync.ok === true ? 'on' : ''}`} /> Amazon · {describeSync(autoSync)}
            </li>
            <li>
              <span className="dot on" /> Mercado Livre · pedidos há 14 min
            </li>
            <li>
              <span className="dot on" /> Shopee · pedidos há 21 min
            </li>
            <li>
              <span className="dot" /> TikTok Shop · aguardando autorização
            </li>
          </ul>
          <p className="hint-text">
            Nenhum total é apresentado como “tempo real” sem a data de atualização ao lado. Falhas de sincronização aparecem com
            motivo e nova tentativa.
          </p>
        </Panel>
      </div>

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
