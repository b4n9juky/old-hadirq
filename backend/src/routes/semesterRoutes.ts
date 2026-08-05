import { Router } from 'express';
import { semesterService } from '../services/semesterService.js';

export const semesterRouter = Router();

// GET all semesters
semesterRouter.get('/', async (req, res) => {
  try {
    const data = await semesterService.getSemesters();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST a new semester
semesterRouter.post('/', async (req, res) => {
  try {
    const { academicYearId, name, isActive } = req.body;
    const insertId = await semesterService.createSemester({ academicYearId, name, isActive });
    res.status(201).json({ success: true, message: 'Semester berhasil dibuat.', data: { id: insertId } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT update semester
semesterRouter.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    const { name, academicYearId } = req.body;
    await semesterService.updateSemester(id, { name, academicYearId: academicYearId ? parseInt(academicYearId) : undefined });
    res.json({ success: true, message: 'Semester berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT to deactivate a specific semester
semesterRouter.put('/:id/deactivate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await semesterService.deactivateSemester(id);
    res.json({ success: true, message: 'Semester berhasil dinonaktifkan.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT to activate a specific semester (deactivates others in the same academic year)
semesterRouter.put('/:id/activate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await semesterService.activateSemester(id);
    res.json({ success: true, message: 'Semester berhasil diaktifkan.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
// DELETE a semester (admin only — guarded by mount)
semesterRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await semesterService.deleteSemester(id);
    res.json({ success: true, message: 'Semester berhasil dihapus.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export const semestersRouter = semesterRouter;
