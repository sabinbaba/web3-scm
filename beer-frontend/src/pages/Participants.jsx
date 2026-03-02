import { useState, useEffect } from 'react';
import { getParticipants, registerParticipant } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

export default function Participants() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    participantId: '', name: '', role: 'manufacturer', contactInfo: ''
  });

  const fetchParticipants = async () => {
    try {
      const res = await getParticipants();
      setParticipants(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParticipants(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registerParticipant(form);
      toast.success('Participant registered on blockchain!');
      setShowModal(false);
      setForm({ participantId: '', name: '', role: 'manufacturer', contactInfo: '' });
      fetchParticipants();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register participant');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">🍺</div>
        <p className="text-gray-500">Loading participants...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Participants</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Register Participant
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.length === 0 ? (
          <p className="text-gray-400 col-span-3 text-center py-8">No participants found</p>
        ) : participants.map((p) => (
          <div key={p.participantId} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400 mt-1">{p.participantId}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600'}`}>
                {p.role}
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-gray-500">
              <p>📧 {p.contactInfo}</p>
              <p>🏢 {p.mspId}</p>
              <p>📅 {new Date(p.registeredAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Register Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Register Participant</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participant ID</label>
                <input
                  type="text"
                  value={form.participantId}
                  onChange={e => setForm({ ...form, participantId: e.target.value })}
                  placeholder="DIST002"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Kigali Distributor"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="supplier">Supplier</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Info</label>
                <input
                  type="email"
                  value={form.contactInfo}
                  onChange={e => setForm({ ...form, contactInfo: e.target.value })}
                  placeholder="contact@company.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Registering...' : 'Register on Blockchain'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}