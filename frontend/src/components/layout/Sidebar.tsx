import { LogOut, Users, LayoutDashboard, BookOpen, GraduationCap, Calendar, Settings, Clock, Book, ClipboardCheck, GraduationCap as SchoolIcon, FileText, UserCheck, Printer, CreditCard, MessageCircle } from 'lucide-react';
import { ThemeToggle } from '../shared/ThemeToggle';

const allNavItems = [
  { path: '/dashboard/ringkasan', key: 'dashboard', icon: LayoutDashboard, label: 'Ringkasan', roles: ['admin', 'guru'] },
  { path: '/dashboard/pengguna', key: 'users', icon: Users, label: 'Pengguna', roles: ['admin'] },
  { path: '/dashboard/absensi-guru', key: 'teacher-attendance', icon: UserCheck, label: 'Absensi Guru', roles: ['admin'] },
  { path: '/dashboard/kelas', key: 'classes', icon: BookOpen, label: 'Kelas', roles: ['admin'] },
  { path: '/dashboard/siswa', key: 'students', icon: GraduationCap, label: 'Siswa', roles: ['admin'] },
  { path: '/dashboard/whatsapp', key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Bot', roles: ['admin'] },
  { path: '/dashboard/akademik', key: 'academic', icon: Calendar, label: 'Akademik', roles: ['admin'] },
  { path: '/dashboard/jadwal-mengajar', key: 'teaching-schedule', icon: Clock, label: 'Jadwal Mengajar', roles: ['admin', 'guru'] },
  { path: '/dashboard/rekap', key: 'recap', icon: FileText, label: 'Rekap Jurnal', roles: ['admin', 'guru'] },
  { path: '/dashboard/cetak-jurnal', key: 'print-journal', icon: Printer, label: 'Cetak Buku Jurnal', roles: ['admin', 'guru'] },
  { path: '/dashboard/cetak-kartu-siswa', key: 'print-student-card', icon: CreditCard, label: 'Cetak Kartu Siswa', roles: ['admin'] },
  { path: '/dashboard/mata-pelajaran', key: 'subjects', icon: Book, label: 'Mata Pelajaran', roles: ['admin'] },
  { path: '/dashboard/agenda-absensi', key: 'agenda-attendance', icon: ClipboardCheck, label: 'Agenda Absensi', roles: ['guru'] },
  { path: '/dashboard/pengaturan', key: 'settings', icon: Settings, label: 'Pengaturan', roles: ['admin'] },
  { path: '/dashboard/orang-tua', key: 'parent', icon: Users, label: 'Dashboard', roles: ['parent'] },
];

interface Props {
  activeSection: string;
  onSectionChange: (s: string) => void;
  user: { name: string; role: string };
  onLogout: () => void;
}

export const Sidebar: React.FC<Props> = ({ activeSection, onSectionChange, user, onLogout }) => {
  const navItems = allNavItems.filter(item => item.roles.includes(user.role));

  return (
    <aside className="w-60 bg-card border-r border-border hidden md:flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <SchoolIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
              Hadir<span className="text-primary">Q</span>
            </h1>
            <p className="text-2xs text-muted-foreground mt-0.5">Sistem Absensi</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ key, icon: Icon, label }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <ThemeToggle />
        <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm">
          <div className="font-semibold text-foreground truncate">{user.name}</div>
          <div className="text-2xs text-muted-foreground uppercase tracking-wider mt-0.5">{user.role}</div>
        </div>
        <button
          onClick={onLogout}
          className="btn-danger w-full text-sm"
          aria-label="Keluar dari akun"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};
