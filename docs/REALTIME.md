# Catálogo Realtime

## Canais privados

| Canal                     | Conteúdo                                   | Público autorizado      |
| ------------------------- | ------------------------------------------ | ----------------------- |
| `campaign:{campaignId}`   | avisos coletivos, regras e pressão         | membros ativos          |
| `session:{sessionId}`     | presença, cena, encontro, rodada e turno   | participantes da sessão |
| `user:{userId}`           | mensagens e notificações privadas          | próprio usuário         |
| `character:{characterId}` | recursos, condições, medidor e habilidades | proprietário e mestres  |

## Tabelas publicadas

`character_resources`, `character_abilities`, `character_conditions`, `character_meter_values`, `character_items`, `character_sheet_settings`, `sessions`, `session_participants`, `session_public_state`, `encounters`, `encounter_combatants`, `message_recipients`, `notifications`, `handouts`, `handout_access`, `media_assets`, `actors`, `game_scenes`, `scene_tokens`, `live_session_events` e `script_choice_responses`.

`live_session_events.sequence_number` ordena mudanças de cena, token e roteiro. Ao reconectar, o cliente busca um snapshot e aplica somente eventos posteriores ao último número confirmado.

RLS também é aplicada às assinaturas. O cliente usa o evento apenas como sinal para buscar um novo DTO autorizado, inclusive ao trocar a imagem do mapa, visibilidade da ficha ou token. Roteiro, `gm_content`, remetente real e notas privadas nunca entram em broadcast coletivo.

## Reconexão

1. Manter a ficha atual na tela e mostrar `Reconectando`.
2. Buscar snapshot novo pela API autenticada.
3. Assinar o canal privado.
4. Ignorar eventos cujo `event_id` já foi aplicado.
5. Atualizar presença sem transmitir IP, dispositivo ou dados sensíveis.
