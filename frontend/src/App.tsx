import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardSection } from './components/sections/DashboardSection';
import { UsersSection } from './components/sections/UsersSection';
import { ClassesSection } from './components/sections/ClassesSection';
import { StudentsSection } from './components/sections/StudentsSection';
import { AcademicSection } from './components/sections/AcademicSection';
import { SettingsSection } from './components/sections/SettingsSection';
import { TeachingScheduleSection } from './components/sections/TeachingScheduleSection';
import { TeacherScheduleSection } from './components/sections/TeacherScheduleSection';
import { SubjectsSection } from './components/sections/SubjectsSection';
import { AgendaAttendanceSection } from './components/sections/AgendaAttendanceSection';
import { RecapSection } from './components/sections/RecapSection';
import { JournalPrintSection } from './components/sections/JournalPrintSection';
import { StudentCardPrintSection } from './components/sections/StudentCardPrintSection';
import { ParentSection } from './components/sections/ParentSection';
import { WhatsAppSection } from './components/sections/WhatsAppSection';
import { FaceRegistration } from './components/sections/FaceRegistration';
import { KioskAttendance } from './components/sections/KioskAttendance';
import { QrKioskAttendance } from './components/sections/QrKioskAttendance';
import { TeacherAttendanceSection } from './components/sections/TeacherAttendanceSection';

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('absen_admin_token');
    const savedUser = localStorage.getItem('absen_admin_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('absen_admin_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('absen_admin_token', newToken);
    localStorage.setItem('absen_admin_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('absen_admin_token');
    localStorage.removeItem('absen_admin_user');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-teal-400 font-bold text-sm tracking-widest">
        MEMUAT SISTEM...
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/kiosk-absensi" element={<KioskAttendance />} />
        <Route path="/kiosk-qr" element={<QrKioskAttendance />} />
        <Route path="/registrasi-wajah" element={<FaceRegistration />} />
        <Route
          path="/login"
          element={
            !token || !user ? (
              <LoginScreen onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to={user?.role === 'parent' ? '/dashboard/orang-tua' : '/dashboard/ringkasan'} replace />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            token && user ? (
              <DashboardLayout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Navigate to={user?.role === 'parent' ? 'orang-tua' : 'ringkasan'} replace />} />
          <Route path="ringkasan" element={user?.role === 'parent' ? <Navigate to="orang-tua" replace /> : <DashboardSection token={token!} user={user!} />} />
          <Route path="orang-tua" element={user?.role === 'parent' ? <ParentSection token={token!} user={user!} /> : <Navigate to="/dashboard/ringkasan" replace />} />
          <Route path="pengguna" element={<UsersSection token={token!} />} />
          <Route path="kelas" element={<ClassesSection token={token!} />} />
          <Route path="siswa" element={<StudentsSection token={token!} />} />
          <Route path="akademik" element={<AcademicSection token={token!} />} />
          <Route path="pengaturan" element={<SettingsSection token={token!} />} />
          <Route path="absensi-guru" element={user?.role === 'admin' ? <TeacherAttendanceSection token={token!} /> : <Navigate to="/dashboard/ringkasan" replace />} />
          <Route path="jadwal-mengajar" element={user?.role === 'guru' ? <TeacherScheduleSection token={token!} /> : <TeachingScheduleSection token={token!} />} />
          <Route path="mata-pelajaran" element={user?.role === 'admin' ? <SubjectsSection token={token!} /> : <Navigate to="/dashboard/ringkasan" replace />} />
          <Route path="agenda-absensi" element={user?.role === 'guru' ? <AgendaAttendanceSection token={token!} /> : <Navigate to="/dashboard/ringkasan" replace />} />
          <Route path="rekap" element={<RecapSection token={token!} />} />
          <Route path="cetak-jurnal" element={<JournalPrintSection token={token!} user={user!} />} />
          <Route path="cetak-kartu-siswa" element={<StudentCardPrintSection token={token!} />} />
          <Route path="whatsapp" element={user?.role === 'admin' ? <WhatsAppSection token={token!} /> : <Navigate to="/dashboard/ringkasan" replace />} />
        </Route>
        <Route path="*" element={<Navigate to={token && user ? (user.role === 'parent' ? '/dashboard/orang-tua' : '/dashboard/ringkasan') : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
