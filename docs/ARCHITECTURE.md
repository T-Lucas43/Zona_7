# Arquitetura

```mermaid
flowchart LR
  P[Jogador mobile] --> N[Next.js App Router]
  M[Mestre desktop] --> N
  N --> A[Supabase Auth SSR]
  N --> S[Server Actions e Route Handlers]
  S --> D[Serviços de domínio]
  D --> PG[(PostgreSQL + RLS)]
  D --> ST[Supabase Storage]
  PG --> RT[Supabase Realtime privado]
  RT --> P
  RT --> M
  VC[Vercel Cron] --> C[/api/cron/process-events]
  C --> D
```

## Limites de confiança

- O navegador recebe somente a chave pública do Supabase.
- Cookies SSR são renovados em `src/proxy.ts`.
- Mutações sensíveis passam por ações/rotas do servidor e funções SQL.
- A `service_role` aparece apenas no bootstrap de usuários e no processador de cron.
- RLS é a última barreira mesmo quando uma rota de aplicação falha.

## Organização

- `src/app`: rotas públicas, autenticação, jogador, mestre e APIs.
- `src/components`: design system e interações por domínio.
- `src/lib`: clientes Supabase, parser de dados, permissões e regras puras.
- `src/server`: ações e serviços server-only.
- `supabase/migrations`: schema, RLS, funções, Storage e Realtime.
- `supabase/seed.sql`: conteúdo da Convergência.
- `tests`: unitários, integração e E2E.

Server Components são o padrão. Componentes client-side são usados apenas para Realtime, formulários e interações locais imediatas.

## Fluxo de recurso

1. A rota autentica o usuário e valida o contrato com Zod.
2. `mutate_character_resource` bloqueia a linha do recurso.
3. A função verifica papel na campanha e idempotência.
4. O novo valor é limitado, versionado e gravado.
5. Auditoria, estados de limite e notificações são gravados na mesma transação.
6. Realtime publica apenas as linhas que o usuário pode selecionar por RLS.
