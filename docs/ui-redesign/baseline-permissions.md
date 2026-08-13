# Baseline de permissões

- `campaign_owner`, `game_master` e `co_master`: administração integral da campanha.
- `player`: somente personagem vinculado e conteúdo liberado.
- `spectator`: somente conteúdo explicitamente público.
- Conteúdo secreto é filtrado no servidor e por RLS; chaves administrativas nunca chegam ao navegador.
- Resultados de sessão podem ser coletivos, mas rolagens ocultas e dados de mestre permanecem restritos.

