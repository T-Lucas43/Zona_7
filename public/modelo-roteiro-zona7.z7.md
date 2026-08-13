---
zona7_script_version: 1
id: sessao-modelo-zona-7
title: "Sessão Modelo - A Transmissão Impossível"
execution_mode: semi_automatic
start: abertura
variables:
  pressao_zona: 0
  rodada_atual: 0
  cena_atual: abertura
  sucessos: 0
  falhas: 0
  alvos_sincronizados:
    - grupo
---

:::zona7
id: abertura
type: scene_start
title: A transmissão começa
text: |
  A tela acende sete segundos antes de alguém tocar no equipamento.
  O relógio digital está avançando ao contrário.
next: pergunta_inicial
:::

:::zona7
id: pergunta_inicial
type: player_prompt
title: Pergunta ao grupo
text: "O que cada personagem faz quando reconhece a própria voz na gravação?"
next: investigar_sinal
:::

:::zona7
id: investigar_sinal
type: skill_test
title: Investigar a origem do sinal
text: "Peça um teste de Tecnologia ou Investigação. Explique a intenção antes da rolagem."
formula: character_skill
difficulty: 15
on_success: pista_principal
on_failure: consequencia_produtiva
:::

:::zona7
id: pista_principal
type: handout
title: Pista essencial
text: "A transmissão não vem do futuro: ela chega de outra versão do estúdio."
next: escolher_caminho
:::

:::zona7
id: consequencia_produtiva
type: meter_change
title: A Zona reage
text: "A pista continua disponível, mas a exposição aumenta a Pressão da Zona em 1."
meter: pressao_zona
amount: 1
next: escolher_caminho
:::

:::zona7
id: escolher_caminho
type: choice
title: Escolha do grupo
prompt: "Por onde o grupo continua?"
options:
  - id: corredor
    label: Seguir pelo corredor técnico
    goto: corredor_tecnico
  - id: cameras
    label: Verificar a sala de câmeras
    goto: sala_cameras
:::

:::zona7
id: corredor_tecnico
type: narration
title: Corredor técnico
text: "As lâmpadas acendem uma por uma, sempre sete segundos antes da passagem do grupo."
next: encerramento
:::

:::zona7
id: sala_cameras
type: narration
title: Sala de câmeras
text: "Todos os monitores mostram ângulos que não existem no mapa do prédio."
next: encerramento
:::

:::zona7
id: encerramento
type: session_end
title: Encerramento da sessão
text: "Registre decisões, pistas, itens, condições, medidores e assuntos pendentes."
:::
