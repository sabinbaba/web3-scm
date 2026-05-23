import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import toast, { resolveValue, Toaster } from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import Participants from './pages/Participants';
import Transfers from './pages/Transfers';
import Users from './pages/Users';
import BrandMark from './components/BrandMark';

function AppToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerStyle={{ top: 18, right: 18 }}
      toastOptions={{
        duration: 4200,
        success: { duration: 3200 },
        error: { duration: 5200 },
      }}
    >
      {(t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const statusLabel = isSuccess ? 'Success' : isError ? 'Action failed' : 'Notice';
        const statusClass = isSuccess
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : isError
            ? 'bg-red-50 text-red-700 ring-red-200'
            : 'bg-sky-50 text-sky-700 ring-sky-200';
        const StatusIcon = isSuccess ? CheckCircle2 : isError ? AlertTriangle : Info;

        return (
          <div
            style={{
              opacity: t.visible ? 1 : 0,
              transform: t.visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
            }}
            className="pointer-events-auto w-[min(92vw,390px)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl shadow-gray-900/10 transition-all duration-200"
          >
            <div className="flex gap-3 p-4">
              <BrandMark className="h-10 w-10 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass}`}>
                    <StatusIcon size={14} />
                    {statusLabel}
                  </span>
                </div>
                <div className="text-sm leading-5 text-gray-700">
                  {resolveValue(t.message, t)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="icon-button -mr-1 -mt-1 h-7 w-7 flex-shrink-0 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
            <div className={`h-1 ${isSuccess ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-sky-500'}`} />
          </div>
        );
      }}
    </Toaster>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <BrandMark className="mx-auto mb-3 h-12 w-12" />
        <p className="text-sm text-gray-500">Loading workspace...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard"    element={<ProtectedRoute><Dashboard />    </ProtectedRoute>} />
      <Route path="/batches"      element={<ProtectedRoute><Batches />      </ProtectedRoute>} />
      <Route path="/transfers"    element={<ProtectedRoute><Transfers />    </ProtectedRoute>} />
      <Route path="/participants" element={<ProtectedRoute><Participants /> </ProtectedRoute>} />
      <Route path="/users"        element={<ProtectedRoute><Users />         </ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppToaster />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
