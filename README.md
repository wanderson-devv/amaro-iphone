# Amaro Iphone

ERP offline-first para loja fisica e assistencia tecnica.

## Executar

```powershell
cd client
npm.cmd run dev
```

O cliente abre em `http://localhost:5173`, funciona com IndexedDB e pode ser instalado como PWA apos o build/servico em HTTPS.

Para a API, crie `server/.env` a partir de `server/.env.example`, aplique `server/db/schema.sql` em PostgreSQL e execute:

```powershell
cd server
npm.cmd run dev
```

Configure o endpoint da API em **Configuracoes**. A sincronizacao exige um token recebido de `POST /v1/auth/login`; a interface de identidade e gestao de usuarios faz parte do proximo modulo de seguranca, portanto nenhum login local ficticio foi adicionado.

## Verificacao

```powershell
cd client
npm.cmd test
npm.cmd run build
npm.cmd run lint

cd ../server
npm.cmd run check
```

Veja `ARCHITECTURE.md` para limites, modelo, sincronizacao e mapa de telas da primeira entrega.
