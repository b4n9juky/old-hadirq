import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileSpreadsheet, FileDown, Users, CheckCircle, Clock, UserMinus, Activity, ShieldBan } from 'lucide-react';
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

export const RecapSection: React.FC<Props> = ({ token }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = String(new Date().getMonth() + 1);
  const currentYear = String(new Date().getFullYear());

  const [recapType, setRecapType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [filterClass, setFilterClass] = useState('');
  const [filterDate, setFilterDate] = useState(todayStr);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  const authHeader = { Authorization: `Bearer ${token}` };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('type', recapType);
    if (filterClass) params.set('classId', filterClass);

    if (recapType === 'daily') {
      params.set('date', filterDate);
    } else if (recapType === 'weekly') {
      params.set('date', filterDate);
    } else if (recapType === 'monthly') {
      params.set('month', filterMonth);
      params.set('year', filterYear);
    }
    return params.toString();
  };

  const { data: recapData, isPending: recapLoading } = useQuery({
    queryKey: ['recapReport', recapType, filterClass, filterDate, filterMonth, filterYear],
    queryFn: async () => {
      const qs = buildQueryParams();
      const res = await fetch(`/api/reports/recap?${qs}`, { headers: authHeader });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal mengambil data rekap.');
      return result.data;
    },
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

  const summary = recapData?.summary || { totalStudents: 0, presentCount: 0, lateCount: 0, sickCount: 0, excusedCount: 0, absentCount: 0 };
  const students = recapData?.students || [];
  const dailyRecap = recapData?.dailyRecap || {};

  const getWeekRange = () => {
    const base = filterDate ? new Date(filterDate) : new Date();
    const day = base.getDay();
    const mon = new Date(base);
    mon.setDate(base.getDate() - ((day + 6) % 7));
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    return `${mon.toLocaleDateString('id-ID')} - ${sat.toLocaleDateString('id-ID')}`;
  };

  const getMonthName = () => {
    return months.find(m => m.value === filterMonth)?.label || '';
  };

  const recapTitle = recapType === 'daily' ? `Harian - ${new Date(filterDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    : recapType === 'weekly' ? `Mingguan - ${getWeekRange()}`
    : `Bulanan - ${getMonthName()} ${filterYear}`;

  const allRecords = students.flatMap((s: any) =>
    (s.records || []).map((r: any) => ({
      ...r,
      nis: s.nis,
      name: s.name,
      className: s.className,
    }))
  );

  const columns = [
    { key: 'name', header: 'Nama', render: (row: any) => (
      <div>
        <div className="font-semibold text-foreground text-xs">{row.name}</div>
        <div className="text-2xs text-muted-foreground">{row.nis} | {row.className}</div>
      </div>
    )},
    { key: 'date', header: 'Tanggal', render: (row: any) => {
      const d = new Date(row.date + 'T00:00:00');
      return <span className="text-xs text-foreground">{d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>;
    }},
    { key: 'checkinTime', header: 'Jam Datang', render: (row: any) => (
      <span className="text-xs font-mono">{row.checkinTime ? row.checkinTime.slice(0, 5) : '-'}</span>
    )},
    { key: 'checkoutTime', header: 'Jam Pulang', render: (row: any) => (
      <span className="text-xs font-mono">{row.checkoutTime ? row.checkoutTime.slice(0, 5) : '-'}</span>
    )},
    { key: 'status', header: 'Status', align: 'center' as const, render: (row: any) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-bold border ${statusColors[row.status] || 'bg-muted text-muted-foreground'}`}>
        {statusLabels[row.status] || row.status}
      </span>
    )},
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
    const header = 'Tanggal,NIS,Nama,Kelas,Jam Datang,Jam Pulang,Status';
    const rows = allRecords.map((r: any) =>
      `${r.date},${r.nis},${r.name},${r.className},${r.checkinTime?.slice(0, 5) || '-'},${r.checkoutTime?.slice(0, 5) || '-'},${statusLabels[r.status] || r.status}`
    ).join('\n');
    downloadCsv(`${header}\n${rows}`, `rekap-${recapType}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTableMod: any = await import('jspdf-autotable');
    const autoTable = autoTableMod.autoTable || autoTableMod.default;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Rekap Absensi Siswa', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${recapTitle}`, pageWidth / 2, 22, { align: 'center' });
    if (filterClass) {
      const cls = classesData?.find((c: any) => String(c.id) === filterClass);
      if (cls) doc.text(`Kelas: ${cls.name}`, pageWidth / 2, 28, { align: 'center' });
    }

    const summaryData = [
      ['Total Siswa', String(summary.totalStudents)],
      ['Tepat Waktu', String(summary.presentCount)],
      ['Terlambat', String(summary.lateCount)],
      ['Sakit', String(summary.sickCount)],
      ['Izin', String(summary.excusedCount)],
      ['Alfa', String(summary.absentCount)],
    ];

    autoTable(doc, {
      startY: 32,
      head: [['Keterangan', 'Jumlah']],
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const dayKeys = Object.keys(dailyRecap).sort();
    const pdfColumns = ['NIS', 'Nama', 'Kelas'];
    pdfColumns.push(...dayKeys.map(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    }));

    const pdfBody = students.map((s: any) => {
      const recordMap = new Map((s.records || []).map((r: any) => [r.date, r]));
      const row: string[] = [s.nis, s.name, s.className];
      for (const d of dayKeys) {
        const rec: any = recordMap.get(d);
        row.push(rec ? statusLabels[rec.status] || rec.status : '-');
      }
      return row;
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: finalY,
      head: [pdfColumns],
      body: pdfBody,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 0: { cellWidth: 20 } },
    });

    doc.save(`rekap-${recapType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Rekap Jurnal Mengajar & Absensi</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4 mb-4">
          {(['daily' as const, 'weekly' as const, 'monthly' as const]).map((type) => (
            <button key={type} onClick={() => setRecapType(type)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                recapType === type
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground border border-input'
              }`}>
              {type === 'daily' ? 'Harian' : type === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Kelas</label>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
              <option value="">Semua Kelas</option>
              {(classesData || []).map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
          </div>

          {recapType === 'daily' && (
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
            </div>
          )}

          {recapType === 'weekly' && (
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal (dalam minggu ini)</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
            </div>
          )}

          {recapType === 'monthly' && (
            <>
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
            </>
          )}

          <div className="flex items-center gap-2">
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
      </section>

      <section className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Siswa', value: summary.totalStudents, icon: <Users className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Tepat Waktu', value: summary.presentCount, icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Terlambat', value: summary.lateCount, icon: <Clock className="w-4 h-4" />, color: 'text-amber-500 bg-amber-500/10' },
          { label: 'Sakit', value: summary.sickCount, icon: <Activity className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Izin', value: summary.excusedCount, icon: <ShieldBan className="w-4 h-4" />, color: 'text-purple-500 bg-purple-500/10' },
          { label: 'Alfa', value: summary.absentCount, icon: <UserMinus className="w-4 h-4" />, color: 'text-rose-500 bg-rose-500/10' },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`w-8 h-8 mx-auto rounded-lg ${card.color} flex items-center justify-center mb-2`}>{card.icon}</div>
            <p className="text-2xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{recapLoading ? '...' : card.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Detail Rekap: {recapTitle}
          </h3>
          <span className="ml-auto text-2xs text-muted-foreground">{allRecords.length} record</span>
        </div>
        <DataTable
          columns={columns}
          data={allRecords}
          loading={recapLoading}
          searchPlaceholder="Cari siswa..."
          emptyText="Tidak ada data untuk periode ini."
          initialRowsPerPage={15}
        />
      </section>
    </div>
  );
};