# 🚌 RutaQuilla

**Plataforma de crowdsourcing para mapear las rutas del transporte público colectivo en Barranquilla, Colombia.**

RutaQuilla permite a los usuarios encontrar rutas de buses, planificar viajes y navegar por la ciudad usando transporte tradicional (Sobrusa, Coolitoral, Transmecar, y más).

---

## 🌟 Características

### Para Usuarios
- 🗺️ **Mapa interactivo** con todas las rutas de buses en Barranquilla
- 🧭 **Navegación punto a punto** — busca cómo llegar de A a B en bus
- 📍 **Pin en el mapa** — toca/click derecho para marcar origen y destino
- ⭐ **Rutas favoritas** — guarda tus rutas frecuentes para acceso rápido
- 🕐 **Historial de búsquedas** — tus últimas 5 búsquedas siempre a la mano
- 📱 **100% responsive** — optimizado para móviles y escritorio
- 🍪 **Privacidad** — consentimiento de cookies y política de privacidad (Ley 1581 de 2012)

### Para Admin
- 🛠️ **Panel de administración** en `/admin` con:
  - Trazado manual de rutas (click en el mapa)
  - **Snap to Roads** automático (OSRM Match API, 100% gratis)
  - CRUD completo de rutas (crear, editar, eliminar)
  - Vista previa en tiempo real del trazado
- 🔒 **Control de acceso por roles** (free, premium, admin)

### Preparado para el Futuro
- 🔑 **Google Maps API ready** — solo pega tu API key en `.env` para:
  - Geocoding de alta precisión (direcciones colombianas)
  - Google Roads Snap to Roads
  - Autocompletado de Places API

---

## 🏗️ Arquitectura

```
RutaQuilla/
├── client/                   # Frontend React + Vite
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   │   ├── AdminPanel.jsx    # Panel admin (trazado de rutas)
│   │   │   ├── MapComponent.jsx  # Mapa Leaflet interactivo
│   │   │   ├── Sidebar.jsx       # Panel lateral (tabs)
│   │   │   ├── RouteNavigator.jsx # Búsqueda de rutas
│   │   │   ├── Header.jsx        # Barra superior
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Autenticación + roles
│   │   ├── services/
│   │   │   ├── api.js            # Endpoints del backend
│   │   │   ├── routingService.js # Geocoding + Snap to Roads
│   │   │   └── gpsService.js     # GPS del dispositivo
│   │   └── utils/
│   └── index.html            # SEO + Open Graph
│
├── server/                   # Backend Node.js + Express
│   ├── controllers/
│   │   ├── routeController.js    # CRUD de rutas + navegación
│   │   └── userController.js     # Auth (login/registro)
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT + roles (admin/premium/free)
│   ├── models/
│   │   ├── RouteModel.js         # Schema de rutas (GeoJSON)
│   │   └── UserModel.js          # Schema de usuarios
│   ├── routes/
│   │   ├── routeRoutes.js        # API endpoints de rutas
│   │   └── userRoutes.js         # API endpoints de auth
│   ├── data/
│   │   └── seed.json             # Datos iniciales
│   └── server.js                 # Entry point del servidor
│
└── .env                      # Variables de entorno
```

---

## 🚀 Setup Local

### Requisitos
- **Node.js** v18+
- **MongoDB** (local o MongoDB Atlas)

### 1. Clonar e instalar
```bash
git clone https://github.com/tu-usuario/Ruta-Quilla.git
cd Ruta-Quilla
npm install
cd client && npm install && cd ..
```

### 2. Configurar `.env`
```env
# MongoDB
MONGO_URI=mongodb+srv://usuario:password@cluster.mongodb.net/rutaquilla

# JWT
JWT_SECRET=tu_secreto_seguro_aqui
JWT_EXPIRES_IN=30d

# Entorno
NODE_ENV=development

# Google Maps API (opcional — mejora la búsqueda de direcciones)
VITE_GOOGLE_MAPS_API_KEY=
```

### 3. Ejecutar
```bash
# Opción 1: Desde la raíz
npm run dev

# Opción 2: Manual
# Terminal 1 (backend): 
node server/server.js
# Terminal 2 (frontend): 
cd client && npm run dev
```

La app estará en `http://localhost:5173`

### 4. Credenciales de prueba
| Email | Password | Rol |
|---|---|---|
| `admin@rutaquilla.me` | `admin123456` | Admin |
| `demo@rutaquilla.me` | `demo123456` | Free |

---

## 🔑 API Endpoints

### Públicos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/routes` | Listar todas las rutas |
| `GET` | `/api/routes/nearby?lat=X&lng=Y` | Buscar rutas cercanas |
| `POST` | `/api/routes/navigate` | Navegar entre dos puntos |
| `GET` | `/api/routes/:id` | Detalle de una ruta |

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/users/register` | Registrarse |
| `POST` | `/api/users/login` | Iniciar sesión |
| `GET` | `/api/users/profile` | Ver perfil (auth) |

### Admin (requiere rol admin)
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/routes/admin/create` | Crear ruta oficial |
| `PUT` | `/api/routes/:id` | Actualizar ruta |
| `DELETE` | `/api/routes/:id` | Eliminar ruta |
| `DELETE` | `/api/routes/admin/all` | Eliminar TODAS las rutas |

---

## 📱 Stack Técnico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19, Vite, Leaflet, Tailwind CSS |
| **Backend** | Node.js, Express, Mongoose |
| **Base de datos** | MongoDB Atlas |
| **Mapa** | Leaflet + CARTO Dark tiles |
| **Routing** | OSRM (Open Source Routing Machine) |
| **Geocoding** | Nominatim (OSM) + Google Maps (opcional) |
| **Snap to Roads** | OSRM Match API + Google Roads (opcional) |
| **Auth** | JWT + bcrypt |
| **Deploy** | Render.com (gratis) |

---

## 🗺️ Google Maps API (Opcional)

Cuando obtengas una API key de Google Cloud:

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/)
2. Habilita: **Geocoding API**, **Places API**, **Roads API**
3. Crea una API key y pégala en `.env`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyB...tu_key
   ```
4. Reinicia el dev server — todo se activa automáticamente

El sistema usa Nominatim/OSRM como fallback cuando no hay API key.

---

## 🚀 Deploy en Render.com (Gratis)

### 1. Crear cuenta
Ve a [render.com](https://render.com) y regístrate con tu cuenta de GitHub.

### 2. Deploy del Backend (Web Service)
1. Dashboard → **New** → **Web Service**
2. Conectar repo `Chopin-ops1/Ruta-Quilla`
3. Configurar:
   - **Name**: `rutaquilla-api`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. En **Environment Variables**, agregar:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | `mongodb+srv://...` (tu URI de Atlas) |
   | `JWT_SECRET` | (tu secreto) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | (URL del static site, se agrega después) |
   | `ZOHO_EMAIL` | `noreply@rutaquilla.me` |
   | `ZOHO_PASSWORD` | (tu contraseña de app) |
5. Click **Create Web Service**

### 3. Deploy del Frontend (Static Site)
1. Dashboard → **New** → **Static Site**
2. Conectar el mismo repo
3. Configurar:
   - **Name**: `rutaquilla`
   - **Root Directory**: `client`
   - **Build Command**: `npm install --production=false && npm run build`
   - **Publish Directory**: `dist`
4. En **Environment Variables**, agregar:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://rutaquilla-api.onrender.com/api` |
5. Click **Create Static Site**

### 4. Keep-Alive (evitar que se duerma)
1. Ir a [cron-job.org](https://cron-job.org) → crear cuenta gratis
2. Crear cron job → URL: `https://rutaquilla-api.onrender.com/api/ping`
3. Schedule: cada 14 minutos → activar

### 5. (Opcional) Dominio custom
En el Static Site de Render → Settings → Custom Domains → agregar `rutaquilla.me`
y configurar el CNAME en tu proveedor de dominio.

---

## 👥 Contribuir

1. Fork el repo
2. Crea tu branch (`git checkout -b feature/mi-feature`)
3. Commit (`git commit -m 'Agrega mi feature'`)
4. Push (`git push origin feature/mi-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es de uso educativo y comunitario para la ciudad de Barranquilla.

---

**Hecho con ❤️ para Barranquilla 🇨🇴**
