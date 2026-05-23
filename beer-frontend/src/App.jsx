import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import Participants from './pages/Participants';
import Transfers from './pages/Transfers';
import Users from './pages/Users';
import { Beer } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Beer size={26} />
        </div>
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
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
