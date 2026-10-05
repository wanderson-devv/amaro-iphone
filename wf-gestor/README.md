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

## Sincronização com a Amazon (SP-API real)

Não existe modo simulado: o painel só consulta a **Selling Partner API** por meio do proxy em `wf-gestor/server/`.

| Pasta | Papel |
| --- | --- |
| `src/integrations/types.ts` | Contrato `ChannelConnector`, recursos e erros |
| `src/integrations/amazon/connector.ts` | `AmazonSpApiConnector` (chama o proxy) + URL do proxy |
| `src/integrations/sync.ts` | Motor de sincronização, progresso, última execução |
| `server/` | Proxy Fastify que guarda as credenciais LWA e fala com a Amazon |

Rotas do proxy:

```
GET /health                     → status do serviço
GET /amazon/health              → credenciais configuradas?
GET /amazon/orders?since=       → Orders API        (paginado, até 10 páginas)
GET /amazon/settlements?since=  → Finances API      (financialEvents, fallback summaries)
GET /amazon/inventory?since=    → FBA Inventory     (summaries)
GET /amazon/listings?since=     → Listings Items    (precisa SP_API_SELLER_ID)
```

### Rodar o proxy

```bash
cd wf-gestor/server
cp .env.example .env     # preencha as credenciais LWA
npm install
npm run dev              # http://localhost:8787
```

No painel (Integrações → Sincronização Amazon), informe `http://localhost:8787` em **URL do proxy** e clique em Salvar, depois **Executar sincronização**.

### Passo a passo para obter as credenciais

1. Entre em Seller Central → **Configurações** → **Usar meus dados (API)** → registre-se como desenvolvedor.
2. Em **Central de Desenvolvedores**, crie um perfil de desenvolvedor (privado, para uso na própria loja).
3. Registre a aplicação: anote o **LWA client id** e o **LWA client secret**.
4. Gere o **refresh token** fazendo a autorização da própria conta (fluxo de autoautorização de app privado).
5. Marque os papéis necessários: **Orders**, **Finance and Accounting**, **Inventory**, **Product Listing**.
6. Preencha `SP_API_CLIENT_ID`, `SP_API_CLIENT_SECRET`, `SP_API_REFRESH_TOKEN`, `SP_API_SELLER_ID` no `.env` (Brasil já vem como `SP_API_MARKETPLACE_ID=A2Q3Y263D00KWC`).
7. Suba o proxy em um host com HTTPS (Railway, Render, Fly.io…) e libere o endereço do GitHub Pages em `CORS_ORIGIN`.
8. No painel, troque `http://localhost:8787` pela URL pública e execute a sincronização.

**Importante:** o proxy é o único lugar com os segredos LWA. Nunca os coloque em `VITE_*` ou no código do navegador.

Escopos usados por recurso: `Orders:Advanced`, `Finance and Accounting`, `Inventory`, `Product Listing`. A API de Anúncios (Ads) é um serviço separado e ainda não está neste proxy.

