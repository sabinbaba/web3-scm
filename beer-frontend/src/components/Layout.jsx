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
  Beer,
  ArrowLeftRight,
} from 'lucide-react';

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/batches',      label: 'Batches',       icon: Package },
  { to: '/transfers',    label: 'Transfers',     icon: ArrowLeftRight },
  { to: '/participants', label: 'Participants',  icon: Users },
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
    <div className="min-h-screen bg-gray-50 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-30 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Beer className="text-amber-500" size={28} />
            <div>
              <h1 className="font-bold text-gray-800 text-lg leading-tight">Bralirwa</h1>
              <p className="text-xs text-gray-400">Supply Chain</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <p className="font-semibold text-gray-800 text-sm">{user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user?.role] || 'bg-gray-100 text-gray-600'}`}>
            {user?.role}
          </span>
        </div>

        {/* Nav items — scrollable middle section */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                ${isActive
                  ? 'bg-amber-50 text-amber-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout — always at bottom, never overlaps */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar for mobile */}
        <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-4 lg:hidden flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Beer className="text-amber-500" size={20} />
            <span className="font-bold text-gray-800">Bralirwa SCM</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}