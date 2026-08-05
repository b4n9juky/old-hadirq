import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ArrowLeft, BookOpen, Calendar, Clock, CheckSquare, ImagePlus } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ModalShell } from '../shared/ModalShell';
import { FormSelect } from '../shared/FormField';
import { TimePicker } from '../shared/TimePicker';
import { useAttendanceSound } from '../../hooks/useAttendanceSound';
import { DAY_LABELS } from '../../utils/days';

interface ScheduleRecord {
  id: number;
  classId: number;
  className: string;
  dayName: string;
  startTime: string;
  endTime: string;
  subject: string;
}

interface ClassRecord { id: number; name: string; }
interface SubjectRecord { id: number; name: string; }

interface JurnalStudent {
  studentId: number;
  nis: string;
  studentName: string;
  status: string;
  notes: string;
}

interface JurnalScheduleInfo {
  id: number;
  classId: number;
  className: string;
  subject: string;
  startTime: string;
  endTime: string;
  dayName: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STATUS_LIST = ['PRESENT', 'SICK', 'EXCUSED', 'ABSENT'];
const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Hadir',
  SICK: 'Sakit',
  EXCUSED: 'Izin',
  ABSENT: 'Alfa',
};
const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-teal-500/15 text-teal-400 border-teal-500/40',
  SICK: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  EXCUSED: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  ABSENT: 'bg-red-500/15 text-red-400 border-red-500/40',
};

interface Props { token: string; }

export const TeacherScheduleSection: React.FC<Props> = ({ token }) => {
  const authHeader = { 'Authorization': `Bearer ${token}` };
  const [list, setList] = useState<ScheduleRecord[]>([]);
  const [classesList, setClassesList] = useState<ClassRecord[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const { playAttendanceSound } = useAttendanceSound();
  const triggerToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleRecord | null>(null);
  const [formClassId, setFormClassId] = useState('');
  const [formDay, setFormDay] = useState('Monday');
  const [formStart, setFormStart] = useState('07:00:00');
  const [formEnd, setFormEnd] = useState('08:30:00');
  const [formSubject, setFormSubject] = useState('');
  const [formError, setFormError] = useState('');

  const [jurnalSchedule, setJurnalSchedule] = useState<JurnalScheduleInfo | null>(null);
  const [jurnalDate, setJurnalDate] = useState(new Date().toISOString().split('T')[0]);
  const [jurnalStudents, setJurnalStudents] = useState<JurnalStudent[]>([]);
  const [jurnalLoading, setJurnalLoading] = useState(false);
  const [jurnalSaving, setJurnalSaving] = useState(false);
  const [jurnalMateri, setJurnalMateri] = useState('');
  const [jurnalKegiatan, setJurnalKegiatan] = useState('');
  const [jurnalCatatanKendala, setJurnalCatatanKendala] = useState('');
  const [jurnalFoto, setJurnalFoto] = useState<File | null>(null);
  const [jurnalExistingFoto, setJurnalExistingFoto] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const [resSched, resClasses, resSubjects] = await Promise.all([
        fetch('/api/teacher/my-schedules', { headers: authHeader }),
        fetch('/api/classes', { headers: authHeader }),
        fetch('/api/subjects', { headers: authHeader }),
      ]);
      const dSched = await resSched.json(); if (dSched.success) setList(dSched.data);
      const dClasses = await resClasses.json(); if (dClasses.success) setClassesList(dClasses.data);
      const dSubjects = await resSubjects.json(); if (dSubjects.success) setSubjectsList(dSubjects.data);
    } catch { /* ignore */ } finally { setListLoading(false); }
  }, [token]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openAdd = () => {
    setEditItem(null);
    setFormClassId(classesList.length > 0 ? String(classesList[0].id) : '');
    setFormDay('Monday');
    setFormStart('07:00:00');
    setFormEnd('08:30:00');
    setFormSubject(subjectsList.length > 0 ? subjectsList[0].name : '');
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: ScheduleRecord) => {
    setEditItem(item);
    setFormClassId(String(item.classId));
    setFormDay(item.dayName);
    setFormStart(item.startTime);
    setFormEnd(item.endTime);
    setFormSubject(item.subject);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formClassId || !formStart || !formEnd) {
      setFormError('Semua field wajib diisi.');
      return;
    }
    try {
      const body = { classId: Number(formClassId), dayName: formDay, startTime: formStart, endTime: formEnd, subject: formSubject };
      const url = editItem ? `/api/teacher/my-schedules/${editItem.id}` : '/api/teacher/my-schedules';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(editItem ? 'Jadwal berhasil diperbarui!' : 'Jadwal berhasil dibuat!');
        setShowModal(false);
        fetchList();
      } else throw new Error(data.error || 'Gagal menyimpan jadwal.');
    } catch (err: unknown) { setFormError(err instanceof Error ? err.message : 'Gagal menyimpan jadwal.'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal mengajar ini?')) return;
    try {
      const res = await fetch(`/api/teacher/my-schedules/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Jadwal berhasil dihapus.'); fetchList(); }
      else throw new Error(data.error || 'Gagal menghapus jadwal.');
    } catch (err: unknown) { setToastMsg(err instanceof Error ? err.message : 'Gagal menghapus jadwal.'); }
  };

  const openJurnal = async (schedule: ScheduleRecord) => {
    setJurnalSchedule({
      id: schedule.id,
      classId: schedule.classId,
      className: schedule.className,
      subject: schedule.subject,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      dayName: schedule.dayName,
    });
    setJurnalDate(new Date().toISOString().split('T')[0]);
    setJurnalMateri('');
    setJurnalKegiatan('');
    setJurnalCatatanKendala('');
    setJurnalFoto(null);
    setJurnalExistingFoto(null);
    setJurnalLoading(true);

    try {
      const res = await fetch(`/api/subject-attendances/schedule/${schedule.id}/date/${new Date().toISOString().split('T')[0]}`, { headers: authHeader });
      const data = await res.json();
      if (data.success) {
        setJurnalStudents(data.data.students);
        if (data.data.sessionLog) {
          setJurnalMateri(data.data.sessionLog.materi || '');
          setJurnalKegiatan(data.data.sessionLog.kegiatan || '');
          setJurnalCatatanKendala(data.data.sessionLog.catatanKendala || '');
          setJurnalExistingFoto(data.data.sessionLog.fotoPembelajaran || null);
        }
      } else throw new Error(data.error || 'Gagal memuat data.');
    } catch (err: unknown) {
      triggerToast(err instanceof Error ? err.message : 'Gagal memuat data jurnal.');
      setJurnalSchedule(null);
    } finally { setJurnalLoading(false); }
  };

  const closeJurnal = () => {
    setJurnalSchedule(null);
    setJurnalStudents([]);
    setJurnalMateri('');
    setJurnalKegiatan('');
    setJurnalCatatanKendala('');
    setJurnalFoto(null);
    setJurnalExistingFoto(null);
  };

  const toggleStudentStatus = (studentId: number, status: string) => {
    setJurnalStudents(prev =>
      prev.map(s =>
        s.studentId === studentId
          ? { ...s, status: s.status === status ? 'ABSENT' : status }
          : s
      )
    );
  };

  const updateStudentNotes = (studentId: number, notes: string) => {
    setJurnalStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, notes } : s));
  };

  const handleSaveJurnal = async () => {
    if (!jurnalSchedule) return;
    setJurnalSaving(true);
    try {
      const entries = jurnalStudents.map(s => ({
        studentId: s.studentId,
        status: s.status,
        notes: s.notes || undefined,
      }));

      const formData = new FormData();
      formData.append('scheduleId', String(jurnalSchedule.id));
      formData.append('date', jurnalDate);
      formData.append('entries', JSON.stringify(entries));
      if (jurnalMateri) formData.append('materi', jurnalMateri);
      if (jurnalKegiatan) formData.append('kegiatan', jurnalKegiatan);
      if (jurnalCatatanKendala) formData.append('catatanKendala', jurnalCatatanKendala);
      if (jurnalFoto) formData.append('fotoPembelajaran', jurnalFoto);

      const res = await fetch('/api/subject-attendances', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(data.message);
        playAttendanceSound(true, data.message);
        closeJurnal();
      } else throw new Error(data.error || 'Gagal menyimpan jurnal.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan jurnal.';
      triggerToast(message);
      playAttendanceSound(false, message);
    } finally { setJurnalSaving(false); }
  };

  const handleJurnalDateChange = async (newDate: string) => {
    setJurnalDate(newDate);
    if (!jurnalSchedule) return;
    setJurnalLoading(true);
    try {
      const res = await fetch(`/api/subject-attendances/schedule/${jurnalSchedule.id}/date/${newDate}`, { headers: authHeader });
      const data = await res.json();
      if (data.success) {
        setJurnalStudents(data.data.students);
        if (data.data.sessionLog) {
          setJurnalMateri(data.data.sessionLog.materi || '');
          setJurnalKegiatan(data.data.sessionLog.kegiatan || '');
          setJurnalCatatanKendala(data.data.sessionLog.catatanKendala || '');
          setJurnalExistingFoto(data.data.sessionLog.fotoPembelajaran || null);
        } else {
          setJurnalMateri('');
          setJurnalKegiatan('');
          setJurnalCatatanKendala('');
          setJurnalExistingFoto(null);
        }
        setJurnalFoto(null);
      }
    } catch { /* ignore */ } finally { setJurnalLoading(false); }
  };

  const grouped = DAYS.map(day => ({ day, items: list.filter(s => s.dayName === day) }));
  const daysIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = daysIndonesian[new Date().getDay()];

  const jurnalStatusCounts = {
    PRESENT: jurnalStudents.filter(s => s.status === 'PRESENT').length,
    SICK: jurnalStudents.filter(s => s.status === 'SICK').length,
    EXCUSED: jurnalStudents.filter(s => s.status === 'EXCUSED').length,
    ABSENT: jurnalStudents.filter(s => s.status === 'ABSENT').length,
  };

  if (jurnalSchedule) {
    return (
      <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
        <div className="px-6 py-5 border-b border-border flex flex-wrap items-center gap-3">
          <button onClick={closeJurnal} className="p-2 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Kembali ke daftar jadwal">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground">Jurnal Mengajar</h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{jurnalSchedule.className}</span>
              {jurnalSchedule.subject && <span className="text-teal-400">{jurnalSchedule.subject}</span>}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{DAY_LABELS[jurnalSchedule.dayName]}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{jurnalSchedule.startTime.slice(0, 5)} - {jurnalSchedule.endTime.slice(0, 5)}</span>
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Tanggal:</label>
              <input
                type="date"
                value={jurnalDate}
                onChange={e => handleJurnalDateChange(e.target.value)}
                className="bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Materi Pembelajaran</label>
              <input
                type="text"
                value={jurnalMateri}
                onChange={e => setJurnalMateri(e.target.value)}
                placeholder="Tulis materi yang diajarkan..."
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Kegiatan</label>
              <input
                type="text"
                value={jurnalKegiatan}
                onChange={e => setJurnalKegiatan(e.target.value)}
                placeholder="Deskripsi kegiatan pembelajaran..."
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Catatan / Kendala</label>
              <textarea
                value={jurnalCatatanKendala}
                onChange={e => setJurnalCatatanKendala(e.target.value)}
                placeholder="Catatan atau kendala selama pembelajaran..."
                rows={3}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Foto Pembelajaran</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50">
                  <ImagePlus className="w-4 h-4" />
                  {jurnalFoto ? jurnalFoto.name : 'Pilih Foto'}
                  <input type="file" accept="image/*" onChange={e => setJurnalFoto(e.target.files?.[0] || null)} className="hidden" />
                </label>
                {jurnalFoto && (
                  <button onClick={() => setJurnalFoto(null)} className="text-xs text-destructive hover:underline">Hapus</button>
                )}
                {!jurnalFoto && jurnalExistingFoto && (
                  <span className="text-xs text-muted-foreground">Foto tersimpan</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4">
            <div className="flex flex-wrap gap-3 mb-4">
              {STATUS_LIST.map(st => (
                <span key={st} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[st]}`}>
                  {STATUS_LABELS[st]}: {jurnalStatusCounts[st as keyof typeof jurnalStatusCounts]}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-teal-400" />
                Daftar Siswa ({jurnalStudents.length})
              </h3>
              <button
                onClick={handleSaveJurnal}
                disabled={jurnalSaving}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-xs transition-all"
              >
                {jurnalSaving ? 'Menyimpan...' : 'Simpan Jurnal'}
              </button>
            </div>

            {jurnalLoading ? <LoadingSpinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-semibold w-10">No</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-semibold">NIS</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-semibold">Nama</th>
                      <th className="text-center py-3 px-2 text-muted-foreground font-semibold">Status</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-semibold">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {jurnalStudents.map((s, idx) => (
                      <tr key={s.studentId} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-2 font-mono text-muted-foreground">{s.nis}</td>
                        <td className="py-2.5 px-2 font-semibold text-foreground">{s.studentName}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex justify-center gap-1">
                            {STATUS_LIST.map(st => (
                              <button
                                key={st}
                                onClick={() => toggleStudentStatus(s.studentId, st)}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                                  s.status === st
                                    ? STATUS_COLORS[st]
                                    : 'bg-transparent text-muted-foreground border-transparent hover:border-border/50 hover:text-foreground'
                                }`}
                              >
                                {STATUS_LABELS[st]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={s.notes}
                            onChange={e => updateStudentNotes(s.studentId, e.target.value)}
                            placeholder="..."
                            className="w-24 bg-background border border-input rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {toastMsg && <div className="fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce"><span>{toastMsg}</span></div>}
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Jadwal Mengajar Saya</h2>
          <p className="text-xs text-muted-foreground mt-1">Kelola jadwal dan isi jurnal mengajar — {todayName}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
          <Plus className="w-4 h-4" /><span>Tambah Jadwal</span>
        </button>
      </div>
      <div className="p-6">
        {listLoading ? <LoadingSpinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {grouped.map(({ day, items }) => (
              <div key={day} className="bg-muted/10 rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 bg-muted/20 border-b border-border/50 font-bold text-xs text-foreground uppercase tracking-wider">
                  {DAY_LABELS[day]}
                </div>
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">Tidak ada jadwal</div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {items.map(s => (
                      <div key={s.id} className="px-4 py-3 space-y-2 hover:bg-muted/10 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{s.className}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEdit(s)}
                              className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit jadwal"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive/80 transition-colors" aria-label="Hapus jadwal"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-primary">{s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}</span>
                            {s.subject && <><span className="text-muted-foreground">|</span><span className="text-muted-foreground truncate max-w-[80px]">{s.subject}</span></>}
                          </div>
                        </div>
                        <button
                          onClick={() => openJurnal(s)}
                          className="w-full py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Jurnal
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {toastMsg && <div className="fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce"><span>{toastMsg}</span></div>}

      {showModal && (
        <ModalShell title={editItem ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'} onClose={() => setShowModal(false)} maxWidth="md"
          footer={<>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button type="submit" form="teacherSchedForm" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">{editItem ? 'Simpan Perubahan' : 'Simpan'}</button>
          </>}>
          <form id="teacherSchedForm" onSubmit={handleSubmit} className="space-y-4">
            <FormSelect label="Kelas" value={formClassId} onChange={e => setFormClassId(e.target.value)} placeholder="-- Pilih Kelas --" options={classesList.map(c => ({ value: String(c.id), label: c.name }))} />
            <FormSelect label="Hari" value={formDay} onChange={e => setFormDay(e.target.value)} options={DAYS.map(d => ({ value: d, label: DAY_LABELS[d] }))} />
            <div className="grid grid-cols-2 gap-4">
              <TimePicker label="Jam Mulai" value={formStart} onChange={setFormStart} required />
              <TimePicker label="Jam Selesai" value={formEnd} onChange={setFormEnd} required />
            </div>
            <FormSelect label="Mata Pelajaran" value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="-- Pilih Mata Pelajaran --" options={subjectsList.map(s => ({ value: s.name, label: s.name }))} />
            {formError && <div className="text-destructive text-xs">{formError}</div>}
          </form>
        </ModalShell>
      )}
    </section>
  );
};
