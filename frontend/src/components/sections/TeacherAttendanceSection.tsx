import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Users, FileSpreadsheet, FileDown } from 'lucide-react';
import { DataTable } from '../shared/DataTable';

interface Props {
  token: string;
}

const months = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' }, { value: '3', label: 'Maret' },
  { value: '4', label: 'April' }, { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' }, { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' }, { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

const statusLabels: Record<string, string> = {
  PRESENT: 'Tepat Waktu', LATE: 'Terlambat',
  SICK: 'Sakit', EXCUSED: 'Izin', ABSENT: 'Alfa',
};

const statusColors: Record<string, string> = {
  PRESENT: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  LATE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  SICK: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  EXCUSED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ABSENT: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

export const TeacherAttendanceSection: React.FC<Props> = ({ token }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = String(new Date().getMonth() + 1);
  const currentYear = String(new Date().getFullYear());

  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [showFilter, setShowFilter] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };
  const queryClient = useQueryClient();

  const { data: teachersData } = useQuery({
    queryKey: ['teacherAttendanceTeachers'],
    queryFn: async () => {
      const res = await fetch('/api/teacher-attendance/teachers', { headers: authHeader });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal mengambil data guru.');
      return result.data;
    },
  });

  const { data: reportData, isPending: loading } = useQuery({
    queryKey: ['teacherAttendanceReport', filterTeacher, filterDate, filterMonth, filterYear, showFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('date', filterDate);
      params.set('month', filterMonth);
      params.set('year', filterYear);
      if (filterTeacher) params.set('teacherId', filterTeacher);
      const res = await fetch(`/api/teacher-attendance/report?${params.toString()}`, { headers: authHeader });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengambil laporan.');
      return result.data;
    },
  });

  const records = reportData?.records || [];
  const summary = reportData?.summary || [];

  const columns = [
    {
      key: 'teacher',
      header: 'Guru',
      render: (row: any) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{row.teacherName}</div>
          <div className="text-2xs text-muted-foreground">{row.teacherEmail}</div>
        </div>
      ),
    },
    {
      key: 'attendanceDate',
      header: 'Tanggal',
      render: (row: any) => {
        const d = new Date(row.attendanceDate + 'T00:00:00');
        return <span className="text-xs">{d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>;
      },
    },
    {
      key: 'checkinTime',
      header: 'Jam Masuk',
      render: (row: any) => <span className="text-xs font-mono">{row.checkinTime ? row.checkinTime.slice(0, 5) : '-'}</span>,
    },
    {
      key: 'checkoutTime',
      header: 'Jam Pulang',
      render: (row: any) => <span className="text-xs font-mono">{row.checkoutTime ? row.checkoutTime.slice(0, 5) : '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center' as const,
      render: (row: any) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold border ${statusColors[row.status] || ''}`}>
          {statusLabels[row.status] || row.status}
        </span>
      ),
    },
    {
      key: 'isVerified',
      header: 'Verifikasi',
      align: 'center' as const,
      render: (row: any) => (
        row.isVerified ? (
          <span className="text-2xs font-bold text-emerald-500">Terverifikasi</span>
        ) : (
          <button onClick={async () => {
            try {
              const res = await fetch(`/api/teacher-attendance/${row.id}/verify`, { method: 'PUT', headers: authHeader });
              const result = await res.json();
              if (!res.ok || !result.success) throw new Error(result.error);
              queryClient.invalidateQueries({ queryKey: ['teacherAttendanceReport'] });
            } catch (err: any) { alert(err.message); }
          }}
            className="text-2xs font-bold text-amber-500 hover:text-amber-400 underline">
            Verifikasi
          </button>
        )
      ),
    },
  ];

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
    const header = 'Tanggal,Nama Guru,Email,Jam Masuk,Jam Pulang,Status,Verifikasi';
    const rows = records.map((r: any) =>
      `${r.attendanceDate},${r.teacherName},${r.teacherEmail},${r.checkinTime?.slice(0, 5) || '-'},${r.checkoutTime?.slice(0, 5) || '-'},${statusLabels[r.status] || r.status},${r.isVerified ? 'Ya' : 'Tidak'}`
    ).join('\n');
    downloadCsv(`${header}\n${rows}`, `rekap-absensi-guru-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTableMod: any = await import('jspdf-autotable');
    const autoTable = autoTableMod.autoTable || autoTableMod.default;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Rekap Absensi Guru', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${new Date(filterDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 22, { align: 'center' });

    autoTable(doc, {
      startY: 28,
      head: [['Nama Guru', 'Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Verifikasi']],
      body: records.map((r: any) => [
        r.teacherName,
        new Date(r.attendanceDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
        r.checkinTime?.slice(0, 5) || '-',
        r.checkoutTime?.slice(0, 5) || '-',
        statusLabels[r.status] || r.status,
        r.isVerified ? 'Ya' : 'Tidak',
      ]),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`rekap-absensi-guru-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Absensi Kehadiran Guru</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-input text-muted-foreground hover:text-foreground text-xs font-bold transition-all">
              <Calendar className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>
            <button onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold transition-all">
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Guru</label>
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                <option value="">Semua Guru</option>
                {(teachersData || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bulan</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tahun</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                {[2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      {summary.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {summary.map((s: any, i: number) => {
            const total = s.presentCount + s.lateCount + s.sickCount + s.excusedCount + s.absentCount;
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-foreground truncate">{s.teacherName}</p>
                <p className="text-2xs text-muted-foreground mt-1">{total} hari</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{s.presentCount} H</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">{s.lateCount} T</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{s.sickCount} S</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">{s.excusedCount} I</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">{s.absentCount} A</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Detail Absensi Guru</h3>
          <span className="ml-auto text-2xs text-muted-foreground">{records.length} record</span>
        </div>
        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          searchPlaceholder="Cari guru..."
          emptyText="Belum ada data absensi guru."
          initialRowsPerPage={15}
        />
      </section>
    </div>
  );
};