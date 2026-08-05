import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, QrCode, Download, Camera, Upload, FileSpreadsheet, Monitor, Users } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { DeviceBadge } from '../shared/StatusBadge';
import { DataTable } from '../shared/DataTable';
import { ModalShell } from '../shared/ModalShell';
import { FormInput, FormSelect } from '../shared/FormField';
import { getVideoDevices, getDefaultDeviceId, getCameraConstraints } from '../../utils/camera';

interface StudentRecord {
  id: number; nis: string; classId: number;
  studentName: string; className: string;
  deviceUuid?: string | null;
  qrcode?: string | null;
  faceEmbedding?: string | null;
  photo?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
}
interface ClassRecord { id: number; name: string; }

interface Props { token: string; }

export const StudentsSection: React.FC<Props> = ({ token }) => {
  const authHeader = { 'Authorization': `Bearer ${token}` };
  const [studentsList, setStudentsList] = useState<StudentRecord[]>([]);
  const [classesList, setClassesList] = useState<ClassRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000); };

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState<StudentRecord | null>(null);
  const [studentNis, setStudentNis] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentClassId, setStudentClassId] = useState('');
  const [previewQr, setPreviewQr] = useState<StudentRecord | null>(null);

  // Promote states
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteFromClass, setPromoteFromClass] = useState('');
  const [promoteToClass, setPromoteToClass] = useState('');
  const [promoteSelectedStudents, setPromoteSelectedStudents] = useState<number[]>([]);
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Parent link state
  const [showLinkParentModal, setShowLinkParentModal] = useState<StudentRecord | null>(null);
  const [parentUsers, setParentUsers] = useState<{ id: string; name: string; email: string; phone?: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = useState('');

  // Import Excel state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ nis: string; name: string; className: string; parentName?: string; parentEmail?: string; parentPhone?: string }[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; results: any[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Import Parent Excel state
  const [showImportParentModal, setShowImportParentModal] = useState(false);
  const [importParentFile, setImportParentFile] = useState<File | null>(null);
  const [importParentPreview, setImportParentPreview] = useState<{ nis: string; name: string; email: string; password: string; phone?: string }[]>([]);
  const [importParentResult, setImportParentResult] = useState<{ imported: number; failed: number; results: any[] } | null>(null);
  const [importParentLoading, setImportParentLoading] = useState(false);

  // Photo Upload
  const [showPhotoUpload, setShowPhotoUpload] = useState<StudentRecord | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Face Registration
  const [showFaceRegister, setShowFaceRegister] = useState<StudentRecord | null>(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceStatus, setFaceStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceCameraDevices, setFaceCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [faceSelectedCameraId, setFaceSelectedCameraId] = useState<string | undefined>(undefined);
  const [faceShowCameraPicker, setFaceShowCameraPicker] = useState(false);

  const startFaceRegistration = async (student: StudentRecord) => {
    setShowFaceRegister(student);
    setFaceLoading(true);
    setFaceStatus('Memuat model AI...');
    try {
      const devices = await getVideoDevices();
      setFaceCameraDevices(devices);
      const deviceId = getDefaultDeviceId(devices);
      setFaceSelectedCameraId(deviceId);

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      setFaceStatus('Membuka kamera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: getCameraConstraints(deviceId)
      });
      
      let attempts = 0;
      while (!videoRef.current && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        throw new Error('Elemen video tidak ditemukan setelah render.');
      }
    } catch (err: any) {
      setFaceStatus('Error: ' + err.message);
    } finally {
      setFaceLoading(false);
    }
  };

  const faceSwitchCamera = async (deviceId: string) => {
    setFaceSelectedCameraId(deviceId);
    setFaceShowCameraPicker(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: getCameraConstraints(deviceId) });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setFaceStatus('Gagal mengganti kamera.');
    }
  };

  const closeFaceRegister = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowFaceRegister(null);
    setFaceStatus('');
  };

  const handleCaptureFace = async () => {
    if (!videoRef.current || !showFaceRegister) return;
    setFaceLoading(true);
    setFaceStatus('Mendeteksi wajah...');
    try {
      if (videoRef.current.paused || videoRef.current.ended || videoRef.current.videoWidth === 0) {
        setFaceStatus('Kamera belum siap, mohon tunggu beberapa saat.');
        setFaceLoading(false);
        return;
      }

      // 1. Try SSD Mobilenet V1
      let detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      // 2. Fallback to Tiny Face Detector
      if (!detection) {
        detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
        ).withFaceLandmarks().withFaceDescriptor();
      }

      if (!detection) {
        setFaceStatus('Wajah tidak terdeteksi. Pastikan posisi wajah tegak, pencahayaan cukup, dan hadap langsung ke kamera.');
        setFaceLoading(false);
        return;
      }

      // Face quality check: must have all 68 landmarks
      if (!detection.landmarks || detection.landmarks.positions.length < 50) {
        setFaceStatus('Kualitas wajah kurang baik. Pastikan seluruh wajah terlihat, tidak tertutup masker/kacamata hitam, dan pencahayaan cukup.');
        setFaceLoading(false);
        return;
      }

      setFaceStatus('Menyimpan ke database...');
      const descriptor = Array.from(detection.descriptor);
      const clientTimestamp = new Date().toISOString();
      const res = await fetch(`/api/students/${showFaceRegister.id}/register-face`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ faceEmbedding: descriptor, clientTimestamp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('Wajah berhasil didaftarkan!');
        closeFaceRegister();
      } else {
        throw new Error(data.error || 'Gagal menyimpan wajah');
      }
    } catch (err: any) {
      setFaceStatus('Error: ' + err.message);
    } finally {
      setFaceLoading(false);
    }
  };

  const handleUnlinkParent = async (studentId: number) => {
    try {
      const res = await fetch(`/api/parents/unlink/${studentId}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Tautan orang tua dihapus!'); setShowLinkParentModal(null); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleLinkParent = async () => {
    if (!showLinkParentModal || !selectedParentId) return;
    try {
      const res = await fetch('/api/parents/link', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ studentId: showLinkParentModal.id, parentId: selectedParentId }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Orang tua berhasil ditautkan!'); setShowLinkParentModal(null); fetchData(); }
      else throw new Error(data.error || 'Gagal.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleImportParentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setImportParentFile(null); setImportParentPreview([]); return; }
    setImportParentFile(file);
    setImportParentResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        if (!XLSX) { setImportParentPreview([{ nis: '(muat ulang untuk preview)', name: '', email: '', password: '' }]); return; }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const keys = json.length > 0 ? Object.keys(json[0]) : [];
        const nisKey = keys.find(k => k.toLowerCase().trim() === 'nis' || k.toLowerCase().trim() === 'nomor induk') || '';
        const nameKey = keys.find(k => k.toLowerCase().trim() === 'name' || k.toLowerCase().trim() === 'nama' || k.toLowerCase().trim() === 'nama orang tua') || '';
        const emailKey = keys.find(k => k.toLowerCase().trim() === 'email') || '';
        const passwordKey = keys.find(k => k.toLowerCase().trim() === 'password' || k.toLowerCase().trim() === 'kata sandi') || '';
        const phoneKey = keys.find(k => k.toLowerCase().trim() === 'no. wa' || k.toLowerCase().trim() === 'nowa' || k.toLowerCase().trim() === 'phone' || k.toLowerCase().trim() === 'telepon' || k.toLowerCase().trim() === 'nomor wa') || '';
        setImportParentPreview(json.slice(0, 5).map((r: any) => ({
          nis: String(r[nisKey] || '').trim(),
          name: String(r[nameKey] || '').trim(),
          email: String(r[emailKey] || '').trim(),
          password: String(r[passwordKey] || '').trim(),
          phone: phoneKey ? String(r[phoneKey] || '').trim() : undefined,
        })));
      } catch { setImportParentPreview([{ nis: '(gagal baca file)', name: '', email: '', password: '' }]); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportParentSubmit = async () => {
    if (!importParentFile) return;
    setImportParentLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importParentFile);
      const res = await fetch('/api/parents/import', { method: 'POST', headers: authHeader, body: formData });
      const data = await res.json();
      if (res.ok && data.success) { setImportParentResult(data.data); fetchData(); }
      else throw new Error(data.error || 'Gagal import.');
    } catch (err: any) { setErrorMsg(err.message); }
    finally { setImportParentLoading(false); }
  };

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
        if (!XLSX) { setImportPreview([{ nis: '(muat ulang untuk preview)', name: '', className: '' }]); return; }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        const keys = json.length > 0 ? Object.keys(json[0]) : [];
        const nisKey = keys.find(k => k.toLowerCase().trim() === 'nis' || k.toLowerCase().trim() === 'nomor induk') || 'nis';
        const nameKey = keys.find(k => k.toLowerCase().trim() === 'name' || k.toLowerCase().trim() === 'nama') || 'name';
        const classKey = keys.find(k => k.toLowerCase().trim() === 'class' || k.toLowerCase().trim() === 'kelas') || 'kelas';
        const parentNameKey = keys.find(k => ['nama orang tua', 'nama ortu', 'orang tua', 'parent name'].includes(k.toLowerCase().trim()));
        const parentEmailKey = keys.find(k => ['email orang tua', 'email ortu', 'parent email', 'email'].includes(k.toLowerCase().trim()));
        const parentPhoneKey = keys.find(k => ['no hp', 'nomer hp', 'nomor hp', 'hp', 'phone', 'telepon', 'no. wa', 'nowa', 'nomor wa'].includes(k.toLowerCase().trim()));

        const preview = json.slice(0, 5).map((r: any) => ({
          nis: String(r[nisKey] || ''),
          name: String(r[nameKey] || ''),
          className: String(r[classKey] || ''),
          parentName: parentNameKey ? String(r[parentNameKey] || '') : '',
          parentEmail: parentEmailKey ? String(r[parentEmailKey] || '') : '',
          parentPhone: parentPhoneKey ? String(r[parentPhoneKey] || '') : '',
        }));
        setImportPreview(preview);
      } catch { setImportPreview([{ nis: '(gagal baca preview)', name: '', className: '' }]); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/students/import', { method: 'POST', headers: authHeader, body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult(data.data);
        triggerToast(`Import selesai: ${data.data.imported} sukses, ${data.data.failed} gagal`);
        fetchData();
      } else throw new Error(data.error || 'Gagal import data.');
    } catch (err: any) { setErrorMsg(err.message); } finally { setImportLoading(false); }
  };

  const promoteSourceStudents = studentsList.filter(s => s.classId === parseInt(promoteFromClass));

  useEffect(() => {
    if (promoteFromClass) {
      const ids = studentsList.filter(s => s.classId === parseInt(promoteFromClass)).map(s => s.id);
      setPromoteSelectedStudents(ids);
    } else {
      setPromoteSelectedStudents([]);
    }
  }, [promoteFromClass, studentsList]);

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteFromClass || !promoteToClass) {
      alert('Pilih kelas asal dan kelas tujuan.');
      return;
    }
    if (promoteFromClass === promoteToClass) {
      alert('Kelas asal dan kelas tujuan tidak boleh sama.');
      return;
    }
    if (promoteSelectedStudents.length === 0) {
      alert('Pilih minimal satu siswa untuk dipindahkan.');
      return;
    }
    setPromoteLoading(true);
    try {
      const res = await fetch('/api/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          fromClassId: parseInt(promoteFromClass),
          toClassId: parseInt(promoteToClass),
          studentIds: promoteSelectedStudents
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('Proses kenaikan kelas berhasil dilakukan!');
        setShowPromoteModal(false);
        setPromoteFromClass('');
        setPromoteToClass('');
        fetchData();
      } else {
        throw new Error(data.error || 'Gagal melakukan kenaikan kelas.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPromoteLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    setListLoading(true);
    try {
      const [resStud, resCls] = await Promise.all([
        fetch('/api/students', { headers: authHeader }),
        fetch('/api/classes', { headers: authHeader }),
      ]);
      const dataStud = await resStud.json(); if (dataStud.success) setStudentsList(dataStud.data);
      const dataCls = await resCls.json(); if (dataCls.success) setClassesList(dataCls.data);
    } catch { /* ignore */ } finally { setListLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (toastMsg) { const t = setTimeout(() => setToastMsg(''), 4000); return () => clearTimeout(t); } }, [toastMsg]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const clientTimestamp = new Date().toISOString();
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ nis: studentNis, name: studentName, classId: parseInt(studentClassId), clientTimestamp }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Profil Siswa berhasil dibuat!'); setShowAddStudent(false); setStudentNis(''); setStudentName(''); setStudentClassId(''); fetchData(); }
      else throw new Error(data.error || 'Gagal menyimpan siswa.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStudent) return;
    try {
      const clientTimestamp = new Date().toISOString();
      const res = await fetch(`/api/students/${showEditStudent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ nis: studentNis, name: studentName, classId: parseInt(studentClassId), clientTimestamp }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Profil Siswa berhasil diperbarui!'); setShowEditStudent(null); fetchData(); }
      else throw new Error(data.error || 'Gagal memperbarui siswa.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus profil siswa ini?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Profil Siswa berhasil dihapus.'); fetchData(); }
      else throw new Error(data.error || 'Gagal menghapus siswa.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handlePhotoUpload = async () => {
    if (!showPhotoUpload || !photoFile) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await fetch(`/api/students/${showPhotoUpload.id}/photo`, {
        method: 'PUT',
        headers: authHeader,
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast('Foto siswa berhasil diperbarui!');
        setShowPhotoUpload(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        fetchData();
      } else {
        throw new Error(data.error || 'Gagal mengunggah foto.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const closePhotoUpload = () => {
    setShowPhotoUpload(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran foto maksimal 2MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Format file tidak didukung. Gunakan file gambar.');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleResetDevice = async (id: number) => {
    if (!confirm('Reset perangkat HP yang terikat pada siswa ini?')) return;
    try {
      const res = await fetch(`/api/students/${id}/reset-device`, { method: 'PUT', headers: authHeader });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Perangkat HP berhasil direset.'); fetchData(); }
      else throw new Error(data.error || 'Gagal reset device.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const handleDeleteBiometric = async (id: number) => {
    if (!confirm('Hapus data biometrik wajah siswa ini?')) return;
    try {
      const clientTimestamp = new Date().toISOString();
      const res = await fetch(`/api/students/${id}/delete-face`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify({ clientTimestamp }) });
      const data = await res.json();
      if (res.ok && data.success) { triggerToast('Data biometrik wajah berhasil dihapus.'); fetchData(); }
      else throw new Error(data.error || 'Gagal menghapus data biometrik.');
    } catch (err: any) { setErrorMsg(err.message); }
  };

  const columns = [
    {
      key: 'nis',
      header: 'Nomor Induk (NIS)',
      render: (row: StudentRecord) => <span className="font-mono text-muted-foreground font-bold">{row.nis}</span>
    },
    {
      key: 'studentName',
      header: 'Nama Siswa',
      render: (row: StudentRecord) => <span className="font-bold text-foreground">{row.studentName || '-'}</span>
    },
    {
      key: 'className',
      header: 'Kelas',
      render: (row: StudentRecord) => <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-xs font-bold">{row.className || '-'}</span>
    },
    {
      key: 'deviceUuid',
      header: 'Status Perangkat HP',
      render: (row: StudentRecord) => <DeviceBadge bound={!!row.deviceUuid} />
    },
    {
      key: 'faceEmbedding',
      header: 'Biometrik Wajah',
      align: 'center' as const,
      render: (row: StudentRecord) => (
        row.faceEmbedding ? (
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-teal-500/10 border-teal-500/20 text-teal-400">
            Terdaftar
          </span>
        ) : (
          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-500/10 border-slate-500/20 text-slate-400">
            Belum Ada
          </span>
        )
      )
    },
    {
      key: 'photo',
      header: 'Foto',
      align: 'center' as const,
      render: (row: StudentRecord) => (
        row.photo ? (
          <img src={row.photo} alt={row.studentName}
            className="w-9 h-9 rounded-full object-cover border border-border cursor-pointer hover:border-primary transition-colors"
            onClick={() => { setShowPhotoUpload(row); setPhotoPreview(row.photo!); }} />
        ) : (
          <button onClick={() => { setShowPhotoUpload(row); setPhotoPreview(null); setPhotoFile(null); }}
            className="p-1.5 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex" title="Upload Foto" aria-label="Upload foto">
            <Upload className="w-3.5 h-3.5" />
          </button>
        )
      )
    },
    {
      key: 'qrcode',
      header: 'QR Code',
      align: 'center' as const,
      render: (row: StudentRecord) => (
        row.qrcode ? (
          <button onClick={() => setPreviewQr(row)}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors inline-flex" aria-label="Lihat QR code">
            <QrCode className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-muted-foreground/50 text-xs">—</span>
        )
      )
    },
    {
      key: 'parentName',
      header: 'Orang Tua',
      render: (row: StudentRecord) => (
        <div className="flex items-center gap-2">
          {row.parentName ? (
            <span className="text-xs text-muted-foreground">{row.parentName}</span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
          <button onClick={() => { setSelectedParentId(row.parentId || ''); setShowLinkParentModal(row); }}
            className="p-1 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={row.parentId ? 'Ganti Orang Tua' : 'Tautkan Orang Tua'}>
            <Users className="w-3 h-3" />
          </button>
        </div>
      )
    },
    {
      key: 'parentPhone',
      header: 'No. WA',
      render: (row: StudentRecord) => (
        <span className="text-xs text-muted-foreground">{row.parentPhone || '—'}</span>
      )
    },
    {
      key: 'actions',
      header: 'Aksi',
      align: 'right' as const,
      render: (row: StudentRecord) => (
        <div className="space-x-1 inline-flex">
          <button onClick={() => startFaceRegistration(row)}
            className="p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 hover:text-teal-600 transition-colors inline-flex border border-teal-500/10" title="Daftarkan Wajah" aria-label="Daftarkan wajah">
            <Camera className="w-3.5 h-3.5" />
          </button>
          {row.faceEmbedding && (
            <button onClick={() => handleDeleteBiometric(row.id)}
              className="p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 hover:text-orange-600 transition-colors inline-flex border border-orange-500/10" title="Hapus Biometrik" aria-label="Hapus biometrik">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => { setStudentNis(row.nis); setStudentName(row.studentName); setStudentClassId(String(row.classId)); setShowEditStudent(row); }}
            className="p-2 rounded-lg bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors inline-flex" title="Edit Siswa" aria-label="Edit siswa">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {row.deviceUuid && (
            <button onClick={() => handleResetDevice(row.id)}
              className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-600 transition-colors inline-flex border border-amber-500/10" title="Reset Device" aria-label="Reset perangkat">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => handleDelete(row.id)}
            className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive/80 transition-colors inline-flex border border-destructive/10" aria-label="Hapus siswa">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden shadow-xl animate-fadeIn">
      <div className="px-6 py-5 border-b border-border flex justify-between items-center gap-4">
        <div><h2 className="text-base font-bold text-foreground">Kelola Profil Siswa</h2><p className="text-xs text-muted-foreground mt-1">Daftar siswa beserta NIS, kelas, dan data biometrik.</p></div>
        <div className="flex gap-2">
          <button onClick={() => { setImportParentFile(null); setImportParentPreview([]); setImportParentResult(null); setShowImportParentModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-all">
            <Upload className="w-4 h-4" /><span>Import Orang Tua</span>
          </button>
          <button onClick={() => { setPromoteFromClass(''); setPromoteToClass(''); setShowPromoteModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-all">
            <span>Kenaikan Kelas</span>
          </button>
          <button onClick={() => { setImportFile(null); setImportPreview([]); setImportResult(null); setShowImportModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
            <Upload className="w-4 h-4" /><span>Import Excel</span>
          </button>
          <button onClick={() => { setStudentNis(''); setStudentName(''); setStudentClassId(''); setShowAddStudent(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
            <Plus className="w-4 h-4" /><span>Tambah Profil Siswa</span>
          </button>
        </div>
      </div>
      <div className="w-full">
        <DataTable
          columns={columns}
          data={studentsList}
          loading={listLoading}
          searchPlaceholder="Cari siswa..."
          emptyText="Tidak ada profil siswa."
        />
      </div>
      {errorMsg && <div className="px-6 py-3 text-destructive text-xs">{errorMsg}</div>}
      {toastMsg && <div className="fixed bottom-5 right-5 z-50 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce"><span>{toastMsg}</span></div>}

      {showAddStudent && (
        <ModalShell title="Tambah Profil Siswa" onClose={() => setShowAddStudent(false)} maxWidth="md"
          footer={<><button type="button" onClick={() => setShowAddStudent(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="addStudentForm" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan</button></>}>
          <form id="addStudentForm" onSubmit={handleAdd}>
            <div className="space-y-4">
              <FormInput label="Nomor Induk Siswa (NIS)" value={studentNis} onChange={(e) => setStudentNis(e.target.value)} placeholder="Contoh: SISWA-BTG-025" required />
              <FormInput label="Nama Siswa" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Contoh: Ani Rahmawati" required />
              <FormSelect label="Kelas" value={studentClassId} onChange={(e) => setStudentClassId(e.target.value)}
                options={classesList.map(c => ({ value: String(c.id), label: c.name }))} placeholder="-- Pilih Kelas --" />
            </div>
          </form>
        </ModalShell>
      )}

      {showEditStudent && (
        <ModalShell title="Edit Profil Siswa" onClose={() => setShowEditStudent(null)} maxWidth="md"
          footer={<><button type="button" onClick={() => setShowEditStudent(null)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button><button type="submit" form="editStudentForm" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Simpan Perubahan</button></>}>
          <form id="editStudentForm" onSubmit={handleEdit}>
            <div className="space-y-4">
              <FormInput label="Nomor Induk Siswa (NIS)" value={studentNis} onChange={(e) => setStudentNis(e.target.value)} required />
              <FormInput label="Nama Siswa" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
              <FormSelect label="Kelas" value={studentClassId} onChange={(e) => setStudentClassId(e.target.value)}
                options={classesList.map(c => ({ value: String(c.id), label: c.name }))} placeholder="-- Pilih Kelas --" />
            </div>
          </form>
        </ModalShell>
      )}

      {previewQr && (
        <ModalShell title={`QR Code - ${previewQr.nis}`} onClose={() => setPreviewQr(null)} maxWidth="sm"
          footer={<>
            <a href={previewQr.qrcode!} download={`${previewQr.nis}.png`}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs inline-flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Unduh QR
            </a>
            <button onClick={() => setPreviewQr(null)}
              className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Tutup</button>
          </>}>
          <div className="flex flex-col items-center gap-4 py-4">
            <img src={previewQr.qrcode!} alt={`QR ${previewQr.nis}`}
              className="w-48 h-48 rounded-xl border border-border" />
            <div className="text-center">
              <p className="font-bold text-foreground text-sm">{previewQr.studentName || previewQr.nis}</p>
              <p className="text-muted-foreground text-xs mt-1">NIS: {previewQr.nis}</p>
            </div>
          </div>
        </ModalShell>
      )}

      {showFaceRegister && (
        <ModalShell title={`Pendaftaran Wajah - ${showFaceRegister.studentName || showFaceRegister.nis}`} onClose={closeFaceRegister} maxWidth="md"
          footer={<>
            <button onClick={closeFaceRegister} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={handleCaptureFace} disabled={faceLoading} className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> {faceLoading ? 'Memproses...' : 'Ambil Wajah & Simpan'}
            </button>
          </>}>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative w-full max-w-[320px] aspect-[4/3] bg-black rounded-xl overflow-hidden border-2 border-border shadow-inner">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100"></video>
              <div className="absolute inset-0 border-2 border-teal-500/50 rounded-xl pointer-events-none border-dashed m-4"></div>
              {faceCameraDevices.length > 1 && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="relative">
                    <button onClick={() => setFaceShowCameraPicker(v => !v)}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                      title="Ganti Kamera">
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    {faceShowCameraPicker && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden">
                        {faceCameraDevices.map(d => (
                          <button key={d.deviceId}
                            onClick={() => faceSwitchCamera(d.deviceId)}
                            className={`w-full text-left px-3 py-2 text-xs border-b border-border last:border-b-0 transition-colors ${
                              d.deviceId === faceSelectedCameraId
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-accent'
                            }`}>
                            {d.label || `Kamera ${d.deviceId.slice(0, 8)}...`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {faceStatus && <p className="text-sm text-center text-muted-foreground font-medium animate-pulse">{faceStatus}</p>}
            <p className="text-xs text-center text-muted-foreground/70 px-4">Posisikan wajah Anda tepat di tengah kamera dengan pencahayaan yang cukup. Pastikan Anda tidak memakai kacamata hitam atau masker.</p>
          </div>
        </ModalShell>
      )}
      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <ModalShell title={`Upload Foto - ${showPhotoUpload.studentName || showPhotoUpload.nis}`} onClose={closePhotoUpload} maxWidth="sm"
          footer={<>
            <button onClick={closePhotoUpload} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={handlePhotoUpload} disabled={!photoFile || photoUploading}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" /> {photoUploading ? 'Mengunggah...' : 'Simpan Foto'}
            </button>
          </>}>
          <div className="flex flex-col items-center gap-4 py-4">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview"
                className="w-40 h-40 rounded-full object-cover border-4 border-border shadow-lg" />
            ) : (
              <div className="w-40 h-40 rounded-full bg-background border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/60">
                <Upload className="w-10 h-10" />
              </div>
            )}
            <label className="cursor-pointer px-4 py-2 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-bold transition-all inline-flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" /> Pilih File Foto
              <input type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" />
            </label>
            <p className="text-xs text-muted-foreground/70 text-center">Format: JPG, PNG, WebP. Maks: 2MB.</p>
          </div>
        </ModalShell>
      )}

      {/* Promote Students Modal */}
      {showPromoteModal && (
        <ModalShell title="Kenaikan Kelas Massal" onClose={() => setShowPromoteModal(false)} maxWidth="lg"
          footer={<><button type="button" onClick={() => setShowPromoteModal(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={handlePromoteSubmit} disabled={promoteLoading} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">
              {promoteLoading ? 'Memproses...' : 'Proses Kenaikan Kelas'}
            </button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormSelect label="Dari Kelas (Asal)" value={promoteFromClass} onChange={e => setPromoteFromClass(e.target.value)}
                options={classesList.map(c => ({ value: String(c.id), label: c.name }))} placeholder="-- Pilih Kelas Asal --" />
              <FormSelect label="Ke Kelas (Tujuan)" value={promoteToClass} onChange={e => setPromoteToClass(e.target.value)}
                options={classesList.map(c => ({ value: String(c.id), label: c.name }))} placeholder="-- Pilih Kelas Tujuan --" />
            </div>

            {promoteFromClass && (
              <div className="border border-border rounded-xl p-4 bg-muted/5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-foreground">Daftar Siswa ({promoteSourceStudents.length} siswa):</span>
                  <button type="button" onClick={() => {
                    if (promoteSelectedStudents.length === promoteSourceStudents.length) {
                      setPromoteSelectedStudents([]);
                    } else {
                      setPromoteSelectedStudents(promoteSourceStudents.map(s => s.id));
                    }
                  }} className="text-xs text-teal-400 font-bold hover:underline">
                    {promoteSelectedStudents.length === promoteSourceStudents.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                </div>
                {promoteSourceStudents.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center py-6">Tidak ada siswa di kelas ini.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {promoteSourceStudents.map(s => {
                      const isChecked = promoteSelectedStudents.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/10 cursor-pointer border border-border/30 bg-background/50">
                          <input type="checkbox" checked={isChecked} onChange={() => {
                            if (isChecked) {
                              setPromoteSelectedStudents(prev => prev.filter(id => id !== s.id));
                            } else {
                              setPromoteSelectedStudents(prev => [...prev, s.id]);
                            }
                          }} className="rounded border-border focus:ring-teal-400" />
                          <div className="text-xs">
                            <span className="font-bold text-foreground">{s.studentName || 'Siswa'}</span>
                            <span className="text-muted-foreground font-mono ml-2">({s.nis})</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalShell>
      )}
      {/* Link Parent Modal */}
      {showLinkParentModal && (
        <ModalShell title={`Tautkan Orang Tua - ${showLinkParentModal.studentName}`} onClose={() => setShowLinkParentModal(null)} maxWidth="sm"
          footer={<><button type="button" onClick={() => setShowLinkParentModal(null)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={() => { if (!showLinkParentModal.parentId) { handleUnlinkParent(showLinkParentModal.id); } else { handleLinkParent(); } }}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">{showLinkParentModal.parentId ? 'Simpan Perubahan' : 'Tautkan'}</button></>}>
          <div className="space-y-4">
            {showLinkParentModal.parentId && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-600 font-semibold">Sudah memiliki tautan orang tua</p>
                <p className="text-xs text-muted-foreground mt-1">{showLinkParentModal.parentName}</p>
                <button onClick={() => handleUnlinkParent(showLinkParentModal.id)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-colors">
                  Lepaskan Tautan
                </button>
              </div>
            )}
            <label className="block text-muted-foreground mb-1.5 uppercase font-semibold">Cari Orang Tua</label>
            <input type="text" placeholder="Ketik nama atau email orang tua..."
              onChange={async (e) => {
                const q = e.target.value;
                if (q.length < 2) { setParentUsers([]); return; }
                try {
                  const res = await fetch(`/api/parents/search?q=${encodeURIComponent(q)}`, { headers: authHeader });
                  const data = await res.json();
                  if (data.success) setParentUsers(data.data);
                } catch {}
              }}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none" />
            {parentUsers.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-2 bg-muted/5">
                {parentUsers.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedParentId === p.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/10 border border-transparent'}`}>
                    <input type="radio" name="parent" value={p.id} checked={selectedParentId === p.id}
                      onChange={() => setSelectedParentId(p.id)} className="text-primary focus:ring-primary/30" />
                    <div className="text-xs">
                      <span className="font-bold text-foreground">{p.name}</span>
                      <span className="text-muted-foreground ml-2">({p.email})</span>
                      {p.phone && <span className="text-muted-foreground/50 ml-1">— {p.phone}</span>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {parentUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Ketik minimal 2 karakter untuk mencari orang tua.</p>}
          </div>
        </ModalShell>
      )}

      {/* Import Parent Excel Modal */}
      {showImportParentModal && (
        <ModalShell title="Import Orang Tua dari Excel" onClose={() => { setShowImportParentModal(false); setImportParentResult(null); setImportParentFile(null); setImportParentPreview([]); }} maxWidth="lg"
          footer={!importParentResult ? <><button type="button" onClick={() => setShowImportParentModal(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground font-bold hover:text-foreground text-xs">Batal</button>
            <button onClick={handleImportParentSubmit} disabled={!importParentFile || importParentLoading}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 ${!importParentFile || importParentLoading ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}>
              {importParentLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengimport...</> : <><Upload className="w-3.5 h-3.5" /> Import</>}
            </button></> : undefined}>
          {importParentResult ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-500">{importParentResult.imported}</div>
                  <div className="text-muted-foreground mt-1">Berhasil</div>
                </div>
                <div className="flex-1 bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">{importParentResult.failed}</div>
                  <div className="text-muted-foreground mt-1">Gagal</div>
                </div>
              </div>
              {importParentResult.results.filter((r: any) => r.status === 'gagal').length > 0 && (
                <div>
                  <h4 className="text-foreground/80 font-semibold mb-2">Detail Error:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importParentResult.results.filter((r: any) => r.status === 'gagal').map((r: any, i: number) => (
                      <div key={i} className="bg-destructive/5 border border-destructive/10 rounded-lg px-3 py-2 text-foreground/80">
                        <span className="text-muted-foreground">Baris {r.row}:</span> NIS: {r.nis} — <span className="text-destructive">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { setShowImportParentModal(false); setImportParentResult(null); setImportParentFile(null); setImportParentPreview([]); }}
                className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Tutup</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                <span className="text-xs text-muted-foreground">Butuh template? Download file contoh Excel:</span>
                <a href="/api/templates/download/parent"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
                  <Download className="w-3.5 h-3.5" /> Download Template
                </a>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1.5 uppercase font-semibold">File Excel</label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('parent-excel-file-input')?.click()}>
                  {importParentFile ? (
                    <div className="text-foreground">
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-primary mb-2" />
                      <p className="font-semibold">{importParentFile.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">{(importParentFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="font-semibold">Klik untuk pilih file Excel</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">Format .xlsx atau .xls</p>
                    </div>
                  )}
                  <input id="parent-excel-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportParentFileChange} />
                </div>
              </div>
              {importParentPreview.length > 0 && (
                <div>
                  <h4 className="text-foreground/80 font-semibold mb-2">Preview (5 baris pertama):</h4>
                  <div className="bg-background rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead><tr className="bg-secondary text-muted-foreground uppercase font-semibold">
                        <th className="px-3 py-2">NIS</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">No. WA</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Password</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border">
                        {importParentPreview.map((row, i) => (
                          <tr key={i} className="text-foreground">
                            <td className="px-3 py-2">{row.nis || '-'}</td>
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.phone || '-'}</td>
                            <td className="px-3 py-2">{row.email || '-'}</td>
                            <td className="px-3 py-2">{row.password ? '••••••' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">Kolom wajib: NIS, Nama/Nama Orang Tua, Email, Password. No. WA opsional.</p>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <ModalShell title="Import Siswa dari Excel" onClose={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); setImportPreview([]); }} maxWidth="lg"
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
                      <div key={i} className="bg-destructive/5 border border-destructive/10 rounded-lg px-3 py-2 text-foreground/80">
                        <span className="text-muted-foreground">Baris {r.row}:</span> NIS: {r.nis} — <span className="text-destructive">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); setImportPreview([]); }}
                className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">Tutup</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                <span className="text-xs text-muted-foreground">Butuh template? Download file contoh Excel:</span>
                <a href="/api/templates/download/siswa"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all">
                  <Download className="w-3.5 h-3.5" /> Download Template
                </a>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1.5 uppercase font-semibold">File Excel</label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('student-excel-file-input')?.click()}>
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
                  <input id="student-excel-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileChange} />
                </div>
              </div>
              {importPreview.length > 0 && (
                <div>
                  <h4 className="text-foreground/80 font-semibold mb-2">Preview (5 baris pertama):</h4>
                  <div className="bg-background rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                       <thead><tr className="bg-secondary text-muted-foreground uppercase font-semibold">
                         <th className="px-3 py-2">NIS</th><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Kelas</th><th className="px-3 py-2">Nama Ortu</th><th className="px-3 py-2">Email Ortu</th><th className="px-3 py-2">No. HP</th>
                       </tr></thead>
                       <tbody className="divide-y divide-border">
                         {importPreview.map((row, i) => (
                           <tr key={i} className="text-foreground">
                             <td className="px-3 py-2">{row.nis || '-'}</td>
                             <td className="px-3 py-2">{row.name || '-'}</td>
                             <td className="px-3 py-2">{row.className || '-'}</td>
                             <td className="px-3 py-2">{row.parentName || '-'}</td>
                             <td className="px-3 py-2">{row.parentEmail || '-'}</td>
                             <td className="px-3 py-2">{row.parentPhone || '-'}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">Kolom: NIS, Nama, Kelas, Nama Orang Tua, Email, Password, Nomer HP (kolom orang tua opsional)</p>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </section>
  );
};
