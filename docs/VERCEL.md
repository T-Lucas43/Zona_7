# Deploy na Vercel

## Antes do deploy

1. Faça o build local: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
2. Importe o repositório na Vercel como Next.js.
3. Use Node.js 22 e pnpm.
4. Adicione todas as variáveis de `.env.example` necessárias ao ambiente.
5. Gere um `CRON_SECRET` aleatório e forte; nunca use a chave do Supabase como segredo do cron.
6. Mantenha `SUPABASE_SERVICE_ROLE_KEY` somente nos ambientes de servidor. Ela é necessária para o mestre criar e administrar contas, mas jamais pode usar o prefixo `NEXT_PUBLIC_`.

## Ambientes

- Development: `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- Preview: use a URL de preview quando fixa ou derive o host para callbacks autorizados.
- Production: use o domínio final em `NEXT_PUBLIC_APP_URL`.

Cadastre URLs local, preview e produção no Supabase Auth. Cookies são `Secure` em produção e devem ser testados também em subdomínios de preview.

## Cron

`vercel.json` chama `/api/cron/process-events` a cada cinco minutos. A rota exige `Authorization: Bearer ${CRON_SECRET}`. Esse cron é uma rede de segurança; durante sessões, o painel deve chamar o processador autenticado em intervalo curto e idempotente.

## Arquivos

O runtime não grava no filesystem. Retratos, documentos, áudio e vídeo vão para Supabase Storage. Apenas URLs assinadas temporárias são entregues ao navegador.

## Checklist pós-deploy

- Login, recuperação e convite redirecionam ao domínio correto.
- Mestre cria campanha e convida jogador.
- Mestre cria conta com senha temporária, atribui/troca/remove personagem e o primeiro acesso exige nova senha.
- Jogador não abre ficha de outro usuário.
- Jogador não recebe campo ou seção ainda não liberada e vê o mapa publicado em tempo real.
- Dano aparece nos dois dispositivos e gera uma auditoria.
- Cruzamento de 25% alerta uma vez; recuperação rearma o limite.
- Mensagem privada não aparece em outra conta nem em push.
- Rolagem, combate, handout privado e upload funcionam.
- Cron rejeita requisição sem Bearer e processa evento uma vez.
- Viewports de 375px e 1440px, teclado, foco e movimento reduzido foram verificados.
