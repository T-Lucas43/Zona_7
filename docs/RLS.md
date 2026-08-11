# Políticas RLS

Todas as tabelas públicas têm RLS habilitado e forçado.

## Regras centrais

- `profiles` e `user_preferences`: somente o próprio usuário; administrador da plataforma pode ler perfis.
- `campaigns` e `campaign_members`: somente membros ativos da campanha.
- Escrita de campanha: proprietário, mestre e, quando permitido, co-mestre.
- `characters`: mestres leem a linha completa. O proprietário recebe sua ficha pela função protegida `get_player_character_sheet`, já filtrada pelas opções de `character_sheet_settings`; personagem `gm_only` nunca chega ao jogador.
- Recursos, atributos, perícias, itens e condições: proprietário da ficha somente quando a seção correspondente foi liberada pelo mestre; recursos críticos mudam por RPC.
- Habilidade selada: o vínculo não é selecionável pelo jogador. Habilidade mascarada entrega somente `public_override`/pista autorizada. O segredo mestre fica em `ability_secrets`.
- Atores, mapas e tokens: leitura segue vínculo da campanha e visibilidade do ator/token. Retratos exclusivos ficam no bucket privado `actor-portraits`; mapas publicados aos jogadores ficam em `handouts-public`. Roteiros continuam exclusivos do mestre.
- Notas de ficha: `gm_only`, `owner_only` e campanha usam políticas próprias; nota exclusiva não é enviada ao cliente sem autorização.
- Mensagem: somente destinatário ou mestre. `message_sender_secrets` tem exclusivamente política de mestre.
- Handout: visibilidade pública/de campanha ou concessão em `handout_access`.
- `session_public_state`: qualquer membro ativo pode ler somente título, resumo e objetivo públicos; apenas mestres escrevem. Roteiros e notas continuam em tabelas com política exclusiva do mestre.
- Ocultar personagem altera a visibilidade do ator e do token. O jogador deixa de receber ambos pela própria política, sem depender apenas de CSS.
- Dados: autor, mestre ou sessão, conforme a visibilidade.
- Notificações: próprio usuário; mestres podem acompanhar alertas da campanha.
- Auditoria e eventos agendados: mestres; clientes não inserem ou apagam auditoria diretamente.
- Storage: primeiro segmento do caminho é o UUID da campanha; arquivos privados verificam concessão, propriedade ou visibilidade do ator. Nenhuma chave administrativa é enviada ao navegador.

## Testes

`supabase/tests/database/rls.test.sql` usa pgTAP para validar separação de segredos, estado público da sessão e assinaturas das funções transacionais de criação, entrega e visibilidade.

```bash
supabase test db
```

Para um teste completo entre dois usuários, rode o bootstrap com ao menos dois e-mails de jogador e tente consultar a ficha/mensagem com os JWTs individuais. O banco deve retornar zero linhas, não conteúdo censurado.
