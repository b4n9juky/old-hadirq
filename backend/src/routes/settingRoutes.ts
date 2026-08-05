import { Router } from 'express';
import { settingService } from '../services/settingService.js';
import { notificationService } from '../services/notificationService.js';
import { getSchoolTimezone, setSchoolTimezone } from '../lib/timezone.js';

export const settingsRouter = Router();

// GET all settings
settingsRouter.get('/', async (req, res) => {
  try {
    const data = await settingService.getAll();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET default WhatsApp templates
settingsRouter.get('/templates/defaults', async (_req, res) => {
  try {
    const defaults = notificationService.getDefaultTemplates();
    res.json({ success: true, data: defaults });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET school timezone — DB first, then env var / default
settingsRouter.get('/timezone', async (_req, res) => {
  try {
    const dbTz = await settingService.getValue('school_timezone');
    if (dbTz && dbTz.trim() !== '') {
      setSchoolTimezone(dbTz);
      return res.json({ success: true, data: { timezone: dbTz } });
    }
    res.json({ success: true, data: { timezone: getSchoolTimezone() } });
  } catch {
    res.json({ success: true, data: { timezone: getSchoolTimezone() } });
  }
});

// PUT update settings (partial)
settingsRouter.put('/', async (req, res) => {
  try {
    const entries = req.body;
    const data = await settingService.update(entries);
    res.json({ success: true, message: 'Pengaturan berhasil disimpan.', data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default settingsRouter;
