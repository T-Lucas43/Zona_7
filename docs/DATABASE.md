# Banco e entidades

## Núcleos

| Núcleo     | Tabelas principais                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identidade | `profiles`, `user_preferences`                                                                                                                                                             |
| Campanha   | `campaigns`, `campaign_members`, `campaign_permissions`, `invitations`, `rule_profiles`                                                                                                    |
| Ficha      | `characters`, `character_owners`, `character_sheet_settings`, `character_attribute_values`, `character_resources`, `character_skills`, `attacks`, `character_weaknesses`, `character_notes` |
| Progressão | `abilities`, `ability_versions`, `character_abilities`, `ability_unlock_events`, `custom_meter_definitions`, `character_meter_values`, `character_meter_stages`, `character_meter_history` |
| Estado     | `items`, `character_items`, `condition_definitions`, `character_conditions`                                                                                                                |
| Sessão     | `sessions`, `session_scenes`, `session_participants`, `session_public_state`                                                                                                               |
| Combate    | `encounters`, `encounter_combatants`, `threat_templates`                                                                                                                                   |
| Dados      | `dice_rolls`, `roll_requests`                                                                                                                                                              |
| Narrativa  | `messages`, `message_recipients`, `scheduled_events`, `handouts`, `handout_access`                                                                                                         |
| Mídia      | `media_assets`, buckets privados e vínculos de retrato/mapa                                                                                                                                |
| Atores     | `actors`, `actor_controllers`, `actor_links`, `actor_media`, `synergy_tags`                                                                                                                |
| Mapa       | `game_scenes`, `scene_layers`, `scene_tokens`, `token_movements`, `collective_displays`                                                                                                    |
| Ao vivo    | `live_sessions`, `live_session_events`, `live_event_receipts`                                                                                                                              |
| Roteiros   | `script_packages`, `script_versions`, `script_nodes`, `script_edges`, `script_runs`, estados, escolhas, checkpoints e execuções de ação                                                    |
| Segurança  | `audit_events`, `notifications`, `resource_threshold_rules`, `resource_threshold_states`                                                                                                   |

## Segredos fisicamente separados

- `campaign_secrets`: metatrama e notas exclusivas.
- `character_secrets`: fraquezas e notas do mestre.
- `ability_secrets` e `item_secrets`: regras ainda não reveladas.
- `message_sender_secrets`: remetente real, ausente da linha visível ao jogador.
- `message_contents`: conteúdo entregue somente a destinatários.
- `handout_contents`: texto/arquivo protegido, separado dos metadados.

## Concorrência e histórico

Fichas, recursos, habilidades, medidores, itens, condições, encontros e combatentes usam `version`. As funções transacionais bloqueiam a linha necessária e usam `idempotency_key` nos comandos que podem ser reenviados.

`audit_events` é imutável para clientes. `undo_audit_event` exige justificativa e restaura o estado somente quando o valor atual ainda corresponde ao resultado original.

As migrations estão em ordem em `supabase/migrations`. A terceira concentra fichas, atores, mapas e roteiros. A quarta corrige Gragas como jogador e adiciona a central ao vivo. A quinta protege a visibilidade configurável das fichas. A sexta adiciona retratos seguros de atores, tokens de cena e atribuição transacional de personagens. A sétima fixa o caminho de busca das funções e mantém o schema sem alertas do lint.

## Timestamps e exclusão

O banco grava `timestamptz` em UTC. A interface converte para o fuso da campanha, cujo padrão é `America/Belem`. Entidades que participam do histórico usam `deleted_at` em vez de exclusão física.
