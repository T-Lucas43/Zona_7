# Configuração do Supabase

## Projeto e banco

1. Crie um projeto Supabase na região adequada ao grupo.
2. Instale a CLI e autentique-se.
3. Vincule o projeto: `supabase link --project-ref <PROJECT_ID>`.
4. Aplique migrations: `supabase db push`.
5. Configure `.env.local` com URL, chave pública e `service_role`.
6. Defina um mestre forte em `SEED_MASTER_EMAIL` e `SEED_MASTER_PASSWORD`.
7. Opcionalmente, informe até cinco e-mails em `SEED_PLAYER_EMAILS`.
8. Execute `pnpm db:seed`.

O SQL não contém senhas. O script cria usuários por Admin API, aplica o conteúdo idempotente e não imprime credenciais temporárias.

## Auth e redirects

Adicione em **Authentication > URL Configuration**:

- Local: `http://localhost:3000/**`
- Preview: `https://*-seu-time.vercel.app/**`
- Produção: `https://seu-dominio.com/**`

Defina o Site URL para a produção. Ative confirmação de e-mail, configure SMTP próprio para convites e mantenha proteção contra senhas vazadas.

## Buckets

As migrations criam `portraits`, `handouts-public` e `handouts-private`. Todos são privados; mesmo o bucket “public” exige vínculo com a campanha. Limites de tamanho e MIME ficam no schema.

## Realtime

As migrations adicionam somente as tabelas necessárias à publicação. Use canais privados e confirme que `Realtime Authorization` está ativo. Nunca habilite broadcast público para mensagens ou notas.

## Validação

```bash
supabase db reset
supabase test db
pnpm test
```

Depois do bootstrap, entre como dois jogadores diferentes e confirme que consultas à ficha, mensagem e handout do outro retornam zero linhas.
