# Amaro Iphone - Sistema de Gestao Online

Sistema completo de gestao para loja de celulares e assistencia tecnica.

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite
- **Backend**: Fastify + TypeScript
- **Banco**: PostgreSQL
- **Deploy**: GitHub Pages (frontend) + Railway/Render (backend + DB)

## Estrutura

```
client/     → Frontend React (SPA)
server/     → API Fastify
```

## Setup Local

### Backend

```bash
cd server
cp .env.example .env
# Edite .env com suas credenciais de banco
npm install
# Crie o banco PostgreSQL e rode o schema:
psql -U user -d database -f db/schema.sql
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

O frontend roda em `http://localhost:5173` e procura a API em `http://localhost:3001`.

## Deploy

### Frontend (GitHub Pages)

1. Crie um repositorio no GitHub
2. Push do codigo
3. No GitHub Actions, adicione um workflow para build e deploy:
   - Build: `cd client && npm install && npm run build`
   - Deploy: pasta `client/dist`
4. Configure o `VITE_API_URL` como variavel de ambiente no build

### Backend (Railway)

1. Crie uma conta no [Railway](https://railway.app)
2. Crie um novo projeto
3. Adicione um PostgreSQL addon
4. Configure as variaveis de ambiente:
   - `DATABASE_URL` (auto-configure pelo addon)
   - `JWT_SECRET` (gere uma chave segura)
   - `CORS_ORIGIN` (dominio do frontend)
5. Conecte o repositorio GitHub
6. Railway faz deploy automatico

### Banco (Neon)

1. Crie uma conta no [Neon](https://neon.tech)
2. Crie um projeto
3. Copie a connection string para `DATABASE_URL`
4. Rode o `db/schema.sql` no SQL editor do painel

## API Endpoints

### Auth
- `POST /v1/auth/register` → Criar conta
- `POST /v1/auth/login` → Login
- `GET /v1/auth/me` → Dados do usuario logado

### Customers
- `GET /v1/customers` → Listar
- `POST /v1/customers` → Criar
- `PUT /v1/customers/:uuid` → Atualizar
- `DELETE /v1/customers/:uuid` → Excluir

### Products
- `GET /v1/products` → Listar
- `POST /v1/products` → Criar
- `PUT /v1/products/:uuid` → Atualizar
- `DELETE /v1/products/:uuid` → Excluir
- `POST /v1/products/:uuid/stock` → Entrada/Saida de estoque

### Sales
- `GET /v1/sales` → Listar
- `POST /v1/sales` → Criar (baixa estoque + registra caixa)

### Service Orders
- `GET /v1/service-orders` → Listar
- `POST /v1/service-orders` → Criar
- `PUT /v1/service-orders/:uuid/status` → Atualizar status
- `POST /v1/service-orders/:uuid/parts` → Consumir peca

### Financial
- `GET /v1/financial` → Listar
- `POST /v1/financial` → Criar
- `POST /v1/financial/:uuid/pay` → Registrar pagamento
- `DELETE /v1/financial/:uuid` → Cancelar

### Suppliers
- `GET /v1/suppliers` → Listar
- `POST /v1/suppliers` → Criar
- `DELETE /v1/suppliers/:uuid` → Excluir

### Purchase Orders
- `GET /v1/purchase-orders` → Listar
- `POST /v1/purchase-orders` → Criar
- `PUT /v1/purchase-orders/:uuid/status` → Atualizar status
- `POST /v1/purchase-orders/:uuid/receive` → Receber item
