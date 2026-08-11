# Fichas, mídia, mapas e roteiros

## Conteúdo inicial

`supabase/seed.sql` cria Davi Brito, Magnus Sigvaldi, Arya Black Snape, Lize Matsunaga, Amber Moss e Gragas como seis personagens jogáveis. Cada ficha possui identidade, recursos, cinco atributos, perícias, quatro ações, seis habilidades, seis fraquezas e um medidor de seis estágios. Rivaldo existe separadamente como ator-entidade ligado a Gragas.

## Edição pelo mestre

- `CharacterIdentityEditor`: identidade, regras, versão otimista e pré-visualização segura do jogador.
- `PortraitUploader`: retrato privado associado à ficha.
- `ResourceConsole` e `MeterControl`: alterações transacionais com justificativa.
- `CharacterRulesManager`: criar, editar e arquivar perícias, ações e fraquezas.
- `AbilityManager`: criar habilidade e alterar progressivamente o estado funcional.
- `CharacterNotesEditor`: notas com autoria, horário e visibilidade.
- `CharacterCreator`: ficha jogável completa, ator, token, recursos, atributos, medidor e vínculo opcional com uma conta em uma transação.

Arquivar preserva histórico. Dados exclusivos do mestre e conteúdo ainda selado não são enviados ao jogador.

## Fotos, atores e mapas

Retratos usam o bucket `portraits`; mapas e demais materiais privados usam `handouts-private`. O caminho começa pelo UUID da campanha e a interface recebe URL assinada temporária. `MapStudio` associa a imagem à cena e registra todo movimento de token. A central integra mapa e sessão: ocultar um personagem retira também seu ator e token da visão dos jogadores.

Os seis personagens iniciais usam `public/personagens-zona7.png` como conjunto de retratos padrão no mapa. Quando o mestre envia uma foto pela ficha, o caminho público do ator é atualizado e a URL assinada substitui automaticamente o retrato padrão na central e na sala dos jogadores. Personagens novos sem foto continuam com iniciais até o primeiro envio.

## Roteiros

- `.z7.md` e `.z7.json`: parse determinístico, lista fechada de nós, validação de referências e fórmulas sem `eval`.
- TXT, DOCX e PDF: extração server-side para um rascunho manual; nenhum comando é executado durante a importação.
- Simulação: percorre arestas localmente e não altera fichas.
- Publicação: cria pacote e versão imutável, nós e arestas.
- Execução: `control_script_run` inicia, avança somente por aresta válida, pausa, retoma, improvisa e encerra. Cada comando é idempotente, auditado e distribuído em `live_session_events` com sequência crescente.

Consequências sensíveis permanecem preparadas para confirmação do mestre; o formato rejeita chaves executáveis, URLs e fórmulas inválidas.
