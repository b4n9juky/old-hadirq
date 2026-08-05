import { useState, useEffect } from 'react';
import { Users, Clock, CalendarDays, ChevronDown, ChevronUp, Filter, Bell, BellOff } from 'lucide-react';
import { useTimezone } from '../../hooks/useTimezone';
import { subscribeToPush, isPushSubscribed, unsubscribeFromPush } from '../../utils/pushNotifications';

interface ChildRecord {
  id: number;
  name: string;
  nis: string;
  className: string;
  photo?: string | null;
  todayAttendance?: {
    status: string;
    checkinTime?: string | null;
    checkoutTime?: string | null;
    checkinPhoto?: string | null;
    checkinLatitude?: number | null;
    checkinLongitude?: number | null;
    attendanceDate: string;
  } | null;
}

interface AttendanceRecord {
  id: number;
  studentId: number;
  attendanceDate: string;
  status: string;
  checkinTime?: string | null;
  checkoutTime?: string | null;
  checkinPhoto?: string | null;
}

interface Props {
  token: string;
  user: { id?: string; name: string };
}

const statusColor: Record<string, string> = {
  PRESENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  LATE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  SICK: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  EXCUSED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ABSENT: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabel: Record<string, string> = {
  PRESENT: 'Hadir',
  LATE: 'Terlambat',
  SICK: 'Sakit',
  EXCUSED: 'Izin',
  ABSENT: 'Tidak Hadir',
};

export const ParentSection: React.FC<Props> = ({ token, user }) => {
  const schoolTimezone = useTimezone();
  const authHeader = { Authorization: `Bearer ${token}` };
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedChild, setExpandedChild] = useState<number | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (!user.id) return;
    isPushSubscribed().then(setPushEnabled);
  }, [user.id]);

  const handleTogglePush = async () => {
    if (!user.id) return;
    setPushLoading(true);
    setPushMsg('');
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(token, user.id);
        setPushEnabled(false);
        setPushMsg('Notifikasi dinonaktifkan.');
      } else {
        setPushMsg('Meminta izin...');
        const ok = await subscribeToPush(token, user.id);
        setPushEnabled(ok);
        setPushMsg(ok ? 'Notifikasi berhasil diaktifkan!' : 'Gagal mengaktifkan notifikasi. Cek console browser untuk detail.');
      }
    } catch (err: any) {
      setPushMsg('Error: ' + (err.message || 'Unknown'));
    } finally {
      setPushLoading(false);
    }
  };

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/children', { headers: authHeader });
      const data = await res.json();
      if (data.success) setChildren(data.data);
      else throw new Error(data.error || 'Gagal memuat data.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (childId: number) => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    try {
      const res = await fetch(`/api/parent/attendance/${childId}?${params.toString()}`, { headers: authHeader });
      const data = await res.json();
      if (data.success) setHistory(data.data);
      else throw new Error(data.error || 'Gagal memuat riwayat.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleChild = (childId: number) => {
    if (expandedChild === childId) {
      setExpandedChild(null);
      setHistory([]);
    } else {
      setExpandedChild(childId);
      fetchHistory(childId);
    }
  };

  const formatTime = (t?: string | null) => {
    if (!t) return '—';
    return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: schoolTimezone });
  };

  const formatDate = (d: string) => {
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Dashboard Orang Tua</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Selamat datang, {user.name}</p>
          </div>
        </div>
      </div>

      {errorMsg && <div className="px-6 py-3 text-destructive text-xs">{errorMsg}</div>}

      <div className="px-6 pt-4">
        <div className={`flex items-center justify-between p-3 rounded-xl border ${
          pushEnabled ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-muted/30 border-border'
        }`}>
          <div className="flex items-center gap-2">
            {pushEnabled ? <Bell className="w-4 h-4 text-emerald-500" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
            <span className="text-xs text-foreground">
              {pushEnabled ? 'Notifikasi aktif — Anda akan menerima notifikasi browser jika WhatsApp gagal' : 'Aktifkan notifikasi browser sebagai cadangan jika WhatsApp tidak tersedia'}
            </span>
          </div>
          <button
            onClick={handleTogglePush}
            disabled={pushLoading}
            className={`px-3 py-1.5 rounded-lg text-2xs font-bold transition-all ${
              pushEnabled
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            } disabled:opacity-50`}>
            {pushLoading ? '...' : pushEnabled ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
        {pushMsg && (
          <div className={`mt-2 text-2xs px-3 py-1.5 rounded-lg ${
            pushMsg.includes('berhasil') || pushMsg.includes('diaktifkan')
              ? 'bg-emerald-500/10 text-emerald-500'
              : pushMsg.includes('Gagal') || pushMsg.includes('Error')
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}>
            {pushMsg}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-12">Memuat data...</div>
        ) : children.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada siswa yang terhubung dengan akun Anda.</p>
            <p className="text-xs mt-2">Hubungi admin untuk menautkan akun Anda dengan siswa.</p>
          </div>
        ) : (
          children.map((child) => (
            <div key={child.id} className="border border-border rounded-xl overflow-hidden">
              <button onClick={() => toggleChild(child.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/10 transition-colors text-left">
                <div className="shrink-0">
                  {child.photo ? (
                    <img src={child.photo} alt={child.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground/50 border-2 border-border">
                      <Users className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{child.name}</span>
                    <span className="text-xs text-muted-foreground">({child.nis})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{child.className}</p>
                  {child.todayAttendance ? (
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor[child.todayAttendance.status] || ''}`}>
                        {statusLabel[child.todayAttendance.status] || child.todayAttendance.status}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(child.todayAttendance.checkinTime)}
                      </span>
                      {child.todayAttendance.checkoutTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pulang: {formatTime(child.todayAttendance.checkoutTime)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold border bg-slate-500/10 border-slate-500/20 text-slate-400 mt-2">
                      Belum Absen Hari Ini
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-muted-foreground">
                  {expandedChild === child.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {expandedChild === child.id && (
                <div className="border-t border-border p-4 space-y-4 bg-muted/5">
                  <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
                    <button onClick={() => fetchHistory(child.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors">
                      Terapkan
                    </button>
                  </div>

                  {historyLoading ? (
                    <div className="text-center text-muted-foreground text-sm py-8">Memuat riwayat...</div>
                  ) : history.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Belum ada data absensi.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-secondary text-muted-foreground uppercase font-semibold">
                            <th className="px-3 py-2 rounded-l-lg">Tanggal</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Jam Masuk</th>
                            <th className="px-3 py-2">Jam Pulang</th>
                            <th className="px-3 py-2 rounded-r-lg">Foto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {history.map((rec) => (
                            <tr key={rec.id} className="text-foreground hover:bg-muted/5">
                              <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatDate(rec.attendanceDate)}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${statusColor[rec.status] || ''}`}>
                                  {statusLabel[rec.status] || rec.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">{formatTime(rec.checkinTime)}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">{formatTime(rec.checkoutTime)}</td>
                              <td className="px-3 py-2.5">
                                {rec.checkinPhoto ? (
                                  <img src={rec.checkinPhoto} alt="foto absen"
                                    className="w-8 h-8 rounded-lg object-cover border border-border cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => window.open(rec.checkinPhoto!, '_blank')} />
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};
