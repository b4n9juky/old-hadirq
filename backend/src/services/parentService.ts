import { parentRepo } from '../repositories/parentRepository.js';
import { studentRepo } from '../repositories/studentRepository.js';
import { userRepo } from '../repositories/userRepository.js';
import { auth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { attendances, academicYears, semesters, students as studentsTable, classes, user } from '../db/schema.js';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { parseExcelParentFile } from '../lib/excelParser.js';
import fs from 'fs';

export class ParentService {
  async getAllWithLinks() {
    return parentRepo.findAllWithParent();
  }

  async linkToStudent(studentId: number, parentId: string) {
    const student = await studentRepo.findById(studentId);
    if (!student) {
      throw new Error(`Siswa dengan ID ${studentId} tidak ditemukan.`);
    }

    // If student already linked to a different parent, unlink first
    if (student.parentId && student.parentId !== parentId) {
      await parentRepo.removeParent(studentId);
    }

    await parentRepo.setParent(studentId, parentId);
  }

  async unlinkStudent(studentId: number) {
    const student = await studentRepo.findById(studentId);
    if (!student) {
      throw new Error(`Siswa dengan ID ${studentId} tidak ditemukan.`);
    }

    if (!student.parentId) {
      throw new Error('Siswa ini belum memiliki orang tua terdaftar.');
    }

    await parentRepo.removeParent(studentId);
  }

  async searchParents(query: string) {
    return userRepo.searchByRole('parent', query);
  }

  // Create or link a parent account for a given student. Reused by student import.
  async upsertAndLinkParent(
    studentId: number,
    input: { name: string; email: string; password: string; phone?: string },
  ): Promise<{ status: 'sukses' | 'ditautkan'; parentId: string }> {
    const existingUser = await userRepo.findByEmail(input.email);
    if (existingUser) {
      await parentRepo.setParent(studentId, existingUser.id);
      if (input.phone) {
        await db.update(user).set({ phone: input.phone }).where(eq(user.id, existingUser.id));
      }
      return { status: 'ditautkan', parentId: existingUser.id };
    }

    const signupResult = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    });
    const userId = signupResult.user.id;

    await userRepo.updateRole(userId, 'parent');
    if (input.phone) {
      await db.update(user).set({ phone: input.phone }).where(eq(user.id, userId));
    }

    await parentRepo.setParent(studentId, userId);
    return { status: 'sukses', parentId: userId };
  }

  async getMyChildren(userId: string) {
    const children = await parentRepo.findStudentsByParentId(userId);

    const today = new Date().toISOString().split('T')[0];

    const result = [];
    for (const child of children) {
      const todayAttendance = await db.select()
        .from(attendances)
        .where(and(
          eq(attendances.studentId, child.id),
          eq(attendances.attendanceDate, today)
        ))
        .limit(1);
      result.push({
        ...child,
        todayAttendance: todayAttendance[0] || null,
      });
    }
    return result;
  }

  async getChildAttendance(userId: string, studentId: number, dateFrom?: string, dateTo?: string) {
    // Verify this child belongs to this parent
    const children = await parentRepo.findStudentsByParentId(userId);
    const child = children.find(c => c.id === studentId);
    if (!child) {
      throw new Error('Siswa tidak ditemukan atau bukan anak Anda.');
    }

    const conditions: any[] = [eq(attendances.studentId, studentId)];

    if (dateFrom) {
      conditions.push(gte(attendances.attendanceDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(attendances.attendanceDate, dateTo));
    }

    // Default to last 30 days if no date range
    if (!dateFrom && !dateTo) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      conditions.push(gte(attendances.attendanceDate, thirtyDaysAgo.toISOString().split('T')[0]));
    }

    const records = await db.select()
      .from(attendances)
      .where(and(...conditions))
      .orderBy(attendances.attendanceDate);

    return records;
  }

  async importParents(filePath: string) {
    const { rows, errors } = parseExcelParentFile(filePath);

    const imported: number[] = [];
    const results: { row: number; nis: string; email: string; status: string; error?: string }[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNum = index + 2;

      try {
        const student = await studentRepo.findByNis(row.nis);
        if (!student) {
          results.push({ row: rowNum, nis: row.nis, email: row.email, status: 'gagal', error: `Siswa dengan NIS ${row.nis} tidak ditemukan.` });
          continue;
        }

        const existingUser = await userRepo.findByEmail(row.email);
        if (existingUser) {
          await parentRepo.setParent(student.id, existingUser.id);
          if (row.phone) {
            await db.update(user).set({ phone: row.phone }).where(eq(user.id, existingUser.id));
          }
          results.push({ row: rowNum, nis: row.nis, email: row.email, status: 'ditautkan' });
          imported.push(student.id);
          continue;
        }

        const signupResult = await auth.api.signUpEmail({
          body: {
            name: row.name,
            email: row.email,
            password: row.password,
          },
        });

        const userId = signupResult.user.id;

        await userRepo.updateRole(userId, 'parent');
        if (row.phone) {
          await db.update(user).set({ phone: row.phone }).where(eq(user.id, userId));
        }

        await parentRepo.setParent(student.id, userId);

        imported.push(student.id);
        results.push({ row: rowNum, nis: row.nis, email: row.email, status: 'sukses' });
      } catch (err: any) {
        results.push({ row: rowNum, nis: row.nis, email: row.email, status: 'gagal', error: err.message });
      }
    }

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    return { imported: imported.length, failed: results.filter(r => r.status === 'gagal').length, errors, results };
  }
}
export const parentService = new ParentService();
