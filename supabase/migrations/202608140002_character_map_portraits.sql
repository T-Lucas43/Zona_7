alter table public.actors
add column if not exists map_portrait_path text;

comment on column public.actors.public_portrait_path is
  'Retrato principal usado em fichas, listas e documentos.';

comment on column public.actors.map_portrait_path is
  'Imagem de corpo inteiro usada nos tokens do mapa e na iniciativa.';
