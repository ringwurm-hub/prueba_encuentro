# Videoarte Net v2 — Guía de instalación

## Estructura
```
videoarte-net-v2/
├── supabase_schema.sql
├── frontend/
│   └── index.html
└── server/
    ├── package.json
    ├── .env.example
    └── index.js
```

---

## Paso 1 — Supabase

1. Crea cuenta en [supabase.com](https://supabase.com) → nuevo proyecto.
2. **Authentication → Providers → Email** → activa "Email/Password".  
   (Opcional: desactiva "Confirm email" durante el desarrollo para no tener que verificar cada cuenta de prueba.)
3. **SQL Editor** → pega `supabase_schema.sql` → Run.
4. En **Project Settings → API** anota:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_KEY` ⚠️ nunca en el frontend

---

## Paso 2 — Servidor

```bash
cd server
cp .env.example .env
# edita .env con tus claves
npm install
npm run dev
```

Genera un `ADMIN_TOKEN` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Paso 3 — Frontend

Cambia en `frontend/index.html`:
```js
const API = 'http://localhost:3000';  // → tu URL de producción
```

---

## Endpoints de la API

### Públicos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/pieces` | Todas las piezas activas |
| GET | `/pieces/:id` | Una pieza |
| GET | `/tags` | Etiquetas oficiales únicas |
| GET | `/user-tags/public` | Tags de usuario públicos (todos) |

### Auth (email/password)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` | `{ email, password }` |
| POST | `/auth/login` | `{ email, password }` → devuelve `access_token` |
| GET | `/auth/me` | Perfil del usuario autenticado |
| PATCH | `/auth/me` | Actualizar `display_name` |

### User tags (requieren `Authorization: Bearer <token>`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/user-tags/mine` | Mis tags (privados + públicos) |
| POST | `/user-tags` | `{ piece_id, tag }` → añadir tag (privado por defecto) |
| PATCH | `/user-tags/:id/publish` | Hacer público un tag |
| PATCH | `/user-tags/:id/unpublish` | Volver privado un tag |
| DELETE | `/user-tags/:id` | Eliminar un tag |

### Admin (requieren `x-admin-token`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/pieces` | Añadir pieza |
| PATCH | `/pieces/:id` | Editar pieza |
| DELETE | `/pieces/:id` | Desactivar pieza |

---

## Añadir una pieza (flujo de trabajo)

```bash
curl -X POST http://localhost:3000/pieces \
  -H "Content-Type: application/json" \
  -H "x-admin-token: TU_TOKEN" \
  -d '{
    "title": "Título",
    "author": "Artista",
    "tags": ["cuerpo", "loop"],
    "vimeo_url": "https://player.vimeo.com/video/123456789",
    "vimeo_thumb": "https://i.vimeocdn.com/video/123456789_640.jpg",
    "year": 2024
  }'
```

---

## Despliegue

| Parte | Servicio recomendado | Coste |
|-------|---------------------|-------|
| Base de datos | Supabase Free | Gratis |
| Servidor Node | Railway | Gratis hasta 500h/mes |
| Frontend | Netlify / Vercel | Gratis |

En Railway: conecta el repo → añade las variables de entorno → despliega.  
En Netlify: arrastra la carpeta `frontend/` → listo.

---

## Cómo funciona la capa de tags de usuario

1. **Privado por defecto** — al añadir un tag, solo lo ve el propio usuario.
2. **Publicar** — el usuario puede hacer público un tag con el botón "○ Privado" en el panel de detalle. Pasa a "◉ Público".
3. **Red colectiva** — el toggle "USUARIOS" en el header activa la capa de conexiones de usuario (líneas punteadas en azul claro).
4. **Tres modos de vista**:
   - Solo OFICIAL activado → red de tags del equipo (líneas sólidas, verde)
   - Solo USUARIOS activado → red de tags públicos de usuarios (líneas punteadas, azul)
   - Ambos activados → las dos capas superpuestas
5. **Filtro por tag** — al hacer clic en una píldora de tag, solo se iluminan las conexiones de esa capa.
