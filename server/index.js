console.log("🚀 SERVER STARTING")
console.log("SUPABASE_URL:", process.env.SUPABASE_URL)
console.log("SUPABASE_KEY:", process.env.SUPABASE_SERVICE_KEY)
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
import cors from 'cors'
app.use(cors({ origin: '*' }))
app.use(express.json());
app.use(cors());

// ─── Supabase (service role — puede saltarse RLS para escritura) ───
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Middleware de autenticación admin ───
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ──────────────────────────────────────────
//  RUTAS PÚBLICAS (frontend)
// ──────────────────────────────────────────

// GET /pieces — todas las piezas activas
app.get('/pieces', async (req, res) => {
  const { data, error } = await supabase
    .from('pieces')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /pieces/:id — una pieza concreta
app.get('/pieces/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('pieces')
    .select('*')
    .eq('id', req.params.id)
    .eq('active', true)
    .single();

  if (error) return res.status(404).json({ error: 'Pieza no encontrada' });
  res.json(data);
});

// GET /tags — lista de etiquetas únicas
app.get('/tags', async (req, res) => {
  const { data, error } = await supabase
    .from('pieces')
    .select('tags')
    .eq('active', true);

  if (error) return res.status(500).json({ error: error.message });

  const tags = [...new Set(data.flatMap(p => p.tags))].sort();
  res.json(tags);
});


// ──────────────────────────────────────────
//  RUTAS DE ADMIN (requieren x-admin-token)
// ──────────────────────────────────────────

// POST /pieces — añadir pieza nueva
//
// Body esperado:
// {
//   "title":       "Nombre de la pieza",
//   "author":      "Nombre del artista",
//   "tags":        ["cuerpo", "loop", "glitch"],
//   "vimeo_url":   "https://player.vimeo.com/video/123456789",
//   "vimeo_thumb": "https://i.vimeocdn.com/video/...",   (opcional)
//   "year":        2024,                                  (opcional)
//   "description": "Texto libre"                         (opcional)
// }
app.post('/pieces', requireAdmin, async (req, res) => {
  const { title, author, tags, vimeo_url, vimeo_thumb, year, description } = req.body;

  if (!title || !author || !tags?.length || !vimeo_url) {
    return res.status(400).json({
      error: 'Faltan campos obligatorios: title, author, tags, vimeo_url'
    });
  }

  const { data, error } = await supabase
    .from('pieces')
    .insert([{ title, author, tags, vimeo_url, vimeo_thumb, year, description }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /pieces/:id — editar una pieza
app.patch('/pieces/:id', requireAdmin, async (req, res) => {
  const allowed = ['title','author','tags','vimeo_url','vimeo_thumb','year','description','active'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Ningún campo válido para actualizar' });
  }

  const { data, error } = await supabase
    .from('pieces')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /pieces/:id — desactivar pieza (soft delete)
app.delete('/pieces/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('pieces')
    .update({ active: false })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});


// ─── Arranque ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Videoarte Net API escuchando en http://localhost:${PORT}`);
});
