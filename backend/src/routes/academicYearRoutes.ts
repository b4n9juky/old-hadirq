import { Router } from 'express';
import { academicYearService } from '../services/academicYearService.js';

export const academicYearRouter = Router();

// GET all academic years
academicYearRouter.get('/', async (req, res) => {
  try {
    const data = await academicYearService.getYears();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST a new academic year
academicYearRouter.post('/', async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const insertId = await academicYearService.createYear({ name, isActive });
    res.status(201).json({ success: true, message: 'Tahun ajaran berhasil dibuat.', data: { id: insertId } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT update academic year name
academicYearRouter.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    const { name } = req.body;
    await academicYearService.updateYear(id, { name });
    res.json({ success: true, message: 'Tahun ajaran berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT to deactivate a specific academic year
academicYearRouter.put('/:id/deactivate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await academicYearService.deactivateYear(id);
    res.json({ success: true, message: 'Tahun ajaran berhasil dinonaktifkan.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT to activate a specific academic year (sets others as inactive)
academicYearRouter.put('/:id/activate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await academicYearService.activateYear(id);
    res.json({ success: true, message: 'Tahun ajaran berhasil diaktifkan.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
// DELETE an academic year (admin only — guarded by mount)
academicYearRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid.' });
    }
    await academicYearService.deleteYear(id);
    res.json({ success: true, message: 'Tahun ajaran berhasil dihapus.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export const academicYearsRouter = academicYearRouter;
