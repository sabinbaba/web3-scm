import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LockKeyhole, Mail } from 'lucide-react';
import bottleBackground from '../assets/beer-bottle-background.png';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(90deg, rgb(245 247 250 / 0.96) 0%, rgb(245 247 250 / 0.9) 42%, rgb(245 247 250 / 0.2) 100%), url(${bottleBackground})` }}
    >
      <div className="panel w-full max-w-md p-7 sm:p-8 bg-white/95 backdrop-blur-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <BrandMark className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold text-gray-900">Bralirwa SCM</h1>
          <p className="text-gray-500 text-sm mt-1">Supply Chain Management</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@manufacturer.com"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password123"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs font-semibold text-amber-800 mb-2">Demo Accounts</p>
          <div className="space-y-1 text-xs text-amber-700">
            <p>admin@supplier.com</p>
            <p>admin@manufacturer.com</p>
            <p>admin@distributor.com</p>
            <p>admin@retailer.com</p>
            <p className="text-amber-400 mt-1">password: password123</p>
          </div>
        </div>

      </div>
    </div>
  );
}
