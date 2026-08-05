import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ErrorBanner } from '../shared/ErrorBanner';
import { useState } from 'react';

const sectionMap: Record<string, string> = {
  ringkasan: 'dashboard',
  pengguna: 'users',
  'absensi-guru': 'teacher-attendance',
  'cetak-jurnal': 'print-journal',
  'cetak-kartu-siswa': 'print-student-card',
  kelas: 'classes',
  siswa: 'students',
  akademik: 'academic',
  'jadwal-mengajar': 'teaching-schedule',
  rekap: 'recap',
  'mata-pelajaran': 'subjects',
  'agenda-absensi': 'agenda-attendance',
  pengaturan: 'settings',
  'orang-tua': 'parent',
  whatsapp: 'whatsapp',
};

const pathToSection: Record<string, string> = {
  dashboard: 'ringkasan',
  users: 'pengguna',
  'teacher-attendance': 'absensi-guru',
  'print-journal': 'cetak-jurnal',
  'print-student-card': 'cetak-kartu-siswa',
  classes: 'kelas',
  students: 'siswa',
  academic: 'akademik',
  'teaching-schedule': 'jadwal-mengajar',
  recap: 'rekap',
  subjects: 'mata-pelajaran',
  'agenda-attendance': 'agenda-absensi',
  settings: 'pengaturan',
  parent: 'orang-tua',
  whatsapp: 'whatsapp',
};

interface Props {
  user: { name: string; role: string };
  onLogout: () => void;
}

export const DashboardLayout: React.FC<Props> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');

  const currentPath = location.pathname.split('/').pop() || 'ringkasan';
  const activeSection = sectionMap[currentPath] || 'dashboard';

  const handleSectionChange = (section: string) => {
    const path = pathToSection[section] || 'ringkasan';
    navigate(`/dashboard/${path}`);
    setErrorMsg('');
  };

  const handleRefresh = () => {
    setErrorMsg('');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} user={user} onLogout={onLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar activeSection={activeSection} onSectionChange={handleSectionChange} onRefresh={handleRefresh} isLoading={false} user={user} />
        <main className="flex-1 p-6 overflow-y-auto max-w-6xl w-full mx-auto space-y-6 animate-fade-in">
          <ErrorBanner message={errorMsg} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};
