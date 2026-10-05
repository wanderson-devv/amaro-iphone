# WF Gestor

Painel SaaS de gestão de marketplaces (vendas, financeiro, catálogo, operação e integrações) com identidade azul e animações próprias.

Rodando localmente:

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc + vite build
npm run lint     # tsc --noEmit
```

## Publicação (GitHub Pages)

O deploy é feito pelo workflow `.github/workflows/deploy.yml` na raiz do repositório:

1. A cada push em `main` que altere `client/**` ou `wf-gestor/**`, o workflow compila os dois frontends.
2. O build do WF Gestor é copiado para `client/dist/wf-gestor/` e publicado junto com o site principal.
3. Endereço do WF Gestor: `https://<usuario>.github.io/<repositorio>/wf-gestor/`

Requisitos no GitHub: **Settings → Pages → Source = GitHub Actions** (o mesmo usado pelo site principal).

O `vite.config.ts` usa `base: './'`, então os assets funcionam nesse subcaminho sem ajuste extra.

## Sincronização com a Amazon

A camada de integração fica em `src/integrations/`:

| Arquivo | Papel |
| --- | --- |
| `types.ts` | Contrato `ChannelConnector`, recursos sincronizáveis e erros |
| `amazon/connector.ts` | `MockAmazonConnector` (simulado) e `AmazonSpApiConnector` (produção) |
| `sync.ts` | Motor de sincronização, progresso por recurso e última execução |

### Modo simulado (padrão)

Sem variável de ambiente configurada, o app usa `MockAmazonConnector`: as cinco etapas rodam com atraso realista e contam registros gerados localmente. Nenhuma requisição externa é feita.

### Modo produção (SP-API)

Defina no build:

```bash
VITE_SP_API_PROXY=https://api.seudominio.com
```

O `AmazonSpApiConnector` passa a chamar:

```
GET {VITE_SP_API_PROXY}/amazon/health
GET {VITE_SP_API_PROXY}/amazon/orders?since=AAAA-MM-DD
GET {VITE_SP_API_PROXY}/amazon/settlements?since=...
GET {VITE_SP_API_PROXY}/amazon/inventory?since=...
GET {VITE_SP_API_PROXY}/amazon/listings?since=...
GET {VITE_SP_API_PROXY}/amazon/ads?since=...
```

**Importante:** o proxy (backend) é quem guarda as credenciais LWA (`client_id`, `client_secret`, `refresh_token`) do app registrado em Seller Central. Esses segredos nunca podem entrar no código do navegador ou em variáveis `VITE_*` expostas.

Checklist para produção:

1. Criar conta de desenvolvedor e registrar o app em Seller Central ( Selling Partner API ).
2. Obter LWA app ID, client secret e refresh token.
3. Implementar o proxy com os escopos usados em `syncResources` (`Orders:Advanced`, `Finance:Read`, `Inventory:Read`, `Listings:Read`, `Advertising:Read`).
4. Publicar o proxy e apontar `VITE_SP_API_PROXY` para ele.
