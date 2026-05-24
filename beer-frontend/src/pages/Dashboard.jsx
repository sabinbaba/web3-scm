import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, getParticipants } from '../services/api';
import { Package, Users, TrendingUp, AlertCircle, Beer } from 'lucide-react';

const ROLE_COLORS = {
  supplier:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  manufacturer: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  distributor:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  retailer:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

const STATUS_COLORS = {
  PRODUCED:       'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  IN_TRANSIT:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  PARTIALLY_SOLD: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  SOLD_OUT:       'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
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

function StatCard({ icon, label, value, color }) {
  const IconComponent = icon;
  return (
    <div className="panel p-5 flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
        <IconComponent size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
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
      } catch {
        setError('Failed to load data from blockchain');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isAssignedToUser = (batch) => {
    if (!['distributor', 'retailer'].includes(user.role) || !user.participantId) return true;
    if (batch.currentOwnerId === user.participantId) return true;
    return (batch.actionHistory || []).some(action =>
      action.from === user.participantId ||
      action.to === user.participantId ||
      action.performedBy?.participantId === user.participantId
    );
  };

  const visibleBatches = batches.filter(isAssignedToUser);
  const totalQuantity = visibleBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const inTransit = visibleBatches.filter(b => b.status === 'IN_TRANSIT').length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Beer size={36} className="mx-auto mb-3 text-amber-600" />
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name}. Monitor batches, participants, and inventory movement.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium capitalize ${ROLE_COLORS[user?.role]}`}>
            {user?.role}
          </span>
          <span>{user?.mspId}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}    label="Total Batches" value={visibleBatches.length}     color="bg-amber-50 text-amber-700" />
        <StatCard icon={TrendingUp} label="Total Units"   value={totalQuantity}       color="bg-sky-50 text-sky-700" />
        <StatCard icon={Package}    label="In Transit"    value={inTransit}           color="bg-yellow-50 text-yellow-700" />
        <StatCard icon={Users}      label="Participants"  value={participants.length} color="bg-emerald-50 text-emerald-700" />
      </div>

      {/* Recent Batches */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent Batches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-head-cell">Batch ID</th>
                <th className="table-head-cell">Beer Type</th>
                <th className="table-head-cell">Quantity</th>
                <th className="table-head-cell">Location</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleBatches.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-500">No batches found</td></tr>
              ) : visibleBatches.slice(0, 5).map((batch) => (
                <tr key={batch.batchId} className="hover:bg-gray-50">
                  <td className="table-cell font-semibold text-amber-700">{batch.batchId}</td>
                  <td className="table-cell">{batch.beerType}</td>
                  <td className="table-cell">{batch.quantity}</td>
                  <td className="table-cell">{batch.currentLocation}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[batch.status] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="table-cell">
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
      <div className="panel">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Participants</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8 sm:col-span-2 lg:col-span-3">No participants found</p>
          ) : participants.map((p) => (
            <div key={p.participantId} className="border border-gray-200 rounded-lg p-4 bg-gray-50/40">
              <p className="font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400 mt-1">{p.participantId}</p>
              <span className={`inline-flex mt-2 px-2 py-0.5 rounded-md text-xs font-medium capitalize ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
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
