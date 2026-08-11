-- Idempotent campaign seed. It is also callable after demo users are created.
create or replace function public.seed_zona7_demo(p_owner_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_session uuid := '50000000-0000-4000-8000-000000000001'::uuid;
  v_scene uuid := '50000000-0000-4000-8000-000000000002'::uuid;
  v_encounter uuid := '51000000-0000-4000-8000-000000000001'::uuid;
  v_message uuid := '52000000-0000-4000-8000-000000000001'::uuid;
begin
  if not exists (select 1 from auth.users where id = p_owner_user_id) then
    raise exception 'Crie o usuário mestre pelo script server-side antes de executar o seed';
  end if;

  insert into public.rule_profiles (id, code, name, description, defaults)
  values
    ('70000000-0000-4000-8000-000000000001', 'zona7_classic', 'Zona 7 Clássico', 'Perfil original baseado em HP e SAN.',
      '{"initial_hp":10,"initial_san":20,"zero_hp_mode":"dead","zero_sanity_mode":"absorbed_by_zone","new_room_san_cost":0,"critical_failure_san_loss":5,"incomplete_challenge_san_loss":5,"trap_hp_loss":3,"entity_attack_hp_loss":5,"first_aid_healing":3,"almond_water_san_healing":5,"safe_room_san_healing":1}'::jsonb),
    ('70000000-0000-4000-8000-000000000002', 'zona7_convergencia', 'Zona 7: A Convergência', 'Perfil NEX com PV, PE, SAN e Pressão.',
      '{"attributes":["AGI","FOR","INT","PRE","VIG"],"resources":["PV","PE","SAN"],"nex_10_pe_per_turn":2,"nex_10_default_dc":15,"pressure_min":0,"pressure_max":7,"fail_forward":true}'::jsonb)
  on conflict (id) do update set name = excluded.name, description = excluded.description, defaults = excluded.defaults;

  insert into public.campaigns (id, owner_user_id, rule_profile_id, name, slug, system_code, language_code, timezone, status, public_premise, settings)
  values (v_campaign, p_owner_user_id, '70000000-0000-4000-8000-000000000002', 'Zona 7: A Convergência', 'zona-7-a-convergencia',
    'zona7_convergencia', 'pt-BR', 'America/Belem', 'active',
    'Dois anos após a primeira Zona 7, cinco sobreviventes voltam a ser perseguidos por fenômenos que registram sete segundos do futuro. Eles precisam se reunir, sobreviver e entender por que Gragas aparece vivo em uma transmissão impossível.',
    '{"allow_private_clue_sharing":true,"ability_approval_mode":"manual","player_narrative_fields":["portrait_path","player_private_history"]}'::jsonb)
  on conflict (id) do update set owner_user_id = excluded.owner_user_id, rule_profile_id = excluded.rule_profile_id, name = excluded.name,
    system_code = excluded.system_code, timezone = excluded.timezone, public_premise = excluded.public_premise, settings = excluded.settings, updated_at = now();

  insert into public.campaign_members (id, campaign_id, user_id, role, status, joined_at)
  values ('11000000-0000-4000-8000-000000000001', v_campaign, p_owner_user_id, 'campaign_owner', 'active', now())
  on conflict (campaign_id, user_id) do update set role = 'campaign_owner', status = 'active';

  insert into public.campaign_secrets (campaign_id, gm_notes, secrets)
  values (v_campaign, 'O Facilitador localiza as relíquias; Rivaldo as protege.', jsonb_build_array(
    'A primeira Zona 7 ensinava votar, obedecer, sacrificar, confessar e desconfiar.',
    'A execução coletiva de Gragas criou a Sentença Unânime.',
    'O Facilitador quer criar o Mundo Corrigido, transformando cidades em salas da Zona 7.',
    'O Revide é uma entidade de Sangue contaminada por Conhecimento; Gragas o chama de Rivaldo.',
    'Rivaldo divide a consciência e o corpo de Gragas.',
    'Davi e os sobreviventes devem permanecer vivos até a ativação da Sentença Unânime.',
    'Responsabilidade sincera enfraquece Rivaldo e pode invalidar o pacto corporal.'
  )) on conflict (campaign_id) do update set gm_notes = excluded.gm_notes, secrets = excluded.secrets;

  insert into public.campaign_rule_settings (campaign_id, zero_hp_mode, zero_sanity_mode, pressure, settings)
  values (v_campaign, 'dying', 'absorbed_by_zone', 0, '{"fail_forward":true,"pe_per_turn":2,"default_ability_dc":15}'::jsonb)
  on conflict (campaign_id) do update set zero_hp_mode = excluded.zero_hp_mode, zero_sanity_mode = excluded.zero_sanity_mode, settings = excluded.settings;

  insert into public.character_templates (id, campaign_id, name, nex, data)
  values
    ('21000000-0000-4000-8000-000000000001', v_campaign, 'Davi Brito — NEX 35%', 35, '{"attributes":{"agi":1,"for":1,"int":2,"pre":4,"vig":2},"resources":{"pv":48,"pe":49,"san":40},"defense":16,"difficulty":20}'::jsonb),
    ('21000000-0000-4000-8000-000000000002', v_campaign, 'Magnus Sigvaldi — NEX 35%', 35, '{"attributes":{"agi":2,"for":3,"int":2,"pre":1,"vig":2},"resources":{"pv":58,"pe":21,"san":30},"defense":17,"difficulty":20}'::jsonb),
    ('21000000-0000-4000-8000-000000000003', v_campaign, 'Arya Black Snape — NEX 35%', 35, '{"attributes":{"agi":4,"for":1,"int":2,"pre":1,"vig":2},"resources":{"pv":48,"pe":28,"san":40},"defense":19,"difficulty":20}'::jsonb),
    ('21000000-0000-4000-8000-000000000004', v_campaign, 'Lize Matsunaga — NEX 35%', 35, '{"attributes":{"agi":1,"for":1,"int":4,"pre":2,"vig":2},"resources":{"pv":48,"pe":35,"san":40},"defense":16,"difficulty":20}'::jsonb),
    ('21000000-0000-4000-8000-000000000005', v_campaign, 'Amber Moss — NEX 35%', 35, '{"attributes":{"agi":3,"for":1,"int":3,"pre":1,"vig":2},"resources":{"pv":58,"pe":21,"san":30},"defense":18,"difficulty":20}'::jsonb),
    ('21000000-0000-4000-8000-000000000006', v_campaign, 'Gragas/Rivaldo — NEX 35%', 35, '{"attributes":{"agi":2,"for":3,"int":1,"pre":1,"vig":3},"resources":{"pv":65,"pe":21,"san":30},"defense":17,"block":8}'::jsonb)
  on conflict (id) do update set name = excluded.name, data = excluded.data;

  insert into public.characters (id, campaign_id, template_id, name, codename, origin, class_name, path_name, nex, narrative_status, team_role, affinities, public_history, defense, main_dc, is_npc, visibility)
  values
    ('20000000-0000-4000-8000-000000000001', v_campaign, '21000000-0000-4000-8000-000000000001', 'Davi Brito', 'O Favorito', 'Artista', 'Especialista', 'Negociador', 10, 'observado', 'face, controlador e canal involuntário', array['Conhecimento','Energia'], 'Não sente culpa pela morte de Gragas e sente-se permanentemente observado.', 16, 15, false, 'selected'),
    ('20000000-0000-4000-8000-000000000002', v_campaign, '21000000-0000-4000-8000-000000000002', 'Magnus Sigvaldi', null, 'Investigador', 'Combatente', 'Guerreiro', 10, 'em tratamento', 'analista, interceptor e duelista', array['Sangue','Conhecimento'], 'Paranoico, realiza tratamento psiquiátrico e busca verificações concretas.', 17, 15, false, 'selected'),
    ('20000000-0000-4000-8000-000000000003', v_campaign, '21000000-0000-4000-8000-000000000003', 'Arya Black Snape', null, 'Artista', 'Especialista', 'Infiltradora', 10, 'marcada', 'infiltração, rastreio e controle de rotas', array[]::text[], 'Desconfia de tudo e não entrega confiança automaticamente.', 18, 15, false, 'selected'),
    ('20000000-0000-4000-8000-000000000004', v_campaign, '21000000-0000-4000-8000-000000000004', 'Lize Matsunaga', null, 'Agente de Saúde', 'Especialista', 'Médica de Campo', 10, 'dissociada', 'suporte, diagnóstico e proteção mental', array[]::text[], 'Analisa a dor de forma clínica e corre risco de perder a própria identidade.', 16, 15, false, 'selected'),
    ('20000000-0000-4000-8000-000000000005', v_campaign, '21000000-0000-4000-8000-000000000005', 'Amber Moss', null, 'Militar', 'Combatente', 'Comandante de Campo', 10, 'reserva', 'comando, posicionamento e fogo coordenado', array[]::text[], 'Não confia automaticamente em ordens e mapas.', 17, 15, false, 'selected'),
    ('20000000-0000-4000-8000-000000000006', v_campaign, '21000000-0000-4000-8000-000000000006', 'Gragas', 'Hospedeiro do Revide', 'Militar', 'Combatente', 'Tropa de Choque', 35, 'reanimado e dividido', 'linha de frente', array['Sangue','Conhecimento'], 'Rivaldo divide seu corpo, mas Gragas continua sendo um personagem jogável.', 17, 20, false, 'selected')
  on conflict (id) do update set name = excluded.name, narrative_status = excluded.narrative_status, team_role = excluded.team_role, version = public.characters.version + 1;

  insert into public.character_secrets (character_id, campaign_id, gm_notes, weaknesses)
  values
    ('20000000-0000-4000-8000-000000000001', v_campaign, 'Sua atenção coletiva permite a Convergência.', array['imagem distorcida','observação constante','perda de força sem audiência','Favorito o torna conduto']),
    ('20000000-0000-4000-8000-000000000002', v_campaign, 'Pistas falsas em reflexos agravam a Suspeita.', array['ações imprevisíveis','comandos paternos','mapas não verificados','excesso de análise']),
    ('20000000-0000-4000-8000-000000000003', v_campaign, 'A Marca Ausente abre passagem indesejada.', array['desconfiança absoluta','dor do marcado','tinta vulnerável a água e Energia']),
    ('20000000-0000-4000-8000-000000000004', v_campaign, 'O Gravador pode substituir suas memórias.', array['dano transferido permanece','voz contaminada','técnicas dependem de comunicação']),
    ('20000000-0000-4000-8000-000000000005', v_campaign, 'Thompson pode reescrever sua responsabilidade.', array['mapa não confirmado','voz de Thompson','fé em documento oficial']),
    ('20000000-0000-4000-8000-000000000006', v_campaign, 'Responsabilidade sincera reduz o Controle.', array['misericórdia deliberada','memória dos oito segundos','verdade sobre o Facilitador'])
  on conflict (character_id) do update set gm_notes = excluded.gm_notes, weaknesses = excluded.weaknesses;

  insert into public.character_attributes (character_id, agility, strength, intellect, presence, vigor, fortitude, reflexes, willpower)
  values
    ('20000000-0000-4000-8000-000000000001',1,1,1,3,1,0,5,5),
    ('20000000-0000-4000-8000-000000000002',2,2,2,1,2,5,5,5),
    ('20000000-0000-4000-8000-000000000003',3,1,2,1,2,0,5,0),
    ('20000000-0000-4000-8000-000000000004',1,1,3,2,2,0,5,5),
    ('20000000-0000-4000-8000-000000000005',2,1,2,1,2,5,5,5),
    ('20000000-0000-4000-8000-000000000006',2,3,1,1,3,10,5,5)
  on conflict (character_id) do update set agility=excluded.agility, strength=excluded.strength, intellect=excluded.intellect, presence=excluded.presence, vigor=excluded.vigor;

  insert into public.character_resources (id, campaign_id, character_id, resource, current_value, maximum_value)
  select gen_random_uuid(), v_campaign, data.character_id, data.resource, data.amount, data.amount
  from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'pv',23),('20000000-0000-4000-8000-000000000001'::uuid,'pe',12),('20000000-0000-4000-8000-000000000001'::uuid,'san',20),
    ('20000000-0000-4000-8000-000000000002'::uuid,'pv',28),('20000000-0000-4000-8000-000000000002'::uuid,'pe',6),('20000000-0000-4000-8000-000000000002'::uuid,'san',15),
    ('20000000-0000-4000-8000-000000000003'::uuid,'pv',23),('20000000-0000-4000-8000-000000000003'::uuid,'pe',8),('20000000-0000-4000-8000-000000000003'::uuid,'san',20),
    ('20000000-0000-4000-8000-000000000004'::uuid,'pv',23),('20000000-0000-4000-8000-000000000004'::uuid,'pe',10),('20000000-0000-4000-8000-000000000004'::uuid,'san',20),
    ('20000000-0000-4000-8000-000000000005'::uuid,'pv',28),('20000000-0000-4000-8000-000000000005'::uuid,'pe',6),('20000000-0000-4000-8000-000000000005'::uuid,'san',15),
    ('20000000-0000-4000-8000-000000000006'::uuid,'pv',65),('20000000-0000-4000-8000-000000000006'::uuid,'pe',21),('20000000-0000-4000-8000-000000000006'::uuid,'san',30)
  ) data(character_id, resource, amount)
  on conflict (character_id, resource) do update set current_value = excluded.current_value, maximum_value = excluded.maximum_value;

  insert into public.character_skills (campaign_id, character_id, name, bonus, trained)
  select v_campaign, data.character_id, data.name, data.bonus, true from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'Diplomacia',5),('20000000-0000-4000-8000-000000000001'::uuid,'Enganação',5),('20000000-0000-4000-8000-000000000001'::uuid,'Percepção',5),
    ('20000000-0000-4000-8000-000000000002'::uuid,'Luta',5),('20000000-0000-4000-8000-000000000002'::uuid,'Investigação',5),
    ('20000000-0000-4000-8000-000000000003'::uuid,'Furtividade',5),('20000000-0000-4000-8000-000000000003'::uuid,'Crime',5),
    ('20000000-0000-4000-8000-000000000004'::uuid,'Medicina',5),('20000000-0000-4000-8000-000000000004'::uuid,'Ocultismo',5),
    ('20000000-0000-4000-8000-000000000005'::uuid,'Pontaria',5),('20000000-0000-4000-8000-000000000005'::uuid,'Tática',5)
  ) data(character_id,name,bonus)
  on conflict (character_id,name) do update set bonus=excluded.bonus, trained=excluded.trained;

  insert into public.custom_meter_definitions (id, campaign_id, name, minimum, maximum, stages)
  values
    ('40000000-0000-4000-8000-000000000001',v_campaign,'Audiência',0,5,'["Fora do Ar","Observado","Tendência","Viral","Transmissão","Favorito"]'),
    ('40000000-0000-4000-8000-000000000002',v_campaign,'Suspeita',0,5,'["Centrado","Observação","Suspeita","Hipervigilância","Cerco","Golpe Final"]'),
    ('40000000-0000-4000-8000-000000000003',v_campaign,'Profundidade da Marca',0,5,'["Pele Limpa","Traço","Contorno","Tinta Viva","Porta Aberta","Marca Ausente"]'),
    ('40000000-0000-4000-8000-000000000004',v_campaign,'Carga de Trauma',0,5,'["Lúcida","Eco","Sobreposição","Dissociação","Voz Alheia","Sem Nome"]'),
    ('40000000-0000-4000-8000-000000000005',v_campaign,'Ruptura do Comando',0,5,'["Rota Segura","Alerta","Divergência","Ordem Falsa","Motim","Arquivo Branco"]'),
    ('40000000-0000-4000-8000-000000000006',v_campaign,'Controle da Consciência',0,5,'["Gragas","Sussurro","Intrusão","Disputa","Invasão","Rivaldo"]')
  on conflict (id) do update set stages=excluded.stages;

  insert into public.character_meter_values (campaign_id, character_id, meter_definition_id, current_value)
  select v_campaign, data.character_id, data.meter_id, data.value from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'40000000-0000-4000-8000-000000000001'::uuid,1),
    ('20000000-0000-4000-8000-000000000002'::uuid,'40000000-0000-4000-8000-000000000002'::uuid,0),
    ('20000000-0000-4000-8000-000000000003'::uuid,'40000000-0000-4000-8000-000000000003'::uuid,1),
    ('20000000-0000-4000-8000-000000000004'::uuid,'40000000-0000-4000-8000-000000000004'::uuid,0),
    ('20000000-0000-4000-8000-000000000005'::uuid,'40000000-0000-4000-8000-000000000005'::uuid,0),
    ('20000000-0000-4000-8000-000000000006'::uuid,'40000000-0000-4000-8000-000000000006'::uuid,3)
  ) data(character_id,meter_id,value)
  on conflict (character_id,meter_definition_id) do update set current_value=excluded.current_value;

  insert into public.abilities (id,campaign_id,name,public_description,action_type,costs,usage_limit,recommended_nex,visibility,effects)
  values
    ('30000000-0000-4000-8000-000000000001',v_campaign,'Narrativa Dominante','Declara uma versão possível; aliados recebem +1d20. Se não ocorrer, um detalhe se volta contra o grupo.','standard','{"pe":3}', '{"scope":"scene","count":1}',10,'owner_only','[{"type":"bonus","dice":"1d20"}]'),
    ('30000000-0000-4000-8000-000000000002',v_campaign,'Sempre no Ar','Câmeras e reflexos registram Davi e concedem uma pista visual verdadeira.','passive','{}','{"scope":"scene","count":1}',10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000003',v_campaign,'Sete Segundos Antes','Concede +5 Defesa contra um ataque ou permite repetir Reflexos.','reaction','{"pe":2,"san":"1d4"}',null,20,'owner_only','[{"type":"defense","value":5}]'),
    ('30000000-0000-4000-8000-000000000004',v_campaign,'Holofote Compulsório','O alvo testa Vontade ou fica fascinado e vulnerável.','standard','{"pe":2}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000005',v_campaign,'Versão que Cola','Repete uma falha social ou investigativa com correção plausível.','reaction','{"pe":4}',null,35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000006',v_campaign,'Protagonista Absoluto','Por três rodadas inimigos e câmeras priorizam Davi.','standard','{"pe":6,"san":"2d6"}','{"scope":"mission","count":1}',35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000007',v_campaign,'Padrão de Ameaça','Revela resistência, imunidade, intenção ou padrão.','movement','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000008',v_campaign,'Interrupção Precisa','Move 3m e bloqueia ou contra-ataca um alvo analisado.','reaction','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000009',v_campaign,'Confiança Calculada','Vínculo com aliado concede +2 Defesa.','movement','{"pe":3}','{"scope":"scene","count":1}',20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000010',v_campaign,'Kata do Ponto Cego','Ataque pode derrubar, desarmar ou empurrar.','standard','{"pe":3}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000011',v_campaign,'Espelho de Álibi','O atacante repete o teste e usa o pior resultado.','reaction','{"pe":4,"san":"1d4"}',null,35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000012',v_campaign,'Golpe Final','Ataque decisivo que ignora resistência.','standard','{"pe":6,"san":"2d6"}','{"scope":"mission","count":1}',35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000013',v_campaign,'Marca Indelével','Marca um alvo e revela sua direção ao grupo.','movement','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000014',v_campaign,'Marca de Retorno','Marca um ponto seguro e permite retornar como reação.','standard','{"pe":3}','{"scope":"scene","count":1}',10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000015',v_campaign,'Vínculo de Tinta','Arya e um aliado recebem bônus em Reflexos e Furtividade.','standard','{"pe":3}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000016',v_campaign,'Tinta de Cobertura','Criaturas recebem +5 Furtividade e não deixam rastros comuns.','standard','{"pe":2}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000017',v_campaign,'Porta de Agulha','Cria duas marcas-portais por três rodadas.','standard','{"pe":4,"san":"1d4"}',null,35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000018',v_campaign,'Sete Portas na Pele','Cria até sete pontos marcados por três rodadas.','standard','{"pe":6,"san":"2d6"}','{"scope":"mission","count":1}',35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000019',v_campaign,'Compartimentar Trauma','Reduz perda de PV ou SAN de um aliado e absorve parte.','reaction','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000020',v_campaign,'Anatomia da Alma','Revela origem de condição, memória ou menor resistência.','movement','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000021',v_campaign,'Medicina de Campo','Recupera 2d8+4 PV, encerra sangramento ou estabiliza.','standard','{"pe":2}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000022',v_campaign,'Memória Anestesiada','Aliado ignora condição mental por um turno.','standard','{"pe":3}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000023',v_campaign,'Incisão de Memória','Extrai memória falsa ou condição e pode implantá-la.','standard','{"pe":4,"san":"1d4"}',null,35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000024',v_campaign,'Todas as Vozes','Aliados se comunicam mentalmente e repartem dano mental.','standard','{"pe":6,"san":"2d6"}','{"scope":"mission","count":1}',35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000025',v_campaign,'Linha Segura','Reposiciona aliados sem reação ou concede +2 Defesa.','movement','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000026',v_campaign,'Fogo Coordenado','O segundo atacante recebe bônus contra fraqueza explorada.','reaction','{"pe":2}',null,10,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000027',v_campaign,'Marco Confirmado','Uma posição verificada concede proteção e direção da rota.','standard','{"pe":2}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000028',v_campaign,'Supressão em Setores','Cone de 9m impede avanço e causa vulnerabilidade.','standard','{"pe":3}',null,20,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000029',v_campaign,'Ordem Provisória','Uma mentira operacional plausível é aceita por sistemas.','standard','{"pe":4,"san":"1d4"}',null,35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000030',v_campaign,'Todos Voltam','Até cinco aliados se movem e escolhem defesa ou ataque.','standard','{"pe":6,"san":"2d6"}','{"scope":"mission","count":1}',35,'owner_only','[]'),
    ('30000000-0000-4000-8000-000000000031',v_campaign,'Dor Devolvida','Armazena dano e o adiciona ao próximo ataque.','reaction','{"pe":3}',null,35,'gm_only','[]'),
    ('30000000-0000-4000-8000-000000000032',v_campaign,'O Oitavo Segundo','O tempo para por oito segundos.','standard','{"pe":5,"san":"1d6"}','{"scope":"scene","count":1}',35,'gm_only','[]'),
    ('30000000-0000-4000-8000-000000000033',v_campaign,'Dois na Mira','Rivaldo percebe emboscadas que Gragas não percebe.','passive','{}',null,35,'gm_only','[]'),
    ('30000000-0000-4000-8000-000000000034',v_campaign,'Motor de Rancor','Quando machucado recebe dano e Fortitude adicionais.','passive','{}',null,35,'gm_only','[]'),
    ('30000000-0000-4000-8000-000000000035',v_campaign,'Voz de Rivaldo','Inimigos próximos ficam abalados e vulneráveis.','standard','{"pe":2}',null,35,'gm_only','[]'),
    ('30000000-0000-4000-8000-000000000036',v_campaign,'Retorno Sangrento','Rivaldo recupera o corpo quando Gragas está morrendo.','reaction','{}','{"scope":"mission","count":1}',35,'gm_only','[]')
  on conflict (id) do update set name=excluded.name, public_description=excluded.public_description, costs=excluded.costs, recommended_nex=excluded.recommended_nex;

  insert into public.character_abilities (campaign_id,character_id,ability_id,state,unlocked_at,unlocked_by)
  select v_campaign, data.character_id, data.ability_id,
    case
      when data.ability_id = '30000000-0000-4000-8000-000000000001'::uuid then 'discovered'
      when data.position <= 2 and data.character_id <> '20000000-0000-4000-8000-000000000006'::uuid then 'unlocked'
      else 'sealed'
    end,
    case when data.position <= 2 and data.character_id <> '20000000-0000-4000-8000-000000000006'::uuid then now() else null end,
    case when data.position <= 2 and data.character_id <> '20000000-0000-4000-8000-000000000006'::uuid then p_owner_user_id else null end
  from (
    select character_id, ability_id, row_number() over (partition by character_id order by ability_id)::integer as position from (values
      ('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid),('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000002'::uuid),('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000003'::uuid),('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000004'::uuid),('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000005'::uuid),('20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000006'::uuid),
      ('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000007'::uuid),('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000008'::uuid),('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000009'::uuid),('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000010'::uuid),('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000011'::uuid),('20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000012'::uuid),
      ('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000013'::uuid),('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000014'::uuid),('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000015'::uuid),('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000016'::uuid),('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000017'::uuid),('20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000018'::uuid),
      ('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000019'::uuid),('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000020'::uuid),('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000021'::uuid),('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000022'::uuid),('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000023'::uuid),('20000000-0000-4000-8000-000000000004'::uuid,'30000000-0000-4000-8000-000000000024'::uuid),
      ('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000025'::uuid),('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000026'::uuid),('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000027'::uuid),('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000028'::uuid),('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000029'::uuid),('20000000-0000-4000-8000-000000000005'::uuid,'30000000-0000-4000-8000-000000000030'::uuid),
      ('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000031'::uuid),('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000032'::uuid),('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000033'::uuid),('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000034'::uuid),('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000035'::uuid),('20000000-0000-4000-8000-000000000006'::uuid,'30000000-0000-4000-8000-000000000036'::uuid)
    ) links(character_id,ability_id)
  ) data
  on conflict (character_id,ability_id) do update set state=excluded.state;

  insert into public.resource_threshold_rules (id,campaign_id,resource,key,label,percent,severity)
  values
    ('60000000-0000-4000-8000-000000000001',v_campaign,'pv','pv_wounded','Machucado',50,'warning'),
    ('60000000-0000-4000-8000-000000000002',v_campaign,'pv','pv_critical','Crítico',25,'critical'),
    ('60000000-0000-4000-8000-000000000003',v_campaign,'pv','pv_zero','Zero',0,'zero'),
    ('60000000-0000-4000-8000-000000000004',v_campaign,'san','san_unstable','Instável',50,'warning'),
    ('60000000-0000-4000-8000-000000000005',v_campaign,'san','san_collapse','Colapso iminente',25,'critical'),
    ('60000000-0000-4000-8000-000000000006',v_campaign,'san','san_zero','Zero',0,'zero'),
    ('60000000-0000-4000-8000-000000000007',v_campaign,'pe','pe_low','Baixo',25,'warning'),
    ('60000000-0000-4000-8000-000000000008',v_campaign,'pe','pe_zero','Esgotado',0,'zero')
  on conflict (id) do update set label=excluded.label,percent=excluded.percent,severity=excluded.severity;

  insert into public.sessions (id,campaign_id,title,status)
  values (v_session,v_campaign,'Sessão 01 - Sete Segundos Antes','draft')
  on conflict (id) do update set title=excluded.title;
  insert into public.session_scenes (id,campaign_id,session_id,title,status,position,public_summary,gm_notes)
  values (v_scene,v_campaign,v_session,'A transmissão impossível','pending',1,'Uma câmera sem energia registra sete segundos do futuro.','Gragas aparece vivo ao final do sinal.')
  on conflict (id) do update set title=excluded.title,public_summary=excluded.public_summary,gm_notes=excluded.gm_notes;
  update public.sessions set current_scene_id=v_scene where id=v_session;
  insert into public.session_public_state(session_id,campaign_id,scene_title,public_summary,public_objective,updated_by)
  values(v_session,v_campaign,'A transmissão impossível','Uma câmera sem energia registra sete segundos do futuro.','Descubram a origem da transmissão impossível.',p_owner_user_id)
  on conflict(session_id) do update set scene_title=excluded.scene_title,public_summary=excluded.public_summary,public_objective=excluded.public_objective,updated_by=excluded.updated_by,updated_at=now();

  insert into public.encounters (id,campaign_id,session_id,name,status,round)
  values (v_encounter,v_campaign,v_session,'Dois Observadores no estúdio','draft',0)
  on conflict (id) do update set name=excluded.name;
  insert into public.encounter_combatants (id,campaign_id,encounter_id,display_name,kind,initiative,position,current_hp,maximum_hp,hidden_hp,visible_state)
  values
    ('51000000-0000-4000-8000-000000000011',v_campaign,v_encounter,'Observador de Estática α','enemy',null,1,38,38,true,'intacto'),
    ('51000000-0000-4000-8000-000000000012',v_campaign,v_encounter,'Observador de Estática β','enemy',null,2,38,38,true,'intacto')
  on conflict (id) do update set current_hp=excluded.current_hp,visible_state=excluded.visible_state;

  insert into public.messages (id,campaign_id,apparent_sender_name,format,visibility,status,spoiler_safe_preview,send_at,idempotency_key)
  values (v_message,v_campaign,'DESCONHECIDO','text','selected','scheduled','Nova mensagem da Zona 7',now()+interval '1 day','52000000-0000-4000-8000-000000000099')
  on conflict (id) do update set apparent_sender_name=excluded.apparent_sender_name,status=excluded.status;
  insert into public.message_sender_secrets (message_id,campaign_id,real_sender_user_id)
  values (v_message,v_campaign,p_owner_user_id) on conflict (message_id) do update set real_sender_user_id=excluded.real_sender_user_id;
  insert into public.message_contents (message_id,body)
  values (v_message,'VOCÊ AINDA É O FAVORITO.') on conflict (message_id) do update set body=excluded.body;
  insert into public.scheduled_events (id,campaign_id,session_id,event_type,trigger_type,due_at,protected_payload,status,idempotency_key,created_by)
  values ('52000000-0000-4000-8000-000000000002',v_campaign,v_session,'send_message','datetime',now()+interval '1 day',jsonb_build_object('messageId',v_message),'pending','52000000-0000-4000-8000-000000000098',p_owner_user_id)
  on conflict (id) do update set due_at=excluded.due_at,protected_payload=excluded.protected_payload;

  insert into public.message_sender_profiles (id,campaign_id,name,sender_type,visual_style,notification_label,is_active,created_by)
  values
    ('57000000-0000-4000-8000-000000000001',v_campaign,'Mestre','master','{"accent":"#b52532"}','Nova mensagem do mestre',true,p_owner_user_id),
    ('57000000-0000-4000-8000-000000000002',v_campaign,'SISTEMA ZONA 7','system','{"accent":"#d7d8dc","effect":"scanline"}','Nova mensagem da Zona 7',true,p_owner_user_id),
    ('57000000-0000-4000-8000-000000000003',v_campaign,'DESCONHECIDO','unknown','{"accent":"#ee3c4d","effect":"glitch"}','Nova mensagem da Zona 7',true,p_owner_user_id),
    ('57000000-0000-4000-8000-000000000004',v_campaign,'Facilitador','entity','{"accent":"#8b5cf6","effect":"interference"}','Nova manifestação da Zona 7',true,p_owner_user_id),
    ('57000000-0000-4000-8000-000000000005',v_campaign,'Rivaldo','npc','{"accent":"#7f1d2d","effect":"pulse"}','Nova mensagem da Zona 7',true,p_owner_user_id)
  on conflict (campaign_id,name) do update set sender_type=excluded.sender_type,visual_style=excluded.visual_style,is_active=excluded.is_active;

  insert into public.campaign_ui_settings (campaign_id,labels,theme,feature_flags)
  values (v_campaign,
    '{"character":"Sobrevivente","ability":"Cicatriz","master":"Mestre","session":"Transmissão"}',
    '{"accent":"#b52532","energy":"#4b9be8","surface":"#101216","style":"terminal_crt"}',
    '{"sound":true,"vibration":true,"realtime_presence":true,"scheduled_events":true}')
  on conflict (campaign_id) do update set labels=excluded.labels,theme=excluded.theme,feature_flags=excluded.feature_flags;

  insert into public.roll_requests (id,campaign_id,session_id,requested_by,character_id,skill_or_attribute,difficulty,context,visibility,status,expires_at,idempotency_key)
  values ('54000000-0000-4000-8000-000000000001',v_campaign,v_session,p_owner_user_id,'20000000-0000-4000-8000-000000000001','Percepção',15,'Observe a câmera sem encarar o reflexo.','player_master','pending',now()+interval '7 days','54000000-0000-4000-8000-000000000099')
  on conflict (id) do update set difficulty=excluded.difficulty,context=excluded.context;

  insert into public.handouts (id,campaign_id,title,type,state,visibility,created_by)
  values
    ('53000000-0000-4000-8000-000000000001',v_campaign,'Medalha dos Oito Segundos','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000002',v_campaign,'Arquivo Branco de Thompson','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000003',v_campaign,'Agulha da Marca Ausente','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000004',v_campaign,'Espelho Imóvel','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000005',v_campaign,'Gravador das Vozes Recortadas','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000006',v_campaign,'Lente do Favorito','artifact','hidden','gm_only',p_owner_user_id),
    ('53000000-0000-4000-8000-000000000007',v_campaign,'Sentença Unânime','artifact','hidden','gm_only',p_owner_user_id)
  on conflict (id) do update set title=excluded.title,state=excluded.state,visibility=excluded.visibility;

  insert into public.threat_templates (id,campaign_id,name,challenge_rating,defense,maximum_hp,movement,abilities,weaknesses)
  values
    ('61000000-0000-4000-8000-000000000001',v_campaign,'Observador de Estática',20,16,38,9,'[{"name":"Impacto de sinal","attack":"2d20+8","damage":"2d6+3 impacto + 1d4 mental"},{"name":"Antecipar","type":"reaction","effect":"+2 Defesa contra alvo filmado"}]','["Cobrir ou destruir a câmera remove Antecipar"]'),
    ('61000000-0000-4000-8000-000000000002',v_campaign,'Vigilante de Estática',40,18,75,9,'[{"name":"Rajada de ruído","attack":"3d20+10","damage":"2d8+5 eletricidade"},{"name":"Foco compulsório","dc":18}]','["Vulnerável quando alguém altera o futuro previsto"]'),
    ('61000000-0000-4000-8000-000000000003',v_campaign,'Enxerto de Porta',80,21,145,12,'[{"name":"Batente cortante","attack":"3d20+12","damage":"2d10+6 corte"},{"name":"Atravessar","dc":20}]','[]'),
    ('61000000-0000-4000-8000-000000000004',v_campaign,'Reflexo Punitivo',100,22,180,9,'[{"name":"Copiar Cicatriz","frequency":"1/round"},{"name":"Retorno sem confissão","healing":45}]','["Confissão sincera impede o retorno"]')
  on conflict (id) do update set abilities=excluded.abilities,weaknesses=excluded.weaknesses;

  update public.characters set codename='O Favorito', pronouns=null, identification_color='#b8323c', short_description='Sempre no ar.', tagline='Sempre no ar.', character_state='active', pe_per_turn=2, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000001';
  update public.characters set codename='O Detetive', identification_color='#e2b341', short_description='Hipótese, evidência e medo não são a mesma coisa.', character_state='active', pe_per_turn=2, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000002';
  update public.characters set codename='A Marcada', identification_color='#8f74c8', short_description='Toda saída deixa um traço.', character_state='active', pe_per_turn=2, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000003';
  update public.characters set codename='A Médica', identification_color='#57a773', short_description='A dor pode ser dividida, nunca apagada.', character_state='active', pe_per_turn=2, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000004';
  update public.characters set codename='A Comandante', identification_color='#3c8dff', short_description='Nenhuma ordem vale mais que uma pessoa.', character_state='active', pe_per_turn=2, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000005';
  update public.characters set name='Gragas', codename='Hospedeiro do Revide', identification_color='#7f1d2d', short_description='Dois ocupantes, um corpo e uma cobrança.', tagline='Rivaldo chama Gragas de corpo.', character_state='active', is_npc=false, visibility='selected', block_value=8, pe_per_turn=4, updated_by=p_owner_user_id where id='20000000-0000-4000-8000-000000000006';
  update public.character_attributes set intellect=2,vigor=2 where character_id='20000000-0000-4000-8000-000000000001';

  insert into public.character_attribute_values(campaign_id,character_id,attribute_key,base_value,updated_by)
  select v_campaign,data.character_id,data.attribute_key,data.base_value,p_owner_user_id from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'agi',1),('20000000-0000-4000-8000-000000000001'::uuid,'for',1),('20000000-0000-4000-8000-000000000001'::uuid,'int',2),('20000000-0000-4000-8000-000000000001'::uuid,'pre',3),('20000000-0000-4000-8000-000000000001'::uuid,'vig',2),
    ('20000000-0000-4000-8000-000000000002'::uuid,'agi',2),('20000000-0000-4000-8000-000000000002'::uuid,'for',2),('20000000-0000-4000-8000-000000000002'::uuid,'int',2),('20000000-0000-4000-8000-000000000002'::uuid,'pre',1),('20000000-0000-4000-8000-000000000002'::uuid,'vig',2),
    ('20000000-0000-4000-8000-000000000003'::uuid,'agi',3),('20000000-0000-4000-8000-000000000003'::uuid,'for',1),('20000000-0000-4000-8000-000000000003'::uuid,'int',2),('20000000-0000-4000-8000-000000000003'::uuid,'pre',1),('20000000-0000-4000-8000-000000000003'::uuid,'vig',2),
    ('20000000-0000-4000-8000-000000000004'::uuid,'agi',1),('20000000-0000-4000-8000-000000000004'::uuid,'for',1),('20000000-0000-4000-8000-000000000004'::uuid,'int',3),('20000000-0000-4000-8000-000000000004'::uuid,'pre',2),('20000000-0000-4000-8000-000000000004'::uuid,'vig',2),
    ('20000000-0000-4000-8000-000000000005'::uuid,'agi',2),('20000000-0000-4000-8000-000000000005'::uuid,'for',1),('20000000-0000-4000-8000-000000000005'::uuid,'int',2),('20000000-0000-4000-8000-000000000005'::uuid,'pre',1),('20000000-0000-4000-8000-000000000005'::uuid,'vig',2),
    ('20000000-0000-4000-8000-000000000006'::uuid,'agi',2),('20000000-0000-4000-8000-000000000006'::uuid,'for',3),('20000000-0000-4000-8000-000000000006'::uuid,'int',1),('20000000-0000-4000-8000-000000000006'::uuid,'pre',1),('20000000-0000-4000-8000-000000000006'::uuid,'vig',3)
  ) data(character_id,attribute_key,base_value)
  on conflict(character_id,attribute_key) do update set base_value=excluded.base_value,updated_by=excluded.updated_by,updated_at=now();

  insert into public.character_skills(campaign_id,character_id,name,bonus,trained,related_attribute,training_degree,base_bonus,sort_order,updated_by)
  select v_campaign,data.character_id,data.name,data.bonus,true,data.attribute_key,case when data.bonus>=10 then 'veterano' else 'treinado' end,data.bonus,data.position,p_owner_user_id from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'Diplomacia',10,'pre',1),('20000000-0000-4000-8000-000000000001'::uuid,'Enganação',10,'pre',2),('20000000-0000-4000-8000-000000000001'::uuid,'Intuição',10,'pre',3),('20000000-0000-4000-8000-000000000001'::uuid,'Artes',10,'pre',4),('20000000-0000-4000-8000-000000000001'::uuid,'Atualidades',10,'int',5),('20000000-0000-4000-8000-000000000001'::uuid,'Intimidação',5,'pre',6),('20000000-0000-4000-8000-000000000001'::uuid,'Percepção',5,'pre',7),('20000000-0000-4000-8000-000000000001'::uuid,'Reflexos',5,'agi',8),('20000000-0000-4000-8000-000000000001'::uuid,'Tecnologia',5,'int',9),('20000000-0000-4000-8000-000000000001'::uuid,'Vontade',10,'pre',10),
    ('20000000-0000-4000-8000-000000000002'::uuid,'Luta',10,'for',1),('20000000-0000-4000-8000-000000000002'::uuid,'Investigação',10,'int',2),('20000000-0000-4000-8000-000000000002'::uuid,'Intuição',10,'pre',3),('20000000-0000-4000-8000-000000000002'::uuid,'Percepção',10,'pre',4),('20000000-0000-4000-8000-000000000002'::uuid,'Fortitude',10,'vig',5),('20000000-0000-4000-8000-000000000002'::uuid,'Reflexos',10,'agi',6),('20000000-0000-4000-8000-000000000002'::uuid,'Atletismo',5,'for',7),('20000000-0000-4000-8000-000000000002'::uuid,'Iniciativa',5,'agi',8),('20000000-0000-4000-8000-000000000002'::uuid,'Crime',5,'agi',9),('20000000-0000-4000-8000-000000000002'::uuid,'Vontade',5,'pre',10),
    ('20000000-0000-4000-8000-000000000003'::uuid,'Furtividade',10,'agi',1),('20000000-0000-4000-8000-000000000003'::uuid,'Crime',10,'agi',2),('20000000-0000-4000-8000-000000000003'::uuid,'Pontaria',10,'agi',3),('20000000-0000-4000-8000-000000000003'::uuid,'Artes',10,'pre',4),('20000000-0000-4000-8000-000000000003'::uuid,'Acrobacia',10,'agi',5),('20000000-0000-4000-8000-000000000003'::uuid,'Reflexos',10,'agi',6),('20000000-0000-4000-8000-000000000003'::uuid,'Iniciativa',10,'agi',7),('20000000-0000-4000-8000-000000000003'::uuid,'Percepção',10,'pre',8),('20000000-0000-4000-8000-000000000003'::uuid,'Intuição',5,'pre',9),('20000000-0000-4000-8000-000000000003'::uuid,'Enganação',5,'pre',10),
    ('20000000-0000-4000-8000-000000000004'::uuid,'Medicina',10,'int',1),('20000000-0000-4000-8000-000000000004'::uuid,'Ciências',10,'int',2),('20000000-0000-4000-8000-000000000004'::uuid,'Intuição',10,'pre',3),('20000000-0000-4000-8000-000000000004'::uuid,'Investigação',10,'int',4),('20000000-0000-4000-8000-000000000004'::uuid,'Ocultismo',10,'int',5),('20000000-0000-4000-8000-000000000004'::uuid,'Vontade',10,'pre',6),('20000000-0000-4000-8000-000000000004'::uuid,'Diplomacia',5,'pre',7),('20000000-0000-4000-8000-000000000004'::uuid,'Percepção',5,'pre',8),('20000000-0000-4000-8000-000000000004'::uuid,'Reflexos',5,'agi',9),('20000000-0000-4000-8000-000000000004'::uuid,'Tecnologia',5,'int',10),
    ('20000000-0000-4000-8000-000000000005'::uuid,'Pontaria',10,'agi',1),('20000000-0000-4000-8000-000000000005'::uuid,'Tática',10,'int',2),('20000000-0000-4000-8000-000000000005'::uuid,'Investigação',10,'int',3),('20000000-0000-4000-8000-000000000005'::uuid,'Percepção',10,'pre',4),('20000000-0000-4000-8000-000000000005'::uuid,'Fortitude',10,'vig',5),('20000000-0000-4000-8000-000000000005'::uuid,'Reflexos',10,'agi',6),('20000000-0000-4000-8000-000000000005'::uuid,'Iniciativa',10,'agi',7),('20000000-0000-4000-8000-000000000005'::uuid,'Sobrevivência',5,'int',8),('20000000-0000-4000-8000-000000000005'::uuid,'Tecnologia',5,'int',9),('20000000-0000-4000-8000-000000000005'::uuid,'Vontade',5,'pre',10),
    ('20000000-0000-4000-8000-000000000006'::uuid,'Luta',10,'for',1),('20000000-0000-4000-8000-000000000006'::uuid,'Pontaria',10,'agi',2),('20000000-0000-4000-8000-000000000006'::uuid,'Fortitude',10,'vig',3),('20000000-0000-4000-8000-000000000006'::uuid,'Reflexos',5,'agi',4),('20000000-0000-4000-8000-000000000006'::uuid,'Vontade',5,'pre',5),('20000000-0000-4000-8000-000000000006'::uuid,'Atletismo',10,'for',6),('20000000-0000-4000-8000-000000000006'::uuid,'Iniciativa',5,'agi',7),('20000000-0000-4000-8000-000000000006'::uuid,'Sobrevivência',5,'int',8)
  ) data(character_id,name,bonus,attribute_key,position)
  on conflict(character_id,name) do update set bonus=excluded.bonus,trained=true,related_attribute=excluded.related_attribute,training_degree=excluded.training_degree,base_bonus=excluded.base_bonus,sort_order=excluded.sort_order,updated_by=excluded.updated_by,updated_at=now();

  insert into public.attacks(id,campaign_id,character_id,name,attack_formula,damage_formula,damage_type,range_text,category,action_type,description,sort_order,created_by,updated_by)
  select data.id,v_campaign,data.character_id,data.name,data.test,data.damage,data.damage_type,data.range_text,data.category,data.action_type,data.description,data.position,p_owner_user_id,p_owner_user_id from (values
    ('71000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'Pistola leve','1d20+5','1d12','balístico','curto','weapon','padrão','Arma simples de curto alcance.',1),('71000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'Faca','1d20','1d4+1','corte','corpo a corpo','weapon','padrão','Ataque corpo a corpo.',2),('71000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'Improviso','1d20','1d6+1','impacto','corpo a corpo','action','padrão','Objeto disponível na cena.',3),('71000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'Pulso da Lente','4d20+10','2d6','mental','Audiência 3+','paranormal','padrão','Exige Audiência no estágio Viral ou superior.',4),
    ('71000000-0000-4000-8000-000000000005'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'Golpe técnico','3d20+10','1d8+3','impacto','corpo a corpo','attack','padrão','Golpe calculado.',1),('71000000-0000-4000-8000-000000000006'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'Chute lateral','3d20+10','1d10+3','impacto','corpo a corpo','attack','padrão','Ataque desarmado.',2),('71000000-0000-4000-8000-000000000007'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'Bastão retrátil','3d20+10','1d6+3','impacto','corpo a corpo','weapon','padrão','Arma tática discreta.',3),('71000000-0000-4000-8000-000000000008'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'Interrupção Precisa','3d20+12','2d8+3','impacto','alvo analisado','action','reação','Disponível contra alvo analisado.',4),
    ('71000000-0000-4000-8000-000000000009'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'Pistola silenciada','4d20+10','1d12','balístico','curto','weapon','padrão','Disparo silencioso.',1),('71000000-0000-4000-8000-000000000010'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'Adaga','4d20+10','1d4+1','corte','corpo a corpo','weapon','padrão','Lâmina leve.',2),('71000000-0000-4000-8000-000000000011'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'Agulha de tatuagem','4d20+10','1d6+1','perfuração','corpo a corpo','paranormal','padrão','Marca o alvo quando configurado.',3),('71000000-0000-4000-8000-000000000012'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'Ataque furtivo','4d20+10','3d6','adicional','alvo desprevenido','action','livre','Dano adicional contra alvo desprevenido.',4),
    ('71000000-0000-4000-8000-000000000013'::uuid,'20000000-0000-4000-8000-000000000004'::uuid,'Pistola compacta','1d20+5','1d12','balístico','curto','weapon','padrão','Arma compacta.',1),('71000000-0000-4000-8000-000000000014'::uuid,'20000000-0000-4000-8000-000000000004'::uuid,'Bisturi','1d20+5','1d4+1','corte','corpo a corpo','procedure','padrão','Instrumento médico.',2),('71000000-0000-4000-8000-000000000015'::uuid,'20000000-0000-4000-8000-000000000004'::uuid,'Sedação de urgência','4d20+10','especial','químico','toque','procedure','padrão','Fortitude DT 20.',3),('71000000-0000-4000-8000-000000000016'::uuid,'20000000-0000-4000-8000-000000000004'::uuid,'Incisão de memória','4d20+10','2d6','mental','curto','paranormal','padrão','Vontade DT 20.',4),
    ('71000000-0000-4000-8000-000000000017'::uuid,'20000000-0000-4000-8000-000000000005'::uuid,'Fuzil de assalto','3d20+10','2d10','balístico','médio','weapon','padrão','Arma tática principal.',1),('71000000-0000-4000-8000-000000000018'::uuid,'20000000-0000-4000-8000-000000000005'::uuid,'Pistola de serviço','3d20+10','1d12','balístico','curto','weapon','padrão','Arma secundária.',2),('71000000-0000-4000-8000-000000000019'::uuid,'20000000-0000-4000-8000-000000000005'::uuid,'Faca de campanha','1d20+5','1d4+1','corte','corpo a corpo','weapon','padrão','Lâmina de campanha.',3),('71000000-0000-4000-8000-000000000020'::uuid,'20000000-0000-4000-8000-000000000005'::uuid,'Fogo de supressão','3d20+10','2d10','balístico','cone','action','completa','Controle de área.',4),
    ('71000000-0000-4000-8000-000000000021'::uuid,'20000000-0000-4000-8000-000000000006'::uuid,'Metralhadora de apoio','2d20+10','2d10+5','balístico','médio','weapon','padrão','Arma de apoio.',1),('71000000-0000-4000-8000-000000000022'::uuid,'20000000-0000-4000-8000-000000000006'::uuid,'Faca de combate','3d20+10','1d4+3','corte','corpo a corpo','weapon','padrão','Lâmina militar.',2),('71000000-0000-4000-8000-000000000023'::uuid,'20000000-0000-4000-8000-000000000006'::uuid,'Punhos','3d20+10','1d6+3','impacto','corpo a corpo','attack','padrão','Ataque desarmado.',3),('71000000-0000-4000-8000-000000000024'::uuid,'20000000-0000-4000-8000-000000000006'::uuid,'Golpe de Rivaldo','3d20+12','2d8+3','Sangue','Controle 3+','paranormal','padrão','Exige Controle da Consciência em Disputa ou superior.',4)
  ) data(id,character_id,name,test,damage,damage_type,range_text,category,action_type,description,position)
  on conflict(id) do update set attack_formula=excluded.attack_formula,damage_formula=excluded.damage_formula,description=excluded.description,updated_by=excluded.updated_by,updated_at=now();

  insert into public.character_weaknesses(campaign_id,character_id,name,narrative_description,trigger_text,mechanical_effect,visibility,sort_order,created_by,updated_by)
  select v_campaign,data.character_id,data.name,data.description,data.trigger_text,data.effect,data.visibility,data.position,p_owner_user_id,p_owner_user_id from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'Imagem Distorcida','A pior interpretação sobrevive à gravação.','Falha social','Testemunhas guardam a pior interpretação e gravações omitem contexto favorável.','owner_only',1),('20000000-0000-4000-8000-000000000001'::uuid,'Sempre Observado','O Facilitador acompanha o sinal.','Uso de poder paranormal','A posição de Davi pode ser revelada ao Facilitador.','gm_only',2),('20000000-0000-4000-8000-000000000001'::uuid,'Sem Audiência','O poder perde força no silêncio.','Sem testemunhas, eletrônicos ou reflexos','-1d20 em poderes narrativos e Holofote bloqueado.','owner_only',3),('20000000-0000-4000-8000-000000000001'::uuid,'Vontade sem Culpa','Confissão não reduz Audiência.','Tentar recuar sem assumir custo','Precisa proteger alguém e aceitar um custo real para reduzir Audiência.','owner_only',4),('20000000-0000-4000-8000-000000000001'::uuid,'Gragas Contradiz','A presença de Gragas rompe a narrativa.','Gragas presente','Poderes narrativos custam +1 PE até reconhecimento sincero.','gm_only',5),('20000000-0000-4000-8000-000000000001'::uuid,'Lente-Conduto','O Facilitador impõe uma regra curta.','Audiência em Favorito','Vontade DT 20; em sucesso recusa e perde 1d6 SAN.','gm_only',6),
    ('20000000-0000-4000-8000-000000000002'::uuid,'Ação Imprevisível','O inesperado rompe o plano.','Aliado age de forma inesperada','Vontade DT 20; em falha não recebe ajuda até rever o plano.','owner_only',1),('20000000-0000-4000-8000-000000000002'::uuid,'Comando Paterno','Ordens de punição atravessam a defesa.','Comando gritado','Vontade DT 18; em falha fica abalado e perde reação.','owner_only',2),('20000000-0000-4000-8000-000000000002'::uuid,'Mapa do Estranho','Rotas desconhecidas exigem prova.','Rota entregue por desconhecido','-1d20 em navegação e evita liderar até verificar referência física.','owner_only',3),('20000000-0000-4000-8000-000000000002'::uuid,'Rotina como Âncora','O tratamento mantém o real no lugar.','Interrupção paranormal do tratamento','Próxima missão começa em Observação e recuperação de SAN cai em 1d4.','owner_only',4),('20000000-0000-4000-8000-000000000002'::uuid,'Excesso de Análise','Um padrão quebrado dissolve a certeza.','Alvo quebra o padrão','Alvo deixa de estar analisado e Suspeita aumenta em 1.','owner_only',5),('20000000-0000-4000-8000-000000000002'::uuid,'Pai Dentro do Vidro','O reflexo oferece certeza falsa.','Suspeita em Cerco','Mestre oferece uma pista falsa por reflexo uma vez por cena.','gm_only',6),
    ('20000000-0000-4000-8000-000000000003'::uuid,'Desconfiança Absoluta','Ajuda parece uma armadilha.','Primeira ajuda de um aliado','Intuição DT 18; pode recusar o bônus.','owner_only',1),('20000000-0000-4000-8000-000000000003'::uuid,'Dor do Marcado','A dor atravessa o vínculo.','Marcado sofre crítico ou fica morrendo','Perde 1d4 SAN e fica vulnerável até o próximo turno.','owner_only',2),('20000000-0000-4000-8000-000000000003'::uuid,'Marca Revertida','Uma traição inverte o rastreio.','Alvo marcado trai Arya','Inimigos conhecem sua direção e ela perde camuflagem por uma rodada.','owner_only',3),('20000000-0000-4000-8000-000000000003'::uuid,'Pedido de Socorro','Recusar ajuda aprofunda a Marca.','Arya recusa ajuda por desconfiança','Profundidade +1 até proteger alguém ou reparar a escolha.','owner_only',4),('20000000-0000-4000-8000-000000000003'::uuid,'Tinta Vulnerável','Marcas físicas podem ser apagadas.','Água corrente, solvente ou Energia','Redesenhar a marca custa 1 PE.','owner_only',5),('20000000-0000-4000-8000-000000000003'::uuid,'Agulha Quer um Corpo','A última saída deixa de ser escolha.','Marca em Porta Aberta','Cada portal grava um traço; em Marca Ausente o mestre escolhe uma saída indesejada.','gm_only',6),
    ('20000000-0000-4000-8000-000000000004'::uuid,'A Dor Permanece','Trauma dividido continua existindo.','Segundo Compartimentar na cena','Vontade DT 20; em falha dissocia e perde a próxima reação.','owner_only',1),('20000000-0000-4000-8000-000000000004'::uuid,'Empatia Removida','A ajuda sem explicação parece procedimento vazio.','Pedido de confiança sem explicação','-1d20 no primeiro teste para ajudar.','owner_only',2),('20000000-0000-4000-8000-000000000004'::uuid,'Voz Contaminada','A própria voz carrega outra memória.','Ouvir gravação com a própria voz','Vontade DT 18; Carga +1 em falha.','owner_only',3),('20000000-0000-4000-8000-000000000004'::uuid,'Compulsão Clínica','Ninguém morre sem tentativa.','Alguém entra em morrendo','Ignorar exige Vontade DT 20 e aumenta Carga.','owner_only',4),('20000000-0000-4000-8000-000000000004'::uuid,'Procedimento Verbal','Certos procedimentos exigem contato.','Silêncio paranormal','Anatomia da Alma e Memória Anestesiada ficam bloqueadas até criar novo código.','owner_only',5),('20000000-0000-4000-8000-000000000004'::uuid,'Identidade Arquivada','O Gravador ocupa o espaço vazio.','Carga em Sem Nome','Memória substituída até alguém provar lembrança compartilhada.','gm_only',6),
    ('20000000-0000-4000-8000-000000000005'::uuid,'Mapa Não Confirmado','Uma rota não verificada não é segura.','Emboscada ou informação impossível','Vontade DT 20; Linha Segura bloqueada até confirmar Marco.','owner_only',1),('20000000-0000-4000-8000-000000000005'::uuid,'Voz de Thompson','A credencial falsa ainda comanda.','Ordem com voz de Thompson','Vontade DT 18; em falha fica abalada e perde reação.','owner_only',2),('20000000-0000-4000-8000-000000000005'::uuid,'Fé na Instituição','O documento oficial recebe benefício da dúvida.','Documento oficial é provado falso','Ruptura +1 e perda de 1d4 SAN.','owner_only',3),('20000000-0000-4000-8000-000000000005'::uuid,'Pessoas sem Registro','A instituição apaga quem não conta.','Ignorar civil apagado','Ruptura +1; resgatar ou registrar reduz 1.','owner_only',4),('20000000-0000-4000-8000-000000000005'::uuid,'Comando Depende de Voz','Coordenação exige comunicação.','Silêncio, estática ou surdez','Habilidades de comando bloqueadas até combinar sinal visual.','owner_only',5),('20000000-0000-4000-8000-000000000005'::uuid,'Responsabilidade Reescrita','O arquivo muda o autor da ordem.','Ruptura em Motim','Uma ação alheia é atribuída a Amber por cena.','gm_only',6),
    ('20000000-0000-4000-8000-000000000006'::uuid,'Responsabilidade Sincera','Assumir a decisão enfraquece o Revide.','Alguém admite a decisão sem culpar o jogo','Controle -1 e uma habilidade de Rivaldo fica indisponível.','campaign',1),('20000000-0000-4000-8000-000000000006'::uuid,'Misericórdia Deliberada','Poupar devolve escolha ao corpo.','Gragas poupa quem poderia matar','Controle -1 e repete Vontade contra posse.','campaign',2),('20000000-0000-4000-8000-000000000006'::uuid,'Memória dos Oito Segundos','A ordem de fogo volta inteira.','Pelotão, Medalha ou ordem de fogo','Vontade DT 18; em falha abalado e perde reação.','owner_only',3),('20000000-0000-4000-8000-000000000006'::uuid,'Consciência Compartilhada','Dano mental atinge as duas consciências.','Controle 3 ou mais','-1d20 contra invasão mental.','owner_only',4),('20000000-0000-4000-8000-000000000006'::uuid,'Verdade sobre o Facilitador','A cobrança encontra outro alvo.','Provas do planejamento','Rivaldo perde a Proteção do Rancor durante a dúvida.','gm_only',5),('20000000-0000-4000-8000-000000000006'::uuid,'Custo do Retorno','Toda ressurreição desgasta a identidade.','Gragas chega a 0 SAN','Rivaldo assume e Gragas vira voz aprisionada.','gm_only',6)
  ) data(character_id,name,description,trigger_text,effect,visibility,position)
  on conflict(character_id,name) do update set narrative_description=excluded.narrative_description,trigger_text=excluded.trigger_text,mechanical_effect=excluded.mechanical_effect,visibility=excluded.visibility,sort_order=excluded.sort_order,updated_by=excluded.updated_by,updated_at=now();

  insert into public.character_meter_stages(campaign_id,meter_definition_id,stage_value,name,description,mechanical_effect,visibility)
  select v_campaign,data.meter_id,data.value,data.name,data.description,data.effect,'owner_only' from (values
    ('40000000-0000-4000-8000-000000000001'::uuid,0,'Fora do Ar','O silêncio limita poderes narrativos.','Sem efeito.'),('40000000-0000-4000-8000-000000000001'::uuid,1,'Observado','Câmeras e celulares se viram para Davi.','Sinal discreto.'),('40000000-0000-4000-8000-000000000001'::uuid,2,'Tendência','O Facilitador repete uma frase por aparelho.','Uma vez por cena.'),('40000000-0000-4000-8000-000000000001'::uuid,3,'Viral','Pulso da Lente é liberado.','Falhas sociais têm consequências maiores.'),('40000000-0000-4000-8000-000000000001'::uuid,4,'Transmissão','O Facilitador aparece em tela próxima.','Pode falar com todos.'),('40000000-0000-4000-8000-000000000001'::uuid,5,'Favorito','Davi vira conduto da Convergência.','Ganha alcance e perde autonomia.'),
    ('40000000-0000-4000-8000-000000000002'::uuid,0,'Centrado','Separa hipótese, evidência e medo.','Sem efeito.'),('40000000-0000-4000-8000-000000000002'::uuid,1,'Observação','Vigilância intensificada.','+1d20 em Percepção para vigilância.'),('40000000-0000-4000-8000-000000000002'::uuid,2,'Suspeita','Ajuda precisa ser verificada.','Só aceita ajuda analisada ou vinculada.'),('40000000-0000-4000-8000-000000000002'::uuid,3,'Hipervigilância','Tudo parece prestes a atacar.','+2 Defesa e -1d20 em Presença.'),('40000000-0000-4000-8000-000000000002'::uuid,4,'Cerco','O Espelho introduz uma pista falsa.','Uma vez por cena.'),('40000000-0000-4000-8000-000000000002'::uuid,5,'Golpe Final','O Facilitador marca um alvo.','Vontade para não atacar.'),
    ('40000000-0000-4000-8000-000000000003'::uuid,0,'Pele Limpa','Arya escolhe os vínculos.','Sem efeito.'),('40000000-0000-4000-8000-000000000003'::uuid,1,'Traço','Percebe marcas e portas.','Alcance curto.'),('40000000-0000-4000-8000-000000000003'::uuid,2,'Contorno','Sente medo e dor dos marcados.','Não conhece a causa.'),('40000000-0000-4000-8000-000000000003'::uuid,3,'Tinta Viva','Marcas se movem.','Porta de Agulha ganha +3m.'),('40000000-0000-4000-8000-000000000003'::uuid,4,'Porta Aberta','O Facilitador abre passagem falsa.','Uma vez por cena.'),('40000000-0000-4000-8000-000000000003'::uuid,5,'Marca Ausente','Arya vira passagem viva.','A última saída deixa de ser escolha.'),
    ('40000000-0000-4000-8000-000000000004'::uuid,0,'Lúcida','Reconhece lembranças.','Sem efeito.'),('40000000-0000-4000-8000-000000000004'::uuid,1,'Eco','Analisa a dor com distância.','+1d20 para dor, -1d20 para afeto.'),('40000000-0000-4000-8000-000000000004'::uuid,2,'Sobreposição','Mente e corpo se confundem.','Primeira perda de SAN causa 1 PV.'),('40000000-0000-4000-8000-000000000004'::uuid,3,'Dissociação','A reação desaparece.','Vontade DT 20 no fim do turno.'),('40000000-0000-4000-8000-000000000004'::uuid,4,'Voz Alheia','Uma faixa responde internamente.','Mestre responde uma pergunta.'),('40000000-0000-4000-8000-000000000004'::uuid,5,'Sem Nome','O Gravador ocupa Lize.','Escolhe memória, condição e voz.'),
    ('40000000-0000-4000-8000-000000000005'::uuid,0,'Rota Segura','Rotas verificadas.','Sem efeito.'),('40000000-0000-4000-8000-000000000005'::uuid,1,'Alerta','Incoerências ficam visíveis.','+1d20 para mapas e relatórios.'),('40000000-0000-4000-8000-000000000005'::uuid,2,'Divergência','Mapas escritos perdem autoridade.','Sem bônus até confirmar Marco.'),('40000000-0000-4000-8000-000000000005'::uuid,3,'Ordem Falsa','A rota precisa existir fisicamente.','Linha Segura custa +1 PE.'),('40000000-0000-4000-8000-000000000005'::uuid,4,'Motim','O Facilitador transmite ordem falsa.','Uma vez por cena.'),('40000000-0000-4000-8000-000000000005'::uuid,5,'Arquivo Branco','A equipe vira subordinada.','Registros reescrevem responsabilidade.'),
    ('40000000-0000-4000-8000-000000000006'::uuid,0,'Gragas','Controle humano.','Rivaldo observa.'),('40000000-0000-4000-8000-000000000006'::uuid,1,'Sussurro','Rivaldo fornece uma pista.','Pode ser verdadeira ou falsa.'),('40000000-0000-4000-8000-000000000006'::uuid,2,'Intrusão','A voz atravessa dano mental.','Vontade ou repete a última frase.'),('40000000-0000-4000-8000-000000000006'::uuid,3,'Disputa','Golpe de Rivaldo é liberado.','Efeitos mentais ficam mais fortes.'),('40000000-0000-4000-8000-000000000006'::uuid,4,'Invasão','Rivaldo escolhe prioridade.','Retorno Sangrento disponível.'),('40000000-0000-4000-8000-000000000006'::uuid,5,'Rivaldo','A entidade conduz o corpo.','Gragas disputa por misericórdia ou verdade.')
  ) data(meter_id,value,name,description,effect)
  on conflict(meter_definition_id,stage_value) do update set name=excluded.name,description=excluded.description,mechanical_effect=excluded.mechanical_effect;

  update public.abilities set stable_key=data.stable_key, masked_name=data.masked_name, sealed_hint=data.hint, frequency=data.frequency, target_text=data.target_text, paranormal_consequence=data.consequence, sort_order=data.position, updated_by=p_owner_user_id
  from (values
    ('30000000-0000-4000-8000-000000000001'::uuid,'davi-narrativa-dominante','???','Sua versão ainda pode mudar a cena','uma vez por cena','Todos que escutem Davi','Se a versão falhar, um detalhe se volta contra o grupo e Davi perde 1d4 SAN.',1),('30000000-0000-4000-8000-000000000002'::uuid,'davi-sempre-no-ar',null,null,'uma vez por cena','Davi','Um aparelho próximo acende com o símbolo da Zona 7.',2),('30000000-0000-4000-8000-000000000003'::uuid,'davi-sete-segundos-antes',null,null,'livre','Davi ou aliado','Alterar o futuro aumenta Audiência em 1.',3),('30000000-0000-4000-8000-000000000004'::uuid,'davi-holofote-compulsorio',null,null,'livre','Uma criatura em alcance curto','Ausência total de observadores bloqueia o poder.',4),('30000000-0000-4000-8000-000000000005'::uuid,'davi-versao-que-cola',null,null,'livre','Próprio teste','Nova falha torna a interpretação oposta verdadeira.',5),('30000000-0000-4000-8000-000000000006'::uuid,'davi-protagonista-absoluto',null,null,'uma vez por missão','Todos na cena','Audiência vai para Favorito e o Facilitador pode falar por Davi.',6),
    ('30000000-0000-4000-8000-000000000007'::uuid,'magnus-padrao-de-ameaca',null,null,'livre','Uma ameaça','Revela apenas uma informação autorizada.',1),('30000000-0000-4000-8000-000000000008'::uuid,'magnus-interrupcao-precisa',null,null,'livre','Alvo analisado','Exige análise ativa.',2),('30000000-0000-4000-8000-000000000009'::uuid,'magnus-confianca-calculada',null,null,'uma vez por cena','Um aliado','Ação inesperada encerra o vínculo e aumenta Suspeita.',3),('30000000-0000-4000-8000-000000000010'::uuid,'magnus-kata-ponto-cego',null,null,'livre','Alvo corpo a corpo','Bônus maior contra alvo analisado.',4),('30000000-0000-4000-8000-000000000011'::uuid,'magnus-espelho-de-alibi',null,null,'livre','Um atacante','O uso pode aumentar Suspeita.',5),('30000000-0000-4000-8000-000000000012'::uuid,'magnus-golpe-final',null,null,'uma vez por missão','Um alvo','Se o alvo cair, Vontade DT 20 ou Suspeita vai para Golpe Final.',6),
    ('30000000-0000-4000-8000-000000000013'::uuid,'arya-marca-indelevel',null,null,'livre','Criatura tocada ou ferida','A dor do marcado atravessa o vínculo.',1),('30000000-0000-4000-8000-000000000014'::uuid,'arya-marca-de-retorno',null,null,'uma vez por cena','Ponto seguro','Pode levar aliado voluntário.',2),('30000000-0000-4000-8000-000000000015'::uuid,'arya-vinculo-de-tinta',null,null,'livre','Aliado voluntário','Arya pode receber metade do dano.',3),('30000000-0000-4000-8000-000000000016'::uuid,'arya-tinta-de-cobertura',null,null,'livre','Até duas criaturas','Água, solvente e Energia apagam marcas.',4),('30000000-0000-4000-8000-000000000017'::uuid,'arya-porta-de-agulha',null,null,'livre','Dois pontos','Cada portal pode aprofundar a Marca.',5),('30000000-0000-4000-8000-000000000018'::uuid,'arya-sete-portas-na-pele',null,null,'uma vez por missão','Até sete pontos','Profundidade vai para Marca Ausente.',6),
    ('30000000-0000-4000-8000-000000000019'::uuid,'lize-compartimentar-trauma',null,null,'livre','Um aliado','Depois do segundo uso, ativa A Dor Permanece.',1),('30000000-0000-4000-8000-000000000020'::uuid,'lize-anatomia-da-alma',null,null,'livre','Uma criatura','Revela somente informação autorizada.',2),('30000000-0000-4000-8000-000000000021'::uuid,'lize-medicina-de-campo',null,null,'livre','Uma criatura','Consome uso do kit.',3),('30000000-0000-4000-8000-000000000022'::uuid,'lize-memoria-anestesiada',null,null,'livre','Um aliado','A condição retorna depois.',4),('30000000-0000-4000-8000-000000000023'::uuid,'lize-incisao-de-memoria',null,null,'livre','Aliado ao toque ou inimigo em alcance curto','Uma faixa pode substituir lembrança de Lize.',5),('30000000-0000-4000-8000-000000000024'::uuid,'lize-todas-as-vozes',null,null,'uma vez por missão','Até cinco aliados','Carga vai para Sem Nome.',6),
    ('30000000-0000-4000-8000-000000000025'::uuid,'amber-linha-segura',null,null,'livre','Até dois aliados','Exige cobertura, aliado ou Marco.',1),('30000000-0000-4000-8000-000000000026'::uuid,'amber-fogo-coordenado',null,null,'livre','Segundo atacante','Exige fraqueza explorada.',2),('30000000-0000-4000-8000-000000000027'::uuid,'amber-marco-confirmado',null,null,'livre','Uma saída ou cobertura','Cria direção segura.',3),('30000000-0000-4000-8000-000000000028'::uuid,'amber-supressao-em-setores',null,null,'livre','Cone de 9m','Vontade DT 20.',4),('30000000-0000-4000-8000-000000000029'::uuid,'amber-ordem-provisoria',null,null,'livre','Sistemas e documentos','Invocar o Arquivo pode aumentar Ruptura.',5),('30000000-0000-4000-8000-000000000030'::uuid,'amber-todos-voltam',null,null,'uma vez por missão','Até cinco aliados','A rota precisa estar confirmada.',6),
    ('30000000-0000-4000-8000-000000000031'::uuid,'gragas-dor-devolvida',null,null,'livre','Próprio corpo e próximo alvo','Dano não liberado retorna parcialmente e custa SAN.',1),('30000000-0000-4000-8000-000000000032'::uuid,'gragas-oitavo-segundo',null,null,'uma vez por cena','Gragas','Morte durante a parada aumenta Controle em 2.',2),('30000000-0000-4000-8000-000000000033'::uuid,'gragas-dois-na-mira',null,null,'livre','Gragas','Rivaldo pode sussurrar informação falsa.',3),('30000000-0000-4000-8000-000000000034'::uuid,'gragas-motor-de-rancor',null,null,'livre','Gragas','Falha de Vontade aumenta Controle.',4),('30000000-0000-4000-8000-000000000035'::uuid,'gragas-voz-de-rivaldo',null,null,'livre','Inimigos em alcance curto','Aliados responsáveis recebem +5.',5),('30000000-0000-4000-8000-000000000036'::uuid,'gragas-retorno-sangrento',null,null,'uma vez por missão','Gragas','Rivaldo controla o corpo por 1d4 rodadas.',6)
  ) data(id,stable_key,masked_name,hint,frequency,target_text,consequence,position)
  where public.abilities.id=data.id;
  update public.character_abilities set state='masked',public_override='Sua versão ainda pode mudar a cena',sort_order=1 where ability_id='30000000-0000-4000-8000-000000000001';

  insert into public.actors(id,campaign_id,character_id,name,actor_type,public_description,gm_description,color,visibility)
  values
    ('72000000-0000-4000-8000-000000000001',v_campaign,'20000000-0000-4000-8000-000000000001','Davi Brito','player_character','O Favorito',null,'#b8323c','campaign'),
    ('72000000-0000-4000-8000-000000000002',v_campaign,'20000000-0000-4000-8000-000000000002','Magnus Sigvaldi','player_character','O Detetive',null,'#e2b341','campaign'),
    ('72000000-0000-4000-8000-000000000003',v_campaign,'20000000-0000-4000-8000-000000000003','Arya Black Snape','player_character','A Marcada',null,'#8f74c8','campaign'),
    ('72000000-0000-4000-8000-000000000004',v_campaign,'20000000-0000-4000-8000-000000000004','Lize Matsunaga','player_character','A Médica',null,'#57a773','campaign'),
    ('72000000-0000-4000-8000-000000000005',v_campaign,'20000000-0000-4000-8000-000000000005','Amber Moss','player_character','A Comandante',null,'#3c8dff','campaign'),
    ('72000000-0000-4000-8000-000000000006',v_campaign,'20000000-0000-4000-8000-000000000006','Gragas','player_character','Hospedeiro do Revide','Personagem jogável; Rivaldo permanece uma entidade separada.','#7f1d2d','campaign'),
    ('72000000-0000-4000-8000-000000000007',v_campaign,null,'Rivaldo','entity','O Revide','Entidade de Sangue contaminada por Conhecimento.','#8b1e2d','gm_only'),
    ('72000000-0000-4000-8000-000000000008',v_campaign,null,'Facilitador','narrator','A Regra É Clara','Quer criar o Mundo Corrigido.','#8b5cf6','gm_only'),
    ('72000000-0000-4000-8000-000000000009',v_campaign,null,'Zona 7','environment','Ambiente paranormal ativo','Pode reconfigurar sala, cobrar, absorver e manifestar ameaças.','#5d6268','gm_only')
  on conflict(campaign_id,name) do update set character_id=excluded.character_id,actor_type=excluded.actor_type,public_description=excluded.public_description,gm_description=excluded.gm_description,color=excluded.color,visibility=excluded.visibility;
  insert into public.actor_controllers(campaign_id,actor_id,user_id,control_level,granted_by)
  select v_campaign,id,p_owner_user_id,'full',p_owner_user_id from public.actors where campaign_id=v_campaign and actor_type <> 'player_character'
  on conflict(actor_id,user_id) do update set control_level='full';
  insert into public.actor_links(campaign_id,source_actor_id,target_actor_id,link_type,description,mechanics)
  values(v_campaign,'72000000-0000-4000-8000-000000000007','72000000-0000-4000-8000-000000000006','possui','Rivaldo divide o corpo de Gragas.','{"meter":"Controle da Consciência","separable":true}')
  on conflict(source_actor_id,target_actor_id,link_type) do update set description=excluded.description,mechanics=excluded.mechanics;

  insert into public.synergy_tags(campaign_id,key,label,description,color)
  select v_campaign,key,label,description,color from (values
    ('analisado','Analisado','Fraqueza ou padrão conhecido.','#e2b341'),('marcado','Marcado','Alvo ligado por tinta.','#8f74c8'),('exposto','Exposto','Narrativa ou posição revelou o alvo.','#b8323c'),('rota_segura','Rota segura','Movimento confirmado.','#3c8dff'),('marco_confirmado','Marco confirmado','Posição validada por Amber.','#57a773'),('memoria_compartilhada','Memória compartilhada','Lembrança sustentada pelo grupo.','#8f74c8'),('responsabilidade_sincera','Responsabilidade sincera','Assunção real da decisão.','#57a773'),('controle_rivaldo','Controle de Rivaldo','Influência do Revide.','#7f1d2d'),('audiencia','Audiência','Atenção coletiva concentrada.','#b8323c')
  ) tags(key,label,description,color)
  on conflict(campaign_id,key) do update set label=excluded.label,description=excluded.description,color=excluded.color;

  insert into public.game_scenes(id,campaign_id,session_id,name,description,state,grid_type,grid_size,distance_per_cell,created_by,updated_by)
  values('73000000-0000-4000-8000-000000000001',v_campaign,v_session,'Estúdio dos Sete Segundos','Cena inicial sem mapa associado; o mestre pode enviar e configurar a imagem.','published','square',64,1.5,p_owner_user_id,p_owner_user_id)
  on conflict(id) do update set name=excluded.name,description=excluded.description,state=excluded.state,updated_by=excluded.updated_by;
  insert into public.scene_layers(id,campaign_id,scene_id,name,layer_type,position,visibility,is_locked,is_visible)
  values
    ('73100000-0000-4000-8000-000000000001',v_campaign,'73000000-0000-4000-8000-000000000001','Mapa','background',0,'campaign',true,true),
    ('73100000-0000-4000-8000-000000000002',v_campaign,'73000000-0000-4000-8000-000000000001','Jogadores','tokens',1,'campaign',false,true),
    ('73100000-0000-4000-8000-000000000003',v_campaign,'73000000-0000-4000-8000-000000000001','Segredos do mestre','gm',2,'gm_only',false,true)
  on conflict(scene_id,name) do update set position=excluded.position,visibility=excluded.visibility,is_visible=excluded.is_visible;
  insert into public.scene_tokens(id,campaign_id,scene_id,actor_id,label,x,y,size,visible)
  select data.id,v_campaign,'73000000-0000-4000-8000-000000000001',data.actor_id,data.label,data.x,data.y,1,true from (values
    ('73200000-0000-4000-8000-000000000001'::uuid,'72000000-0000-4000-8000-000000000001'::uuid,'Davi',0.18,0.35),('73200000-0000-4000-8000-000000000002'::uuid,'72000000-0000-4000-8000-000000000002'::uuid,'Magnus',0.34,0.62),('73200000-0000-4000-8000-000000000003'::uuid,'72000000-0000-4000-8000-000000000003'::uuid,'Arya',0.48,0.28),('73200000-0000-4000-8000-000000000004'::uuid,'72000000-0000-4000-8000-000000000004'::uuid,'Lize',0.61,0.58),('73200000-0000-4000-8000-000000000005'::uuid,'72000000-0000-4000-8000-000000000005'::uuid,'Amber',0.78,0.38),('73200000-0000-4000-8000-000000000006'::uuid,'72000000-0000-4000-8000-000000000006'::uuid,'Gragas',0.86,0.70)
  ) data(id,actor_id,label,x,y)
  on conflict(scene_id,actor_id) do update set x=excluded.x,y=excluded.y,label=excluded.label;
  insert into public.collective_displays(id,campaign_id,session_id,scene_id,mode,state,settings)
  values('73300000-0000-4000-8000-000000000001',v_campaign,v_session,'73000000-0000-4000-8000-000000000001','cast','inactive','{"hideControls":true,"hideSecrets":true}')
  on conflict(campaign_id,session_id) do update set scene_id=excluded.scene_id,mode=excluded.mode,settings=excluded.settings;
  insert into public.live_sessions(id,campaign_id,session_id,current_scene_id,state,snapshot)
  values('73400000-0000-4000-8000-000000000001',v_campaign,v_session,'73000000-0000-4000-8000-000000000001','preparing','{"pressure":0,"mode":"cast"}')
  on conflict(session_id) do update set current_scene_id=excluded.current_scene_id,snapshot=excluded.snapshot;

  insert into public.script_packages(id,campaign_id,name,slug,description,state,created_by)
  values('74000000-0000-4000-8000-000000000001',v_campaign,'Sete Segundos Antes','sete-segundos-antes','Roteiro inicial editável com dois caminhos.','published',p_owner_user_id)
  on conflict(campaign_id,slug) do update set name=excluded.name,description=excluded.description;
  insert into public.script_versions(id,campaign_id,script_package_id,version_number,schema_version,canonical_document,source_format,source_hash,state,published_at,created_by)
  values('74100000-0000-4000-8000-000000000001',v_campaign,'74000000-0000-4000-8000-000000000001',1,1,
    '{"schemaVersion":1,"title":"Sete Segundos Antes","start":"sinal","nodes":[{"id":"sinal","type":"narration","title":"A transmissão impossível"},{"id":"seguir","type":"choice","title":"Seguir o sinal?"},{"id":"corredor","type":"scene","title":"Corredor sem saída"},{"id":"cameras","type":"scene","title":"Sala das câmeras"}]}'::jsonb,
    'z7.json','seed-sete-segundos-v1','published',now(),p_owner_user_id)
  on conflict(id) do update set canonical_document=excluded.canonical_document,state=excluded.state;
  update public.script_packages set current_version_id='74100000-0000-4000-8000-000000000001' where id='74000000-0000-4000-8000-000000000001';
  insert into public.script_nodes(id,campaign_id,script_version_id,stable_key,node_type,title,public_content,gm_content,sort_order)
  values
    ('74200000-0000-4000-8000-000000000001',v_campaign,'74100000-0000-4000-8000-000000000001','sinal','narration','A transmissão impossível','{"text":"Uma câmera sem energia registra sete segundos do futuro."}','{"note":"Gragas aparece vivo ao final do sinal."}',1),
    ('74200000-0000-4000-8000-000000000002',v_campaign,'74100000-0000-4000-8000-000000000001','seguir','choice','Seguir o sinal?','{"prompt":"Por onde o grupo segue?","options":[{"key":"corredor","label":"Corredor"},{"key":"cameras","label":"Sala das câmeras"}]}','{}',2),
    ('74200000-0000-4000-8000-000000000003',v_campaign,'74100000-0000-4000-8000-000000000001','corredor','scene','Corredor sem saída','{"text":"A porta fecha depois do oitavo passo."}','{}',3),
    ('74200000-0000-4000-8000-000000000004',v_campaign,'74100000-0000-4000-8000-000000000001','cameras','scene','Sala das câmeras','{"text":"Todas as telas mostram o grupo sete segundos adiante."}','{}',4)
  on conflict(script_version_id,stable_key) do update set title=excluded.title,public_content=excluded.public_content,gm_content=excluded.gm_content;
  insert into public.script_edges(id,campaign_id,script_version_id,source_node_id,target_node_id,edge_type,label,sort_order)
  values
    ('74300000-0000-4000-8000-000000000001',v_campaign,'74100000-0000-4000-8000-000000000001','74200000-0000-4000-8000-000000000001','74200000-0000-4000-8000-000000000002','next',null,1),
    ('74300000-0000-4000-8000-000000000002',v_campaign,'74100000-0000-4000-8000-000000000001','74200000-0000-4000-8000-000000000002','74200000-0000-4000-8000-000000000003','choice','corredor',1),
    ('74300000-0000-4000-8000-000000000003',v_campaign,'74100000-0000-4000-8000-000000000001','74200000-0000-4000-8000-000000000002','74200000-0000-4000-8000-000000000004','choice','cameras',2)
  on conflict(id) do update set source_node_id=excluded.source_node_id,target_node_id=excluded.target_node_id,label=excluded.label;

  insert into public.audit_events (id,campaign_id,actor_user_id,entity_type,entity_id,event_type,visibility,after_data,idempotency_key)
  values ('56000000-0000-4000-8000-000000000001',v_campaign,p_owner_user_id,'campaign',v_campaign,'demo_campaign_seeded','gm_only',jsonb_build_object('name','Zona 7: A Convergência'),'56000000-0000-4000-8000-000000000099')
  on conflict (id) do nothing;

  return v_campaign;
end;
$$;

revoke all on function public.seed_zona7_demo(uuid) from public;
grant execute on function public.seed_zona7_demo(uuid) to service_role;

do $$
declare seed_owner uuid;
begin
  select id into seed_owner from auth.users order by created_at limit 1;
  if seed_owner is not null then
    perform public.seed_zona7_demo(seed_owner);
  else
    raise notice 'Zona 7 seed instalado. Execute pnpm db:seed após criar o primeiro usuário por variáveis de ambiente.';
  end if;
end $$;
