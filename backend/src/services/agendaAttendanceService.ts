import { db } from '../db/index.js';
import { teacherAgendas, agendaAttendances, classes, students, user, academicYears, semesters } from '../db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';

export class AgendaAttendanceService {
  async getAgendas(teacherId: string, filters?: { date?: string; agendaType?: string }) {
    const conditions = [eq(teacherAgendas.teacherId, teacherId)];
    if (filters?.date) conditions.push(eq(teacherAgendas.date, filters.date));
    if (filters?.agendaType) conditions.push(eq(teacherAgendas.agendaType, filters.agendaType));

    return db.select({
      id: teacherAgendas.id,
      title: teacherAgendas.title,
      agendaType: teacherAgendas.agendaType,
      subject: teacherAgendas.subject,
      date: teacherAgendas.date,
      startTime: teacherAgendas.startTime,
      endTime: teacherAgendas.endTime,
      className: classes.name,
      classId: classes.id,
      notes: teacherAgendas.notes,
    })
    .from(teacherAgendas)
    .leftJoin(classes, eq(teacherAgendas.classId, classes.id))
    .where(and(...conditions))
    .orderBy(desc(teacherAgendas.date));
  }

  async createAgenda(teacherId: string, data: {
    classId?: number; title: string; agendaType?: string; subject?: string;
    date: string; startTime?: string; endTime?: string; notes?: string;
  }) {
    const activeAcademicYear = await db.select({ id: academicYears.id })
      .from(academicYears)
      .where(eq(academicYears.isActive, true))
      .limit(1);

    const activeSemester = await db.select({ id: semesters.id })
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1);

    if (activeAcademicYear.length === 0) throw new Error('Tidak ada tahun ajaran aktif.');
    if (activeSemester.length === 0) throw new Error('Tidak ada semester aktif.');

    const [result] = await db.insert(teacherAgendas).values({
      teacherId,
      classId: data.classId ?? null,
      title: data.title,
      agendaType: data.agendaType || null,
      subject: data.subject || null,
      notes: data.notes || null,
      date: data.date,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      academicYearId: activeAcademicYear[0].id,
      semesterId: activeSemester[0].id,
    });

    return result.insertId;
  }

  async updateAgenda(teacherId: string, agendaId: number, data: {
    title?: string; agendaType?: string; subject?: string;
    date?: string; startTime?: string; endTime?: string;
    classId?: number | null; notes?: string;
  }) {
    const existing = await db.select({ teacherId: teacherAgendas.teacherId })
      .from(teacherAgendas)
      .where(eq(teacherAgendas.id, agendaId))
      .limit(1);

    if (existing.length === 0) throw new Error('Agenda tidak ditemukan.');
    if (existing[0].teacherId !== teacherId) throw new Error('Anda tidak memiliki akses ke agenda ini.');

    await db.update(teacherAgendas)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.agendaType !== undefined && { agendaType: data.agendaType }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .where(eq(teacherAgendas.id, agendaId));
  }

  async deleteAgenda(teacherId: string, agendaId: number) {
    const existing = await db.select({ teacherId: teacherAgendas.teacherId })
      .from(teacherAgendas)
      .where(eq(teacherAgendas.id, agendaId))
      .limit(1);

    if (existing.length === 0) throw new Error('Agenda tidak ditemukan.');
    if (existing[0].teacherId !== teacherId) throw new Error('Anda tidak memiliki akses ke agenda ini.');

    await db.delete(agendaAttendances).where(eq(agendaAttendances.agendaId, agendaId));
    await db.delete(teacherAgendas).where(eq(teacherAgendas.id, agendaId));
  }

  async getForm(teacherId: string, agendaId: number) {
    const agenda = await db.select({
      id: teacherAgendas.id,
      teacherId: teacherAgendas.teacherId,
      classId: teacherAgendas.classId,
      className: classes.name,
      title: teacherAgendas.title,
      agendaType: teacherAgendas.agendaType,
      subject: teacherAgendas.subject,
      notes: teacherAgendas.notes,
      date: teacherAgendas.date,
      startTime: teacherAgendas.startTime,
      endTime: teacherAgendas.endTime,
    })
    .from(teacherAgendas)
    .leftJoin(classes, eq(teacherAgendas.classId, classes.id))
    .where(eq(teacherAgendas.id, agendaId))
    .limit(1);

    if (agenda.length === 0) throw new Error('Agenda tidak ditemukan.');
    if (agenda[0].teacherId !== teacherId) throw new Error('Anda tidak memiliki akses ke agenda ini.');

    let studentsRows: { studentId: number; nis: string; studentName: string }[] = [];
    if (agenda[0].classId) {
      studentsRows = await db.select({
        studentId: students.id,
        nis: students.nis,
        studentName: students.name,
      })
      .from(students)
      .where(eq(students.classId, agenda[0].classId))
      .orderBy(students.name);
    }

    const existingAttendances = await db.select({
      studentId: agendaAttendances.studentId,
      status: agendaAttendances.status,
      checkinTime: agendaAttendances.checkinTime,
      notes: agendaAttendances.notes,
    })
    .from(agendaAttendances)
    .where(eq(agendaAttendances.agendaId, agendaId));

    const existingMap = new Map(existingAttendances.map(a => [a.studentId, a]));

    const result = studentsRows.map(student => {
      const existing = existingMap.get(student.studentId);
      return {
        studentId: student.studentId,
        nis: student.nis,
        studentName: student.studentName,
        status: existing ? existing.status : 'ABSENT',
        checkinTime: existing ? existing.checkinTime || null : null,
        notes: existing ? existing.notes || '' : '',
      };
    });

    return { agenda: agenda[0], students: result };
  }

  async submitAttendance(
    teacherId: string,
    agendaId: number,
    entries: { studentId: number; status: string; notes?: string }[],
  ) {
    const ownership = await db.select({ id: teacherAgendas.id, teacherId: teacherAgendas.teacherId })
      .from(teacherAgendas)
      .where(eq(teacherAgendas.id, agendaId))
      .limit(1);
    if (ownership.length === 0) throw new Error('Agenda tidak ditemukan.');
    if (ownership[0].teacherId !== teacherId) throw new Error('Anda tidak memiliki akses ke agenda ini.');

    const validStatuses = ['PRESENT', 'SICK', 'EXCUSED', 'ABSENT', 'DISPEN'];

    for (const entry of entries) {
      if (!validStatuses.includes(entry.status)) {
        throw new Error(`Status tidak valid untuk siswa ID ${entry.studentId}: ${entry.status}`);
      }
    }

    for (const entry of entries) {
      await db.insert(agendaAttendances)
        .values({
          agendaId,
          studentId: entry.studentId,
          status: entry.status as any,
          notes: entry.notes || null,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: entry.status as any,
            notes: entry.notes || null,
          },
        });
    }

    return { success: true, message: `Berhasil menyimpan absensi ${entries.length} siswa.` };
  }

  async qrScanAttendance(teacherId: string, agendaId: number, studentNis: string) {
    const agenda = await db.select({
      id: teacherAgendas.id,
      teacherId: teacherAgendas.teacherId,
      classId: teacherAgendas.classId,
    })
    .from(teacherAgendas)
    .where(eq(teacherAgendas.id, agendaId))
    .limit(1);

    if (agenda.length === 0) throw new Error('Agenda tidak ditemukan.');
    if (agenda[0].teacherId !== teacherId) throw new Error('Anda tidak memiliki akses ke agenda ini.');

    const student = await db.select({
      id: students.id,
      nis: students.nis,
      name: students.name,
      classId: students.classId,
    })
    .from(students)
    .where(eq(students.nis, studentNis))
    .limit(1);

    if (student.length === 0) throw new Error('Siswa dengan NIS tersebut tidak ditemukan.');
    if (agenda[0].classId && student[0].classId !== agenda[0].classId) throw new Error('Siswa tidak terdaftar di kelas agenda ini.');

    await db.insert(agendaAttendances)
      .values({
        agendaId,
        studentId: student[0].id,
        status: 'PRESENT',
        checkinTime: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          status: 'PRESENT',
          checkinTime: new Date(),
        },
      });

    return { success: true, message: `Absensi berhasil untuk ${student[0].name} (${student[0].nis})`, student: student[0] };
  }
}

export const agendaAttendanceService = new AgendaAttendanceService();
