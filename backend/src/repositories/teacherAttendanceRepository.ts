import { db } from '../db/index.js';
import { teacherAttendances, user } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export class TeacherAttendanceRepository {
  async findByTeacherAndDate(teacherId: string, date: string) {
    const rows = await db.select()
      .from(teacherAttendances)
      .where(and(
        eq(teacherAttendances.teacherId, teacherId),
        eq(teacherAttendances.attendanceDate, date),
      ))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  async create(data: {
    teacherId: string;
    attendanceDate: string;
    checkinTime: Date;
    status: 'PRESENT' | 'LATE' | 'SICK' | 'EXCUSED' | 'ABSENT';
  }) {
    const [result] = await db.insert(teacherAttendances).values(data);
    return result.insertId;
  }

  async updateCheckout(id: number, checkoutTime: Date) {
    await db.update(teacherAttendances)
      .set({ checkoutTime, updatedAt: new Date() })
      .where(eq(teacherAttendances.id, id));
  }

  async update(id: number, data: Partial<{
    status: 'PRESENT' | 'LATE' | 'SICK' | 'EXCUSED' | 'ABSENT';
    note: string;
    isVerified: boolean;
    checkinTime: Date;
    checkoutTime: Date;
  }>) {
    await db.update(teacherAttendances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherAttendances.id, id));
  }

  async getReport(filters: {
    teacherId?: string;
    startDate: string;
    endDate: string;
  }) {
    const conditions = [
      gte(teacherAttendances.attendanceDate, filters.startDate),
      lte(teacherAttendances.attendanceDate, filters.endDate),
    ];
    if (filters.teacherId) {
      conditions.push(eq(teacherAttendances.teacherId, filters.teacherId));
    }

    return await db.select({
      id: teacherAttendances.id,
      teacherId: teacherAttendances.teacherId,
      teacherName: user.name,
      teacherEmail: user.email,
      attendanceDate: teacherAttendances.attendanceDate,
      checkinTime: teacherAttendances.checkinTime,
      checkoutTime: teacherAttendances.checkoutTime,
      status: teacherAttendances.status,
      note: teacherAttendances.note,
      isVerified: teacherAttendances.isVerified,
    })
    .from(teacherAttendances)
    .innerJoin(user, eq(teacherAttendances.teacherId, user.id))
    .where(and(...conditions))
    .orderBy(teacherAttendances.attendanceDate, user.name);
  }

  async getAdminSummary(filters: {
    startDate: string;
    endDate: string;
  }) {
    const rows = await db.select({
      teacherId: teacherAttendances.teacherId,
      teacherName: user.name,
      totalDays: sql<number>`COUNT(DISTINCT ${teacherAttendances.attendanceDate})`.as('total_days'),
      presentCount: sql<number>`SUM(CASE WHEN ${teacherAttendances.status} = 'PRESENT' THEN 1 ELSE 0 END)`.as('present_count'),
      lateCount: sql<number>`SUM(CASE WHEN ${teacherAttendances.status} = 'LATE' THEN 1 ELSE 0 END)`.as('late_count'),
      sickCount: sql<number>`SUM(CASE WHEN ${teacherAttendances.status} = 'SICK' THEN 1 ELSE 0 END)`.as('sick_count'),
      excusedCount: sql<number>`SUM(CASE WHEN ${teacherAttendances.status} = 'EXCUSED' THEN 1 ELSE 0 END)`.as('excused_count'),
      absentCount: sql<number>`SUM(CASE WHEN ${teacherAttendances.status} = 'ABSENT' THEN 1 ELSE 0 END)`.as('absent_count'),
    })
    .from(teacherAttendances)
    .innerJoin(user, eq(teacherAttendances.teacherId, user.id))
    .where(and(
      gte(teacherAttendances.attendanceDate, filters.startDate),
      lte(teacherAttendances.attendanceDate, filters.endDate),
    ))
    .groupBy(teacherAttendances.teacherId, user.name);

    return rows;
  }

  async getAllTeachers() {
    return await db.select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.role, 'guru'))
    .orderBy(user.name);
  }
}

export const teacherAttendanceRepo = new TeacherAttendanceRepository();