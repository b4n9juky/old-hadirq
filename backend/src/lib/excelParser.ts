import * as XLSX from 'xlsx';

export interface ExcelUserRow {
  name: string;
  email: string;
  role: string;
}

export interface ParseResult {
  rows: ExcelUserRow[];
  errors: { row: number; email: string; error: string }[];
}

const VALID_ROLES = ['admin', 'guru', 'parent', 'siswa'];

export function parseExcelUserFile(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki sheet.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  if (rawData.length === 0) {
    throw new Error('File Excel kosong.');
  }

  const header = Object.keys(rawData[0]).map((k) => k.toLowerCase().trim());
  const hasName = header.includes('name') || header.includes('nama');
  const hasEmail = header.includes('email') || header.includes('email');
  const hasRole = header.includes('role') || header.includes('peran') || header.includes('role');

  if (!hasName || !hasEmail || !hasRole) {
    throw new Error(
      'Format kolom tidak sesuai. File harus memiliki kolom: Name/Nama, Email, Role/Peran.'
    );
  }

  const nameKey = header.find((k) => k === 'name' || k === 'nama')!;
  const emailKey = header.find((k) => k === 'email')!;
  const roleKey = header.find((k) => k === 'role' || k === 'peran')!;

  const rows: ExcelUserRow[] = [];
  const errors: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const name = String(item[nameKey] || '').trim();
    const email = String(item[emailKey] || '').trim();
    const role = String(item[roleKey] || '').trim().toLowerCase();

    const rowNum = i + 2;

    if (!name) {
      errors.push({ row: rowNum, email, error: 'Nama tidak boleh kosong.' });
      continue;
    }
    if (!email) {
      errors.push({ row: rowNum, email, error: 'Email tidak boleh kosong.' });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, email, error: 'Format email tidak valid.' });
      continue;
    }
    if (!role) {
      errors.push({ row: rowNum, email, error: 'Role tidak boleh kosong.' });
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      errors.push({
        row: rowNum,
        email,
        error: `Role "${role}" tidak valid. Harus: admin, guru, atau siswa.`,
      });
      continue;
    }

    rows.push({ name, email, role });
  }

  return { rows, errors };
}

export interface ExcelStudentRow {
  nis: string;
  name: string;
  className: string;
  parentName?: string;
  parentEmail?: string;
  parentPassword?: string;
  parentPhone?: string;
}

export interface StudentParseResult {
  rows: ExcelStudentRow[];
  errors: { row: number; nis: string; error: string }[];
}

export function parseExcelStudentFile(filePath: string): StudentParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki sheet.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  if (rawData.length === 0) {
    throw new Error('File Excel kosong.');
  }

  // Find exact keys (case insensitive)
  const keys = Object.keys(rawData[0]);
  const nisKey = keys.find(k => k.toLowerCase().trim() === 'nis' || k.toLowerCase().trim() === 'nomor induk');
  const nameKey = keys.find(k => k.toLowerCase().trim() === 'name' || k.toLowerCase().trim() === 'nama');
  const classKey = keys.find(k => k.toLowerCase().trim() === 'class' || k.toLowerCase().trim() === 'kelas');

  // Optional parent columns
  const parentNameKey = keys.find(k => ['nama orang tua', 'nama ortu', 'orang tua', 'parent name'].includes(k.toLowerCase().trim()));
  const parentEmailKey = keys.find(k => ['email orang tua', 'email ortu', 'parent email', 'email'].includes(k.toLowerCase().trim()));
  const parentPasswordKey = keys.find(k => ['password orang tua', 'password ortu', 'kata sandi orang tua', 'password', 'kata sandi'].includes(k.toLowerCase().trim()));
  const parentPhoneKey = keys.find(k => ['no hp', 'nomer hp', 'nomor hp', 'hp', 'phone', 'telepon', 'no. wa', 'nowa', 'nomor wa'].includes(k.toLowerCase().trim()));

  if (!nisKey || !nameKey || !classKey) {
    throw new Error(
      'Format kolom tidak sesuai. File harus memiliki kolom: NIS, Name/Nama, Kelas/Class.'
    );
  }

  const rows: ExcelStudentRow[] = [];
  const errors: { row: number; nis: string; error: string }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const nis = String(item[nisKey] || '').trim();
    const name = String(item[nameKey] || '').trim();
    const className = String(item[classKey] || '').trim();

    const parentName = parentNameKey ? String(item[parentNameKey] || '').trim() : '';
    const parentEmail = parentEmailKey ? String(item[parentEmailKey] || '').trim() : '';
    const parentPassword = parentPasswordKey ? String(item[parentPasswordKey] || '').trim() : '';
    const parentPhone = parentPhoneKey ? String(item[parentPhoneKey] || '').trim() : '';

    const rowNum = i + 2;

    if (!nis) {
      errors.push({ row: rowNum, nis, error: 'NIS tidak boleh kosong.' });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, nis, error: 'Nama tidak boleh kosong.' });
      continue;
    }
    if (!className) {
      errors.push({ row: rowNum, nis, error: 'Kelas tidak boleh kosong.' });
      continue;
    }

    rows.push({
      nis,
      name,
      className,
      parentName: parentName || undefined,
      parentEmail: parentEmail || undefined,
      parentPassword: parentPassword || undefined,
      parentPhone: parentPhone || undefined,
    });
  }

  return { rows, errors };
}

export interface ExcelSubjectRow {
  name: string;
}

export interface SubjectParseResult {
  rows: ExcelSubjectRow[];
  errors: { row: number; error: string }[];
}

export function parseExcelSubjectFile(filePath: string): SubjectParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel tidak memiliki sheet.');

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
  if (rawData.length === 0) throw new Error('File Excel kosong.');

  const keys = Object.keys(rawData[0]);
  const nameKey = keys.find(k => k.toLowerCase().trim() === 'name' || k.toLowerCase().trim() === 'nama' || k.toLowerCase().trim() === 'mata pelajaran');

  if (!nameKey) {
    throw new Error('Format kolom tidak sesuai. File harus memiliki kolom: Name/Nama/Mata Pelajaran.');
  }

  const rows: ExcelSubjectRow[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const name = String(item[nameKey] || '').trim();
    const rowNum = i + 2;

    if (!name) {
      errors.push({ row: rowNum, error: 'Nama mata pelajaran tidak boleh kosong.' });
      continue;
    }
    rows.push({ name });
  }

  return { rows, errors };
}

export interface ExcelParentRow {
  nis: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface ParentParseResult {
  rows: ExcelParentRow[];
  errors: { row: number; nis: string; email: string; error: string }[];
}

export function parseExcelParentFile(filePath: string): ParentParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki sheet.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  if (rawData.length === 0) {
    throw new Error('File Excel kosong.');
  }

  const keys = Object.keys(rawData[0]);
  const nisKey = keys.find(k => k.toLowerCase().trim() === 'nis' || k.toLowerCase().trim() === 'nomor induk');
  const nameKey = keys.find(k => k.toLowerCase().trim() === 'name' || k.toLowerCase().trim() === 'nama' || k.toLowerCase().trim() === 'nama orang tua');
  const emailKey = keys.find(k => k.toLowerCase().trim() === 'email');
  const passwordKey = keys.find(k => k.toLowerCase().trim() === 'password' || k.toLowerCase().trim() === 'kata sandi');
  const phoneKey = keys.find(k => k.toLowerCase().trim() === 'no. wa' || k.toLowerCase().trim() === 'nowa' || k.toLowerCase().trim() === 'phone' || k.toLowerCase().trim() === 'telepon' || k.toLowerCase().trim() === 'nomor wa');

  if (!nisKey || !nameKey || !emailKey) {
    throw new Error(
      'Format kolom tidak sesuai. File harus memiliki kolom: NIS, Nama/Nama Orang Tua, Email.'
    );
  }

  const rows: ExcelParentRow[] = [];
  const errors: { row: number; nis: string; email: string; error: string }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const nis = String(item[nisKey] || '').trim();
    const name = String(item[nameKey] || '').trim();
    const email = String(item[emailKey] || '').trim();
    const password = passwordKey ? String(item[passwordKey] || '').trim() : '';
    const phone = phoneKey ? String(item[phoneKey] || '').trim() : '';
    const rowNum = i + 2;

    if (!nis) {
      errors.push({ row: rowNum, nis, email, error: 'NIS tidak boleh kosong.' });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, nis, email, error: 'Nama tidak boleh kosong.' });
      continue;
    }
    if (!email) {
      errors.push({ row: rowNum, nis, email, error: 'Email tidak boleh kosong.' });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, nis, email, error: 'Format email tidak valid.' });
      continue;
    }

    rows.push({ nis, name, email, password, phone: phone || undefined });
  }

  return { rows, errors };
}

export interface ExcelScheduleRow {
  teacherEmailOrName: string;
  className: string;
  dayName: string;
  startTime: string;
  endTime: string;
  subject: string;
}

export interface ScheduleParseResult {
  rows: ExcelScheduleRow[];
  errors: { row: number; error: string }[];
}

export function parseExcelScheduleFile(filePath: string): ScheduleParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel tidak memiliki sheet.');

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
  if (rawData.length === 0) throw new Error('File Excel kosong.');

  const keys = Object.keys(rawData[0]);
  const teacherKey = keys.find(k => ['teacher', 'guru', 'email guru', 'nama guru', 'teacheremailorname'].includes(k.toLowerCase().trim()));
  const classKey = keys.find(k => ['class', 'kelas', 'classname'].includes(k.toLowerCase().trim()));
  const dayKey = keys.find(k => ['day', 'hari', 'dayname'].includes(k.toLowerCase().trim()));
  const startKey = keys.find(k => ['start', 'start time', 'mulai', 'jam mulai', 'starttime'].includes(k.toLowerCase().trim()));
  const endKey = keys.find(k => ['end', 'end time', 'selesai', 'jam selesai', 'endtime'].includes(k.toLowerCase().trim()));
  const subjectKey = keys.find(k => ['subject', 'mata pelajaran', 'mapel'].includes(k.toLowerCase().trim()));

  if (!teacherKey || !classKey || !dayKey || !startKey || !endKey || !subjectKey) {
    throw new Error('Format kolom tidak sesuai. File harus memiliki kolom: Guru, Kelas, Hari, Jam Mulai, Jam Selesai, Mapel.');
  }

  const rows: ExcelScheduleRow[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const teacherEmailOrName = String(item[teacherKey] || '').trim();
    const className = String(item[classKey] || '').trim();
    const dayName = String(item[dayKey] || '').trim();
    const startTime = String(item[startKey] || '').trim();
    const endTime = String(item[endKey] || '').trim();
    const subject = String(item[subjectKey] || '').trim();
    const rowNum = i + 2;

    if (!teacherEmailOrName || !className || !dayName || !startTime || !endTime || !subject) {
      errors.push({ row: rowNum, error: 'Data tidak lengkap. Semua kolom wajib diisi.' });
      continue;
    }

    rows.push({ teacherEmailOrName, className, dayName, startTime, endTime, subject });
  }

  return { rows, errors };
}
