import { useState } from 'react'
import { Database, RefreshCw, Save, ShieldCheck, User } from 'lucide-react'
import { num } from '../data'
import {
  DEFAULT_PROXY_URL,
  describeSync,
  readProxyUrl,
  reloadAppDb,
  runSyncNow,
  setAutoSyncEnabled,
  useAmazonSkus,
  useAppDb,
  useAutoSyncStatus,
  writeProxyUrl,
} from '../integrations'
import { PageHeader, Panel, StatTile, Tag } from '../components/ui'

export default function SettingsPage() {
  const autoSync = useAutoSyncStatus()
  const db = useAppDb()
  const { skus: skuMeta } = useAmazonSkus()
  const [proxyUrl, setProxyUrl] = useState(() => readProxyUrl())
  const [notice, setNotice] = useState('')
  const [reloading, setReloading] = useState(false)

  const skuCount = Object.keys(skuMeta).length
  const backendLabel = db.backend === 'neon' ? 'Neon (Postgres na nuvem)' : 'SQLite local do proxy'
  const proxyOnline = autoSync.ok !== false

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
    void runSyncNow()
  }

  const reload = async () => {
    setReloading(true)
    await reloadAppDb()
    setReloading(false)
    setNotice('Dados recarregados do banco.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Preferências"
        title="Configurações"
        description="Conta conectada, sincronização automática e banco de dados do aplicativo."
      />

      <section className="metrics">
        <StatTile
          label="Banco de dados"
          value={db.backend === 'neon' ? 'Neon' : 'SQLite'}
          hint={backendLabel}
          tone="positive"
        />
        <StatTile label="SKUs cadastrados" value={num(skuCount)} hint="nome, custo e imposto" />
        <StatTile
          label="Auto-sync"
          value={autoSync.enabled ? 'Ligado' : 'Pausado'}
          hint={autoSync.enabled ? 'a cada 5 min' : 'manual'}
          tone={autoSync.enabled ? 'positive' : 'attention'}
        />
        <StatTile
          label="Proxy"
          value={proxyOnline ? 'Online' : 'Offline'}
          hint="servidor SP-API local"
          tone={proxyOnline ? 'positive' : 'attention'}
        />
      </section>

      <div className="two-col">
        <Panel title="Conta e loja" hint="Perfil conectado">
          <dl className="integration-meta">
            <div>
              <dt>Loja conectada</dt>
              <dd>Amazon.com.br</dd>
            </div>
            <div>
              <dt>Marketplace</dt>
              <dd>A2Q3Y263D00KWC</dd>
            </div>
            <div>
              <dt>Usuário</dt>
              <dd>Wanderson F. · Administrador</dd>
            </div>
            <div>
              <dt>Última sincronização</dt>
              <dd>{autoSync.lastSync ?? 'nunca'}</dd>
            </div>
          </dl>
          <div className="method">
            <ShieldCheck size={14} />
            <span>Credenciais LWA ficam apenas no proxy local — o navegador recebe só o resultado das consultas.</span>
          </div>
        </Panel>

        <Panel title="Sincronização" hint="Amazon SP-API">
          <label className="auto-sync">
            <input
              type="checkbox"
              checked={autoSync.enabled}
              onChange={(event) => {
                setAutoSyncEnabled(event.target.checked)
                setNotice(
                  event.target.checked
                    ? 'Sincronização automática ligada: a cada 5 minutos com a aba aberta.'
                    : 'Sincronização automática pausada. Use “Sincronizar agora” quando quiser.',
                )
              }}
            />
            <span>
              <b>Sincronização automática</b>
              <small>pedidos, estoque e financeiro a cada 5 minutos e ao voltar para a aba</small>
            </span>
          </label>
          <p className="hint-text">
            Status: {describeSync(autoSync)}. Detalhes por recurso ficam na aba Integrações.
          </p>
          <button className="ghost lg full" onClick={() => void runSyncNow()} disabled={autoSync.running}>
            <RefreshCw size={15} className={autoSync.running ? 'spin' : ''} />
            {autoSync.running ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </Panel>
      </div>

      <Panel title="Conexão e dados" hint="Proxy SP-API e banco">
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

        <dl className="integration-meta">
          <div>
            <dt>Banco de dados</dt>
            <dd>
              <Tag value="Conectado" /> {backendLabel}
            </dd>
          </div>
          <div>
            <dt>O que fica salvo</dt>
            <dd>Nome, custo e imposto dos SKUs · snapshot e última sync</dd>
          </div>
        </dl>

        <div className="method">
          <Database size={14} />
          <span>
            Nome, custo e alíquota de imposto por SKU ficam no banco e valem de qualquer dispositivo. Recarregue para
            puxar alterações feitas em outra aba ou máquina.
          </span>
        </div>

        <button className="ghost lg full" onClick={() => void reload()} disabled={reloading}>
          <RefreshCw size={15} className={reloading ? 'spin' : ''} />
          {reloading ? 'Recarregando…' : 'Recarregar dados do banco'}
        </button>
      </Panel>

      <section className="footnote">
        <User size={14} /> WF Gestor · perfil administrador · dados reais da Amazon via SP-API.
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
