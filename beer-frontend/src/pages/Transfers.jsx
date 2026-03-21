import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, getParticipants, transferBatch } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowRight, X, CheckCircle, Clock, Package } from 'lucide-react';

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

const ROLE_COLORS = {
  supplier:     'bg-green-100 text-green-700',
  manufacturer: 'bg-blue-100 text-blue-700',
  distributor:  'bg-purple-100 text-purple-700',
  retailer:     'bg-orange-100 text-orange-700',
};

export default function Transfers() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [transferTo, setTransferTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [batchRes, partRes] = await Promise.all([
        getBatches(),
        getParticipants(),
      ]);
      setBatches(batchRes.data.data || []);
      setParticipants(partRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await transferBatch(selectedBatch.batchId, transferTo);
      toast.success('Batch transferred on blockchain!');
      setShowModal(false);
      setTransferTo('');
      setSelectedBatch(null);
      fetchData();
    } catch (err) {
      const raw = err.response?.data?.error || '';
      if (raw.includes('District mismatch')) {
        const match = raw.match(/Distributor is in '(.+?)' but Retailer is in '(.+?)'/);
        if (match) {
          toast.error(`❌ District mismatch! Your district is ${match[1]} but this retailer is in ${match[2]}. You can only transfer to retailers in your district.`, { duration: 5000 });
        } else {
          toast.error('❌ District mismatch! You can only transfer to retailers in your district.', { duration: 5000 });
        }
      } else if (raw.includes('not at your location')) {
        toast.error('❌ This batch is not at your location.', { duration: 4000 });
      } else {
        toast.error(raw || 'Transfer failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Only show batches owned by current org that can be transferred
  const myBatches = batches.filter(b =>
    b.currentLocation === user.role.toUpperCase() && b.status !== 'SOLD_OUT'
  );

  // All transfer actions across all batches
  const allTransfers = batches.flatMap(b =>
    (b.actionHistory || [])
      .filter(a => a.action === 'TRANSFERRED')
      .map(a => ({ ...a, batchId: b.batchId, beerType: b.beerType }))
  ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Filter participants for transfer target
  const transferTargets = participants.filter(p => {
    if (user.role === 'manufacturer') return p.role === 'distributor';
    if (user.role === 'distributor') return p.role === 'retailer';
    return false;
  });

  const canTransfer = user.role === 'manufacturer' || user.role === 'distributor';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">🍺</div>
        <p className="text-gray-500">Loading transfers...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Transfers</h1>
        <p className="text-gray-500 text-sm mt-1">Track and manage batch transfers across the supply chain</p>
      </div>

      {/* My Batches Ready to Transfer */}
      {canTransfer && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Package size={18} className="text-amber-500" />
              My Batches — Ready to Transfer
            </h2>
          </div>
          <div className="p-6">
            {myBatches.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No batches available for transfer</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBatches.map(batch => (
                  <div key={batch.batchId} className="border border-gray-100 rounded-xl p-4 hover:border-amber-200 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-amber-600">{batch.batchId}</p>
                        <p className="text-sm text-gray-600">{batch.beerType}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[batch.status]}`}>
                        {batch.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1 mb-4">
                      <p>📦 Quantity: <span className="font-medium text-gray-700">{batch.quantity}</span></p>
                      <p>📍 Location: <span className="font-medium text-gray-700">{batch.currentLocation}</span></p>
                      <p>👤 Owner: <span className="font-medium text-gray-700">{batch.currentOwnerId}</span></p>
                    </div>
                    <button
                      onClick={() => { setSelectedBatch(batch); setShowModal(true); }}
                      className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-sm font-medium transition"
                    >
                      <ArrowRight size={16} />
                      Transfer Batch
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer History Timeline */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            Transfer History
          </h2>
        </div>
        <div className="p-6">
          {allTransfers.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No transfers recorded yet</p>
          ) : (
            <div className="space-y-4">
              {allTransfers.map((transfer, i) => (
                <div key={i} className="flex gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-purple-600" />
                    </div>
                    {i < allTransfers.length - 1 && (
                      <div className="w-0.5 bg-gray-200 flex-1 mt-1" style={{minHeight: '20px'}} />
                    )}
                  </div>

                  {/* Transfer details */}
                  <div className="flex-1 pb-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-amber-600">{transfer.batchId}</span>
                        <div>
                          <p className="text-xs text-gray-600">{formatDateTime(transfer.timestamp)}</p>
                          <p className="text-xs text-gray-400">{timeAgo(transfer.timestamp)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{transfer.beerType}</p>

                      {/* From → To */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <p className="text-xs text-gray-400">From</p>
                          <p className="font-medium text-gray-700">{transfer.from}</p>
                          <p className="text-xs text-gray-400">{transfer.fromMspId}</p>
                        </div>
                        <ArrowRight size={18} className="text-purple-400 flex-shrink-0" />
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <p className="text-xs text-gray-400">To</p>
                          <p className="font-medium text-gray-700">{transfer.to}</p>
                          <p className="text-xs text-gray-400">{transfer.toMspId}</p>
                        </div>
                      </div>

                      {/* Performed by */}
                      {transfer.performedBy && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>👤 Performed by:</span>
                          <span className="font-medium text-gray-700">{transfer.performedBy.name}</span>
                          <span className="text-gray-400">({transfer.performedBy.email})</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[transfer.performedBy.mspId?.replace('MSP','').toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                            {transfer.performedBy.mspId}
                          </span>
                        </div>
                      )}

                      {/* TxID */}
                      {transfer.txId && (
                        <p className="text-xs text-gray-400 mt-2 truncate">
                          🔗 TxID: {transfer.txId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Transfer Batch</h2>
              <button onClick={() => { setShowModal(false); setTransferTo(''); }}><X size={20} /></button>
            </div>
            <div className="p-6">
              {/* Batch info */}
              <div className="bg-amber-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-amber-700">{selectedBatch.batchId}</p>
                <p className="text-sm text-amber-600">{selectedBatch.beerType} — {selectedBatch.quantity} units</p>
                <p className="text-xs text-amber-500 mt-1">Currently at: {selectedBatch.currentLocation}</p>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transfer To {user.role === 'manufacturer' ? '(Distributor)' : '(Retailer)'}
                  </label>
                  {transferTargets.length === 0 ? (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                      No {user.role === 'manufacturer' ? 'distributors' : 'retailers'} registered yet.
                      Please register a participant first.
                    </p>
                  ) : (
                    <select
                      value={transferTo}
                      onChange={e => setTransferTo(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="">Select participant</option>
                      {transferTargets.map(p => (
                        <option key={p.participantId} value={p.participantId}>
                          {p.name} ({p.participantId})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Arrow visualization */}
                {transferTo && (
                  <div className="flex items-center justify-center gap-3 py-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">From</p>
                      <p className="text-sm font-medium text-gray-700">{selectedBatch.currentOwnerId}</p>
                      <p className="text-xs text-gray-400">{user.mspId}</p>
                    </div>
                    <ArrowRight size={20} className="text-purple-400" />
                    <div className="text-center">
                      <p className="text-xs text-gray-400">To</p>
                      <p className="text-sm font-medium text-gray-700">{transferTo}</p>
                      <p className="text-xs text-gray-400">
                        {participants.find(p => p.participantId === transferTo)?.mspId}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || transferTargets.length === 0}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
