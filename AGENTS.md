# AGENTS.md — Hadirq

## Project Structure

Three-part monorepo for school attendance system:

- **`app/`** — Android app (Kotlin, Jetpack Compose). Generated from Google AI Studio.
- **`frontend/`** — React admin dashboard (Vite + TypeScript + Tailwind CSS). Port 5173 in dev.
- **`backend/`** — Node.js API server (Express + Drizzle ORM + MySQL). Port 3001.

Backend serves `frontend/dist/` as static files in production.

## Quick Commands

```bash
# Install all dependencies
npm run install:all

# Development
cd frontend && npm run dev      # Frontend dev server (proxies /api to :3001)
cd backend && npm run dev       # Backend dev server (tsx watch)

# Build
npm run build                   # Builds frontend then backend
npm run build:frontend          # Frontend only
npm run build:backend           # Backend only

# Start (production)
cd backend && node dist/index.js   # or: npm run start

# Database
cd backend && npm run db:push   # Push Drizzle schema to MySQL
cd backend && npm run db:seed   # Seed database

# Android (from root)
gradlew.bat assembleDebug      # Build APK
gradlew.bat installDebug       # Build and install on device

# Tests
cd frontend && npm test         # Vitest (frontend)
cd backend && npm test          # Vitest (backend)

# Lint
cd frontend && npm run lint     # ESLint (frontend only)
```

## Environment Setup

### Backend (`backend/.env`)
Required variables:
- `DATABASE_URL` — MySQL connection string
- `BETTER_AUTH_SECRET` — 32+ character random string
- `BETTER_AUTH_URL` — Backend URL
- `SCHOOL_LATITUDE`, `SCHOOL_LONGITUDE` — School location for geofence
- `SCHOOL_RADIUS_METERS` — Geofence radius (default: 50)
- `MAX_ACCURACY_METERS` — GPS accuracy threshold (default: 30)
- `CORS_ORIGIN` — Comma-separated allowed origins
- `APP_TIMEZONE` — School timezone: `Asia/Jakarta` (WIB), `Asia/Makassar` (WITA), `Asia/Jayapura` (WIT). Default: `Asia/Jakarta`.

### Frontend (`.env`)
- Frontend uses the Vite dev proxy to reach the backend (see `frontend/vite.config.ts`). No required env vars for local dev; optionally set `VITE_API_URL` to override the API base.

### Android (`app/.env`)
Uses Secrets Gradle Plugin. Configured for geofence and API URL.

## Key Architecture Notes

- **Auth**: Better Auth library. Routes at `/api/auth/*`. Role-based access (`admin`, `guru`).
- **Database**: MySQL via Drizzle ORM. Schema at `backend/src/db/schema.ts`. Migrations in `backend/drizzle/`.
- **Geofence**: Server-side validation using `geolib`. Configurable radius and accuracy.
- **Face Recognition**: Uses `@vladmandic/face-api` (both frontend and backend).
- **File Uploads**: Multer for Excel imports. Files stored in `backend/uploads/`.
- **Android Signing**: Debug config uses `debug.keystore`. Release uses env vars `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_PASSWORD`.

## Development Tips

- Frontend proxies `/api` and `/uploads` to backend in dev mode.
- Backend serves frontend SPA in production (catch-all route at bottom).
- `.env` files are gitignored — copy from `.env.example` files.
- Backend logs to `backend.log`, `server_err.log`, etc. (all gitignored).
- Database seed scripts: `seed.ts` (full) and `seed-demo.ts` (demo data).
- Rate limiting: 100 req/min general, 15 req/15min on auth routes.
- Backend validates DB error messages in production to prevent info disclosure.
- Backend `.env` search paths (in order): `process.cwd()/.env`, `process.cwd()/backend/.env`, `dist/lib/../../.env`, `src/lib/../../../.env`.

## Testing

- Frontend: Vitest with React Testing Library.
- Backend: Vitest.
- No integration test setup found. Tests are unit-level only.
- Android: JUnit with Robolectric and Roborazzi for screenshot tests.

## Deployment

- `deploy.sh` exists but is gitignored. Check `DEPLOY.md` (also gitignored).
- Backend builds to `dist/`. Frontend builds to `frontend/dist/`.
- Production serves everything from backend.
