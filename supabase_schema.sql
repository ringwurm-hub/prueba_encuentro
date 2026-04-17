-- ─────────────────────────────────────────────────────────
--  VIDEOARTE NET v2 — Supabase schema
--  Ejecuta en: Supabase → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────

-- ─── Supabase Auth gestiona los usuarios automáticamente ───
-- No necesitas crear la tabla auth.users, ya existe.
-- Solo necesitas habilitar Email/Password en:
-- Authentication → Providers → Email


-- ─── Tabla principal de piezas (sin cambios respecto a v1) ───
create table if not exists pieces (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text not null,
  tags        text[] not null default '{}',
  vimeo_url   text not null,
  vimeo_thumb text,
  year        int,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists pieces_tags_idx on pieces using gin(tags);


-- ─── Tags de usuario ───
create table if not exists user_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  piece_id   uuid not null references pieces(id) on delete cascade,
  tag        text not null,
  public     boolean not null default false,   -- false = solo visible para el propio usuario
  created_at timestamptz not null default now(),

  unique(user_id, piece_id, tag)               -- un usuario no puede poner el mismo tag dos veces al mismo vídeo
);

create index if not exists user_tags_piece_idx  on user_tags(piece_id);
create index if not exists user_tags_user_idx   on user_tags(user_id);
create index if not exists user_tags_public_idx on user_tags(public) where public = true;


-- ─── Tabla de perfiles (nombre público para mostrar en la red) ───
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- Crear perfil automáticamente al registrarse
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles(id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ─────────────────────────────────────────────────────────
--  Row Level Security
-- ─────────────────────────────────────────────────────────

alter table pieces    enable row level security;
alter table user_tags enable row level security;
alter table profiles  enable row level security;

-- Piezas: lectura pública, escritura solo service_role
create policy "pieces_public_read"   on pieces for select using (active = true);
create policy "pieces_service_write" on pieces for insert with check (true);
create policy "pieces_service_update"on pieces for update using (true);
create policy "pieces_service_delete"on pieces for delete using (true);

-- Perfiles: lectura pública, cada usuario edita el suyo
create policy "profiles_public_read"  on profiles for select using (true);
create policy "profiles_own_update"   on profiles for update using (auth.uid() = id);

-- user_tags: reglas por rol
--   SELECT: el propietario ve todos los suyos; cualquiera ve los públicos
create policy "user_tags_read_own"    on user_tags for select using (auth.uid() = user_id);
create policy "user_tags_read_public" on user_tags for select using (public = true);
--   INSERT/UPDATE/DELETE: solo el propietario
create policy "user_tags_insert"      on user_tags for insert with check (auth.uid() = user_id);
create policy "user_tags_update"      on user_tags for update using (auth.uid() = user_id);
create policy "user_tags_delete"      on user_tags for delete using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────
--  Datos de ejemplo
-- ─────────────────────────────────────────────────────────
insert into pieces (title, author, tags, vimeo_url, year) values
  ('Cuerpo sin órganos', 'Elena Vidal',  array['cuerpo','fragmento','loop'],     'https://player.vimeo.com/video/XXXXXXX', 2023),
  ('Glitch Memoria',     'Takashi N.',   array['glitch','tiempo','ruido'],       'https://player.vimeo.com/video/XXXXXXX', 2024),
  ('Paisaje Dato',       'Mar Solà',     array['datos','espacio','paisaje'],     'https://player.vimeo.com/video/XXXXXXX', 2022),
  ('Loop Silencio',      'Diego A.',     array['loop','silencio','tiempo'],      'https://player.vimeo.com/video/XXXXXXX', 2024),
  ('Ruido Blanco',       'Lena Ko',      array['ruido','glitch','cuerpo'],       'https://player.vimeo.com/video/XXXXXXX', 2023),
  ('Espejo Roto',        'Ivan Pérez',   array['fragmento','espejo','silencio'], 'https://player.vimeo.com/video/XXXXXXX', 2022),
  ('Tiempo Muerto',      'Sofía R.',     array['tiempo','espacio','loop'],       'https://player.vimeo.com/video/XXXXXXX', 2024);
