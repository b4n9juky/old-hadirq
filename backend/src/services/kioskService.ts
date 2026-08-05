import { db } from '../db/index.js';
import { students, attendances, academicYears, semesters, schedules } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getSchoolDate, formatDateWIB, formatTimeWIB, getWIBDayName } from '../lib/timezone.js';
import { settingService } from './settingService.js';
import { getDistance } from 'geolib';
import { notificationService } from './notificationService.js';

export class KioskService {
  async getKioskConfig() {
    const val = await settingService.getValue('kiosk_camera_count');
    const count = val !== null && !isNaN(parseInt(val)) ? parseInt(val) : 1;
    return { cameraCount: Math.min(Math.max(count, 1), 4) };
  }

  async processKioskAttendance(
    studentId: number,
    status?: 'PRESENT' | 'LATE' | 'SICK' | 'EXCUSED' | 'ABSENT',
    latitude?: number,
    longitude?: number,
    accuracy?: number
  ) {
    const studentRecord = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (studentRecord.length === 0) {
      return { success: false, message: `Siswa tidak ditemukan di database.` };
    }

    const student = studentRecord[0];
    const activeYear = await db.select().from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
    const activeSemester = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

    if (activeYear.length === 0 || activeSemester.length === 0) {
      return { success: false, message: 'Tahun ajaran atau semester aktif belum diatur di server.' };
    }

    // Geofence validation per-checkin
    if (latitude !== undefined && longitude !== undefined) {
      const geofence = await settingService.getGeofenceConfig();

      if (geofence.max_accuracy_meters > 0 && accuracy !== undefined && accuracy > geofence.max_accuracy_meters) {
        return { success: false, message: `Akurasi GPS terlalu rendah (${Math.round(accuracy)}m). Maksimal ${geofence.max_accuracy_meters}m.` };
      }

      if (geofence.school_latitude !== 0 || geofence.school_longitude !== 0) {
        const distanceM = getDistance(
          { latitude: latitude, longitude: longitude },
          { latitude: geofence.school_latitude, longitude: geofence.school_longitude }
        );

        if (distanceM > geofence.school_radius_meters) {
          return { success: false, message: `Berada di luar area sekolah (${distanceM}m). Maksimal ${geofence.school_radius_meters}m.` };
        }
      }
    }

    const serverTime = getSchoolDate();
    const dayName = getWIBDayName(serverTime);
    const scheduleRecord = await db.select().from(schedules).where(eq(schedules.dayName, dayName)).limit(1);

    if (scheduleRecord.length === 0) {
      return { success: false, message: `Jadwal sekolah tidak ditemukan untuk hari ${dayName}.` };
    }

    const schedule = scheduleRecord[0];

    if (!schedule.isActive) {
      return { success: false, message: 'Hari ini bukan hari sekolah. Presensi tidak tersedia.' };
    }
    const attendanceDate = formatDateWIB(serverTime);
    const currentTimeStr = formatTimeWIB(serverTime);

    const existingAttendance = await db.select()
      .from(attendances)
      .where(and(
        eq(attendances.studentId, student.id),
        eq(attendances.attendanceDate, attendanceDate)
      ))
      .limit(1);

    const targetStatus = status || (currentTimeStr > schedule.lateAfter ? 'LATE' : 'PRESENT');

    if (existingAttendance.length > 0) {
      const record = existingAttendance[0];

      const isCheckoutValid = record.checkoutTime != null &&
        !(record.checkoutTime instanceof Date && isNaN(record.checkoutTime.getTime()));

      if (isCheckoutValid) {
        return { success: false, message: `Peringatan: Anda sudah melakukan absen lengkap (datang + pulang) hari ini.` };
      }

      const checkinTimeVal = record.checkinTime;
      const isCheckinValid = checkinTimeVal != null &&
        !(checkinTimeVal instanceof Date && isNaN(checkinTimeVal.getTime()));

      if (!isCheckinValid) {
        return { success: false, message: 'Data absen tidak valid. Silakan hubungi Guru/Admin.' };
      }

      const checkinEpoch = new Date(checkinTimeVal).getTime();
      const serverEpoch = serverTime.getTime();
      const diffMinutes = Math.abs(serverEpoch - checkinEpoch) / (1000 * 60);

      if (diffMinutes < 5) {
        return { success: false, message: `Anda sudah absen datang. Silakan scan kembali setelah 5 menit untuk absen pulang.` };
      }

      if (currentTimeStr < schedule.checkoutTime) {
        return { success: false, message: `Anda sudah absen datang. Absen pulang dimulai pukul ${schedule.checkoutTime}.` };
      }

      await db.update(attendances)
        .set({
          checkoutTime: serverTime,
          checkoutLatitude: latitude ?? null,
          checkoutLongitude: longitude ?? null,
          updatedAt: serverTime,
        })
        .where(eq(attendances.id, record.id));

      notificationService.sendCheckOutNotification(student, serverTime)
        .catch(() => {});

      return { success: true, message: `Absen Pulang berhasil! Hati-hati di jalan.` };
    }

    // New Check-in
    if (currentTimeStr < schedule.checkinStart) {
      return { success: false, message: `Absen datang belum dibuka. Mulai pada jam ${schedule.checkinStart}.` };
    }

    if (currentTimeStr >= schedule.checkoutTime) {
      return { success: false, message: 'Waktu absen datang sudah lewat. Silakan hubungi Guru/Admin.' };
    }

    await db.insert(attendances).values({
      studentId: student.id,
      classId: student.classId,
      academicYearId: activeYear[0].id,
      semesterId: activeSemester[0].id,
      attendanceDate,
      status: targetStatus,
      isVerified: true,
      checkinTime: serverTime,
      checkinLatitude: latitude ?? null,
      checkinLongitude: longitude ?? null,
      checkinAccuracy: accuracy ?? null,
    });

    notificationService.sendCheckInNotification(student, attendanceDate, serverTime, targetStatus)
      .catch(() => {});

    let statusMsg = 'Hadir';
    if (targetStatus === 'LATE') statusMsg = 'Terlambat';
    return { success: true, message: `Absen Datang ${statusMsg} berhasil!` };
  }

}

export const kioskService = new KioskService();
