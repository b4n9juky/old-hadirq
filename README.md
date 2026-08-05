# HadirQ

Sistem presensi sekolah (absensi siswa & guru) dengan verifikasi wajah, QR code, dan
geofencing. Monorepo berisi backend API, dashboard admin web, dan aplikasi Android.

## Struktur

| Folder | Tech | Port (dev) | Keterangan |
|--------|------|-----------|------------|
| `backend/` | Node.js + Express + Drizzle ORM + MySQL | 3001 | API REST, auth (Better Auth), file uploads |
| `frontend/` | React + Vite + TypeScript + Tailwind | 5173 | Dashboard admin (proxy `/api`, `/uploads` → :3001) |
| `app/` | Kotlin + Jetpack Compose | — | Aplikasi Android (kamera, scanner QR, face recognition) |

Di produksi, backend menyajikan `frontend/dist` secara statis.

## Persiapan

1. **Database MySQL** — buat database dan salin `.env` dari contoh:
   - `backend/.env` (lihat `backend/.env.example`): `DATABASE_URL`, `BETTER_AUTH_SECRET`,
     `BETTER_AUTH_URL`, koordinat sekolah + radius geofence, `CORS_ORIGIN`, `APP_TIMEZONE`, `KIOSK_SECRET_KEY`.
   - `frontend/.env` (opsional): `VITE_API_URL` bila tidak pakai proxy Vite default.
2. **Install dependensi**: `npm run install:all`

## Development

```bash
cd frontend && npm run dev     # dashboard admin (http://localhost:5173)
cd backend  && npm run dev      # API (http://localhost:3001)
```

## Build & Jalankan (produksi)

```bash
npm run build                   # build frontend lalu backend
cd backend && npm run start     # atau: node dist/index.js
```

Backend menyajikan SPA frontend dan melayani API di port 3001.

## Database

```bash
cd backend
npm run db:push                 # push schema Drizzle ke MySQL (dev)
npm run db:migrate              # jalankan migration journal (produksi)
npm run db:seed                 # isi data awal
```

## Tes & Lint

```bash
cd frontend && npm test
cd backend  && npm test
cd frontend && npm run lint
```

## Health Check

Endpoint `GET /api/health` mengembalikan `{ "success": true, "status": "ok" }`
(tanpa auth) dan digunakan oleh HEALTHCHECK container.

## Catatan Keamanan

- File di `backend/uploads/` (foto, wajah, QR) hanya dapat diakses oleh pengguna
  terautentikasi (gate `authMiddleware`).
- Endpoint `POST /api/auth/*` dibatasi rate-limit lebih ketat.
- Jangan commit `.env`, `*.log`, atau artefak build (lihat `.gitignore`).
