-- ─────────────────────────────────────────────
--  VIDEOARTE NET — Supabase schema
--  Ejecuta este SQL en el SQL Editor de Supabase
-- ─────────────────────────────────────────────

create table pieces (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text not null,
  tags        text[] not null default '{}',
  vimeo_url   text not null,          -- URL del iframe de Vimeo
  vimeo_thumb text,                   -- miniatura (opcional, puedes rellenarla manualmente)
  year        int,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Índice para búsquedas por etiqueta
create index pieces_tags_idx on pieces using gin(tags);

-- ─── Row Level Security ───
alter table pieces enable row level security;

-- Cualquiera puede leer piezas activas (frontend público)
create policy "Public read"
  on pieces for select
  using (active = true);

-- Solo el service_role (backend) puede insertar / editar / borrar
create policy "Service insert"
  on pieces for insert
  with check (true);

create policy "Service update"
  on pieces for update
  using (true);

create policy "Service delete"
  on pieces for delete
  using (true);


-- ─── Datos de ejemplo ───
insert into pieces (title, author, tags, vimeo_url, year) values
  ('Cuerpo sin órganos', 'Elena Vidal',  array['cuerpo','fragmento','loop'],    'https://player.vimeo.com/video/XXXXXXX', 2023),
  ('Glitch Memoria',     'Takashi N.',   array['glitch','tiempo','ruido'],      'https://player.vimeo.com/video/XXXXXXX', 2024),
  ('Paisaje Dato',       'Mar Solà',     array['datos','espacio','paisaje'],    'https://player.vimeo.com/video/XXXXXXX', 2022),
  ('Loop Silencio',      'Diego A.',     array['loop','silencio','tiempo'],     'https://player.vimeo.com/video/XXXXXXX', 2024),
  ('Ruido Blanco',       'Lena Ko',      array['ruido','glitch','cuerpo'],      'https://player.vimeo.com/video/XXXXXXX', 2023),
  ('Espejo Roto',        'Ivan Pérez',   array['fragmento','espejo','silencio'],'https://player.vimeo.com/video/XXXXXXX', 2022),
  ('Tiempo Muerto',      'Sofía R.',     array['tiempo','espacio','loop'],      'https://player.vimeo.com/video/XXXXXXX', 2024);
