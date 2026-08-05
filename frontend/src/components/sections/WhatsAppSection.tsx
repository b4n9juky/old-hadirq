import { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, RefreshCw, Wifi, WifiOff, ScanLine, Smartphone, CheckCircle2, XCircle, Clock, TrendingUp, Filter, Copy, FileText, RotateCcw, Save, Eye, Bell } from 'lucide-react';

interface Props {
  token: string;
}

interface NotificationRecord {
  id: number;
  studentId: number;
  studentName: string | null;
  studentNis: string | null;
  type: string;
  recipient: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  rate: number;
}

export const WhatsAppSection: React.FC<Props> = ({ token }) => {
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [status, setStatus] = useState<{
    connected: boolean;
    initializing: boolean;
    hasQR: boolean;
    hasPairingCode: boolean;
    qr?: string | null;
    pairingCode?: string | null;
    error?: string | null;
  }>({ connected: false, initializing: false, hasQR: false, hasPairingCode: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairingPhone, setPairingPhone] = useState('');
  const [copied, setCopied] = useState(false);

  // Notification log state
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, rate: 0 });
  const [notifLoading, setNotifLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Template state
  const [templates, setTemplates] = useState({ wa_checkin_normal: '', wa_checkin_late: '', wa_checkout: '' });
  const [defaultTemplates, setDefaultTemplates] = useState({ wa_checkin_normal: '', wa_checkin_late: '', wa_checkout: '' });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');
  const [previewTab, setPreviewTab] = useState<'checkin' | 'checkout'>('checkin');
  const [pushSubCount, setPushSubCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/wa/status', { headers: authHeader, signal });
        if (!signal.aborted) {
          const data = await res.json();
          if (data.success) setStatus(data.data);
        }
      } catch { /* ignore */ }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => { clearInterval(interval); controller.abort(); };
  }, [authHeader]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/wa/notifications?${params}`, { headers: authHeader });
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.data);
        setStats(json.data.stats);
      }
    } catch { /* ignore */ } finally {
      setNotifLoading(false);
    }
  }, [authHeader, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const [settingsRes, defaultsRes] = await Promise.all([
          fetch('/api/settings', { headers: authHeader }),
          fetch('/api/settings/templates/defaults', { headers: authHeader }),
        ]);
        const settingsData = await settingsRes.json();
        const defaultsData = await defaultsRes.json();
        if (settingsData.success && defaultsData.success) {
          const s = settingsData.data;
          const d = defaultsData.data;
          setDefaultTemplates(d);
          setTemplates({
            wa_checkin_normal: s.wa_checkin_normal || d.wa_checkin_normal,
            wa_checkin_late: s.wa_checkin_late || d.wa_checkin_late,
            wa_checkout: s.wa_checkout || d.wa_checkout,
          });
        }
      } catch { /* ignore */ }
    };
    fetchTemplates();
  }, [authHeader]);

  // Fetch push subscription count
  useEffect(() => {
    const fetchPushCount = async () => {
      try {
        const res = await fetch('/api/push/subscriptions', { headers: authHeader });
        const data = await res.json();
        if (data.success) setPushSubCount(data.data.count || 0);
      } catch { /* ignore */ }
    };
    fetchPushCount();
  }, [authHeader]);

  const handleInit = async (usePairing = false) => {
    setLoading(true);
    setError('');
    setStatus(prev => ({ ...prev, error: null }));
    try {
      const body = usePairing && pairingPhone ? { phone: pairingPhone } : {};
      const res = await fetch('/api/wa/init', { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) setError(data.error || 'Gagal memulai koneksi WA');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError('');
    try {
      await fetch('/api/wa/disconnect', { method: 'POST', headers: authHeader });
      setStatus({ connected: false, initializing: false, hasQR: false, hasPairingCode: false, error: null });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/wa/status', { headers: authHeader });
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } catch { /* ignore */ }
  };

  const handleSaveTemplates = async () => {
    setTemplateSaving(true);
    setTemplateMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      });
      const data = await res.json();
      if (data.success) {
        setTemplateMsg('Template berhasil disimpan!');
      } else {
        setTemplateMsg(data.error || 'Gagal menyimpan template');
      }
    } catch {
      setTemplateMsg('Gagal menghubungi server');
    } finally {
      setTemplateSaving(false);
      setTimeout(() => setTemplateMsg(''), 3000);
    }
  };

  const handleResetTemplates = () => {
    setTemplates({ ...defaultTemplates });
    setTemplateMsg('Template dikembalikan ke default.');
    setTimeout(() => setTemplateMsg(''), 3000);
  };

  const renderPreview = (template: string) => {
    return template
      .replace(/\{nama\}/g, 'Ahmad Fauzi')
      .replace(/\{waktu\}/g, '07:30')
      .replace(/\{tanggal\}/g, '05 Agustus 2026')
      .replace(/\{status\}/g, 'Hadir')
      .replace(/\{kelas\}/g, 'VII A');
  };

  const typeLabel: Record<string, string> = { CHECKIN: 'Check-in', CHECKOUT: 'Check-out' };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">WhatsApp Bot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kirim notifikasi check-in / check-out otomatis ke orang tua
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {(error || status.error) && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive">{error || status.error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
          <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : status.initializing ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
          <div className="text-sm">
            <span className="font-semibold text-foreground">
              {status.connected ? 'Terhubung' : status.initializing ? 'Memindai...' : 'Terputus'}
            </span>
            {status.connected && (
              <span className="text-xs text-muted-foreground ml-2">WhatsApp siap mengirim notifikasi</span>
            )}
          </div>
        </div>

        {status.hasQR && status.qr && (
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-muted/20 border border-border">
            <div className="flex items-center gap-2 text-amber-500">
              <ScanLine className="w-4 h-4" />
              <span className="text-sm font-semibold">Scan QR ini dengan WhatsApp</span>
            </div>
            <img src={status.qr} alt="WhatsApp QR Code" className="w-56 h-56 rounded-xl border border-border bg-white" />
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Buka WhatsApp &gt; Menu &gt; Perangkat Tertaut &gt; Tautkan Perangkat.
            </p>
          </div>
        )}

        {status.hasPairingCode && status.pairingCode && (
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-muted/20 border border-border">
            <div className="flex items-center gap-2 text-amber-500">
              <Smartphone className="w-4 h-4" />
              <span className="text-sm font-semibold">Pairing Code</span>
            </div>
            <div className="relative">
              <code className="block text-4xl font-mono font-bold tracking-[0.3em] text-foreground bg-background px-8 py-4 rounded-xl border border-border select-all">
                {status.pairingCode}
              </code>
              <button onClick={() => handleCopyCode(status.pairingCode!)}
                className="absolute -top-2 -right-2 p-1.5 rounded-lg bg-secondary hover:bg-accent border border-border transition-colors">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            {copied && <span className="text-xs text-emerald-500">Tersalin!</span>}
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Buka WhatsApp &gt; Menu &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; Ketik kode di atas.
            </p>
            <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
              Kode berlaku selama 60 detik.
            </p>
          </div>
        )}

        {!status.connected && !status.hasQR && !status.hasPairingCode && !status.initializing && (
          <div className="flex items-center justify-center p-8 rounded-xl bg-muted/10 border border-dashed border-border">
            <div className="text-center space-y-3">
              <WifiOff className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm text-muted-foreground">WhatsApp bot belum terhubung</p>
              <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto">
                {status.error
                  ? 'Terjadi kesalahan. Klik "Coba Lagi" untuk memulai ulang.'
                  : 'Pilih metode koneksi di bawah untuk memulai.'}
              </p>
            </div>
          </div>
        )}

        {status.connected && (
          <div className="flex items-center justify-center p-6 rounded-xl bg-green-500/5 border border-green-500/10">
            <div className="text-center space-y-2">
              <Wifi className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">WhatsApp Terhubung</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Notifikasi check-in/check-out dikirim otomatis ke nomor WA orang tua.
              </p>
            </div>
          </div>
        )}

        {pushSubCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <Bell className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-foreground">
              <span className="font-bold">{pushSubCount}</span> orang tua telah mengaktifkan notifikasi browser sebagai cadangan.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!status.connected && !status.initializing && (
            <>
              <button onClick={() => handleInit(false)} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all disabled:opacity-50">
                {status.error ? <RefreshCw className="w-4 h-4" /> : <ScanLine className="w-4 h-4" />}
                {status.error ? 'Coba Lagi (QR)' : 'Scan QR'}
              </button>
              <div className="flex items-center gap-2">
                <input type="text" value={pairingPhone} onChange={e => setPairingPhone(e.target.value)}
                  placeholder="No. HP (cth: 0812xxx)"
                  className="w-44 bg-background border border-border rounded-lg px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50" />
                <button onClick={() => handleInit(true)} disabled={loading || !pairingPhone}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-accent border border-border text-foreground text-xs font-bold transition-all disabled:opacity-50">
                  <Smartphone className="w-4 h-4" /> Pairing Code
                </button>
              </div>
            </>
          )}
          {status.initializing && (
            <button disabled
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/50 text-primary-foreground text-xs font-bold cursor-not-allowed">
              <RefreshCw className="w-4 h-4 animate-spin" /> Memulai koneksi...
            </button>
          )}
          {status.connected && (
            <button onClick={handleDisconnect} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-bold transition-all">
              <WifiOff className="w-4 h-4" /> Putuskan Koneksi
            </button>
          )}
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-all">
            <RefreshCw className="w-4 h-4" /> Perbarui
          </button>
        </div>
      </div>

      {/* Notification Log */}
      <div className="border-t border-border">
        <div className="px-6 py-4 border-b border-border bg-muted/10">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> Log Notifikasi
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-muted/20 border border-border">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Total</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-500">{stats.sent}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Terkirim</div>
            </div>
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-2xl font-bold text-red-500">{stats.failed}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Gagal</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">{stats.rate}%</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Keberhasilan</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-2xs text-muted-foreground uppercase font-semibold mb-1">Dari Tanggal</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
            </div>
            <div>
              <label className="block text-2xs text-muted-foreground uppercase font-semibold mb-1">Sampai Tanggal</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground" />
            </div>
            <div>
              <label className="block text-2xs text-muted-foreground uppercase font-semibold mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground">
                <option value="">Semua</option>
                <option value="SENT">Terkirim</option>
                <option value="FAILED">Gagal</option>
              </select>
            </div>
            <button onClick={fetchNotifications} disabled={notifLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
              <Filter className="w-3 h-3" /> Filter
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground uppercase font-semibold">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">No. WA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {notifLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Memuat...</td></tr>
                ) : notifications.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Belum ada notifikasi terkirim.</td></tr>
                ) : notifications.map(n => (
                  <tr key={n.id} className="text-foreground hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{n.studentName || '-'}</div>
                      {n.studentNis && <div className="text-2xs text-muted-foreground">{n.studentNis}</div>}
                    </td>
                    <td className="px-4 py-3">{typeLabel[n.type] || n.type}</td>
                    <td className="px-4 py-3">{n.recipient}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${
                        n.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {n.status === 'SENT' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {n.status === 'SENT' ? 'Terkirim' : 'Gagal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-destructive max-w-[200px] truncate">{n.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {notifications.length > 0 && (
            <p className="text-2xs text-muted-foreground text-center">
              Menampilkan {notifications.length} notifikasi terbaru
            </p>
          )}
        </div>
      </div>

      {/* Template Editor */}
      <div className="border-t border-border">
        <div className="px-6 py-4 border-b border-border bg-muted/10">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Pesan Template
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Kustomisasi pesan notifikasi WhatsApp. Gunakan placeholder: {'{nama}'}, {'{waktu}'}, {'{tanggal}'}, {'{status}'}, {'{kelas}'}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {templateMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              templateMsg.includes('berhasil') || templateMsg.includes('dikembalikan')
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {templateMsg}
            </div>
          )}

          {/* Check-in Normal */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Check-in (Tepat Waktu)</label>
            <textarea
              value={templates.wa_checkin_normal}
              onChange={e => setTemplates(prev => ({ ...prev, wa_checkin_normal: e.target.value }))}
              rows={4}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Check-in Late */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Check-in (Terlambat)</label>
            <textarea
              value={templates.wa_checkin_late}
              onChange={e => setTemplates(prev => ({ ...prev, wa_checkin_late: e.target.value }))}
              rows={4}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Check-out */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Check-out</label>
            <textarea
              value={templates.wa_checkout}
              onChange={e => setTemplates(prev => ({ ...prev, wa_checkout: e.target.value }))}
              rows={4}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Preview</span>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => setPreviewTab('checkin')}
                  className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all ${
                    previewTab === 'checkin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}>
                  Check-in
                </button>
                <button
                  onClick={() => setPreviewTab('checkout')}
                  className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all ${
                    previewTab === 'checkout' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}>
                  Check-out
                </button>
              </div>
            </div>
            <div className="bg-[#e5ddd5] rounded-xl p-4 border border-border">
              <div className="bg-white rounded-xl p-4 max-w-sm ml-auto shadow-sm">
                <p className="text-sm text-[#303030] whitespace-pre-wrap leading-relaxed">
                  {renderPreview(previewTab === 'checkin' ? templates.wa_checkin_normal : templates.wa_checkout)}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveTemplates}
              disabled={templateSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all disabled:opacity-50">
              <Save className="w-4 h-4" /> {templateSaving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
            <button
              onClick={handleResetTemplates}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary hover:bg-accent border border-border text-foreground text-xs font-bold transition-all">
              <RotateCcw className="w-4 h-4" /> Reset ke Default
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
