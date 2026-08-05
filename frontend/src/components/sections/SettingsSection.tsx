import { useState, useEffect } from 'react';
import { Save, MapPin, Crosshair, Ruler, Wifi, AlertCircle, CheckCircle, School, Calendar, Clock, Camera, Key } from 'lucide-react';
import { FormInput, FormSelect } from '../shared/FormField';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  token: string;
}

export const SettingsSection: React.FC<Props> = ({ token }) => {
  const authHeader = { 'Authorization': `Bearer ${token}` };

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [accuracy, setAccuracy] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolDays, setSchoolDays] = useState('5');
  const [schoolTimezone, setSchoolTimezone] = useState('Asia/Jakarta');
  const [kioskCameraCount, setKioskCameraCount] = useState('1');
  const [kioskSecretKey, setKioskSecretKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings', { headers: authHeader });
      const data = await res.json();
      if (data.success) {
        setLatitude(data.data.school_latitude || '');
        setLongitude(data.data.school_longitude || '');
        setRadius(data.data.school_radius_meters || '');
        setAccuracy(data.data.max_accuracy_meters || '');
        setApiBaseUrl(data.data.api_base_url || '');
        setSchoolName(data.data.school_name || '');
        setSchoolDays(data.data.school_days || '5');
        setSchoolTimezone(data.data.school_timezone || 'Asia/Jakarta');
        setKioskCameraCount(data.data.kiosk_camera_count || '1');
        setKioskSecretKey(data.data.kiosk_secret_key || '');
      }
    } catch (err: any) {
      setError('Gagal memuat pengaturan.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload: Record<string, string> = {};
    if (latitude.trim()) payload.school_latitude = latitude.trim();
    if (longitude.trim()) payload.school_longitude = longitude.trim();
    if (radius.trim()) payload.school_radius_meters = radius.trim();
    if (accuracy.trim()) payload.max_accuracy_meters = accuracy.trim();
    if (apiBaseUrl.trim()) payload.api_base_url = apiBaseUrl.trim();
    if (schoolName.trim()) payload.school_name = schoolName.trim();
    payload.school_days = schoolDays;
    payload.school_timezone = schoolTimezone;
    payload.kiosk_camera_count = kioskCameraCount;
    if (kioskSecretKey.trim()) payload.kiosk_secret_key = kioskSecretKey.trim();

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        await applySchoolDays(schoolDays);
        setSuccess('Pengaturan berhasil disimpan.');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(data.error || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      setError('Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const applySchoolDays = async (days: string) => {
    const scheduleRes = await fetch('/api/schedules', { headers: authHeader });
    const scheduleData = await scheduleRes.json();
    if (!scheduleData.success) return;

    const schedules = scheduleData.data as { id: number; dayName: string }[];
    const activeDays = days === '6'
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (const sched of schedules) {
      const shouldBeActive = activeDays.includes(sched.dayName);
      await fetch(`/api/schedules/${sched.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ isActive: shouldBeActive }),
      });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pengaturan Sistem</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Konfigurasi geolokasi & koneksi perangkat Android
          </p>
        </div>
        <button
          onClick={loadSettings}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Muat Ulang
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-400" />
            Lokasi Sekolah (Geofence)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="-7.123456"
            />
            <FormInput
              label="Longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="112.123456"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-teal-400" />
            Batasan Presensi
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Radius Sekolah (meter)"
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="50"
            />
            <FormInput
              label="Maks. Akurasi GPS (meter)"
              type="number"
              value={accuracy}
              onChange={(e) => setAccuracy(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
            <Ruler className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Radius sekolah: batas maksimal jarak siswa dari titik koordinat sekolah.
              Akurasi GPS: batas maksimal ketidakpastian sinyal GPS (semakin kecil semakin akurat).
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wifi className="w-4 h-4 text-teal-400" />
            Koneksi Aplikasi Android
          </h3>
          <FormInput
            label="API Base URL (opsional)"
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://absensi.sekolah.sch.id"
          />
          <p className="text-xs text-muted-foreground">
            Biarkan kosong untuk menggunakan URL server otomatis. Isi jika aplikasi Android
            membutuhkan URL tetap (misalnya untuk akses dari luar jaringan).
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <School className="w-4 h-4 text-teal-400" />
            Identitas Sekolah
          </h3>
          <FormInput
            label="Nama Sekolah"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="SMA Negeri 1 Bontang"
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Hari Sekolah
          </h3>
          <FormSelect
            label="Jumlah Hari Sekolah"
            value={schoolDays}
            onChange={(e) => setSchoolDays(e.target.value)}
            options={[
              { value: '5', label: '5 Hari (Senin - Jumat)' },
              { value: '6', label: '6 Hari (Senin - Sabtu)' },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Menentukan hari aktif sekolah untuk presensi. Perubahan akan otomatis menyesuaikan jadwal harian.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            Zona Waktu
          </h3>
          <FormSelect
            label="Zona Waktu Sekolah"
            value={schoolTimezone}
            onChange={(e) => setSchoolTimezone(e.target.value)}
            options={[
              { value: 'Asia/Jakarta', label: 'WIB (UTC+7) — Sumatera, Jawa, Kalbar' },
              { value: 'Asia/Makassar', label: 'WITA (UTC+8) — Sulawesi, Bali, Kaltim, NTB, NTT' },
              { value: 'Asia/Jayapura', label: 'WIT (UTC+9) — Maluku, Papua' },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Menentukan zona waktu untuk presensi, jadwal, dan tampilan jam di kiosk. Simpan & refresh halaman agar diterapkan.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            Kiosk Multi Kamera
          </h3>
          <FormSelect
            label="Jumlah Kamera Kiosk"
            value={kioskCameraCount}
            onChange={(e) => setKioskCameraCount(e.target.value)}
            options={[
              { value: '1', label: '1 Kamera' },
              { value: '2', label: '2 Kamera' },
              { value: '3', label: '3 Kamera' },
              { value: '4', label: '4 Kamera' },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Jumlah webcam yang digunakan secara bersamaan pada kiosk absensi (wajah & QR code). Kiosk otomatis memakai kamera yang tersedia hingga jumlah ini.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-teal-400" />
            Kunci Rahasia Kiosk
          </h3>
          <FormInput
            label="Kunci Kiosk (KIOSK_SECRET_KEY)"
            type="text"
            value={kioskSecretKey}
            onChange={(e) => setKioskSecretKey(e.target.value)}
            placeholder="Masukkan kunci rahasia kiosk"
          />
          <p className="text-xs text-muted-foreground">
            Kunci rahasia yang digunakan kiosk absensi untuk autentikasi ke server.
            Kunci ini harus cocok dengan yang dikonfigurasi di perangkat kiosk.
            Jika kosong, menggunakan nilai dari environment variable.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
};
