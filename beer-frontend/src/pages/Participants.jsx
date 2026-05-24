import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getParticipants, registerParticipant } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Lock, Mail, Building2, MapPin, Calendar, Beer } from 'lucide-react';

const RWANDA_DISTRICTS = [
  'Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara',
  'Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga',
  'Musanze','Ngabo','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe',
  'Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango',
  'Rulindo','Rusizi','Rutsiro','Rwamagana',
];

const ROLE_COLORS = {
  supplier:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  manufacturer: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  distributor:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  retailer:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

export default function Participants() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    participantId: '', name: '', role: '', contactInfo: '', district: ''
  });

  // Only Manufacturer Admin can register participants
  const canRegister = user?.mspId === 'ManufacturerMSP' && user?.isAdmin;

  const fetchParticipants = async () => {
    try {
      const res = await getParticipants();
      setParticipants(res.data.data || []);
    } catch {
      toast.error('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchParticipants();
  }, []);

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
      setForm({ participantId: '', name: '', role: '', contactInfo: '', district: '' });
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
        <Beer size={36} className="mx-auto mb-3 text-amber-600" />
        <p className="text-gray-500">Loading participants...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Participants</h1>
          <p className="page-subtitle">
            Organizations registered on the blockchain
          </p>
        </div>
        {canRegister ? (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Register Participant
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-lg">
            <Lock size={14} />
            Only Manufacturer Admin can register
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.length === 0 ? (
          <div className="panel col-span-full py-10 text-center text-sm text-gray-500">No participants found</div>
        ) : participants.map((p) => (
          <div key={p.participantId} className="panel p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 mt-1">{p.participantId}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
                {p.role}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Mail size={15} className="text-gray-400" /> <span className="truncate">{p.contactInfo}</span></p>
              <p className="flex items-center gap-2"><Building2 size={15} className="text-gray-400" /> {p.mspId}</p>
              {p.district && <p className="flex items-center gap-2"><MapPin size={15} className="text-gray-400" /> {p.district}</p>}
              <p className="flex items-center gap-2"><Calendar size={15} className="text-gray-400" /> {new Date(p.registeredAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Register Modal — only shown to Manufacturer Admin */}
      {showModal && canRegister && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Register Participant</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value, district: '', participantId: '' })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select role first</option>
                  <option value="supplier">Supplier</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participant ID</label>
                <select
                  value={form.participantId}
                  onChange={e => setForm({ ...form, participantId: e.target.value })}
                  required
                  disabled={!form.role}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">{form.role ? 'Select ID' : 'Choose role first'}</option>
                  {form.role && generateNextParticipantIds(form.role).map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Auto-generated after selecting a role</p>
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
                    <p className="text-xs text-amber-700 mt-1">
                      {takenDistrictsByDistributors.length} of {RWANDA_DISTRICTS.length} districts already have a distributor
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
