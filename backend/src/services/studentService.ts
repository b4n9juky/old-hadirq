import { studentRepo } from '../repositories/studentRepository.js';
import { userRepo } from '../repositories/userRepository.js';
import { classRepo } from '../repositories/classRepository.js';
import { parentService } from './parentService.js';
import { generateQrCode, deleteQrCodeFile } from '../lib/qrGenerator.js';
import { db } from '../db/index.js';
import { students, user, attendances, subjectAttendances, agendaAttendances } from '../db/schema.js';
import fs from 'fs';
import path from 'path';
import { eq, and, inArray } from 'drizzle-orm';

export interface CreateStudentDto {
  name: string;
  nis: string;
  classId: number;
}

export class StudentService {
  async getStudents(classId?: number) {
    if (classId) {
      return studentRepo.findByClassId(classId);
    }
    return studentRepo.findAll();
  }

  async createStudent(dto: CreateStudentDto, clientTimestamp?: string) {
    if (!dto.name || dto.name.trim() === '') {
      throw new Error('Nama wajib diisi.');
    }
    if (!dto.nis || dto.nis.trim() === '') {
      throw new Error('NIS wajib diisi.');
    }
    if (!dto.classId) {
      throw new Error('Kelas wajib dipilih.');
    }

    // Verify Class Exists
    const classRecord = await classRepo.findById(dto.classId);
    if (!classRecord) {
      throw new Error('Kelas tidak ditemukan.');
    }

    // Verify NIS uniqueness
    const existingNis = await studentRepo.findByNis(dto.nis);
    if (existingNis) {
      throw new Error('NIS siswa sudah terdaftar.');
    }

    const studentId = await studentRepo.create(dto.name, dto.nis, dto.classId);
    try {
      const qrPath = await generateQrCode(dto.nis, studentId);
      await studentRepo.updateQrCode(studentId, qrPath, clientTimestamp);
    } catch (err) {
      console.error(`[QR] Gagal generate QR untuk NIS ${dto.nis}:`, err);
    }
    return studentId;
  }

  async updateStudent(id: number, dto: CreateStudentDto, clientTimestamp?: string) {
    const existing = await studentRepo.findById(id);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan.');
    }

    if (!dto.name || dto.name.trim() === '') {
      throw new Error('Nama wajib diisi.');
    }
    if (!dto.nis || dto.nis.trim() === '') {
      throw new Error('NIS wajib diisi.');
    }
    if (!dto.classId) {
      throw new Error('Kelas wajib dipilih.');
    }

    // Verify Class Exists
    const classRecord = await classRepo.findById(dto.classId);
    if (!classRecord) {
      throw new Error('Kelas tidak ditemukan.');
    }

    // Verify NIS uniqueness if NIS changed
    if (dto.nis !== existing.nis) {
      const nisConflict = await studentRepo.findByNis(dto.nis);
      if (nisConflict) {
        throw new Error('NIS siswa sudah digunakan.');
      }
    }

    let qrcode = existing.qrcode;
    if (dto.nis !== existing.nis || !existing.qrcode) {
      await deleteQrCodeFile(existing.qrcode);
      try {
        qrcode = await generateQrCode(dto.nis, id);
      } catch (err) {
        console.error(`[QR] Gagal generate QR untuk NIS ${dto.nis}:`, err);
      }
    }
    await studentRepo.update(id, dto.name, dto.nis, dto.classId, qrcode || undefined, clientTimestamp);
  }

  async resetDevice(id: number) {
    const existing = await studentRepo.findById(id);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan.');
    }
    await studentRepo.updateDeviceUuid(id, null);
  }

  async deleteStudent(id: number) {
    const existing = await studentRepo.findById(id);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan.');
    }

    // Cascade delete all related records
    await db.delete(attendances).where(eq(attendances.studentId, id));
    await db.delete(subjectAttendances).where(eq(subjectAttendances.studentId, id));
    await db.delete(agendaAttendances).where(eq(agendaAttendances.studentId, id));

    // Delete photo file
    if (existing.photo) {
      const photoPath = path.join(__dirname, '../../', existing.photo.replace(/^\//, ''));
      try { if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath); } catch { /* ignore */ }
    }

    await deleteQrCodeFile(existing.qrcode);
    await studentRepo.delete(id);
  }
  async promoteStudents(fromClassId: number, toClassId: number, studentIds?: number[]) {
    if (!fromClassId || !toClassId) {
      throw new Error('Kelas asal dan kelas tujuan wajib ditentukan.');
    }

    const classRecord = await classRepo.findById(toClassId);
    if (!classRecord) {
      throw new Error('Kelas tujuan tidak ditemukan.');
    }

    if (studentIds && studentIds.length > 0) {
      await db.update(students)
        .set({ classId: toClassId, updatedAt: new Date() })
        .where(and(
          eq(students.classId, fromClassId),
          inArray(students.id, studentIds)
        ));
    } else {
      await db.update(students)
        .set({ classId: toClassId, updatedAt: new Date() })
        .where(eq(students.classId, fromClassId));
    }
    return { success: true };
  }

  async appendFaceEmbedding(id: number, newEmbedding: number[], clientTimestamp?: string) {
    const existing = await studentRepo.findById(id);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan.');
    }

    let embeddings: number[][] = [];

    if (existing.faceEmbedding) {
      try {
        const parsed = JSON.parse(existing.faceEmbedding);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            embeddings = parsed as number[][];
          } else {
            embeddings = [parsed as number[]];
          }
        }
      } catch { }
    }

    embeddings.push(newEmbedding);

    if (embeddings.length > 3) {
      embeddings = embeddings.slice(-3);
    }

    await db.update(students)
      .set({ faceEmbedding: JSON.stringify(embeddings), updatedAt: clientTimestamp ? new Date(clientTimestamp) : new Date() })
      .where(eq(students.id, id));
  }

  async checkDuplicateFace(studentId: number, newEmbedding: number[], threshold = 0.4): Promise<{ isDuplicate: boolean; matchedStudent?: { id: number; name: string; nis: string } }> {
    const allStudents = await this.getStudentEmbeddings();
    for (const student of allStudents) {
      if (student.id === studentId) continue;
      if (!student.faceEmbedding || student.faceEmbedding.length === 0) continue;
      const minDist = student.faceEmbedding.reduce((min, emb) => {
        let sum = 0;
        for (let i = 0; i < emb.length; i++) {
          const diff = newEmbedding[i] - emb[i];
          sum += diff * diff;
        }
        const d = Math.sqrt(sum);
        return d < min ? d : min;
      }, Infinity);
      if (minDist < threshold) {
        return { isDuplicate: true, matchedStudent: { id: student.id, name: student.studentName, nis: student.nis } };
      }
    }
    return { isDuplicate: false };
  }

  async deleteFace(id: number, clientTimestamp?: string) {
    const existing = await studentRepo.findById(id);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan.');
    }
    await studentRepo.deleteFace(id, clientTimestamp);
  }

  async getStudentEmbeddings() {
    const allStudents = await db.select({
      id: students.id,
      nis: students.nis,
      studentName: students.name,
      faceEmbedding: students.faceEmbedding,
      photo: students.photo,
    }).from(students);

    return allStudents.filter(s => s.faceEmbedding).map(s => {
      let embeddings: number[][] = [];
      try {
        const parsed = JSON.parse(s.faceEmbedding!);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && Array.isArray(parsed[0])) {
            embeddings = parsed as number[][];
          } else {
            embeddings = [parsed as number[]];
          }
        }
      } catch { }
      return {
        id: s.id,
        nis: s.nis,
        studentName: s.studentName,
        photo: s.photo,
        faceEmbedding: embeddings,
      };
    });
  }

  async importStudents(filePath: string) {
    const fs = await import('fs');
    const { parseExcelStudentFile } = await import('../lib/excelParser.js');
    const { rows, errors: parseErrors } = parseExcelStudentFile(filePath);
    const { classes } = await import('../db/schema.js');

    console.log(`[Import] Parsed ${rows.length} rows from Excel, ${parseErrors.length} parse errors`);

    const results: { row: number; nis: string; status: string; error?: string }[] = [];
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      console.log(`[Import] Processing row ${rowNum}: NIS=${row.nis}, Name=${row.name}, Class=${row.className}, NIS type=${typeof row.nis}`);

      try {
        console.log(`[Import] Row ${rowNum}: Looking up class "${row.className}"`);
        const classRecord = await db.select().from(classes).where(eq(classes.name, row.className)).limit(1);
        console.log(`[Import] Row ${rowNum}: Class lookup returned ${classRecord.length} rows`);
        if (classRecord.length === 0) {
          results.push({ row: rowNum, nis: row.nis, status: 'failed', error: `Kelas "${row.className}" tidak ditemukan.` });
          failed++;
          continue;
        }

        console.log(`[Import] Row ${rowNum}: Checking NIS "${row.nis}" (type=${typeof row.nis})`);
        const existingNis = await studentRepo.findByNis(row.nis);
        console.log(`[Import] Row ${rowNum}: NIS check returned ${existingNis ? 'FOUND' : 'not found'}`);
        if (existingNis) {
          results.push({ row: rowNum, nis: row.nis, status: 'skipped', error: 'NIS sudah terdaftar.' });
          failed++;
          continue;
        }

        console.log(`[Import] Row ${rowNum}: Creating student name="${row.name}", nis="${row.nis}", classId=${classRecord[0].id}`);
        const studentId = await studentRepo.create(row.name, row.nis, classRecord[0].id);
        console.log(`[Import] Row ${rowNum}: Created student with id=${studentId}`);
        try {
          const qrPath = await generateQrCode(row.nis, studentId);
          await studentRepo.updateQrCode(studentId, qrPath);
        } catch (err) {
          console.error(`[QR] Gagal generate QR untuk NIS ${row.nis}:`, err);
        }

        const result: { row: number; nis: string; status: string; parentStatus?: string; parentError?: string } = {
          row: rowNum,
          nis: row.nis,
          status: 'imported',
        };

        if (row.parentEmail && row.parentName) {
          try {
            const parentPassword = row.parentPassword && row.parentPassword.length > 0
              ? row.parentPassword
              : `${row.nis}HadirQ`;
            const pres = await parentService.upsertAndLinkParent(studentId, {
              name: row.parentName,
              email: row.parentEmail,
              password: parentPassword,
              phone: row.parentPhone,
            });
            result.parentStatus = pres.status;
          } catch (err: any) {
            console.error(`[Import] Row ${rowNum}: gagal membuat orang tua:`, err.message);
            result.parentStatus = 'gagal';
            result.parentError = err.message;
          }
        }

        results.push(result);
        imported++;
      } catch (err: any) {
        const cause = err.cause || err;
        console.error(`[Import] Error row ${rowNum} NIS ${row.nis}:`, {
          message: err.message,
          code: cause.code,
          errno: cause.errno,
          sqlMessage: cause.sqlMessage,
          sqlState: cause.sqlState,
          sql: cause.sql,
          stack: cause.stack || err.stack,
        });
        results.push({ row: rowNum, nis: row.nis, status: 'failed', error: cause.sqlMessage || err.message || 'Gagal menyimpan siswa.' });
        failed++;
      }
    }

    // Include parse-level errors
    for (const pe of parseErrors) {
      console.log(`[Import] Parse error row ${pe.row}: ${pe.error}`);
      results.push({ row: pe.row, nis: pe.nis, status: 'failed', error: pe.error });
      failed++;
    }

    // Clean up uploaded file
    try { fs.default.unlinkSync(filePath); } catch { /* ignore */ }

    console.log(`[Import] Done: ${imported} imported, ${failed} failed`);
    return { imported, failed, results };
  }
}
export const studentService = new StudentService();
