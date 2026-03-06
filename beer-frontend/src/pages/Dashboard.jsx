import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, getParticipants } from '../services/api';
import { Package, Users, TrendingUp, AlertCircle } from 'lucide-react';

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

const STATUS_COLORS = {
  PRODUCED:       'bg-blue-100 text-blue-700',
  IN_TRANSIT:     'bg-yellow-100 text-yellow-700',
  PARTIALLY_SOLD: 'bg-orange-100 text-orange-700',
  SOLD_OUT:       'bg-gray-100 text-gray-500',
};

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchRes, participantRes] = await Promise.all([
          getBatches(), getParticipants(),
        ]);
        setBatches(batchRes.data.data || []);
        setParticipants(participantRes.data.data || []);
      } catch (err) {
        setError('Failed to load data from blockchain');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const inTransit = batches.filter(b => b.status === 'IN_TRANSIT').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">🍺</div>
        <p className="text-gray-500">Loading blockchain data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-red-500">
        <AlertCircle size={40} className="mx-auto mb-2" />
        <p>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user?.role]}`}>
            {user?.role}
          </span>
          <span className="ml-2">{user?.mspId}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}    label="Total Batches" value={batches.length}     color="bg-amber-100 text-amber-600" />
        <StatCard icon={TrendingUp} label="Total Units"   value={totalQuantity}       color="bg-blue-100 text-blue-600" />
        <StatCard icon={Package}    label="In Transit"    value={inTransit}           color="bg-yellow-100 text-yellow-600" />
        <StatCard icon={Users}      label="Participants"  value={participants.length} color="bg-green-100 text-green-600" />
      </div>

      {/* Recent Batches */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recent Batches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beer Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No batches found</td></tr>
              ) : batches.slice(0, 5).map((batch) => (
                <tr key={batch.batchId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-amber-600">{batch.batchId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.beerType}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.currentLocation}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[batch.status] || 'bg-gray-100 text-gray-600'}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-600">{formatDateTime(batch.createdAt)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(batch.createdAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Participants</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map((p) => (
            <div key={p.participantId} className="border border-gray-100 rounded-lg p-4">
              <p className="font-medium text-gray-800">{p.name}</p>
              <p className="text-xs text-gray-400 mt-1">{p.participantId}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600'}`}>
                {p.role}
              </span>
              <p className="text-xs text-gray-400 mt-2">{formatDateTime(p.registeredAt)}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}