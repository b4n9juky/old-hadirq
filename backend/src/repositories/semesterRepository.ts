import { db } from '../db/index.js';
import { semesters } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class SemesterRepository {
  async findAll() {
    return db.select().from(semesters);
  }

  async findById(id: number) {
    const results = await db.select().from(semesters).where(eq(semesters.id, id)).limit(1);
    return results[0] || null;
  }

  async create(academicYearId: number, name: string, isActive: boolean) {
    const [result] = await db.insert(semesters).values({
      academicYearId,
      name,
      isActive,
    });
    return result.insertId;
  }

  async update(id: number, name: string, academicYearId?: number) {
    const values: any = { name };
    if (academicYearId !== undefined) values.academicYearId = academicYearId;
    await db.update(semesters).set(values).where(eq(semesters.id, id));
  }

  async deactivateAllInYear(academicYearId: number) {
    await db.update(semesters)
      .set({ isActive: false })
      .where(eq(semesters.academicYearId, academicYearId));
  }

  async setActive(id: number) {
    await db.update(semesters).set({ isActive: true }).where(eq(semesters.id, id));
  }

  async setInactive(id: number) {
    await db.update(semesters).set({ isActive: false }).where(eq(semesters.id, id));
  }

  async delete(id: number) {
    await db.delete(semesters).where(eq(semesters.id, id));
  }
}
export const semesterRepo = new SemesterRepository();
