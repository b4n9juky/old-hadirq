import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet, RefreshCw, Download } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ModalShell } from '../shared/ModalShell';
import { FormSelect } from '../shared/FormField';
import { TimePicker } from '../shared/TimePicker';
import { DAY_LABELS } from '../../utils/days';

interface ScheduleRecord {
  id: number;
  teacherId: string;
  teacherName: string;
  classId: number;
  className: string;
  dayName: string;
  startTime: string;
  endTime: string;
  subject: string;
}

interface ClassRecord { id: number; name: string; }
interface TeacherRecord { id: string; name: string; email: string; role: string; }
interface SubjectRecord { id: number; name: string; }

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props { token: string; }

export const TeachingScheduleSection: React.FC<Props> = ({ token }) => {
  const authHeader = { 'Authorization': `Bearer ${token}` };
  const [list, setList] = useState<ScheduleRecord[]>([]);
  const [classesList, setClassesList] = useState<ClassRecord[]>([]);
  const [teachersList, setTeachersList] = useState<TeacherRecord[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const triggerToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleRecord | null>(null);
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formDay, setFormDay] = useState('Monday');
  const [formStart, setFormStart] = useState('07:00:00');
  const [formEnd, setFormEnd] = useState('08:30:00');
  const [formSubject, setFormSubject] = useState('');
  const [formError, setFormError] = useState('');

  // Import Excel state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ teacher: string; class: string; day: string; start: string; end: string; subject: string }[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; results: any[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const [resSched, resClasses, resUsers, resSubjects] = await Promise.all([
        fetch('/api/teaching-schedules', { headers: authHeader }),
        fetch('/api/classes', { headers: authHeader }),
        fetch('/api/users', { headers: authHeader }),
        fetch('/api/subjects', { headers: authHeader }),
      ]);
      const dSched = await resSched.json(); if (dSched.success) setList(dSched.data);
      const dClasses = await resClasses.json(); if (dClasses.success) setClassesList(dClasses.data);
      const dUsers = await resUsers.json(); if (dUsers.success) setTeachersList(dUsers.data.filter((u: TeacherRecord) => u.role === 'guru'));
      const dSubjects = await resSubjects.json(); if (dSubjects.success) setSubjectsList(dSubjects.data);
    } catch { /* ignore */ } finally { setListLoading(false); }
  }, [token]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { if (toastMsg) { const t = setTimeout(() => setToastMsg(''), 4000); return () => clearTimeout(t); } }, [toastMsg]);

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setImportFile(null); setImportPreview([]); return; }
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        if (!XLSX) { setImportPreview([{ teacher: '(muat ulang untuk preview)', class: '', day: '', start: '', end: '', subject: '' }]); return; }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        const keys = json.length > 0 ? Object.keys(json[0]) : [];
        const teacherKey = keys.find(k => ['teacher', 'guru', 'email guru', 'nama guru', 'teacheremailorname'].includes(k.toLowerCase().trim())) || 'teacher';
        const classKey = keys.find(k => ['class', 'kelas', 'classname'].includes(k.toLowerCase().trim())) || 'class';
        const dayKey = keys.find(k => ['day', 'hari', 'dayname'].includes(k.toLowerCase().trim())) || 'day';
        const startKey = keys.find(k => ['start', 'start time', 'mulai', 'jam mulai', 'starttime'].includes(k.toLowerCase().trim())) || 'start';
        const endKey = keys.find(k => ['end', 'end time', 'selesai', 'jam selesai', 'endtime'].includes(k.toLowerCase().trim())) || 'end';
        const subjectKey = keys.find(k => ['subject', 'mata pelajaran', 'mapel'].includes(k.toLowerCase().trim())) || 'subject';

        const preview = json.slice(0, 5).map((r: any) => ({
          teacher: String(r[teacherKey] || ''),
          class: String(r[classKey] || ''),
          day: String(r[dayKey] || ''),
          start: String(r[startKey] || ''),
          end: String(r[endKey] || ''),
          subject: String(r[subjectKey] || ''),
        }));
        setImportPreview(preview);
      } catch { setImportPreview([{ teacher: '(gagal baca preview)', class: '', day: '', start: '', end: '', subject: '' }]); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/teaching-schedules/import', { method: 'POST', headers: authHeader, body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult(data.data);
        triggerToast(`Import selesai: ${data.data.imported} sukses, ${data.data.failed} gagal`);
        fetchList();
      } else throw new Error(data.error || 'Gagal import data.');
    } catch (err: any) { setErrorMsg(err.message); } finally { setImportLoading(false); }
  };

  const openAdd = () => {
    setEditItem(null);
    setFormTeacherId(teachersList.length > 0 ? teachersList[0].id : '');
    setFormClassId(classesList.length > 0 ? String(classesList[0].id) : '');
    setFormDay('Monday');
    setFormStart('07:00:00');
    setFormEnd('08:30:00');
    setFormSubject('');
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: ScheduleRecord) => {
    setEditItem(item);
    setFormTeacherId(item.teacherId);
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
    if (!formTeacherId || !formClassId || !formStart || !formEnd) {
      setFormError('Semua field wajib diisi.');
      return;
    }
    try {
      const body = { teacherId: formTeacherId, classId: Number(formClassId), dayName: formDay, startTime: formStart, endTime: formEnd, subject: formSubject };
      const url = editItem ? `/api/teaching-schedules/${editItem.id}` : '/api/teaching-schedules';
      const method = editItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(editItem ? 'Jadwal berhasil diperbarui!' : 'Jadwal berhasil dibuat!');
        setShowModal(false);
        fetchList();
      } else throw new Error(data.error || 'Gagal menyimpan jadwal.');
    } catch (err: any) { setFormError(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus jadwal mengajar ini?')) return;
    try {
      const res = await fetch(`/api/teaching-schedules/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Jadwal berhasil dihapus.'); fetchList(); }
      else throw new Error(data.error || 'Gagal menghapus jadwal.');
    } catch (err: any) { setToastMsg(err.message); }
  };

  const grouped = DAYS.map(day => ({ day, items: list.filter(s => s.dayName === day) }));

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Jadwal Mengajar Guru</h2>
          <p className="text-xs text-muted-foreground mt-1">Atur jadwal mata pelajaran per guru, kelas, dan hari.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setImportFile(null); setImportPreview([]); setImportResult(null); setErrorMsg(''); setShowImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
            <Upload className="w-4 h-4" /><span>Import Excel</span>
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
            <Plus className="w-4 h-4" /><span>Tambah Jadwal</span>
          </button>
        </div>
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
                      <div key={s.id} className="px-4 py-3 space-y-1.5 hover:bg-muted/10 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">{s.teacherName}</div>
                            <div className="text-xs text-muted-foreground">{s.className}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEdit(s)}
                              className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit jadwal"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive/80 transition-colors" aria-label="Hapus jadwal"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-primary">{s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}</span>
                          {s.subject && <><span className="text-muted-foreground">|</span><span className="text-muted-foreground">{s.subject}</span></>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {errorMsg && <div className="px-6 py-3 text-destructive text-xs">{errorMsg}</div>}
      {toastMsg && <div className="fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce"><span>{toastMsg}</span></div>}

      {showModal && (
        <ModalShell title={editItem ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'} onClose={() => setShowModal(false)} maxWidth="md"
          footer={<>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button type="submit" form="schedForm" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">{editItem ? 'Simpan Perubahan' : 'Simpan'}</button>
          </>}>
          <form id="schedForm" onSubmit={handleSubmit} className="space-y-4">
            <FormSelect label="Guru" value={formTeacherId} onChange={e => setFormTeacherId(e.target.value)} placeholder="-- Pilih Guru --" options={teachersList.map(t => ({ value: t.id, label: t.name }))} />
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

      {/* Import Excel Modal */}
      {showImportModal && (
        <ModalShell title="Import Jadwal dari Excel" onClose={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); setImportPreview([]); setErrorMsg(''); }} maxWidth="lg"
          footer={!importResult ? <><button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={handleImportSubmit} disabled={!importFile || importLoading}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${!importFile || importLoading ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}>
              {importLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengimport...</> : <><Upload className="w-3.5 h-3.5" /> Import</>}
            </button></> : undefined}>
          {importResult ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-500">{importResult.imported}</div>
                  <div className="text-muted-foreground mt-1">Berhasil</div>
                </div>
                <div className="flex-1 bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">{importResult.failed}</div>
                  <div className="text-muted-foreground mt-1">Gagal</div>
                </div>
              </div>
              {importResult.results.filter((r: any) => r.status === 'failed' || r.status === 'skipped').length > 0 && (
                <div>
                  <h4 className="text-foreground/80 font-semibold mb-2">Detail Error:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.results.filter((r: any) => r.status === 'failed' || r.status === 'skipped').map((r: any, i: number) => (
                      <div key={i} className="bg-destructive/5 border border-destructive/10 rounded-lg px-3 py-2 text-foreground/80 text-xs">
                        <span className="text-muted-foreground">Baris {r.row}:</span> Guru: {r.teacher || 'n/a'}, Kelas: {r.class || 'n/a'} — <span className="text-destructive font-semibold">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); setImportPreview([]); setErrorMsg(''); }}
                className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Tutup</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                <span className="text-xs text-muted-foreground">Butuh template? Download file contoh Excel:</span>
                <a href="/api/templates/download/jadwal"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
                  <Download className="w-3.5 h-3.5" /> Download Template
                </a>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1.5 uppercase font-semibold">File Excel</label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('sched-excel-file-input')?.click()}>
                  {importFile ? (
                    <div className="text-foreground">
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-primary mb-2" />
                      <p className="font-semibold">{importFile.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="font-semibold">Klik untuk pilih file Excel</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Format .xlsx atau .xls</p>
                    </div>
                  )}
                  <input id="sched-excel-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
                </div>
              </div>
              {importPreview.length > 0 && (
                <div>
                  <h4 className="text-foreground/80 font-semibold mb-2">Preview (5 baris pertama):</h4>
                  <div className="bg-background rounded-xl overflow-hidden border border-border">
                    <table className="w-full text-left text-xs">
                      <thead><tr className="bg-secondary text-muted-foreground uppercase font-semibold">
                        <th className="px-3 py-2">Guru</th>
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2">Hari</th>
                        <th className="px-3 py-2">Mulai</th>
                        <th className="px-3 py-2">Selesai</th>
                        <th className="px-3 py-2">Mapel</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border">
                        {importPreview.map((row, i) => (
                          <tr key={i} className="text-foreground">
                            <td className="px-3 py-2">{row.teacher || '-'}</td>
                            <td className="px-3 py-2">{row.class || '-'}</td>
                            <td className="px-3 py-2">{row.day || '-'}</td>
                            <td className="px-3 py-2">{row.start || '-'}</td>
                            <td className="px-3 py-2">{row.end || '-'}</td>
                            <td className="px-3 py-2">{row.subject || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1.5">Kolom wajib: Guru, Kelas, Hari (English: Monday-Sunday), Jam Mulai, Jam Selesai, Mapel</p>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </section>
  );
};
