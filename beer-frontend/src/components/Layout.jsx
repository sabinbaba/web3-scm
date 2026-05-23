import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Package,
  Users,
  LogOut,
  Menu,
  ArrowLeftRight,
  UserCog,
} from 'lucide-react';
import BrandMark from './BrandMark';

const ROLE_COLORS = {
  supplier:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  manufacturer: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  distributor:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  retailer:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

const getNavItems = (user) => [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/batches',      label: 'Batches',       icon: Package },
  { to: '/transfers',    label: 'Transfers',     icon: ArrowLeftRight },
  { to: '/participants', label: 'Participants',  icon: Users },
  ...(user?.isAdmin ? [{ to: '/users', label: 'Users', icon: UserCog }] : []),
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex text-gray-900">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-200 z-30 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12 flex-shrink-0" />
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">Bralirwa SCM</h1>
              <p className="text-xs text-gray-500">Supply chain workspace</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
          <span className={`inline-flex mt-3 px-2 py-0.5 rounded-md text-xs font-medium capitalize ${ROLE_COLORS[user?.role] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
            {user?.role}
          </span>
        </div>

        {/* Nav items — scrollable middle section */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {getNavItems(user).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout — always at bottom, never overlaps */}
        <div className="flex-shrink-0 p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar for mobile */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="icon-button text-gray-600 hover:bg-gray-100" aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark className="h-8 w-8 flex-shrink-0" />
            <span className="font-bold text-gray-900">Bralirwa SCM</span>
          </div>
        </header>

        <header className="hidden lg:flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8 flex-shrink-0">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Organization</p>
            <p className="text-sm font-semibold text-gray-900">{user?.mspId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium capitalize ${ROLE_COLORS[user?.role] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
              {user?.role}
            </span>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="page-shell">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
