import { academicYearRepo } from '../repositories/academicYearRepository.js';
import { db } from '../db/index.js';
import { semesters, attendances, teacherAgendas } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface CreateAcademicYearDto {
  name: string;
  isActive?: boolean;
}

export interface UpdateAcademicYearDto {
  name: string;
}

export class AcademicYearService {
  async getYears() {
    return academicYearRepo.findAll();
  }

  async createYear(dto: CreateAcademicYearDto) {
    if (!dto.name || dto.name.trim() === '') {
      throw new Error('Nama tahun ajaran tidak boleh kosong.');
    }

    const isActive = dto.isActive ?? false;

    if (isActive) {
      return db.transaction(async (tx) => {
        await academicYearRepo.deactivateAll();
        return academicYearRepo.create(dto.name, true);
      });
    }

    return academicYearRepo.create(dto.name, false);
  }

  async updateYear(id: number, dto: UpdateAcademicYearDto) {
    if (!dto.name || dto.name.trim() === '') {
      throw new Error('Nama tahun ajaran tidak boleh kosong.');
    }

    const existing = await academicYearRepo.findById(id);
    if (!existing) {
      throw new Error(`Tahun ajaran dengan ID ${id} tidak ditemukan.`);
    }

    await academicYearRepo.update(id, dto.name);
  }

  async activateYear(id: number) {
    const year = await academicYearRepo.findById(id);
    if (!year) {
      throw new Error(`Tahun ajaran dengan ID ${id} tidak ditemukan.`);
    }

    return db.transaction(async (tx) => {
      await academicYearRepo.deactivateAll();
      await academicYearRepo.setActive(id);
    });
  }

  async deactivateYear(id: number) {
    const year = await academicYearRepo.findById(id);
    if (!year) {
      throw new Error(`Tahun ajaran dengan ID ${id} tidak ditemukan.`);
    }

    await academicYearRepo.setInactive(id);
  }

  async deleteYear(id: number) {
    const year = await academicYearRepo.findById(id);
    if (!year) {
      throw new Error(`Tahun ajaran dengan ID ${id} tidak ditemukan.`);
    }

    if (year.isActive) {
      throw new Error('Tahun ajaran aktif tidak dapat dihapus. Aktifkan tahun ajaran lain terlebih dahulu.');
    }

    const [sem, att, ag] = await Promise.all([
      db.select({ id: semesters.id }).from(semesters).where(eq(semesters.academicYearId, id)).limit(1),
      db.select({ id: attendances.id }).from(attendances).where(eq(attendances.academicYearId, id)).limit(1),
      db.select({ id: teacherAgendas.id }).from(teacherAgendas).where(eq(teacherAgendas.academicYearId, id)).limit(1),
    ]);

    if (sem.length > 0 || att.length > 0 || ag.length > 0) {
      const parts: string[] = [];
      if (sem.length > 0) parts.push('Semester');
      if (att.length > 0) parts.push('Data Presensi');
      if (ag.length > 0) parts.push('Agenda Guru');
      throw new Error(`Tahun ajaran tidak bisa dihapus karena masih dipakai oleh: ${parts.join(', ')}. Hapus atau pindahkan data tersebut terlebih dahulu.`);
    }

    await academicYearRepo.delete(id);
  }
}
export const academicYearService = new AcademicYearService();
