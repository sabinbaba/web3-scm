import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, createBatch, transferBatch, recordSale, getParticipants, getBatchHistory } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, ArrowRight, ShoppingCart, History, X } from 'lucide-react';

const STATUS_COLORS = {
  PRODUCED:       'bg-blue-100 text-blue-700',
  IN_TRANSIT:     'bg-yellow-100 text-yellow-700',
  PARTIALLY_SOLD: 'bg-orange-100 text-orange-700',
  SOLD_OUT:       'bg-gray-100 text-gray-500',
};

export default function Batches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({
    batchId: '', beerType: '', quantity: '', manufacturerId: '',
    productionDate: '', expirationDate: '', ingredients: ''
  });
  const [transferTo, setTransferTo] = useState('');
  const [saleQty, setSaleQty] = useState('');

  const fetchData = async () => {
    try {
      const [batchRes, partRes] = await Promise.all([getBatches(), getParticipants()]);
      setBatches(batchRes.data.data || []);
      setParticipants(partRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let ingredients = {};
      if (createForm.ingredients) {
        try { ingredients = JSON.parse(createForm.ingredients); }
        catch { toast.error('Ingredients must be valid JSON'); setSubmitting(false); return; }
      }
      await createBatch({ ...createForm, quantity: parseInt(createForm.quantity), ingredients });
      toast.success('Batch created on blockchain!');
      setShowCreateModal(false);
      setCreateForm({ batchId: '', beerType: '', quantity: '', manufacturerId: '', productionDate: '', expirationDate: '', ingredients: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await transferBatch(selectedBatch.batchId, transferTo);
      toast.success('Batch transferred on blockchain!');
      setShowTransferModal(false);
      setTransferTo('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to transfer batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSale = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordSale(selectedBatch.batchId, parseInt(saleQty));
      toast.success('Sale recorded on blockchain!');
      setShowSaleModal(false);
      setSaleQty('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHistory = async (batch) => {
    setSelectedBatch(batch);
    try {
      const res = await getBatchHistory(batch.batchId);
      setHistory(res.data.data || []);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error('Failed to load history');
    }
  };

  // Filter participants based on role for transfer
  const transferTargets = participants.filter(p => {
    if (user.role === 'manufacturer') return p.role === 'distributor';
    if (user.role === 'distributor') return p.role === 'retailer';
    return false;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">🍺</div>
        <p className="text-gray-500">Loading batches...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Beer Batches</h1>
        {user.role === 'manufacturer' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> New Batch
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beer Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created By</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No batches found</td></tr>
              ) : batches.map((batch) => (
                <tr key={batch.batchId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-amber-600">{batch.batchId}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.beerType}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{batch.currentLocation}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[batch.status] || 'bg-gray-100'}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {batch.actionHistory?.[0]?.performedBy?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {/* Transfer button */}
                      {(user.role === 'manufacturer' || user.role === 'distributor') &&
                        batch.mspId === user.mspId && batch.status !== 'SOLD_OUT' && (
                        <button
                          onClick={() => { setSelectedBatch(batch); setShowTransferModal(true); }}
                          className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition"
                          title="Transfer"
                        >
                          <ArrowRight size={16} />
                        </button>
                      )}
                      {/* Sale button */}
                      {user.role === 'retailer' && batch.mspId === user.mspId && batch.status !== 'SOLD_OUT' && (
                        <button
                          onClick={() => { setSelectedBatch(batch); setShowSaleModal(true); }}
                          className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition"
                          title="Record Sale"
                        >
                          <ShoppingCart size={16} />
                        </button>
                      )}
                      {/* History button */}
                      <button
                        onClick={() => handleHistory(batch)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                        title="History"
                      >
                        <History size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Create New Batch</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {[
                { label: 'Batch ID', key: 'batchId', placeholder: 'BATCH003' },
                { label: 'Beer Type', key: 'beerType', placeholder: 'Primus Lager' },
                { label: 'Quantity', key: 'quantity', placeholder: '1000', type: 'number' },
                { label: 'Manufacturer ID', key: 'manufacturerId', placeholder: 'MFG001' },
                { label: 'Production Date', key: 'productionDate', type: 'date' },
                { label: 'Expiration Date', key: 'expirationDate', type: 'date' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type || 'text'}
                    value={createForm[key]}
                    onChange={e => setCreateForm({ ...createForm, [key]: e.target.value })}
                    placeholder={placeholder}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredients (JSON)
                </label>
                <textarea
                  value={createForm.ingredients}
                  onChange={e => setCreateForm({ ...createForm, ingredients: e.target.value })}
                  placeholder='{"hops":"100kg","barley":"500kg"}'
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Batch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Transfer Batch</h2>
              <button onClick={() => setShowTransferModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Transferring: <span className="font-medium text-amber-600">{selectedBatch.batchId}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer To</label>
                <select
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select participant</option>
                  {transferTargets.map(p => (
                    <option key={p.participantId} value={p.participantId}>
                      {p.name} ({p.participantId})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Transferring...' : 'Transfer Batch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Record Sale</h2>
              <button onClick={() => setShowSaleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSale} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Batch: <span className="font-medium text-amber-600">{selectedBatch.batchId}</span>
                <span className="ml-2 text-gray-400">(Available: {selectedBatch.quantity})</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Sold</label>
                <input
                  type="number"
                  value={saleQty}
                  onChange={e => setSaleQty(e.target.value)}
                  min="1"
                  max={selectedBatch.quantity}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record Sale'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">
                History: {selectedBatch.batchId}
              </h2>
              <button onClick={() => setShowHistoryModal(false)}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {history.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No history found</p>
              ) : history.map((record, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">TX {i + 1}</span>
                    <span className="text-xs text-gray-400">
                      {record.timestamp?.seconds
                        ? new Date(record.timestamp.seconds * 1000).toLocaleString()
                        : '-'}
                    </span>
                  </div>
                  {record.value?.actionHistory?.slice(-1).map((action, j) => (
                    <div key={j}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${
                        action.action === 'CREATED' ? 'bg-blue-100 text-blue-700' :
                        action.action === 'TRANSFERRED' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {action.action}
                      </span>
                      {action.performedBy && (
                        <p className="text-sm text-gray-600">
                          By: <span className="font-medium">{action.performedBy.name}</span>
                          <span className="text-gray-400 ml-1">({action.performedBy.email})</span>
                        </p>
                      )}
                      {action.from && (
                        <p className="text-sm text-gray-600">
                          From: <span className="font-medium">{action.from}</span>
                          → To: <span className="font-medium">{action.to}</span>
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2 truncate">
                    TxID: {record.txId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}