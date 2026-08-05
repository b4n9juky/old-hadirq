import { RefreshCw, CheckCircle } from 'lucide-react';

const allOptions = [
  { value: 'dashboard', label: 'Dashboard', roles: ['admin', 'guru'] },
  { value: 'users', label: 'Pengguna', roles: ['admin'] },
  { value: 'classes', label: 'Kelas', roles: ['admin'] },
  { value: 'students', label: 'Siswa', roles: ['admin'] },
  { value: 'academic', label: 'Jadwal & Periode', roles: ['admin'] },
  { value: 'teaching-schedule', label: 'Jadwal Mengajar', roles: ['admin', 'guru'] },
  { value: 'subjects', label: 'Mata Pelajaran', roles: ['admin'] },
  { value: 'agenda-attendance', label: 'Agenda Absensi', roles: ['guru'] },
  { value: 'settings', label: 'Pengaturan', roles: ['admin'] },
  { value: 'parent', label: 'Dashboard', roles: ['parent'] },
];

interface Props {
  activeSection: string;
  onSectionChange: (s: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  user: { name: string; role: string };
}

export const TopBar: React.FC<Props> = ({ activeSection, onSectionChange, onRefresh, isLoading, user }) => {
  const options = allOptions.filter(item => item.roles.includes(user.role));

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md px-6 py-4 flex items-center justify-between md:justify-end">
      <div className="flex items-center gap-2 md:hidden">
        <CheckCircle className="w-5 h-5 text-primary animate-pulse-soft" />
        <span className="font-black text-foreground text-sm">HadirQ Panel</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
          aria-label="Muat ulang data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <div className="md:hidden">
          <select
            value={activeSection}
            onChange={(e) => onSectionChange(e.target.value)}
            className="bg-muted/50 border border-border rounded-lg px-2.5 py-2 text-sm font-medium text-foreground focus:border-primary/50 transition-colors"
            aria-label="Navigasi menu"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
