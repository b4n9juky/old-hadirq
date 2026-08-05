import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, CheckCircle, Clock, UserMinus, SlidersHorizontal, FileSpreadsheet, FileDown, User, Eye, Trash2, Calendar, Camera, BookOpen, ClipboardCheck, ScanBarcode } from 'lucide-react';
import { ModalShell } from '../shared/ModalShell';
import { DataTable } from '../shared/DataTable';
import { useTimezone } from '../../hooks/useTimezone';
import { agendaTypeLabel } from '../../constants/labels';

interface Props {
  token: string;
  user: { name: string; role: string };
}

const months = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
  { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

export const DashboardSection: React.FC<Props> = ({ token, user }) => {
  const schoolTimezone = useTimezone();
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterClass, setFilterClass] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [previewDetails, setPreviewDetails] = useState<any | null>(null);
  const [serverClock, setServerClock] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Teacher report state
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportStartDate, setReportStartDate] = useState(todayStr);
  const [reportEndDate, setReportEndDate] = useState(todayStr);

  // Schedule detail view state
  const [scheduleDetail, setScheduleDetail] = useState<any | null>(null);
  const [scheduleDetailLoading, setScheduleDetailLoading] = useState(false);

  const authHeader = { 'Authorization': `Bearer ${token}` };

  const columns = [
    {
      key: 'student',
      header: 'Siswa & Kelas',
      render: (row: any) => (
        <div className="flex items-center gap-3">
          {row.checkinPhoto ? (
            <img src={row.checkinPhoto} alt="Selfie" onClick={() => { setPreviewPhoto(row.checkinPhoto); setPreviewDetails(row); }}
              className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-border hover:border-primary transition-colors bg-background" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground/60">
              <User className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="font-bold text-foreground text-xs">{row.student?.name || 'Siswa'}</div>
            <div className="text-xs text-muted-foreground">{row.student?.nis || '-'} | {row.class?.name || 'Umum'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (row: any) => {
        const status = row.status;
        switch (status) {
          case 'PRESENT':
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-500">
                TEPAT WAKTU
              </span>
            );
          case 'LATE':
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-500/10 border-amber-500/20 text-amber-500">
                TERLAMBAT
              </span>
            );
          case 'SICK':
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-blue-500/10 border-blue-500/20 text-blue-500">
                SAKIT
              </span>
            );
          case 'EXCUSED':
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-purple-500/10 border-purple-500/20 text-purple-500">
                IZIN
              </span>
            );
          case 'ABSENT':
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-rose-500/10 border-rose-500/20 text-rose-500">
                ALFA
              </span>
            );
          default:
            return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-muted border-muted-foreground/20 text-muted-foreground">
                {status}
              </span>
            );
        }
      }
    },
    {
      key: 'checkinTime',
      header: 'Absen Masuk (Datang)',
      render: (row: any) => (
        <>
          <div className="text-foreground">{formatTimeString(row.checkinTime)}</div>
          <div className="text-2xs text-muted-foreground mt-0.5">{formatDateString(row.attendanceDate)}</div>
        </>
      )
    },
    {
      key: 'checkoutTime',
      header: 'Absen Pulang (Checkout)',
      render: (row: any) => (
        row.checkoutTime ? (
          <div>
            <div className="text-foreground">{formatTimeString(row.checkoutTime)}</div>
            <div className="text-2xs text-muted-foreground mt-0.5">Checkout Selesai</div>
          </div>
        ) : <span className="text-xs text-muted-foreground/60 italic">Belum Pulang</span>
      )
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setPreviewPhoto(row.checkinPhoto || row.checkoutPhoto); setPreviewDetails(row); }}
            className="p-2 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={async () => {
            if (!window.confirm('Yakin ingin menghapus data absensi ini?')) return;
            try {
              const res = await fetch(`/api/attendance/${row.id}`, { method: 'DELETE', headers: authHeader });
              const result = await res.json();
              if (!res.ok || !result.success) throw new Error(result.message || 'Gagal menghapus.');
              queryClient.invalidateQueries({ queryKey: ['attendanceReports'] });
              queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            } catch (err: any) {
              alert(err.message || 'Gagal menghapus data absensi.');
            }
          }}
            className="p-2 rounded-lg bg-secondary hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors inline-flex">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const { data: statsData, isPending: statsLoading, error: statsError } = useQuery({
    queryKey: ['dashboardStats', filterDate, filterClass, filterMonth, filterYear],
    queryFn: async () => {
      const params: string[] = [];
      if (filterDate) params.push(`date=${filterDate}`);
      if (filterClass) params.push(`classId=${filterClass}`);
      if (filterMonth) params.push(`month=${filterMonth}`);
      if (filterYear) params.push(`year=${filterYear}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/dashboard/stats${qs}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil statistik.');
      return data.data;
    },
  });
  const stats = statsData || { totalStudents: 0, presentCount: 0, lateCount: 0, absentCount: 0, daysCount: 1 };

  const { data: reportsData, isPending: reportsLoading } = useQuery({
    queryKey: ['attendanceReports', filterDate, filterClass, filterMonth, filterYear],
    queryFn: async () => {
      const params: string[] = [];
      if (filterDate) params.push(`date=${filterDate}`);
      if (filterClass) params.push(`classId=${filterClass}`);
      if (filterMonth) params.push(`month=${filterMonth}`);
      if (filterYear) params.push(`year=${filterYear}`);
      const qs = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/reports/attendance${qs}`, { headers: authHeader });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengambil data laporan.');
      return Array.isArray(result.data) ? result.data : [];
    },
  });
  const reports = reportsData || [];

  const { data: teacherReport, isPending: teacherReportLoading } = useQuery({
    queryKey: ['teacherReport', reportStartDate, reportEndDate],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/report?startDate=${reportStartDate}&endDate=${reportEndDate}`, { headers: authHeader });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal mengambil laporan.');
      return result.data;
    },
    enabled: user.role === 'guru',
  });

  const { data: myAttendanceStatus, refetch: refetchAttendance } = useQuery({
    queryKey: ['myTeacherAttendance'],
    queryFn: async () => {
      const res = await fetch('/api/teacher-attendance/my-status', { headers: authHeader });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal mengambil status.');
      return result.data;
    },
    enabled: user.role === 'guru',
  });

  const { data: classesData } = useQuery({
    queryKey: ['classesList'],
    queryFn: async () => {
      const res = await fetch('/api/classes', { headers: authHeader });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil kelas.');
      return data.data;
    },
  });
  const classesList = classesData || [];

  const errorMsg = statsError ? (statsError as Error).message : '';

  // Sync server clock when stats data is loaded
  useEffect(() => {
    if (statsData?.serverTime) {
      setServerClock(new Date(statsData.serverTime));
    }
  }, [statsData?.serverTime]);

  // Tick the clock every second
  useEffect(() => {
    if (!serverClock) return;
    const timer = setInterval(() => {
      setServerClock(prev => prev ? new Date(prev.getTime() + 1000) : null);
    }, 1000);
    return () => clearInterval(timer);
  }, [!!serverClock]);

  const tzLabel: Record<string, string> = {
    'Asia/Jakarta': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Jayapura': 'WIT',
  };

  const getClockString = () => {
    if (!serverClock) return '--:--:--';
    try {
      return serverClock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: schoolTimezone });
    } catch {
      const h = String(serverClock.getHours()).padStart(2, '0');
      const m = String(serverClock.getMinutes()).padStart(2, '0');
      const s = String(serverClock.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
  };

  const getClockDateString = () => {
    if (!serverClock) return 'Memuat tanggal...';
    return serverClock.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: schoolTimezone,
    });
  };

  const handleResetFilters = () => {
    setFilterDate(new Date().toISOString().split('T')[0]);
    setFilterClass('');
    setFilterMonth('');
    setFilterYear('');
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '-';
    try { return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return dateStr; }
  };

  const formatTimeString = (timeStr: string) => {
    if (!timeStr) return '-';
    try { return new Date(timeStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: schoolTimezone }); }
    catch { return timeStr; }
  };

  const downloadCsv = (csvContent: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const statusLabels: Record<string, string> = {
      PRESENT: 'Tepat Waktu', LATE: 'Terlambat',
      SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alfa',
    };
    const header = 'Tanggal,NIS,Nama,Kelas,Jam Datang,Jam Pulang,Status';
    const rows = reports.map((r: any) => {
      const datang = r.checkinTime ? new Date(r.checkinTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: schoolTimezone }) : '-';
      const pulang = r.checkoutTime ? new Date(r.checkoutTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: schoolTimezone }) : '-';
      return `${r.attendanceDate},${r.student?.nis || ''},${r.student?.name || ''},${r.class?.name || ''},${datang},${pulang},${statusLabels[r.status] || r.status}`;
    }).join('\n');
    downloadCsv(`${header}\n${rows}`, `rekap-absensi-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportTeacherCsv = () => {
    if (!teacherReport) return;
    const rows: string[] = ['Tanggal,Kelas,Mapel,Jam,Materi,Kegiatan,Catatan,Total Siswa,Persentase'];
    teacherReport.schedules?.forEach((s: any) => {
      const total = s.totalStudents || 1;
      const attended = s.presentCount + s.sickCount + s.excusedCount + s.dispensationCount;
      const pct = Math.round((attended / total) * 100);
      rows.push(`${reportStartDate},${s.className},${s.subject || ''},${s.startTime?.slice(0, 5)}-${s.endTime?.slice(0, 5)},${s.materi || ''},${s.kegiatan || ''},${s.catatanKendala || ''},${total},${pct}%`);
    });
    teacherReport.agendas?.forEach((a: any) => {
      const total = a.totalStudents || 1;
      const attended = a.presentCount + a.sickCount + a.excusedCount + a.dispensationCount;
      const pct = Math.round((attended / total) * 100);
      rows.push(`${reportStartDate},${a.className},${agendaTypeLabel(a.agendaType) || 'Agenda'},"${a.title}",,,,,${total},${pct}%`);
    });
    downloadCsv(rows.join('\n'), `rekap-mengajar-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleOpenScheduleDetail = async (scheduleId: number) => {
    setScheduleDetailLoading(true);
    setScheduleDetail(null);
    try {
      const res = await fetch(`/api/subject-attendances/schedule/${scheduleId}/date/${reportStartDate}`, { headers: authHeader });
      const data = await res.json();
      if (data.success) setScheduleDetail(data.data);
      else setScheduleDetail({ error: data.error || 'Gagal memuat detail' });
    } catch { setScheduleDetail({ error: 'Gagal memuat detail' }); }
    setScheduleDetailLoading(false);
  };

  return (
    <>
      {/* Welcome & Live Server Clock Banner */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeIn mb-2">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-primary/10 border border-primary/20 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Sistem Aktif
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
            Selamat datang kembali, <span className="text-primary">{user?.name || 'Admin'}</span>!
          </h1>
          <p className="text-sm text-muted-foreground">
            {statsData?.schoolName || 'Sistem Absensi Kehadiran Siswa'}
          </p>
          <div className="pt-2 flex items-center gap-3">
            <a href="/#/kiosk-absensi" target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Camera className="w-4 h-4" />
              <span>Buka Kiosk Absensi Wajah</span>
            </a>
            <a href="/#/kiosk-qr" target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <ScanBarcode className="w-4 h-4" />
              <span>Buka Kiosk QR Code</span>
            </a>
          </div>
        </div>
        
        {/* Digital Clock Section */}
        <div className="bg-background border border-border rounded-xl px-6 py-4 flex flex-col md:items-end justify-center gap-1.5 min-w-[200px]">
          <div className="flex items-center gap-2 text-primary font-mono text-3xl font-bold tracking-wider">
            <Clock className="w-5 h-5 text-primary/70" />
            <span>{getClockString()}</span>
            <span className="text-xs font-sans font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest ml-1">{tzLabel[schoolTimezone] || schoolTimezone.split('/').pop()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
            <span>{getClockDateString()}</span>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
        {[
          { label: 'Total Siswa', value: stats.totalStudents, icon: <Users className="w-5 h-5" />, iconBg: 'bg-blue-500/10 text-blue-500' },
          { label: 'Hadir Tepat Waktu', value: stats.presentCount, icon: <CheckCircle className="w-5 h-5" />, iconBg: 'bg-teal-500/10 text-teal-500' },
          { label: 'Siswa Terlambat', value: stats.lateCount, icon: <Clock className="w-5 h-5" />, iconBg: 'bg-amber-500/10 text-amber-500' },
          { label: 'Belum Hadir / Absen', value: stats.absentCount, icon: <UserMinus className="w-5 h-5" />, iconBg: 'bg-muted text-muted-foreground' },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <h3 className="text-xl font-bold mt-2 text-foreground">{statsLoading ? '...' : card.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${card.iconBg}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      {user.role === 'guru' ? (
        <>
          {/* Teacher Check-in / Check-out Card */}
          {myAttendanceStatus && (
            <section className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    myAttendanceStatus.checkedOut ? 'bg-emerald-500/10' :
                    myAttendanceStatus.checkedIn ? 'bg-amber-500/10' : 'bg-muted'
                  }`}>
                    <Clock className={`w-6 h-6 ${
                      myAttendanceStatus.checkedOut ? 'text-emerald-500' :
                      myAttendanceStatus.checkedIn ? 'text-amber-500' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      {myAttendanceStatus.checkedOut ? 'Sudah Absen Pulang' :
                       myAttendanceStatus.checkedIn ? 'Sudah Absen Masuk' : 'Belum Absen'}
                    </p>
                    {myAttendanceStatus.record && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {myAttendanceStatus.record.checkinTime && (
                          <span>Masuk: {new Date(myAttendanceStatus.record.checkinTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: schoolTimezone })}</span>
                        )}
                        {myAttendanceStatus.record.checkoutTime && (
                          <span className="ml-3">Pulang: {new Date(myAttendanceStatus.record.checkoutTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: schoolTimezone })}</span>
                        )}
                        <span className={`ml-3 inline-flex px-2 py-0.5 rounded-full text-2xs font-bold border ${
                          myAttendanceStatus.record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          myAttendanceStatus.record.status === 'LATE' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {myAttendanceStatus.record.status === 'PRESENT' ? 'Tepat Waktu' :
                           myAttendanceStatus.record.status === 'LATE' ? 'Terlambat' :
                           myAttendanceStatus.record.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!myAttendanceStatus.checkedIn && (
                    <button onClick={async () => {
                      try {
                        const res = await fetch('/api/teacher-attendance/checkin', { method: 'POST', headers: authHeader });
                        const result = await res.json();
                        if (!res.ok || !result.success) throw new Error(result.error);
                        refetchAttendance();
                        queryClient.invalidateQueries({ queryKey: ['myTeacherAttendance'] });
                      } catch (err: any) { alert(err.message); }
                    }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 text-xs font-bold transition-all">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Absen Masuk</span>
                    </button>
                  )}
                  {myAttendanceStatus.checkedIn && !myAttendanceStatus.checkedOut && (
                    <button onClick={async () => {
                      try {
                        const res = await fetch('/api/teacher-attendance/checkout', { method: 'POST', headers: authHeader });
                        const result = await res.json();
                        if (!res.ok || !result.success) throw new Error(result.error);
                        refetchAttendance();
                        queryClient.invalidateQueries({ queryKey: ['myTeacherAttendance'] });
                      } catch (err: any) { alert(err.message); }
                    }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 text-xs font-bold transition-all">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Absen Pulang</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Teacher Report: Date Range Filter */}
          <section className="bg-card/50 border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Laporan Absensi Saya</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tanggal Mulai</label>
                <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Tanggal Selesai</label>
                <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          </section>

          {/* Teacher Report: Teaching Schedule Attendance */}
          {teacherReportLoading ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm animate-pulse">
              Memuat laporan absensi...
            </div>
          ) : teacherReport ? (
            <>
              {/* Schedule Attendance Cards */}
              {teacherReport.schedules && teacherReport.schedules.length > 0 && (
                <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-6 py-5 border-b border-border flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Absensi Jadwal Mengajar</h2>
                    <span className="text-xs text-muted-foreground">{reportStartDate}{reportEndDate !== reportStartDate ? ` s/d ${reportEndDate}` : ''}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{teacherReport.schedules.length} jadwal</span>
                    <button onClick={handleExportTeacherCsv} title="Ekspor CSV"
                      className="ml-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold transition-all">
                      <FileDown className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teacherReport.schedules.map((sched: any) => {
                      const attended = sched.presentCount + sched.sickCount + sched.excusedCount + sched.dispensationCount;
                      const total = sched.totalStudents || 1;
                      return (
                        <div key={sched.scheduleId} onClick={() => handleOpenScheduleDetail(sched.scheduleId)}
                          className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-3 hover:border-primary/50 transition-all cursor-pointer hover:shadow-md">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-foreground text-sm">{sched.className}</div>
                              {sched.subject && <div className="text-xs text-muted-foreground mt-0.5">{sched.subject}</div>}
                            </div>
                            <span className="text-xs font-mono text-teal-400 font-bold shrink-0">{sched.startTime.slice(0, 5)}-{sched.endTime?.slice(0, 5)}</span>
                          </div>
                          <div className="flex gap-1.5 text-xs flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">{sched.presentCount} Hadir</span>
                            {sched.sickCount > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">{sched.sickCount} Sakit</span>}
                            {sched.excusedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-semibold">{sched.excusedCount} Izin</span>}
                            {sched.absentCount > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-semibold">{sched.absentCount} Alpa</span>}
                            {sched.dispensationCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">{sched.dispensationCount} Dispensasi</span>}
                            {sched.skippedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-semibold">{sched.skippedCount} Kosong</span>}
                          </div>
                          <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${Math.min((attended / total) * 100, 100)}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>{attended} dari {sched.totalStudents} siswa</span>
                            <span className="font-semibold">{Math.round((attended / total) * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Agenda Attendance Cards */}
              {teacherReport.agendas && teacherReport.agendas.length > 0 && (
                <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-6 py-5 border-b border-border flex items-center gap-3">
                    <ClipboardCheck className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Absensi Agenda</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{teacherReport.agendas.length} agenda</span>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teacherReport.agendas.map((ag: any) => {
                      const attended = ag.presentCount + ag.sickCount + ag.excusedCount + ag.dispensationCount;
                      const total = ag.totalStudents || 1;
                      return (
                        <div key={ag.agendaId} className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-3 hover:border-border transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-foreground text-sm">{ag.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{ag.className}</div>
                            </div>
                            {ag.agendaType && (
                              <span className="text-2xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold shrink-0">{agendaTypeLabel(ag.agendaType)}</span>
                            )}
                          </div>
                          <div className="flex gap-1.5 text-xs flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">{ag.presentCount} Hadir</span>
                            {ag.sickCount > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">{ag.sickCount} Sakit</span>}
                            {ag.excusedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-semibold">{ag.excusedCount} Izin</span>}
                            {ag.absentCount > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-semibold">{ag.absentCount} Alpa</span>}
                            {ag.dispensationCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">{ag.dispensationCount} Dispensasi</span>}
                          </div>
                          <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${Math.min((attended / total) * 100, 100)}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>{attended} dari {ag.totalStudents} siswa</span>
                            <span className="font-semibold">{Math.round((attended / total) * 100)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* No data state */}
              {(!teacherReport.schedules || teacherReport.schedules.length === 0) && (!teacherReport.agendas || teacherReport.agendas.length === 0) && (
                <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Tidak ada data absensi untuk periode ini.</p>
                  <p className="text-xs mt-2 opacity-60">Ubah rentang tanggal untuk melihat laporan.</p>
                </div>
              )}
            </>
              ) : null}

              {/* Schedule Detail Modal */}
              {scheduleDetail && !scheduleDetail.error && (
                <ModalShell onClose={() => setScheduleDetail(null)} title="Detail Absensi Jadwal">
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground text-xs uppercase">Kelas</span><div className="font-bold">{scheduleDetail.schedule?.className}</div></div>
                      <div><span className="text-muted-foreground text-xs uppercase">Mapel</span><div className="font-bold">{scheduleDetail.schedule?.subject || '-'}</div></div>
                      <div><span className="text-muted-foreground text-xs uppercase">Jam</span><div className="font-mono text-teal-400">{scheduleDetail.schedule?.startTime?.slice(0, 5)}-{scheduleDetail.schedule?.endTime?.slice(0, 5)}</div></div>
                      <div><span className="text-muted-foreground text-xs uppercase">Tanggal</span><div className="font-bold">{reportStartDate}</div></div>
                    </div>
                    {scheduleDetail.sessionLog && (
                      <div className="border-t border-border pt-4 space-y-3">
                        {scheduleDetail.sessionLog.materi && <div><span className="text-xs uppercase text-muted-foreground font-semibold">Materi</span><p className="text-sm mt-1">{scheduleDetail.sessionLog.materi}</p></div>}
                        {scheduleDetail.sessionLog.kegiatan && <div><span className="text-xs uppercase text-muted-foreground font-semibold">Kegiatan</span><p className="text-sm mt-1">{scheduleDetail.sessionLog.kegiatan}</p></div>}
                        {scheduleDetail.sessionLog.catatanKendala && <div><span className="text-xs uppercase text-muted-foreground font-semibold">Catatan / Kendala</span><p className="text-sm mt-1 whitespace-pre-wrap">{scheduleDetail.sessionLog.catatanKendala}</p></div>}
                        {scheduleDetail.sessionLog.fotoPembelajaran && (
                          <div><span className="text-xs uppercase text-muted-foreground font-semibold mb-2 block">Foto Pembelajaran</span>
                            <img src={scheduleDetail.sessionLog.fotoPembelajaran} alt="Foto Pembelajaran" className="rounded-xl border border-border max-h-48 object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border-t border-border pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Daftar Siswa ({scheduleDetail.students?.length || 0})</h4>
                      <div className="space-y-2">
                        {scheduleDetail.students?.map((s: any) => {
                          const statusColors: Record<string, string> = {
                            PRESENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                            SICK: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                            EXCUSED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                            ABSENT: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                            DISPEN: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                            SKIPPED: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
                          };
                          const labels: Record<string, string> = { PRESENT: 'Hadir', SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alpa', DISPEN: 'Dispensasi', SKIPPED: 'Kosong' };
                          return (
                            <div key={s.studentId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/5 border border-border/30">
                              <div>
                                <div className="text-sm font-semibold">{s.studentName}</div>
                                <div className="text-xs text-muted-foreground">{s.nis}</div>
                              </div>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColors[s.status] || 'bg-muted text-muted-foreground'}`}>
                                {labels[s.status] || s.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </ModalShell>
              )}
              {scheduleDetailLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                  <div className="bg-card rounded-2xl p-8 shadow-2xl animate-pulse text-muted-foreground text-sm">Memuat detail...</div>
                </div>
              )}
              {scheduleDetail?.error && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setScheduleDetail(null)}>
                  <div className="bg-card rounded-2xl p-6 shadow-2xl max-w-sm text-center space-y-3">
                    <p className="text-sm text-rose-500">{scheduleDetail.error}</p>
                    <button onClick={() => setScheduleDetail(null)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Tutup</button>
                  </div>
                </div>
              )}
            </>
      ) : (
        <>
          {/* Admin: Filter Panel */}
          <section className="card-surface p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal Absensi</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Kelas</label>
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                  <option value="">Semua Kelas</option>
                  {classesList.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bulan Rekap</label>
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                  <option value="">Pilih Bulan (Opsional)</option>
                  {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tahun Rekap</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                  <option value="">Pilih Tahun (Opsional)</option>
                  {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={handleResetFilters} className="btn-secondary">
                Reset Filter
              </button>
            </div>
          </section>

          {/* Admin: Attendance Log Table */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Log Riwayat Kehadiran Siswa</h2>
                <p className="text-xs text-muted-foreground mt-1">Ditemukan {reports.length} rekaman absensi cocok.</p>
              </div>
              <button onClick={handleExportCsv}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold transition-all">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor CSV</span>
              </button>
            </div>
            <div className="w-full">
              <DataTable
                columns={columns}
                data={reports}
                loading={reportsLoading}
                searchPlaceholder="Cari siswa atau kelas..."
                emptyText="Tidak ada data absensi yang ditemukan."
                initialRowsPerPage={10}
              />
            </div>
          </section>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          {/* Admin: Photo Preview Modal */}
          {previewPhoto && (
            <ModalShell title="Foto Bukti Selfie" onClose={() => { setPreviewPhoto(null); setPreviewDetails(null); }} maxWidth="md"
              footer={<button onClick={() => { setPreviewPhoto(null); setPreviewDetails(null); }} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Tutup</button>}>
              <img src={previewPhoto} alt="Preview Selfie" className="w-full rounded-xl border border-border" />
              {previewDetails && (
                <div className="bg-background rounded-xl p-4 space-y-2 text-xs border border-border">
                  <div className="flex justify-between"><span className="text-muted-foreground">Siswa</span><span className="text-foreground font-semibold">{previewDetails.student?.nis || '-'}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-bold ${
                      previewDetails.status === 'LATE' ? 'text-amber-500' :
                      previewDetails.status === 'PRESENT' ? 'text-emerald-500' :
                      previewDetails.status === 'SICK' ? 'text-blue-500' :
                      previewDetails.status === 'EXCUSED' ? 'text-purple-500' :
                      'text-rose-500'
                    }`}>
                      {previewDetails.status === 'PRESENT' ? 'TEPAT WAKTU' :
                       previewDetails.status === 'LATE' ? 'TERLAMBAT' :
                       previewDetails.status === 'SICK' ? 'SAKIT' :
                       previewDetails.status === 'EXCUSED' ? 'IZIN' :
                       previewDetails.status === 'ABSENT' ? 'ALFA' :
                        previewDetails.status}
                     </span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Jam Masuk</span><span className="text-foreground">{formatTimeString(previewDetails.checkinTime)}</span></div>
                  {previewDetails.checkoutTime && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Jam Pulang</span><span className="text-foreground">{formatTimeString(previewDetails.checkoutTime)}</span></div>
                  )}
                </div>
              )}
            </ModalShell>
          )}
        </>
      )}
    </>
  );
};
