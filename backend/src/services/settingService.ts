import { settingRepo } from '../repositories/settingRepository.js';

export class SettingService {
  async getAll() {
    const rows = await settingRepo.getAll();
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  }

  async update(entries: Record<string, string>) {
    const allowedKeys = [
      'school_latitude',
      'school_longitude',
      'school_radius_meters',
      'max_accuracy_meters',
      'api_base_url',
      'school_name',
      'school_logo',
      'school_days',
      'school_timezone',
      'kiosk_camera_count',
      'kiosk_secret_key',
      'wa_checkin_normal',
      'wa_checkin_late',
      'wa_checkout',
    ];

    for (const key of Object.keys(entries)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Key "${key}" tidak diizinkan.`);
      }
    }

    const payload = Object.entries(entries).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    await settingRepo.upsertMany(payload);

    // Sync timezone to in-memory cache if updated
    if (entries.school_timezone) {
      const { setSchoolTimezone } = await import('../lib/timezone.js');
      setSchoolTimezone(entries.school_timezone);
    }

    return this.getAll();
  }

  async getValue(key: string): Promise<string | null> {
    const row = await settingRepo.get(key);
    return row ? row.value : null;
  }

  async getGeofenceConfig() {
    const get = async (key: string, envKey: string, fallback: string) => {
      const val = await this.getValue(key);
      if (val !== null && val.trim() !== '') return val;
      return process.env[envKey] || fallback;
    };

    return {
      school_latitude: parseFloat(await get('school_latitude', 'SCHOOL_LATITUDE', '0.1340')),
      school_longitude: parseFloat(await get('school_longitude', 'SCHOOL_LONGITUDE', '117.5000')),
      school_radius_meters: parseFloat(await get('school_radius_meters', 'SCHOOL_RADIUS_METERS', '50')),
      max_accuracy_meters: parseFloat(await get('max_accuracy_meters', 'MAX_ACCURACY_METERS', '30')),
      api_base_url: await get('api_base_url', 'API_BASE_URL', ''),
    };
  }
}

export const settingService = new SettingService();
