# Amaro Iphone - Arquitetura da primeira entrega

## Visao tecnica

O sistema e um monorepo com tres limites explicitos:

- `client/`: PWA React + TypeScript. A UI le e escreve somente pela camada de dominio local.
- `client/src/db/`: banco IndexedDB (Dexie), log de auditoria e fila de sincronizacao. E a fonte de verdade enquanto o dispositivo estiver offline.
- `server/`: API REST Fastify + PostgreSQL. Recebe operacoes idempotentes e distribui alteracoes entre dispositivos. O servidor nao e requisito para concluir uma venda ou OS localmente.

Cada registro de negocio possui UUID, autor, dispositivo, timestamps, soft-delete e estado de sincronizacao. Cada mudanca gera uma operacao com `operationId` unico na fila. O servidor grava `operationId` com restricao unica, portanto uma tentativa repetida nunca duplica venda, baixa de estoque ou recebimento.

## Sincronizacao

1. Uma transacao local atualiza as entidades, cria o log de auditoria e inclui uma entrada `pending` em `syncQueue` no mesmo `db.transaction`.
2. O `SyncEngine` detecta `online`, envia lotes ordenados por criacao para `POST /v1/sync/push` e confirma apenas as operacoes aceitas pelo servidor.
3. Em seguida busca `GET /v1/sync/pull?cursor=` e aplica registros remotos em transacao local.
4. Versoes concorrentes nao sao sobrescritas: o registro entra em `syncConflicts`, fica com estado `conflict` e exige decisao do usuario autorizado.
5. Falhas permanecem na fila com mensagem e tentativa registrada. Nada e descartado automaticamente.

Movimentos de estoque, pagamentos e caixa sao eventos imutaveis. Saldo de estoque e caixa sao projeções locais calculadas/atualizadas dentro da mesma transacao; conflitos nesses agregados devem ser tratados pela central, nunca por "ultimo gravou vence".

## Modelo de dados

Entidades nucleares da entrega atual: `customers`, `products`, `stockMovements`, `sales`, `saleItems`, `payments`, `cashMovements`, `serviceOrders`, `serviceOrderItems`, `warranties`, `auditLogs`, `syncQueue`, `syncConflicts` e `settings`.

O esquema inicial da projecao relacional esta em `server/db/schema.sql`. Todas as tabelas de negocio seguem os campos de rastreabilidade `id`, `uuid`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by` e `sync_status`; os modulos posteriores devem preservar esse contrato.

Relacoes criticas:

```text
customer -> device -> service_order -> service_order_item -> stock_movement
                                  -> payment -> cash_movement -> warranty
customer -> sale -> sale_item -> stock_movement
                 -> payment -> cash_movement -> account_receivable
supplier -> purchase -> purchase_item -> stock_movement -> account_payable
```

## Mapa de telas

### Entrega atual

- Dashboard: indicadores locais e alertas de estoque.
- PDV: busca por codigo/nome/SKU, carrinho, cliente, pagamento, estoque e caixa em uma transacao.
- Ordens de servico: abertura, cliente/equipamento, status e consumo de pecas.
- Clientes: cadastro e consulta rapida.
- Produtos: cadastro, precificacao, estoque minimo e entrada manual auditada.
- Estoque: saldo, alertas e historico de movimentacoes.
- Central de sincronizacao: conectividade, pendencias, erros, conflitos e sincronizacao manual.
- Configuracoes: identidade do dispositivo e carga/remoção explicita de dados DEMO.

### Modulos planejados sobre os mesmos contratos

- Compras e fornecedores; financeiro; caixa com abertura/fechamento; orcamentos; equipamentos e checklist; garantias; relatorios; usuarios/permissoes; backup; impressao e integracoes.

## Limites da primeira entrega

Esta entrega nao declara integracoes fiscais, meios de pagamento, WhatsApp, impressoras ou servidor PostgreSQL como configurados. Os pontos de integracao possuem contratos documentados; nenhum botao simula uma integracao externa.
