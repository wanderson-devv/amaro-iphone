import { useState } from 'react'
import { CheckCircle2, CircleHelp, Link, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { num } from '../data'
import {
  DEFAULT_PROXY_URL,
  describeSync,
  getAutoSyncStatus,
  readProxyUrl,
  readSyncSnapshot,
  runSyncNow,
  setAutoSyncEnabled,
  syncResources,
  useAutoSyncStatus,
  writeProxyUrl,
} from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

const AMAZON_METHODS = ['Autorização via Selling Partner Portal', 'Token LWA no proxy local', 'Escopos por recurso']
const AMAZON_CAPABILITIES = ['Pedidos e itens', 'Extrato financeiro', 'Estoque FBA', 'Anúncios e catálogo']

export default function IntegrationsPage() {
  const [notice, setNotice] = useState('')
  const autoSync = useAutoSyncStatus()
  const running = autoSync.running
  const amazonStates = autoSync.states
  const [proxyUrl, setProxyUrl] = useState(() => readProxyUrl())
  const configured = Boolean(proxyUrl)
  const snapshot = readSyncSnapshot()
  const ordersSynced = snapshot?.orders ?? 0
  const amazonConnected = autoSync.ok !== false

  const saveProxy = () => {
    const typed = proxyUrl.trim()
    writeProxyUrl(typed)
    const saved = readProxyUrl()
    setProxyUrl(saved)
    setNotice(
      saved === DEFAULT_PROXY_URL
        ? `Proxy local padrão em uso: ${saved}. Sincronizando agora.`
        : `Endereço do proxy salvo: ${saved}. Sincronizando agora.`,
    )
    void run()
  }

  const run = async () => {
    if (autoSync.running) return
    await runSyncNow()
  }

  const sync = () => {
    void run()
  }

  return (
    <>
      <PageHeader
        eyebrow="Integrações"
        title="Conta Amazon conectada"
        description="Vinculo oficial via Selling Partner API: credenciais LWA só no proxy local e status de sincronização visível."
        action={
          <button className="primary" onClick={sync}>
            <RefreshCw size={17} className={running ? 'spin' : ''} /> Sincronizar agora
          </button>
        }
      />

      <section className="metrics">
        <StatTile
          label="Canal conectado"
          value={amazonConnected ? '1' : '0'}
          hint="Amazon SP-API"
          tone={amazonConnected ? 'positive' : 'attention'}
        />
        <StatTile label="Pedidos sincronizados" value={num(ordersSynced)} hint="última sincronização" />
        <StatTile
          label="Recursos disponíveis"
          value={`${amazonStates.filter((item) => item.status === 'ok').length}/${amazonStates.length}`}
          hint="pedidos, extrato, estoque e anúncios"
        />
        <StatTile
          label="Próxima varredura"
          value={!autoSync.enabled ? 'pausada' : running ? 'agora' : 'em até 5 min'}
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
            <Tag value={autoSync.ok === false ? 'Proxy indisponível' : configured ? 'Proxy ativo' : 'Sem proxy'} />
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
        <article className="panel integration-card">
          <header>
            <span className="channel-badge badge-amazon">AM</span>
            <div>
              <h2>Amazon</h2>
              <small>Amazon.com.br · SP-API</small>
            </div>
            <Tag value={amazonConnected ? 'Conectado' : 'Ver proxy'} />
          </header>

          <dl className="integration-meta">
            <div>
              <dt>Última sincronização</dt>
              <dd>{autoSync.lastSync ?? 'nunca'}</dd>
            </div>
            <div>
              <dt>Pedidos</dt>
              <dd>{num(ordersSynced)}</dd>
            </div>
            <div>
              <dt>Recursos</dt>
              <dd>
                {amazonStates.filter((item) => item.status === 'ok').length}/{amazonStates.length}
              </dd>
            </div>
          </dl>

          <div className="capability-list">
            {AMAZON_CAPABILITIES.map((item) => (
              <span key={item}>
                <CheckCircle2 size={13} /> {item}
              </span>
            ))}
          </div>

          <div className="method">
            <ShieldCheck size={14} />
            <span>{AMAZON_METHODS.join(' · ')}</span>
          </div>

          <button className="ghost lg full" onClick={sync}>
            <RefreshCw size={15} className={running ? 'spin' : ''} /> Sincronizar canal
          </button>
        </article>
      </div>

      <div className="two-col">
        <Panel title="Escopo de dados" hint="Menor privilégio por integração">
          <div className="scope-list">
            <div>
              <b>Amazon SP-API</b>
              <p>{AMAZON_METHODS.join(' · ')}</p>
            </div>
          </div>
          <p className="hint-text">
            Nenhum total é apresentado como “tempo real” sem a data de atualização ao lado. Falhas de sincronização
            aparecem com motivo e nova tentativa.
          </p>
        </Panel>

        <Panel title="Saúde das sincronizações" hint="Atraso e falhas ficam visíveis">
          <ul className="sync-health">
            <li>
              <span className={`dot ${autoSync.ok === true ? 'on' : ''}`} /> Amazon · {describeSync(autoSync)}
            </li>
          </ul>
          <p className="hint-text">
            Autorize a conta no Solution Provider Portal e mantenha o proxy local rodando para dados sempre atualizados.
          </p>
        </Panel>
      </div>

      <section className="footnote">
        <Link size={14} /> Demais canais entram aqui quando tiverem integração oficial configurada.
      </section>

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
