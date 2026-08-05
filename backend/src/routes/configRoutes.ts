import { Router } from 'express';
import { db } from '../db/index.js';
import { students, classes, schedules, user } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { settingService } from '../services/settingService.js';

export const configRouter = Router();

configRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const userName = req.context!.user.name;

    let studentRecord: any[] = [];
    const deviceUuidQuery = (req.query.device_uuid as string) || '';
    if (deviceUuidQuery) {
      studentRecord = await db.select().from(students).where(eq(students.deviceUuid, deviceUuidQuery)).limit(1);
    }

    // Fetch class name if student has a classId
    let className = '';
    if (studentRecord.length > 0 && studentRecord[0].classId) {
      const classRec = await db.select().from(classes).where(eq(classes.id, studentRecord[0].classId)).limit(1);
      if (classRec.length > 0) className = classRec[0].name;
    }

    const geofence = await settingService.getGeofenceConfig();
    const schoolName = await settingService.getValue('school_name');
    const schoolLogo = await settingService.getValue('school_logo');

    const activeScheduleDays = await db.select({ dayName: schedules.dayName })
      .from(schedules)
      .where(eq(schedules.isActive, true));

    res.json({
      success: true,
      data: {
        api_base_url: geofence.api_base_url || `${req.protocol}://${req.get('host')}`,
        student_name: studentRecord.length > 0 ? studentRecord[0].name : userName,
        student_nis: studentRecord.length > 0 ? studentRecord[0].nis : '',
        student_photo: studentRecord.length > 0 ? (studentRecord[0].photo || '') : '',
        student_qrcode: studentRecord.length > 0 ? (studentRecord[0].qrcode || '') : '',
        student_class: className,
        device_uuid: studentRecord.length > 0 ? (studentRecord[0].deviceUuid || '') : '',
        school_latitude: geofence.school_latitude,
        school_longitude: geofence.school_longitude,
        school_radius_meters: geofence.school_radius_meters,
        max_accuracy_meters: geofence.max_accuracy_meters,
        school_name: schoolName || '',
        school_logo: schoolLogo || '',
        active_days: activeScheduleDays.map(d => d.dayName),
      },
    });
  } catch (error) {
    console.error('[Config] Error fetching config:', error);
    res.status(500).json({ success: false, error: 'Gagal memuat konfigurasi server.' });
  }
});


