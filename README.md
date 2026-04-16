# Videoarte Net — Guía de instalación

## Estructura del proyecto

```
videoarte-net/
├── supabase_schema.sql   ← Schema de la base de datos
├── frontend/
│   └── index.html        ← La web (un solo archivo)
└── server/
    ├── package.json
    ├── .env.example
    └── index.js          ← API Express
```

---

## Paso 1 — Crear la base de datos en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (elige la región más cercana, p.ej. West EU).
3. Cuando esté listo, ve a **SQL Editor** y pega el contenido de `supabase_schema.sql`.
4. Pulsa **Run**. Esto crea la tabla `pieces` con los datos de ejemplo.
5. Ve a **Project Settings → API** y anota:
   - `Project URL` → tu `SUPABASE_URL`
   - `service_role` secret key → tu `SUPABASE_SERVICE_KEY` ⚠️ nunca la expongas en el frontend

---

## Paso 2 — Configurar el servidor

```bash
cd server
cp .env.example .env
```

Edita `.env` con los valores de Supabase:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PORT=3000
ADMIN_TOKEN=genera_uno_con_el_comando_de_abajo
```

Para generar un `ADMIN_TOKEN` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Instala dependencias y arranca:
```bash
npm install
npm run dev     # desarrollo (con auto-reload)
npm start       # producción
```

---

## Paso 3 — Configurar el frontend

Abre `frontend/index.html` y cambia la línea:

```js
const API = 'http://localhost:3000';
```

Por la URL de tu servidor en producción, p.ej.:
```js
const API = 'https://tu-servidor.railway.app';
```

El frontend es un HTML estático — puedes subirlo a **Netlify**, **Vercel**, **GitHub Pages** o cualquier hosting.

---

## Paso 4 — Añadir piezas (flujo de trabajo)

El artista os manda el vídeo. Vosotros lo subís a Vimeo con la configuración:
- **Privacy:** "Hide from Vimeo" + "Allow embedding on specific domains"
- Activad vuestro dominio en la whitelist de Vimeo

Luego añadís la pieza con una petición POST al servidor:

```bash
curl -X POST http://localhost:3000/pieces \
  -H "Content-Type: application/json" \
  -H "x-admin-token: TU_ADMIN_TOKEN" \
  -d '{
    "title":       "Nombre de la pieza",
    "author":      "Nombre del artista",
    "tags":        ["cuerpo", "loop", "glitch"],
    "vimeo_url":   "https://player.vimeo.com/video/123456789",
    "vimeo_thumb": "https://i.vimeocdn.com/video/123456789_640.jpg",
    "year":        2024,
    "description": "Texto opcional sobre la pieza"
  }'
```

La miniatura (`vimeo_thumb`) la encontráis en el panel de Vimeo o mediante la API de Vimeo.

---

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/pieces` | — | Todas las piezas activas |
| GET | `/pieces/:id` | — | Una pieza concreta |
| GET | `/tags` | — | Lista de etiquetas únicas |
| POST | `/pieces` | ✓ | Añadir pieza nueva |
| PATCH | `/pieces/:id` | ✓ | Editar pieza |
| DELETE | `/pieces/:id` | ✓ | Desactivar pieza (soft delete) |

Auth = header `x-admin-token: TU_ADMIN_TOKEN`

---

## Despliegue en producción

**Opción más simple (gratis):**
- Servidor → [Railway](https://railway.app) (conecta el repo de GitHub, detecta Node automáticamente)
- Frontend → [Netlify](https://netlify.com) (arrastra la carpeta `frontend/`)
- Base de datos → Supabase (ya está en la nube)

Recuerda actualizar las variables de entorno en Railway con los mismos valores del `.env`.
