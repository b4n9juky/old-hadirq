import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ActiveBadge } from '../shared/StatusBadge';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ModalShell } from '../shared/ModalShell';
import { FormInput, FormSelect } from '../shared/FormField';
import { TimePicker } from '../shared/TimePicker';
import { dayLabel, DAY_ORDER } from '../../utils/days';

interface YearRecord { id: number; name: string; isActive: boolean; }
interface SemesterRecord { id: number; academicYearId: number; name: string; isActive: boolean; }
interface ScheduleRecord { id: number; dayName: string; checkinStart: string; lateAfter: string; checkoutTime: string; isActive: boolean; }

interface Props { token: string; }

export const AcademicSection: React.FC<Props> = ({ token }) => {
  const authHeader = { 'Authorization': `Bearer ${token}` };
  const [yearsList, setYearsList] = useState<YearRecord[]>([]);
  const [semestersList, setSemestersList] = useState<SemesterRecord[]>([]);
  const [schedulesList, setSchedulesList] = useState<ScheduleRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  // Year state
  const [showAddYear, setShowAddYear] = useState(false);
  const [yearName, setYearName] = useState('');
  const [showEditYear, setShowEditYear] = useState<YearRecord | null>(null);
  const [editYearName, setEditYearName] = useState('');

  // Semester state
  const [showAddSemester, setShowAddSemester] = useState(false);
  const [semName, setSemName] = useState('');
  const [semYearId, setSemYearId] = useState('');
  const [showEditSemester, setShowEditSemester] = useState<SemesterRecord | null>(null);
  const [editSemName, setEditSemName] = useState('');
  const [editSemYearId, setEditSemYearId] = useState('');

  // Schedule state
  const [showEditSchedule, setShowEditSchedule] = useState<ScheduleRecord | null>(null);
  const [schedStart, setSchedStart] = useState('');
  const [schedLate, setSchedLate] = useState('');
  const [schedCheckout, setSchedCheckout] = useState('');

  const fetchData = useCallback(async () => {
    setListLoading(true);
    try {
      const [resY, resSem, resSched] = await Promise.all([
        fetch('/api/academic-years', { headers: authHeader }),
        fetch('/api/semesters', { headers: authHeader }),
        fetch('/api/schedules', { headers: authHeader }),
      ]);
      const dY = await resY.json(); if (dY.success) setYearsList(dY.data);
      const dSem = await resSem.json(); if (dSem.success) setSemestersList(dSem.data);
      const dSched = await resSched.json(); if (dSched.success) setSchedulesList(dSched.data);
    } catch { /* ignore */ } finally { setListLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (toastMsg) { const t = setTimeout(() => setToastMsg(''), 4000); return () => clearTimeout(t); } }, [toastMsg]);

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/academic-years', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ name: yearName }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tahun ajaran berhasil dibuat!'); setShowAddYear(false); setYearName(''); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleEditYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditYear) return;
    try {
      const res = await fetch(`/api/academic-years/${showEditYear.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ name: editYearName }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tahun ajaran diperbarui!'); setShowEditYear(null); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDeactivateYear = async (id: number) => {
    try {
      const res = await fetch(`/api/academic-years/${id}/deactivate`, { method: 'PUT', headers: { ...authHeader, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tahun ajaran dinonaktifkan!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleActivateYear = async (id: number) => {
    try {
      const res = await fetch(`/api/academic-years/${id}/activate`, { method: 'PUT', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tahun ajaran diaktifkan!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDeleteYear = async (id: number) => {
    if (!confirm('Hapus tahun ajaran ini? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch(`/api/academic-years/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tahun ajaran dihapus!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/semesters', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ name: semName, academicYearId: parseInt(semYearId) }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Semester berhasil dibuat!'); setShowAddSemester(false); setSemName(''); setSemYearId(''); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleEditSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditSemester) return;
    try {
      const body: any = { name: editSemName };
      if (editSemYearId) body.academicYearId = parseInt(editSemYearId);
      const res = await fetch(`/api/semesters/${showEditSemester.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Semester diperbarui!'); setShowEditSemester(null); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDeactivateSemester = async (id: number) => {
    try {
      const res = await fetch(`/api/semesters/${id}/deactivate`, { method: 'PUT', headers: { ...authHeader, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Semester dinonaktifkan!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleActivateSemester = async (id: number) => {
    try {
      const res = await fetch(`/api/semesters/${id}/activate`, { method: 'PUT', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Semester diaktifkan!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDeleteSemester = async (id: number) => {
    if (!confirm('Hapus semester ini? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch(`/api/semesters/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Semester dihapus!'); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleEditSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditSchedule) return;
    if (!schedStart || !schedLate || !schedCheckout) {
      setErrorMsg('Semua field waktu harus diisi.');
      return;
    }
    try {
      const body = { checkinStart: schedStart, lateAfter: schedLate, checkoutTime: schedCheckout };
      const res = await fetch(`/api/schedules/${showEditSchedule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Jadwal diperbarui!'); setShowEditSchedule(null); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      const res = await fetch(`/api/schedules/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast(data.message);
        fetchData();
      } else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
      {/* Left Column: Years + Semesters */}
      <div className="space-y-6">
        {/* Academic Years */}
        <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div><h2 className="text-base font-bold text-foreground">Tahun Ajaran</h2><p className="text-xs text-muted-foreground mt-1">Periode tahun ajaran aktif.</p></div>
            <button onClick={() => { setYearName(''); setShowAddYear(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
              <Plus className="w-3.5 h-3.5" /><span>Tambah</span>
            </button>
          </div>
          {listLoading ? <LoadingSpinner /> : (
            <div className="space-y-2">
              {yearsList.length === 0 && <p className="text-muted-foreground text-xs">Belum ada data.</p>}
              {yearsList.map((year) => (
                <div key={year.id} className="flex justify-between items-center p-3 rounded-xl bg-card/50 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">{year.name}</span>
                    <ActiveBadge isActive={year.isActive} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditYearName(year.name); setShowEditYear(year); }}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteYear(year.id)} disabled={year.isActive}
                      className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={year.isActive ? 'Nonaktifkan tahun ajaran terlebih dahulu' : 'Hapus tahun ajaran'}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {year.isActive ? (
                      <button onClick={() => handleDeactivateYear(year.id)}
                        className="px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs font-semibold transition-colors">
                        Nonaktifkan
                      </button>
                    ) : (
                      <button onClick={() => handleActivateYear(year.id)}
                        className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border border-border text-xs font-semibold transition-colors">
                        Aktifkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Semesters */}
        <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div><h2 className="text-base font-bold text-foreground">Semester</h2><p className="text-xs text-muted-foreground mt-1">Pembagian semester dalam tahun ajaran.</p></div>
            <button onClick={() => { setSemName(''); setSemYearId(''); setShowAddSemester(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
              <Plus className="w-3.5 h-3.5" /><span>Tambah</span>
            </button>
          </div>
          {listLoading ? <LoadingSpinner /> : (
            <div className="space-y-2">
              {semestersList.length === 0 && <p className="text-muted-foreground text-xs">Belum ada data.</p>}
              {semestersList.map((sem) => (
                <div key={sem.id} className="flex justify-between items-center p-3 rounded-xl bg-card/50 border border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-xs">{sem.name}</span>
                    <span className="text-xs text-muted-foreground">{yearsList.find(y => y.id === sem.academicYearId)?.name || ''}</span>
                    <ActiveBadge isActive={sem.isActive} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditSemName(sem.name); setEditSemYearId(String(sem.academicYearId)); setShowEditSemester(sem); }}
                      className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteSemester(sem.id)} disabled={sem.isActive}
                      className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={sem.isActive ? 'Nonaktifkan semester terlebih dahulu' : 'Hapus semester'}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {sem.isActive ? (
                      <button onClick={() => handleDeactivateSemester(sem.id)}
                        className="px-2.5 py-1 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs font-semibold transition-colors">
                        Nonaktifkan
                      </button>
                    ) : (
                      <button onClick={() => handleActivateSemester(sem.id)}
                        className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border border-border text-xs font-semibold transition-colors">
                        Aktifkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right Column: Schedules */}
      <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Jadwal Harian</h2>
          <p className="text-xs text-muted-foreground mt-1">Atur jam masuk, batas toleransi, dan jam pulang.</p>
        </div>
        {listLoading ? <LoadingSpinner /> : (
          <div className="space-y-2">
            {schedulesList.length === 0 && <p className="text-muted-foreground text-xs">Belum ada data.</p>}
            {[...schedulesList].sort((a, b) => DAY_ORDER.indexOf(a.dayName) - DAY_ORDER.indexOf(b.dayName)).map((sched) => (
              <div key={sched.id} className={`p-4 rounded-xl border flex justify-between items-center gap-4 ${sched.isActive ? 'bg-card/50 border-border' : 'bg-muted/30 border-muted-foreground/20 opacity-60'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{dayLabel(sched.dayName)}</span>
                    {!sched.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground">Nonaktif</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Mulai: {sched.checkinStart} | Toleransi: {sched.lateAfter} | Pulang: {sched.checkoutTime}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(sched.id, sched.isActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sched.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    title={sched.isActive ? 'Nonaktifkan hari' : 'Aktifkan hari'}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sched.isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                  </button>
                  <button onClick={() => { setSchedStart(sched.checkinStart.slice(0, 5)); setSchedLate(sched.lateAfter.slice(0, 5)); setSchedCheckout(sched.checkoutTime.slice(0, 5)); setShowEditSchedule(sched); }}
                    className="p-2 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {errorMsg && <div className="col-span-full text-destructive text-xs">{errorMsg}</div>}
      {toastMsg && <div className="fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce"><span>{toastMsg}</span></div>}

      {/* Add Year Modal */}
      {showAddYear && (
        <ModalShell title="Tambah Tahun Ajaran" onClose={() => setShowAddYear(false)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowAddYear(false)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="addYearForm" className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan</button></>}>
          <form id="addYearForm" onSubmit={handleAddYear}>
            <FormInput label="Nama Tahun Ajaran" value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="Contoh: 2025/2026" required />
          </form>
        </ModalShell>
      )}

      {/* Add Semester Modal */}
      {showAddSemester && (
        <ModalShell title="Tambah Semester" onClose={() => setShowAddSemester(false)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowAddSemester(false)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="addSemForm" className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan</button></>}>
          <form id="addSemForm" onSubmit={handleAddSemester}>
            <div className="space-y-4">
              <FormInput label="Nama Semester" value={semName} onChange={(e) => setSemName(e.target.value)} placeholder="Contoh: Ganjil 2025" required />
              <FormSelect label="Tahun Ajaran" value={semYearId} onChange={(e) => setSemYearId(e.target.value)}
                options={yearsList.map(y => ({ value: String(y.id), label: y.name }))} placeholder="-- Pilih Tahun Ajaran --" />
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Year Modal */}
      {showEditYear && (
        <ModalShell title="Edit Tahun Ajaran" onClose={() => setShowEditYear(null)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowEditYear(null)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="editYearForm" className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan Perubahan</button></>}>
          <form id="editYearForm" onSubmit={handleEditYear}>
            <FormInput label="Nama Tahun Ajaran" value={editYearName} onChange={(e) => setEditYearName(e.target.value)} placeholder="Contoh: 2025/2026" required />
          </form>
        </ModalShell>
      )}

      {/* Edit Semester Modal */}
      {showEditSemester && (
        <ModalShell title="Edit Semester" onClose={() => setShowEditSemester(null)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowEditSemester(null)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="editSemForm" className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan Perubahan</button></>}>
          <form id="editSemForm" onSubmit={handleEditSemester}>
            <div className="space-y-4">
              <FormInput label="Nama Semester" value={editSemName} onChange={(e) => setEditSemName(e.target.value)} placeholder="Contoh: Ganjil 2025" required />
              <FormSelect label="Tahun Ajaran" value={editSemYearId} onChange={(e) => setEditSemYearId(e.target.value)}
                options={yearsList.map(y => ({ value: String(y.id), label: y.name }))} placeholder="-- Pilih Tahun Ajaran --" />
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Schedule Modal */}
      {showEditSchedule && (
        <ModalShell title="Edit Jadwal Harian" onClose={() => setShowEditSchedule(null)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowEditSchedule(null)} className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="editSchedForm" className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan Perubahan</button></>}>
          <form id="editSchedForm" onSubmit={handleEditSchedule}>
            <div className="space-y-4">
              <p className="text-primary font-semibold">{dayLabel(showEditSchedule.dayName)}</p>
              <TimePicker label="Jam Mulai Absen" value={schedStart} onChange={setSchedStart} required />
              <TimePicker label="Batas Toleransi Terlambat" value={schedLate} onChange={setSchedLate} required />
              <TimePicker label="Jam Pulang (Checkout)" value={schedCheckout} onChange={setSchedCheckout} required />
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
