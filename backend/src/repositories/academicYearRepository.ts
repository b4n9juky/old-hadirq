import { db } from '../db/index.js';
import { academicYears } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class AcademicYearRepository {
  async findAll() {
    return db.select().from(academicYears);
  }

  async findById(id: number) {
    const results = await db.select().from(academicYears).where(eq(academicYears.id, id)).limit(1);
    return results[0] || null;
  }

  async create(name: string, isActive: boolean) {
    const [result] = await db.insert(academicYears).values({
      name,
      isActive,
    });
    return result.insertId;
  }

  async update(id: number, name: string) {
    await db.update(academicYears).set({ name }).where(eq(academicYears.id, id));
  }

  async deactivateAll() {
    await db.update(academicYears).set({ isActive: false });
  }

  async setActive(id: number) {
    await db.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, id));
  }

  async setInactive(id: number) {
    await db.update(academicYears).set({ isActive: false }).where(eq(academicYears.id, id));
  }

  async delete(id: number) {
    await db.delete(academicYears).where(eq(academicYears.id, id));
  }
}
export const academicYearRepo = new AcademicYearRepository();
