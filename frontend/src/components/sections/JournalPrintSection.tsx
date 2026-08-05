import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, BookOpen, FileDown, CheckCircle, UserMinus, Activity, ShieldBan, Loader } from 'lucide-react';

interface Props {
  token: string;
  user: { name: string; role: string };
}

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
let autoTableFn: any = null;

export const JournalPrintSection: React.FC<Props> = ({ token, user }) => {
  const today = new Date();
  const thisYear = today.getFullYear();

  const [filterTeacher, setFilterTeacher] = useState('');
  const [startDate, setStartDate] = useState(`${thisYear}-01-01`);
  const [endDate, setEndDate] = useState(`${thisYear}-12-31`);
  const [generating, setGenerating] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const { data: teachersData } = useQuery({
    queryKey: ['teacherList2'],
    queryFn: async () => {
      const res = await fetch('/api/teacher-attendance/teachers', { headers: authHeader });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil data guru.');
      return data.data;
    },
    enabled: user.role === 'admin',
  });

  const { data: journalData, isPending: loading, error: loadError } = useQuery({
    queryKey: ['semesterJournal', filterTeacher || 'me', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (filterTeacher) params.set('teacherId', filterTeacher);
      const res = await fetch(`/api/teacher/semester-journal?${params.toString()}`, { headers: authHeader });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Gagal mengambil data jurnal.');
      return result.data;
    },
    enabled: user.role === 'guru' || (user.role === 'admin' && !!filterTeacher),
  });

  const stats = journalData?.stats || {};
  const entries = journalData?.entries || [];

  const groupByMonth = (entries: any[]) => {
    const groups: Record<string, any[]> = {};
    for (const e of entries) {
      const m = e.date.slice(0, 7);
      if (!groups[m]) groups[m] = [];
      groups[m].push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const monthGroups = groupByMonth(entries);

  const generateCoverPage = (doc: any, teacherName: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 60, 'F');
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BUKU JURNAL MENGAJAR', pageWidth / 2, 35, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('HadirQ - Sistem Absensi Sekolah', pageWidth / 2, 48, { align: 'center' });

    doc.setTextColor(55, 65, 81);
    doc.setFontSize(11);
    const lines = [
      '',
      '',
      '',
      `Nama Guru          : ${teacherName || '-'}`,
      `Periode              : ${new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} - ${new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      `Total Hari Mengajar : ${stats.totalDays || 0} hari`,
      `Total Jam Pelajaran : ${stats.totalSessions || 0} sesi`,
      `Total Hadir           : ${stats.totalPresent || 0} siswa`,
      `Total Sakit            : ${stats.totalSick || 0} siswa`,
      `Total Izin              : ${stats.totalExcused || 0} siswa`,
      `Total Alfa              : ${stats.totalAbsent || 0} siswa`,
    ];
    let y = 90;
    for (const line of lines) {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += 8;
    }

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    const sigY = pageHeight - 80;
    doc.line(40, sigY, 180, sigY);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Mengetahui,', 40, sigY - 5);
    doc.text('Kepala Sekolah', 40, sigY + 15);
    doc.text(`${teacherName || 'Guru'},`, 140, sigY - 5);
    doc.text('Guru Mata Pelajaran', 140, sigY + 15);
  };

  const generateContentPages = (doc: any) => {
    let pageNum = 0;
    for (const [monthKey, monthEntries] of monthGroups) {
      doc.addPage();

      const [year, month] = monthKey.split('-');
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`${monthNames[parseInt(month) - 1]} ${year}`, doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });

      let yPos = 30;

      for (const entry of monthEntries) {
        const d = new Date(entry.date + 'T00:00:00');
        const dayName = dayNames[d.getDay()];
        const dateStr = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;

        for (const sched of entry.schedules) {
          if (yPos > 250) {
            doc.addPage();
            pageNum++;
            yPos = 20;
          }

          doc.setDrawColor(79, 70, 229);
          doc.setFillColor(249, 250, 251);
          doc.rect(10, yPos, doc.internal.pageSize.getWidth() - 20, 16, 'F');
          doc.rect(10, yPos, doc.internal.pageSize.getWidth() - 20, 16, 'S');

          doc.setFontSize(9);
          doc.setTextColor(31, 41, 55);
          doc.setFont('helvetica', 'bold');
          doc.text(`${dateStr} (${dayName})`, 14, yPos + 5);
          doc.setFont('helvetica', 'normal');
          doc.text(`${sched.className} | ${sched.subject}`, 14, yPos + 13);
          doc.setFont('helvetica', 'bold');
          doc.text(`${sched.startTime?.slice(0, 5) || ''} - ${sched.endTime?.slice(0, 5) || ''}`, doc.internal.pageSize.getWidth() - 50, yPos + 5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Hadir: ${sched.presentCount} | Sakit: ${sched.sickCount} | Izin: ${sched.excusedCount} | Alfa: ${sched.absentCount} | Dispensasi: ${sched.dispensationCount || 0} | Tidak Diisi: ${sched.skippedCount || 0}`, doc.internal.pageSize.getWidth() - 105, yPos + 13);
          yPos += 20;

          if (sched.materi || sched.kegiatan || sched.catatanKendala) {
            if (yPos > 250) {
              doc.addPage();
              pageNum++;
              yPos = 20;
            }

            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            if (sched.materi) {
              doc.text(`Materi: ${sched.materi}`, 14, yPos);
              yPos += 5;
            }
            if (sched.kegiatan) {
              doc.text(`Kegiatan: ${sched.kegiatan}`, 14, yPos);
              yPos += 5;
            }
            if (sched.catatanKendala) {
              const lines = doc.splitTextToSize(`Catatan: ${sched.catatanKendala}`, doc.internal.pageSize.getWidth() - 28);
              doc.text(lines, 14, yPos);
              yPos += lines.length * 4 + 2;
            }
            yPos += 4;
          }
        }
      }
    }
  };

  const generateSummaryPage = (doc: any) => {
    doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('REKAPITULASI JURNAL MENGAJAR', pageWidth / 2, 14, { align: 'center' });

    const summaryRows = [
      ['Total Hari Mengajar', String(stats.totalDays || 0), 'hari'],
      ['Total Pertemuan (Jam Pelajaran)', String(stats.totalSessions || 0), 'sesi'],
      ['Total Kehadiran Siswa (Hadir)', String(stats.totalPresent || 0), 'siswa'],
      ['Total Sakit', String(stats.totalSick || 0), 'siswa'],
      ['Total Izin', String(stats.totalExcused || 0), 'siswa'],
      ['Total Alfa', String(stats.totalAbsent || 0), 'siswa'],
    ];

    autoTableFn(doc, {
      startY: 30,
      head: [['Keterangan', 'Jumlah', 'Satuan']],
      body: summaryRows,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(40, finalY, 180, finalY);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Mengetahui,', 40, finalY - 5);
    doc.text('Kepala Sekolah', 40, finalY + 15);
    doc.text(`${journalData?.teacher?.name || 'Guru'},`, 140, finalY - 5);
    doc.text('Guru Mata Pelajaran', 140, finalY + 15);
  };

  const handlePrintPdf = async () => {
    if (!journalData) return;
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTableMod: any = await import('jspdf-autotable');
      autoTableFn = autoTableMod.autoTable || autoTableMod.default;

      const doc = new jsPDF('p', 'mm', 'a4');
      generateCoverPage(doc, journalData.teacher?.name || '');
      generateContentPages(doc);
      generateSummaryPage(doc);
      doc.save(`buku-jurnal-${startDate}-${endDate}.pdf`);
    } catch (err: any) {
      alert('Gagal membuat PDF: ' + err.message);
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Cetak Buku Jurnal Mengajar Semester</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {user.role === 'admin' && (
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Guru</label>
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary">
                <option value="">Pilih Guru</option>
                {(teachersData || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal Mulai</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tanggal Selesai</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            {user.role === 'admin' && !filterTeacher && (
              <span className="text-xs text-amber-500 font-semibold self-center">Pilih guru terlebih dahulu</span>
            )}
            {(user.role === 'guru' || filterTeacher) && (
              <button onClick={handlePrintPdf} disabled={generating || loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 text-xs font-bold transition-all disabled:opacity-50">
                {generating ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span>{generating ? 'Membuat PDF...' : 'Cetak Buku Jurnal PDF'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {loadError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {(loadError as Error).message}
        </div>
      )}

      {loading && (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-sm animate-pulse">
          <Loader className="w-6 h-6 mx-auto mb-3 animate-spin" />
          Memuat data jurnal...
        </div>
      )}

      {journalData && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Hari', value: stats.totalDays, icon: <Calendar className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
              { label: 'Total Sesi', value: stats.totalSessions, icon: <BookOpen className="w-4 h-4" />, color: 'text-indigo-500 bg-indigo-500/10' },
              { label: 'Hadir', value: stats.totalPresent, icon: <CheckCircle className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-500/10' },
              { label: 'Sakit', value: stats.totalSick, icon: <Activity className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
              { label: 'Izin', value: stats.totalExcused, icon: <ShieldBan className="w-4 h-4" />, color: 'text-purple-500 bg-purple-500/10' },
              { label: 'Alfa', value: stats.totalAbsent, icon: <UserMinus className="w-4 h-4" />, color: 'text-rose-500 bg-rose-500/10' },
            ].map((card, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className={`w-8 h-8 mx-auto rounded-lg ${card.color} flex items-center justify-center mb-2`}>{card.icon}</div>
                <p className="text-2xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{card.value || 0}</p>
              </div>
            ))}
          </section>

          <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Preview Jurnal ({entries.length} hari, {stats.totalSessions} sesi)
              </h3>
            </div>
            <div className="p-5 max-h-[500px] overflow-y-auto space-y-4">
              {monthGroups.map(([monthKey, monthEntries]) => {
                const [year, month] = monthKey.split('-');
                return (
                  <div key={monthKey}>
                    <h4 className="text-sm font-bold text-foreground mb-2 sticky top-0 bg-card py-1">
                      {monthNames[parseInt(month) - 1]} {year}
                    </h4>
                    <div className="space-y-1.5">
                      {monthEntries.map((entry: any) => {
                        const d = new Date(entry.date + 'T00:00:00');
                        return (
                          <div key={entry.date} className="bg-muted/10 border border-border/30 rounded-lg p-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {d.getDate()} {monthNames[d.getMonth()]} ({dayNames[d.getDay()]})
                              </span>
                              <span className="text-muted-foreground">{entry.schedules?.length || 0} sesi</span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {entry.schedules?.map((s: any, i: number) => (
                                <div key={i} className="text-2xs text-muted-foreground flex flex-wrap gap-x-3">
                                  <span className="font-semibold text-foreground">{s.className} - {s.subject}</span>
                                  <span>{s.startTime?.slice(0, 5)}-{s.endTime?.slice(0, 5)}</span>
                                  <span className="text-emerald-500">Hadir: {s.presentCount}</span>
                                  {s.sickCount > 0 && <span className="text-blue-500">Sakit: {s.sickCount}</span>}
                                  {s.excusedCount > 0 && <span className="text-purple-500">Izin: {s.excusedCount}</span>}
                                  {s.absentCount > 0 && <span className="text-rose-500">Alfa: {s.absentCount}</span>}
                                  {s.dispensationCount > 0 && <span className="text-amber-500">Dispensasi: {s.dispensationCount}</span>}
                                  {s.skippedCount > 0 && <span className="text-muted-foreground">Tidak Diisi: {s.skippedCount}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};