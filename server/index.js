require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

// ─── Clientes Supabase ───
// service_role: para operaciones de admin (saltarse RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
// anon: para operaciones con el JWT del usuario (respeta RLS)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);


// ─────────────────────────────────────────────
//  MIDDLEWARES
// ─────────────────────────────────────────────

// Protege rutas de administración con token estático
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ error: 'No autorizado' });
  next();
}

// Verifica el JWT de Supabase y adjunta el cliente autenticado
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  const jwt = auth.slice(7);
  // Crear cliente con el JWT del usuario para que RLS funcione correctamente
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user)
    return res.status(401).json({ error: 'Token inválido o expirado' });

  req.user   = user;
  req.client = client; // cliente con contexto de usuario (respeta RLS)
  next();
}


// ─────────────────────────────────────────────
//  AUTH — registro y login (delegados a Supabase)
// ─────────────────────────────────────────────

// POST /auth/register
// Body: { email, password }
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email y password son obligatorios' });

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({
    user: { id: data.user.id, email: data.user.email },
    // Supabase devuelve el JWT aquí si el email ya está confirmado
    // o null si requiere confirmación por email
    session: data.session
  });
});

// POST /auth/login
// Body: { email, password }
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email y password son obligatorios' });

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  res.json({
    user:         { id: data.user.id, email: data.user.email },
    access_token: data.session.access_token,
    expires_at:   data.session.expires_at
  });
});

// GET /auth/me — devuelve el perfil del usuario autenticado
app.get('/auth/me', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...req.user, profile: data });
});

// PATCH /auth/me — actualiza el display_name
app.patch('/auth/me', requireAuth, async (req, res) => {
  const { display_name } = req.body;
  if (!display_name)
    return res.status(400).json({ error: 'display_name es obligatorio' });

  const { data, error } = await req.client
    .from('profiles')
    .update({ display_name })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// ─────────────────────────────────────────────
//  PIEZAS — lectura pública
// ─────────────────────────────────────────────

// GET /pieces
app.get('/pieces', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pieces')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /pieces/:id
app.get('/pieces/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pieces')
    .select('*')
    .eq('id', req.params.id)
    .eq('active', true)
    .single();

  if (error) return res.status(404).json({ error: 'Pieza no encontrada' });
  res.json(data);
});

// GET /tags — etiquetas oficiales únicas
app.get('/tags', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pieces')
    .select('tags')
    .eq('active', true);

  if (error) return res.status(500).json({ error: error.message });
  const tags = [...new Set(data.flatMap(p => p.tags))].sort();
  res.json(tags);
});


// ─────────────────────────────────────────────
//  PIEZAS — escritura admin
// ─────────────────────────────────────────────

// POST /pieces
app.post('/pieces', requireAdmin, async (req, res) => {
  const { title, author, tags, vimeo_url, vimeo_thumb, year, description } = req.body;
  if (!title || !author || !tags?.length || !vimeo_url)
    return res.status(400).json({ error: 'Faltan campos: title, author, tags, vimeo_url' });

  const { data, error } = await supabaseAdmin
    .from('pieces')
    .insert([{ title, author, tags, vimeo_url, vimeo_thumb, year, description }])
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /pieces/:id
app.patch('/pieces/:id', requireAdmin, async (req, res) => {
  const allowed = ['title','author','tags','vimeo_url','vimeo_thumb','year','description','active'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'Ningún campo válido' });

  const { data, error } = await supabaseAdmin
    .from('pieces').update(updates).eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /pieces/:id (soft delete)
app.delete('/pieces/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('pieces').update({ active: false }).eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});


// ─────────────────────────────────────────────
//  USER TAGS
// ─────────────────────────────────────────────

// GET /user-tags/mine
// Devuelve todos los tags del usuario autenticado (privados + públicos)
app.get('/user-tags/mine', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('user_tags')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /user-tags/public
// Devuelve todos los tags públicos de todos los usuarios,
// incluyendo el display_name del autor para mostrarlo en la UI
app.get('/user-tags/public', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('user_tags')
    .select(`
      id, piece_id, tag, created_at,
      profiles ( display_name )
    `)
    .eq('public', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /user-tags
// Añade un tag a una pieza
// Body: { piece_id, tag }
app.post('/user-tags', requireAuth, async (req, res) => {
  const { piece_id, tag } = req.body;
  if (!piece_id || !tag?.trim())
    return res.status(400).json({ error: 'piece_id y tag son obligatorios' });

  const cleanTag = tag.trim().toLowerCase();

  const { data, error } = await req.client
    .from('user_tags')
    .insert([{ user_id: req.user.id, piece_id, tag: cleanTag, public: false }])
    .select().single();

  if (error) {
    // Código 23505 = unique_violation (ya existe este tag para este usuario+pieza)
    if (error.code === '23505')
      return res.status(409).json({ error: 'Ya tienes este tag en esta pieza' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// PATCH /user-tags/:id/publish
// Hace público un tag privado del usuario autenticado
app.patch('/user-tags/:id/publish', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('user_tags')
    .update({ public: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)   // RLS + comprobación explícita
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data)  return res.status(404).json({ error: 'Tag no encontrado o no te pertenece' });
  res.json(data);
});

// PATCH /user-tags/:id/unpublish
// Vuelve privado un tag público del usuario autenticado
app.patch('/user-tags/:id/unpublish', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('user_tags')
    .update({ public: false })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data)  return res.status(404).json({ error: 'Tag no encontrado o no te pertenece' });
  res.json(data);
});

// DELETE /user-tags/:id
// Elimina un tag del usuario autenticado
app.delete('/user-tags/:id', requireAuth, async (req, res) => {
  const { error } = await req.client
    .from('user_tags')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});


// ─── Arranque ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Videoarte Net API v2 escuchando en http://localhost:${PORT}`);
});
