import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Activity, BarChart3, Settings, Calendar as CalendarIcon, Boxes, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useRef, useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const roleLabel: Record<string,string> = { superadmin: 'Superadmin', org_admin: 'Org-Admin', user: 'Benutzer' };
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openMenu = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; } setMenuOpen(true); };
  const scheduleClose = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setMenuOpen(false), 150); };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-mint-cream">
      {/* Header */}
      <header className="bg-viridian text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Stato 2.0</h1>
            <p className="text-sm text-mint-green">OKJA Statistik & Dokumentation</p>
          </div>
          {/* Current user and org summary */}
          <div className="hidden sm:flex flex-col items-end text-sm">
            <div className="font-medium">{user?.name || user?.email}</div>
            <div className="opacity-90 text-mint-green">{roleLabel[user?.role || 'user']}{user?.orgName ? ` · ${user.orgName}` : (user?.orgId ? ` · Org ${user.orgId}` : '')}</div>
          </div>
          {/* User menu */}
          <div className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
            <button aria-label="Benutzer" className="flex items-center gap-2 hover:opacity-90" onClick={()=> setMenuOpen((v)=>!v)}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <UserCircle2 className="w-8 h-8" />
              )}
            </button>
            {/* Compact user/org on mobile */}
            <div className="flex sm:hidden flex-col items-end ml-2 text-[11px] leading-4">
              <div className="font-medium truncate max-w-[40vw]">{user?.name || user?.email}</div>
              <div className="opacity-90 text-mint-green truncate max-w-[40vw]">{user?.orgName ? user.orgName : (user?.orgId ? `Org ${user.orgId}` : '')}</div>
            </div>
            {menuOpen && (
            <div className="absolute right-0 mt-2 bg-white text-gray-800 rounded shadow-lg w-56 z-50" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
              <div className="px-4 py-3 border-b">
                <div className="font-semibold">{user?.name || user?.email}</div>
                <div className="text-xs text-gray-500">{roleLabel[user?.role || 'user']}{user?.orgName ? ` · ${user.orgName}` : (user?.orgId ? ` · Org ${user.orgId}` : '')}</div>
              </div>
              <ul className="py-1 text-sm">
                <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={()=>{ navigate('/me'); setMenuOpen(false); }}>Meine Daten</button></li>
                {user?.role === 'superadmin' && (
                  <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={()=>navigate('/admin/orgs')}>Organisationen</button></li>
                )}
                {(user?.role === 'org_admin' || user?.role === 'superadmin') && (
                  <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={()=>navigate('/admin/users')}>Benutzer</button></li>
                )}
                <li><button className="w-full text-left px-4 py-2 hover:bg-gray-100" onClick={()=>{ logout(); setMenuOpen(false); }}>Abmelden</button></li>
              </ul>
            </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation (desktop) */}
      <nav className="bg-cambridge-blue text-white shadow-md hidden md:block">
        <div className="container mx-auto px-4">
          <ul className="flex space-x-1">
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/dashboard') ? 'bg-viridian' : ''
                }`}
              >
                <Home className="w-5 h-5 mr-2" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/activities"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/activities') ? 'bg-viridian' : ''
                }`}
              >
                <Activity className="w-5 h-5 mr-2" />
                Aktivitäten
              </Link>
            </li>
            <li>
              <Link
                to="/calendar"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/calendar') ? 'bg-viridian' : ''
                }`}
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Kalender
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/projects') ? 'bg-viridian' : ''
                }`}
              >
                <Boxes className="w-5 h-5 mr-2" />
                Projekte
              </Link>
            </li>
            <li>
              <Link
                to="/statistics"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/statistics') ? 'bg-viridian' : ''
                }`}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                Statistiken
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                className={`flex items-center px-4 py-3 hover:bg-viridian transition-colors ${
                  isActive('/settings') ? 'bg-viridian' : ''
                }`}
              >
                <Settings className="w-5 h-5 mr-2" />
                Einstellungen
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom Navigation (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t shadow md:hidden z-50">
        <ul className="grid grid-cols-6 text-xs">
          <li>
            <Link
              to="/dashboard"
              className={`flex flex-col items-center py-2 ${isActive('/dashboard') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>
          </li>
          <li>
            <Link
              to="/activities"
              className={`flex flex-col items-center py-2 ${isActive('/activities') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Activity className="w-5 h-5" />
              <span>Aktiv.</span>
            </Link>
          </li>
          <li>
            <Link
              to="/calendar"
              className={`flex flex-col items-center py-2 ${isActive('/calendar') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <CalendarIcon className="w-5 h-5" />
              <span>Kalender</span>
            </Link>
          </li>
          <li>
            <Link
              to="/projects"
              className={`flex flex-col items-center py-2 ${isActive('/projects') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Boxes className="w-5 h-5" />
              <span>Projekte</span>
            </Link>
          </li>
          <li>
            <Link
              to="/statistics"
              className={`flex flex-col items-center py-2 ${isActive('/statistics') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Stats</span>
            </Link>
          </li>
          <li>
            <Link
              to="/settings"
              className={`flex flex-col items-center py-2 ${isActive('/settings') ? 'text-viridian' : 'text-gray-600'}`}
            >
              <Settings className="w-5 h-5" />
              <span>Einst.</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Footer */}
      <footer className="bg-azure-web text-gray-600 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm">
          <p>
            © {new Date().getFullYear()} Stato 2.0 · Version 0.7 ·{' '}
            <a href="mailto:nikolas.haefner@mannheim.de" className="underline hover:text-viridian">Nikolas Häfner</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
