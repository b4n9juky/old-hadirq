import { Router } from 'express';
import { agendaAttendanceService } from '../services/agendaAttendanceService.js';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware.js';

export const agendaAttendanceRouter = Router();

agendaAttendanceRouter.get('/agendas', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const { date, agendaType } = req.query;
    const result = await agendaAttendanceService.getAgendas(teacherId, {
      date: date as string | undefined,
      agendaType: agendaType as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.post('/agendas', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const { classId, title, agendaType, subject, date, startTime, endTime, notes } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, error: 'Data tidak lengkap. Dibutuhkan title dan date.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ success: false, error: 'Format tanggal harus YYYY-MM-DD.' });
    }

    const agendaId = await agendaAttendanceService.createAgenda(teacherId, {
      classId: classId ? Number(classId) : undefined, title, agendaType, subject, date, startTime, endTime, notes,
    });
    res.status(201).json({ success: true, message: 'Agenda berhasil dibuat.', data: { id: agendaId } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.put('/agendas/:id', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid.' });

    const { title, agendaType, subject, date, startTime, endTime, classId, notes } = req.body;
    await agendaAttendanceService.updateAgenda(teacherId, id, {
      title, agendaType, subject, date, startTime, endTime,
      classId: classId !== undefined ? (classId ? Number(classId) : null) : undefined,
      notes,
    });
    res.json({ success: true, message: 'Agenda berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.delete('/agendas/:id', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid.' });

    await agendaAttendanceService.deleteAgenda(teacherId, id);
    res.json({ success: true, message: 'Agenda berhasil dihapus.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.get('/agendas/:id/students', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID agenda tidak valid.' });

    const result = await agendaAttendanceService.getForm(teacherId, id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.post('/agendas/:id/attendance', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID agenda tidak valid.' });

    const { entries } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: 'Data entries tidak valid.' });
    }

    const result = await agendaAttendanceService.submitAttendance(teacherId, id, entries);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

agendaAttendanceRouter.post('/agendas/:id/qr-scan', authMiddleware, requireRole(['guru']), async (req, res) => {
  try {
    const teacherId = req.context!.user.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID agenda tidak valid.' });

    const { studentNis } = req.body;
    if (!studentNis) {
      return res.status(400).json({ success: false, error: 'NIS siswa wajib diisi.' });
    }

    const result = await agendaAttendanceService.qrScanAttendance(teacherId, id, studentNis);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
