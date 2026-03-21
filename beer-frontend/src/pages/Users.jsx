import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUsers, register, getParticipants } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Trash2, ShieldCheck, User } from 'lucide-react';

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

const ROLE_TO_MSP = {
  supplier:     'SupplierMSP',
  manufacturer: 'ManufacturerMSP',
  distributor:  'DistributorMSP',
  retailer:     'RetailerMSP',
};

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'manufacturer', participantId: ''
  });

  const fetchData = async () => {
    try {
      const [usersRes, partRes] = await Promise.all([getUsers(), getParticipants()]);
      setUsers(usersRes.data.data || []);
      setParticipants(partRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filter participants by selected role
  const filteredParticipants = participants.filter(p => p.role === form.role);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await register(form);
      toast.success(`User ${form.name} created successfully!`);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'manufacturer', participantId: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`${userName} deleted`);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  // Get participant info for display
  const getParticipantInfo = (participantId) => {
    if (!participantId) return null;
    return participants.find(p => p.participantId === participantId);
  };

  const groupedUsers = users.reduce((acc, u) => {
    if (!acc[u.role]) acc[u.role] = [];
    acc[u.role].push(u);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">👥</div>
        <p className="text-gray-500">Loading users...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage system users across all organizations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['supplier', 'manufacturer', 'distributor', 'retailer'].map(role => (
          <div key={role} className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{groupedUsers[role]?.length || 0}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
              {role}
            </span>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Participant</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created At</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found</td></tr>
              ) : users.map(u => {
                const participantInfo = getParticipantInfo(u.participantId);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.mspId}</td>
                    <td className="px-6 py-4">
                      {participantInfo ? (
                        <div>
                          <p className="text-sm font-medium text-amber-600">{participantInfo.participantId}</p>
                          <p className="text-xs text-gray-400">{participantInfo.name}</p>
                          {participantInfo.district && (
                            <p className="text-xs text-gray-400">📍 {participantInfo.district}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.isAdmin ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <ShieldCheck size={14} /> Admin
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                          <User size={14} /> User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatDateTime(u.createdAt)}</td>
                    <td className="px-6 py-4">
                      {!u.isAdmin && u.id !== user.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-800">Add New User</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="john@company.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value, participantId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="supplier">Supplier</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>

              {/* Link to Participant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to Participant
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                {filteredParticipants.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50">
                    No {form.role} participants registered yet
                  </div>
                ) : (
                  <select
                    value={form.participantId}
                    onChange={e => setForm({ ...form, participantId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">No participant linked</option>
                    {filteredParticipants.map(p => (
                      <option key={p.participantId} value={p.participantId}>
                        {p.participantId} — {p.name} {p.district ? `(📍 ${p.district})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Linking allows the user to act on behalf of that participant on the blockchain
                </p>
              </div>

              {/* Preview */}
              {form.participantId && (
                <div className="bg-amber-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-700 mb-1">Preview:</p>
                  {(() => {
                    const p = getParticipantInfo(form.participantId);
                    return p ? (
                      <div className="text-amber-600 space-y-1">
                        <p>🏢 {p.name} ({p.participantId})</p>
                        {p.district && <p>📍 District: {p.district}</p>}
                        <p>👤 {form.name || 'User'} will act on behalf of this participant</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}