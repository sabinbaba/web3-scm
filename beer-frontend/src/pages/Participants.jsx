import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getParticipants, registerParticipant } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Lock } from 'lucide-react';

const RWANDA_DISTRICTS = [
  'Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara',
  'Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga',
  'Musanze','Ngabo','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe',
  'Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango',
  'Rulindo','Rusizi','Rutsiro','Rwamagana',
];

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

export default function Participants() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    participantId: '', name: '', role: 'manufacturer', contactInfo: '', district: ''
  });

  // Only Manufacturer Admin can register participants
  const canRegister = user?.mspId === 'ManufacturerMSP' && user?.isAdmin;

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

  const needsDistrict = form.role === 'distributor' || form.role === 'retailer';

  // Auto-generate next participant ID based on role
  const PREFIX_MAP = {
    supplier: 'SUP', manufacturer: 'MFG', distributor: 'DIST', retailer: 'RET',
  };
  const generateNextParticipantIds = (role, count = 5) => {
    const prefix = PREFIX_MAP[role] || 'PART';
    const nums = participants
      .filter(p => p.participantId.startsWith(prefix))
      .map(p => parseInt(p.participantId.replace(prefix, '')))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return Array.from({ length: count }, (_, i) =>
      `${prefix}${String(max + i + 1).padStart(3, '0')}`
    );
  };

  // Districts already taken by existing distributors
  const takenDistrictsByDistributors = participants
    .filter(p => p.role === 'distributor' && p.district)
    .map(p => p.district);

  // For distributor: only show available districts
  // For retailer: show all districts
  const availableDistricts = form.role === 'distributor'
    ? RWANDA_DISTRICTS.filter(d => !takenDistrictsByDistributors.includes(d))
    : RWANDA_DISTRICTS;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsDistrict && !form.district) {
      toast.error('District is required for distributor and retailer');
      return;
    }
    setSubmitting(true);
    try {
      await registerParticipant(form);
      toast.success('Participant registered on blockchain!');
      setShowModal(false);
      setForm({ participantId: '', name: '', role: 'manufacturer', contactInfo: '', district: '' });
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
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Participants</h1>
          <p className="text-gray-500 text-sm mt-1">
            Organizations registered on the blockchain
          </p>
        </div>
        {canRegister ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Register Participant
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            <Lock size={14} />
            Only Manufacturer Admin can register
          </div>
        )}
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
              {p.district && <p>📍 {p.district}</p>}
              <p>📅 {new Date(p.registeredAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Register Modal — only shown to Manufacturer Admin */}
      {showModal && canRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Register Participant</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participant ID</label>
                <select
                  value={form.participantId}
                  onChange={e => setForm({ ...form, participantId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select ID</option>
                  {generateNextParticipantIds(form.role).map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Auto-generated based on existing participants</p>
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
                  onChange={e => setForm({ ...form, role: e.target.value, district: '', participantId: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="supplier">Supplier</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>

              {/* District — required for distributor AND retailer */}
              {needsDistrict && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.district}
                    onChange={e => setForm({ ...form, district: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Select district</option>
                    {availableDistricts.length === 0 ? (
                      <option value="" disabled>All districts are taken</option>
                    ) : availableDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {form.role === 'distributor' && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ {takenDistrictsByDistributors.length} of {RWANDA_DISTRICTS.length} districts already have a distributor
                    </p>
                  )}
                  {form.role === 'retailer' && (
                    <p className="text-xs text-gray-400 mt-1">Retailer can only receive from distributor in same district</p>
                  )}
                </div>
              )}

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
