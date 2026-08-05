import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import './lib/env.js';

import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { authMiddleware, requireRole } from './middlewares/authMiddleware.js';
import { userService } from './services/userService.js';

import { academicYearsRouter } from './routes/academicYearRoutes.js';
import { semestersRouter } from './routes/semesterRoutes.js';
import { schedulesRouter } from './routes/scheduleRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { reportsRouter } from './routes/reportRoutes.js';
import { usersRouter } from './routes/userRoutes.js';
import { classesRouter } from './routes/classRoutes.js';
import { studentsRouter } from './routes/studentRoutes.js';
import { settingsRouter } from './routes/settingRoutes.js';
import { attendanceRouter } from './routes/attendanceRoutes.js';
import { configRouter } from './routes/configRoutes.js';
import { teacherRouter } from './routes/teacherRoutes.js';
import { teachingSchedulesRouter } from './routes/teachingScheduleRoutes.js';
import { kioskRouter } from './routes/kioskRoutes.js';
import { subjectAttendanceRouter } from './routes/subjectAttendanceRoutes.js';
import { parentAdminRouter, parentDashboardRouter } from './routes/parentRoutes.js';
import { subjectRouter } from './routes/subjectRoutes.js';
import { agendaAttendanceRouter } from './routes/agendaAttendanceRoutes.js';
import { faceRegistrationRouter } from './routes/faceRegistrationRoutes.js';
import { teacherAttendanceRouter } from './routes/teacherAttendanceRoutes.js';
import { waRouter } from './routes/waRoutes.js';
import { pushRouter } from './routes/pushRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy — OpenLiteSpeed reverse proxy mengirim X-Forwarded-For
app.set('trust proxy', 1);

// Normalize duplicate Origin headers (OpenLiteSpeed proxy can cause duplicates)
app.use((req, _res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.includes(',')) {
    req.headers.origin = origin.split(',')[0].trim();
  }
  next();
});

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS — baca dari env, fallback ke semua origin untuk development
const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Rate limiting — 100 request per menit per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
  message: { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
}));

// Stricter rate limiting on authentication routes (15 attempts per 15 minutes)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
  message: { success: false, error: 'Terlalu banyak percobaan masuk. Silakan coba lagi setelah 15 menit.' },
});
app.use('/api/auth/', authRateLimiter);

// Better Auth
app.all('/api/auth/*', (req, res) => {
  return toNodeHandler(auth)(req, res);
});

// Interceptor to sanitize internal server/database errors in production to prevent information disclosure (OWASP A09 / CWE-209)
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (body && body.success === false && typeof body.error === 'string') {
      const lowerMessage = body.error.toLowerCase();
      const dbKeywords = [
        'select ', 'insert ', 'update ', 'delete ', 'table', 'column',
        'sql', 'database', 'mysql', 'drizzle', 'query', 'syntax error',
        'foreign key', 'constraint', 'unknown column', 'field list', 'sqlstate'
      ];
      const isDbError = dbKeywords.some(keyword => lowerMessage.includes(keyword));
      
      if (isDbError && process.env.NODE_ENV === 'production') {
        body.error = 'Terjadi kesalahan internal pada server database. Silakan hubungi administrator.';
      }
    }
    return originalJson.call(this, body);
  };
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve built frontend static files in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Multer config for Excel file import
const uploadExcel = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const importDir = path.join(__dirname, '../uploads/imports');
      if (!fs.existsSync(importDir)) fs.mkdirSync(importDir, { recursive: true });
      cb(null, importDir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `import-${Date.now()}-${Math.round(Math.random() * 1e9)}.xlsx`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(_file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file harus .xlsx atau .xls'));
    }
  },
});

app.post('/api/users/import', authMiddleware, requireRole(['admin']), uploadExcel.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'File Excel tidak terkirim.' });
    }
    const result = await userService.importUsers(file.path);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.use('/api/academic-years', authMiddleware, requireRole(['admin']), academicYearsRouter);
app.use('/api/semesters', authMiddleware, requireRole(['admin']), semestersRouter);
app.use('/api/schedules', authMiddleware, requireRole(['admin']), schedulesRouter);
app.use('/api/dashboard', authMiddleware, requireRole(['admin', 'guru']), dashboardRouter);
app.use('/api/reports', authMiddleware, requireRole(['admin', 'guru']), reportsRouter);
app.use('/api/users', authMiddleware, requireRole(['admin']), usersRouter);
app.use('/api/classes', authMiddleware, classesRouter);
app.use('/api', faceRegistrationRouter);
app.use('/api/students', authMiddleware, requireRole(['admin']), studentsRouter);
app.use('/api/settings/timezone', async (_req, res) => {
  const { getSchoolTimezone, setSchoolTimezone } = await import('./lib/timezone.js');
  const { settingService } = await import('./services/settingService.js');
  try {
    const dbTz = await settingService.getValue('school_timezone');
    if (dbTz && dbTz.trim() !== '') {
      setSchoolTimezone(dbTz);
      res.json({ success: true, data: { timezone: dbTz } });
      return;
    }
  } catch { /* fall through */ }
  res.json({ success: true, data: { timezone: getSchoolTimezone() } });
});
app.use('/api/settings', authMiddleware, requireRole(['admin']), settingsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/config', configRouter);
app.use('/api/teaching-schedules', authMiddleware, requireRole(['admin']), teachingSchedulesRouter);
app.use('/api/subjects', authMiddleware, subjectRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/teacher', agendaAttendanceRouter);
app.use('/api/subject-attendances', subjectAttendanceRouter);
app.use('/api/parents', authMiddleware, requireRole(['admin']), parentAdminRouter);
app.use('/api/parent', authMiddleware, requireRole(['parent']), parentDashboardRouter);
app.use('/api/teacher-attendance', teacherAttendanceRouter);
app.use('/api/wa', authMiddleware, requireRole(['admin']), waRouter);
app.get('/api/push/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  if (!key) {
    return res.status(503).json({ success: false, error: 'Push notifications not configured' });
  }
  res.json({ success: true, data: { publicKey: key } });
});
app.use('/api/push', authMiddleware, pushRouter);

// Serve uploaded images statically (authenticated — prevents anonymous PII access)
app.use('/uploads', authMiddleware);
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Template download endpoint (reliable, with proper Content-Disposition headers)
const TEMPLATE_MAP: Record<string, string> = {
  siswa: 'template-import-siswa.xlsx',
  user: 'template-import-user.xlsx',
  mapel: 'template-import-mapel.xlsx',
  jadwal: 'template-import-jadwal.xlsx',
  parent: 'template-import-parent.xlsx',
};
app.get('/api/templates/download/:type', (req, res) => {
  const filename = TEMPLATE_MAP[req.params.type];
  if (!filename) {
    return res.status(404).json({ success: false, error: 'Jenis template tidak valid.' });
  }
  const filePath = path.join(uploadDir, 'templates', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File template tidak ditemukan.' });
  }
  res.download(filePath, filename);
});

// Health check (no auth) — used by container HEALTHCHECK
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

// SPA fallback — semua non-API route arahkan ke index.html
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`[Server] HadirQ Backend running on port ${PORT}`);
  console.log(`[Geofence] School coordinates: Lat ${process.env.SCHOOL_LATITUDE}, Lon ${process.env.SCHOOL_LONGITUDE}`);
  console.log(`[Geofence] Max radius: ${process.env.SCHOOL_RADIUS_METERS}m, Max GPS accuracy: ${process.env.MAX_ACCURACY_METERS}m`);
});
