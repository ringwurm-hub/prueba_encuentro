require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN)
    return res.status(401).json({ error: 'No autorizado' });
  next();
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  const jwt = auth.slice(7);
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user)
    return res.status(401).json({ error: 'Token inválido o expirado' });

  req.user   = user;
  req.client = client;
  next();
}

// ── AUTH ──

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email y password son obligatorios' });

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({
    user: { id: data.user.id, email: data.user.email },
    session: data.session
  });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email y password son obligatorios' });

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  res.json({
    user:          { id: data.user.id, email: data.user.email },
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at:    data.session.expires_at
  });
});

app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token)
    return res.status(400).json({ error: 'refresh_token requerido' });

  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: error.message });

  res.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...req.user, profile: data });
});

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

// ── PIEZAS ──

app.get('/pieces', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pieces')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

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

app.get('/tags', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('pieces')
    .select('tags')
    .eq('active', true);

  if (error) return res.status(500).json({ error: error.message });
  const tags = [...new Set(data.flatMap(p => p.tags))].sort();
  res.json(tags);
});

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

app.delete('/pieces/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('pieces').update({ active: false }).eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── USER TAGS ──

app.get('/user-tags/mine', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('user_tags')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/user-tags/public', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('user_tags')
    .select('id, piece_id, tag, created_at, user_id')
    .eq('public', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

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
    if (error.code === '23505')
      return res.status(409).json({ error: 'Ya tienes este tag en esta pieza' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

app.patch('/user-tags/:id/publish', requireAuth, async (req, res) => {
  const { data, error } = await req.client
    .from('user_tags')
    .update({ public: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data)  return res.status(404).json({ error: 'Tag no encontrado o no te pertenece' });
  res.json(data);
});

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

app.delete('/user-tags/:id', requireAuth, async (req, res) => {
  const { error } = await req.client
    .from('user_tags')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── ARRANQUE ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Videoarte Net API v2 escuchando en http://localhost:${PORT}`);
});