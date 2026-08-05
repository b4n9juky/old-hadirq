import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanBarcode, CheckCircle2, UserCircle, Maximize2, Minimize2, Clock, RefreshCw } from 'lucide-react';
import { useAttendanceSound } from '../../hooks/useAttendanceSound';
import { useTimezone } from '../../hooks/useTimezone';
import { getVideoDevices, pickCameraDevices, getCameraGridClass, loadKioskCameraCount } from '../../utils/camera';

interface RecentArrival {
  id: number;
  studentId: number;
  studentName: string;
  nis: string;
  photo?: string;
  className: string;
  status: string;
  checkinTime: string;
}

interface ActivityItem {
  id: number;
  name: string;
  isSuccess: boolean;
  message: string;
  photo?: string | null;
}

interface BulkCheckinResult {
  success: boolean;
  message: string;
  studentId?: number;
  studentNis?: string;
  studentName?: string;
  studentPhoto?: string | null;
}

const QR_COOLDOWN_MS = 3000;
const FLUSH_MS = 300;
const GPS_MAX_AGE_MS = 60000;

export const QrKioskAttendance = () => {
  const qrScannersRef = useRef<Array<Html5Qrcode | null>>([]);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const gpsRef = useRef<{ lat?: number; lng?: number; acc?: number; time: number }>({ time: 0 });
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityIdRef = useRef(0);
  const lastSoundRef = useRef(0);

  const { playAttendanceSound } = useAttendanceSound();
  const schoolTimezone = useTimezone();

  const [kioskKey, setKioskKey] = useState<string | null>(localStorage.getItem('kiosk_secret_key'));
  const [inputKey, setInputKey] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<RecentArrival[]>([]);

  const [activeCameras, setActiveCameras] = useState<string[]>([]);
  const [activeScanners, setActiveScanners] = useState(0);
  const [activityQueue, setActivityQueue] = useState<ActivityItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusMsg, setStatusMsg] = useState('Memuat sistem QR kiosk...');

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  const fetchRecentArrivals = useCallback(async () => {
    if (!kioskKey) return;
    try {
      const res = await fetch('/api/kiosk/recent-arrivals', { headers: { 'x-kiosk-token': kioskKey } });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setRecentArrivals(data.data);
      }
    } catch { /* ignore */ }
  }, [kioskKey]);

  const pushActivity = useCallback((item: Omit<ActivityItem, 'id'>) => {
    const id = ++activityIdRef.current;
    setActivityQueue(q => [...q.slice(-4), { ...item, id }]);
    setTimeout(() => {
      setActivityQueue(q => q.filter(a => a.id !== id));
    }, 4500);
  }, []);

  const getGps = useCallback(async (): Promise<{ lat?: number; lng?: number; acc?: number }> => {
    const now = Date.now();
    if (gpsRef.current.lat !== undefined && now - gpsRef.current.time < GPS_MAX_AGE_MS) {
      return { lat: gpsRef.current.lat, lng: gpsRef.current.lng, acc: gpsRef.current.acc };
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
      });
      gpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, time: now };
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
    } catch {
      return { lat: gpsRef.current.lat, lng: gpsRef.current.lng, acc: gpsRef.current.acc };
    }
  }, []);

  const checkinBatch = useCallback(async (nises: string[]) => {
    if (!kioskKey || nises.length === 0) return;
    const gps = await getGps();
    try {
      const res = await fetch('/api/kiosk/checkin-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-kiosk-token': kioskKey },
        body: JSON.stringify({
          entries: nises.map(n => ({ studentNis: n, latitude: gps.lat, longitude: gps.lng, accuracy: gps.acc }))
        })
      });
      const data = await res.json() as { success: boolean; successCount?: number; results?: BulkCheckinResult[] };
      if (data.success && Array.isArray(data.results)) {
        let played = false;
        for (const r of data.results) {
          pushActivity({
            name: r.studentName || r.studentNis || 'Siswa',
            isSuccess: !!r.success,
            message: r.message,
            photo: r.studentPhoto,
          });
          if (!played && Date.now() - lastSoundRef.current > 800) {
            playAttendanceSound(!!r.success, r.message);
            lastSoundRef.current = Date.now();
            played = true;
          }
        }
        if (data.results.some(r => r.success)) fetchRecentArrivals();
      }
    } catch {
      pushActivity({ name: 'Jaringan', isSuccess: false, message: 'Kesalahan jaringan.' });
    }
  }, [kioskKey, getGps, pushActivity, playAttendanceSound, fetchRecentArrivals]);

  const tryAcquire = useCallback((text: string): boolean => {
    const now = Date.now();
    const last = cooldownRef.current.get(text) ?? 0;
    if (now - last < QR_COOLDOWN_MS) return false;
    cooldownRef.current.set(text, now);
    return true;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const nises = [...pendingRef.current];
      pendingRef.current.clear();
      if (nises.length > 0) checkinBatch(nises);
    }, FLUSH_MS);
  }, [checkinBatch]);

  const handleDecode = useCallback((decodedText: string) => {
    const text = decodedText.trim();
    if (!text) return;
    if (tryAcquire(text)) {
      pendingRef.current.add(text);
      scheduleFlush();
    }
  }, [tryAcquire, scheduleFlush]);

  const stopAllQrScanners = useCallback(async () => {
    const scanners = qrScannersRef.current;
    qrScannersRef.current = [];
    for (const s of scanners) {
      if (!s) continue;
      try { if (s.isScanning) await s.stop(); } catch { /* ignore */ }
      try { s.clear(); } catch { /* ignore */ }
    }
  }, []);

  const initScanners = useCallback(async () => {
    if (!kioskKey) return;
    setStatusMsg('Mengakses kamera...');
    const devices = await getVideoDevices();
    if (devices.length === 0) {
      setActiveCameras([]);
      setActiveScanners(0);
      setStatusMsg('Kamera tidak ditemukan atau ditolak.');
      return;
    }
    let desired = 1;
    try {
      desired = await loadKioskCameraCount(kioskKey);
    } catch { /* ignore */ }
    const ids = pickCameraDevices(devices, desired).map(d => d.deviceId);
    setActiveCameras(ids);

    await stopAllQrScanners();
    await new Promise(r => setTimeout(r, 100));

    let started = 0;
    for (let i = 0; i < ids.length; i++) {
      const scanner = new Html5Qrcode(`qr-kiosk-scanner-${i}`);
      qrScannersRef.current[i] = scanner;
      try {
        await scanner.start(
          ids[i],
          { fps: ids.length >= 3 ? 7 : 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
          handleDecode,
          () => {}
        );
        started++;
      } catch {
        qrScannersRef.current[i] = null;
      }
    }
    setActiveScanners(started);
    setStatusMsg(started > 1 ? `Sistem siap. ${started} kamera aktif. Arahkan QR Code ke kamera.` : 'Sistem siap. Arahkan QR Code ke kamera.');
  }, [kioskKey, stopAllQrScanners, handleDecode]);

  // Initialize QR scanners
  useEffect(() => {
    if (!kioskKey) return;

    fetchRecentArrivals();
    initScanners();

    const arrivalInterval = setInterval(fetchRecentArrivals, 10000);

    return () => {
      clearInterval(arrivalInterval);
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      stopAllQrScanners();
    };
  }, [kioskKey, fetchRecentArrivals, initScanners, stopAllQrScanners]);

  // Auth screen
  if (!kioskKey) {
    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError('');
      setAuthLoading(true);

      try {
        const res = await fetch('/api/kiosk/embeddings', { headers: { 'x-kiosk-token': inputKey } });
        if (res.status === 401) { setAuthError('Kunci Kiosk tidak valid.'); setAuthLoading(false); return; }
        const data = await res.json();
        if (!res.ok || !data.success) { setAuthError(data.error || 'Kunci Kiosk tidak valid.'); setAuthLoading(false); return; }
      } catch { setAuthError('Gagal terhubung ke server.'); setAuthLoading(false); return; }

      try {
        const [posRes, locRes] = await Promise.all([
          new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
          }),
          fetch('/api/kiosk/school-location', { headers: { 'x-kiosk-token': inputKey } }).then(r => r.json())
        ]);

        const { school_latitude, school_longitude, school_radius_meters } = locRes.data;
        if (school_latitude && school_longitude) {
          const R = 6371000;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(posRes.coords.latitude - school_latitude);
          const dLon = toRad(posRes.coords.longitude - school_longitude);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(school_latitude)) * Math.cos(toRad(posRes.coords.latitude)) * Math.sin(dLon / 2) ** 2;
          const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          if (distanceM > school_radius_meters) {
            setAuthError(`Berada di luar area sekolah (${Math.round(distanceM)}m). Maksimal ${school_radius_meters}m.`);
            setAuthLoading(false);
            return;
          }
        }

        localStorage.setItem('kiosk_secret_key', inputKey);
        setKioskKey(inputKey);
      } catch {
        setAuthError('Gagal mendapatkan lokasi GPS. Aktifkan GPS pada perangkat.');
        setAuthLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto border border-primary/20 text-primary">
            <ScanBarcode className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Kiosk QR Code</h2>
            <p className="text-zinc-400 text-sm mt-2">Masukkan Kunci Rahasia Kiosk. Perangkat harus berada di area sekolah (GPS aktif).</p>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input type="password" value={inputKey} onChange={(e) => setInputKey(e.target.value)}
              placeholder="Masukkan Kunci Rahasia..."
              className="w-full px-5 py-4 rounded-xl bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" required />
            {authError && <p className="text-destructive text-xs text-left px-1" role="alert">{authError}</p>}
            <button type="submit" disabled={authLoading} className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold transition-all shadow-lg hover:shadow-primary/20">
              {authLoading ? 'Memvalidasi...' : 'Hubungkan Perangkat'}
            </button>
          </form>
          <p className="text-zinc-600 text-xs">Kunci rahasia diatur oleh administrator pada file .env backend server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 flex justify-between items-center border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <ScanBarcode className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Kiosk QR Code</h1>
            <p className="text-xs text-zinc-500">Scan QR Code siswa · {activeScanners} kamera aktif</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-white tabular-nums">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: schoolTimezone })}
            </span>
          </div>
          <p className="text-sm text-zinc-400" role="status">{statusMsg}</p>
          <button onClick={() => initScanners()} className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-primary hover:text-primary/70 transition-colors" title="Perbarui Kamera" aria-label="Perbarui Kamera">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleToggleFullscreen} className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-primary hover:text-primary/70 transition-colors" title="Layar Penuh" aria-label="Layar Penuh">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* QR Scanner Feeds */}
        <div className={`flex-1 min-w-0 relative bg-zinc-950 grid gap-1 ${getCameraGridClass(activeCameras.length)} min-h-0`}>
          {activeCameras.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center text-center p-6">
              <ScanBarcode className="w-16 h-16 text-zinc-700 mb-4" />
              <p className="text-zinc-500 text-sm font-medium">Kamera tidak ditemukan</p>
              <p className="text-zinc-600 text-xs mt-1">Periksa koneksi kamera lalu tekan tombol perbarui.</p>
            </div>
          ) : (
            activeCameras.map((deviceId, i) => (
              <div key={deviceId} className="relative min-h-0 overflow-hidden bg-black">
                <div id={`qr-kiosk-scanner-${i}`} className="absolute inset-0" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-52 h-52 border-2 border-primary/40 rounded-xl" />
                </div>
                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-zinc-800/50" role="status">
                  <div className={`w-2 h-2 rounded-full ${activeScanners > 0 ? 'bg-primary animate-pulse' : 'bg-zinc-600'}`}></div>
                  <span className="text-xs text-zinc-400">QR {i + 1}</span>
                </div>
              </div>
            ))
          )}

          {/* Activity Notifications */}
          <div className="absolute top-4 right-4 z-40 w-80 space-y-2 pointer-events-none">
            {activityQueue.map(a => (
              <div key={a.id} className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-sm ${a.isSuccess ? 'bg-primary/40 border-primary/50' : 'bg-destructive/40 border-destructive/50'}`} role="alert">
                <div className="flex items-center gap-3">
                  {a.photo ? (
                    <img src={a.photo} alt={a.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/20 flex-shrink-0" />
                  ) : a.isSuccess ? (
                    <CheckCircle2 className="w-12 h-12 text-primary flex-shrink-0" />
                  ) : (
                    <UserCircle className="w-12 h-12 text-destructive flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white truncate">{a.name}</h3>
                    <p className="text-xs text-gray-300 leading-snug">{a.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Recent Arrivals */}
        <div className="w-80 flex-none flex flex-col bg-zinc-900/50 border-l border-zinc-800/50">
          <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Kedatangan Terakhir</h2>
                  <p className="text-xs text-zinc-500">{recentArrivals.length} siswa hari ini</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-xs text-zinc-400 font-medium">Live</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentArrivals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-xl flex items-center justify-center mb-4 border border-zinc-700/50">
                  <ScanBarcode className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm font-medium">Belum ada kedatangan</p>
                <p className="text-zinc-600 text-xs mt-1">Siswa akan muncul di sini setelah scan QR</p>
              </div>
            ) : (
              recentArrivals.map((arrival, index) => (
                <div
                  key={arrival.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    index === 0
                      ? 'bg-primary/5 border-primary/20 shadow-lg shadow-primary/5'
                      : 'bg-zinc-800/30 border-zinc-700/30 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    index === 0
                      ? 'bg-primary text-primary-foreground'
                      : index < 3
                        ? 'bg-zinc-700 text-zinc-300'
                        : 'bg-zinc-800/50 text-zinc-500'
                  }`}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>

                  <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/50 flex-shrink-0">
                    {arrival.photo ? (
                      <img src={arrival.photo} alt={arrival.studentName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{arrival.studentName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500 font-mono">{arrival.nis}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-xs text-zinc-400">{arrival.className}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      arrival.status === 'PRESENT' ? 'text-success bg-success/10 border-success/20'
                      : arrival.status === 'LATE' ? 'text-warning bg-warning/10 border-warning/20'
                      : 'text-muted-foreground bg-muted/10 border-muted-foreground/20'
                    }`}>
                      {arrival.status === 'PRESENT' ? 'Hadir' : arrival.status === 'LATE' ? 'Terlambat' : arrival.status}
                    </span>
                    <span className="text-xs text-zinc-500 mt-1 font-mono">
                      {(() => { try { return new Date(arrival.checkinTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: schoolTimezone }); } catch { return '--:--:--'; } })()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
