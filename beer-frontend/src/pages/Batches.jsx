import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, createBatch, splitBatch, transferBatch, recordSale, getParticipants, getBatchHistory } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, ArrowRight, ShoppingCart, History, X, Trash2, Beer } from 'lucide-react';

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

const STATUS_COLORS = {
  PRODUCED:       'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  IN_TRANSIT:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  PARTIALLY_SOLD: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  SOLD_OUT:       'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
};

const BEER_TYPES = [
  'Primus Lager',
  'Mutzig',
  'Heineken',
  'Turbo King',
  'Guinness',
  'Amstel',
  'Bralirwa Special',
  'Other',
];

const INGREDIENT_OPTIONS = [
  'Hops',
  'Barley',
  'Water',
  'Yeast',
  'Malt',
  'Wheat',
  'Sugar',
  'Carbon Dioxide',
];

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
    batchId: '',
    beerType: '',
    customBeerType: '',
    quantity: '',
    manufacturerId: '',
    productionDate: '',
    expirationDate: '',
  });

  // Auto-generate next batch IDs based on existing batches
  const generateNextBatchIds = (existingBatches, count = 10) => {
    const nums = existingBatches
      .map(b => parseInt(b.batchId.replace(/\D/g, '')))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return Array.from({ length: count }, (_, i) =>
      `BATCH${String(max + i + 1).padStart(3, '0')}`
    );
  };

  // Ingredients as array of {name, amount, unit}
  const [ingredients, setIngredients] = useState([
    { name: 'Hops', amount: '', unit: 'kg' },
  ]);

  const [transferTo, setTransferTo] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [saleQty, setSaleQty] = useState('');

  const fetchData = async () => {
    try {
      const [batchRes, partRes] = await Promise.all([getBatches(), getParticipants()]);
      setBatches(batchRes.data.data || []);
      setParticipants(partRes.data.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: 'Barley', amount: '', unit: 'kg' }]);
  };

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const generateSplitBatchId = (sourceBatchId) => {
    const stamp = Date.now().toString(36).toUpperCase();
    return `${sourceBatchId}-S-${stamp}`;
  };

  const openTransferModal = (batch) => {
    setSelectedBatch(batch);
    setTransferTo('');
    setTransferQty(user.role === 'distributor' ? '' : String(batch.quantity || ''));
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedBatch(null);
    setTransferTo('');
    setTransferQty('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Build ingredients object from array
      const ingredientsObj = {};
      ingredients.forEach(ing => {
        if (ing.name && ing.amount) {
          ingredientsObj[ing.name.toLowerCase()] = `${ing.amount}${ing.unit}`;
        }
      });

      const beerType = createForm.beerType === 'Other' ? createForm.customBeerType : createForm.beerType;

      await createBatch({
        batchId: createForm.batchId,
        beerType,
        quantity: parseInt(createForm.quantity),
        manufacturerId: createForm.manufacturerId,
        productionDate: createForm.productionDate,
        expirationDate: createForm.expirationDate,
        ingredients: ingredientsObj,
      });

      toast.success('Batch created on blockchain!');
      setShowCreateModal(false);
      setCreateForm({ batchId: '', beerType: '', customBeerType: '', quantity: '', manufacturerId: '', productionDate: '', expirationDate: '' });
      setIngredients([{ name: 'Hops', amount: '', unit: 'kg' }]);
      fetchData();
    } catch (err) {
      const raw = err.response?.data?.error || '';
      if (raw.includes('already exists')) {
        toast.error('Batch ID already exists. Please select a different ID.', { duration: 4000 });
      } else if (raw.includes('not found')) {
        toast.error('Manufacturer not found. Please register the manufacturer first.', { duration: 4000 });
      } else {
        toast.error(raw || 'Failed to create batch. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (user.role === 'distributor') {
        const quantity = parseInt(transferQty, 10);
        if (Number.isNaN(quantity) || quantity <= 0) {
          toast.error('Enter a positive quantity to transfer.');
          return;
        }
        if (quantity > selectedBatch.quantity) {
          toast.error(`Only ${selectedBatch.quantity} units are available.`);
          return;
        }

        if (quantity === selectedBatch.quantity) {
          await transferBatch(selectedBatch.batchId, transferTo);
        } else {
          const newBatchId = generateSplitBatchId(selectedBatch.batchId);
          await splitBatch(selectedBatch.batchId, newBatchId, quantity);
          await transferBatch(newBatchId, transferTo);
        }
      } else {
        await transferBatch(selectedBatch.batchId, transferTo);
      }

      toast.success(user.role === 'distributor' ? 'Quantity transferred on blockchain!' : 'Batch transferred on blockchain!');
      closeTransferModal();
      fetchData();
    } catch (err) {
      const raw = err.response?.data?.error || '';
      if (raw.includes('District mismatch')) {
        const match = raw.match(/Distributor is in '(.+?)' but Retailer is in '(.+?)'/);
        if (match) {
          toast.error(`District mismatch. Your district is ${match[1]} but this retailer is in ${match[2]}.`, { duration: 5000 });
        } else {
          toast.error('District mismatch. You can only transfer to retailers in your district.', { duration: 5000 });
        }
      } else if (raw.includes('not at your location')) {
        toast.error('This batch is not at your location.', { duration: 4000 });
      } else if (raw.includes('already exists')) {
        toast.error('This batch ID already exists. Please choose another.', { duration: 4000 });
      } else {
        toast.error(raw || 'Transfer failed. Please try again.');
      }
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
      const raw = err.response?.data?.error || '';
      if (raw.includes('Insufficient stock')) {
        toast.error('Insufficient stock. You cannot sell more than available quantity.', { duration: 4000 });
      } else if (raw.includes('not at your location')) {
        toast.error('This batch is not at your location.', { duration: 4000 });
      } else {
        toast.error(raw || 'Failed to record sale. Please try again.');
      }
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
    } catch {
      toast.error('Failed to load history');
    }
  };

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

  // Manufacturer participants for dropdown
  const manufacturerParticipants = participants.filter(p => p.role === 'manufacturer');

  const transferTargets = participants.filter(p => {
    if (user.role === 'manufacturer') return p.role === 'distributor';
    if (user.role === 'distributor') {
      if (p.role !== 'retailer') return false;
      if (user.participantId) {
        const myParticipant = participants.find(pt => pt.participantId === user.participantId);
        if (myParticipant?.district && p.district) {
          return myParticipant.district === p.district;
        }
      }
      return true;
    }
    return false;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Beer size={36} className="mx-auto mb-3 text-amber-600" />
        <p className="text-gray-500">Loading batches...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Beer Batches</h1>
          <p className="page-subtitle">Create, transfer, sell, and inspect batch history.</p>
        </div>
        {user.role === 'manufacturer' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> New Batch
          </button>
        )}
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-head-cell">Batch ID</th>
                <th className="table-head-cell">Beer Type</th>
                <th className="table-head-cell">Quantity</th>
                <th className="table-head-cell">Location</th>
                <th className="table-head-cell">Status</th>
                <th className="table-head-cell">Created At</th>
                <th className="table-head-cell">Created By</th>
                <th className="table-head-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleBatches.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-500">No batches found</td></tr>
              ) : visibleBatches.map((batch) => (
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
                  <td className="table-cell text-gray-500">
                    {batch.actionHistory?.[0]?.performedBy?.name || '-'}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {(user.role === 'manufacturer' || user.role === 'distributor') &&
                        batch.currentLocation === user.role.toUpperCase() && batch.status !== 'SOLD_OUT' && (
                        <button
                          onClick={() => openTransferModal(batch)}
                          className="icon-button text-violet-600 hover:bg-violet-50"
                          title="Transfer"
                        >
                          <ArrowRight size={16} />
                        </button>
                      )}
                      {user.role === 'retailer' && batch.currentLocation === 'RETAILER' && batch.status !== 'SOLD_OUT' && (
                        <button
                          onClick={() => { setSelectedBatch(batch); setShowSaleModal(true); }}
                          className="icon-button text-emerald-600 hover:bg-emerald-50"
                          title="Record Sale"
                        >
                          <ShoppingCart size={16} />
                        </button>
                      )}
                      {batch.status === 'SOLD_OUT' ? (
                        <button
                          onClick={() => handleHistory(batch)}
                          className="icon-button text-gray-600 hover:bg-gray-200"
                          title="View Sold History"
                        >
                          <History size={16} />
                          <span className="ml-1 text-xs">View Sold</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHistory(batch)}
                          className="icon-button text-sky-600 hover:bg-sky-50"
                          title="History"
                        >
                          <History size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-800">Create New Batch</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">

              {/* Batch ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch ID</label>
                <select
                  value={createForm.batchId}
                  onChange={e => setCreateForm({ ...createForm, batchId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select Batch ID</option>
                  {generateNextBatchIds(batches).map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Auto-generated based on existing batches</p>
              </div>

              {/* Beer Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beer Type</label>
                <select
                  value={createForm.beerType}
                  onChange={e => setCreateForm({ ...createForm, beerType: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select beer type</option>
                  {BEER_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {createForm.beerType === 'Other' && (
                  <input
                    type="text"
                    value={createForm.customBeerType}
                    onChange={e => setCreateForm({ ...createForm, customBeerType: e.target.value })}
                    placeholder="Enter beer type name"
                    required
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (units)</label>
                <input
                  type="number"
                  value={createForm.quantity}
                  onChange={e => setCreateForm({ ...createForm, quantity: e.target.value })}
                  placeholder="e.g. 1000"
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <select
                  value={createForm.manufacturerId}
                  onChange={e => setCreateForm({ ...createForm, manufacturerId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select manufacturer</option>
                  {manufacturerParticipants.map(p => (
                    <option key={p.participantId} value={p.participantId}>
                      {p.name} ({p.participantId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Production Date</label>
                  <input
                    type="date"
                    value={createForm.productionDate}
                    onChange={e => setCreateForm({ ...createForm, productionDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={createForm.expirationDate}
                    onChange={e => setCreateForm({ ...createForm, expirationDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Ingredients Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Ingredients</label>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Ingredient
                  </button>
                </div>
                <div className="space-y-2">
                  {ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      {/* Ingredient name */}
                      <select
                        value={ing.name}
                        onChange={e => updateIngredient(i, 'name', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      >
                        {INGREDIENT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {/* Amount */}
                      <input
                        type="number"
                        value={ing.amount}
                        onChange={e => updateIngredient(i, 'amount', e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      />
                      {/* Unit */}
                      <select
                        value={ing.unit}
                        onChange={e => updateIngredient(i, 'unit', e.target.value)}
                        className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                        <option value="ton">ton</option>
                      </select>
                      {/* Remove */}
                      {ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredient(i)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Creating on Blockchain...' : 'Create Batch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── TRANSFER MODAL ── */}
      {showTransferModal && selectedBatch && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">
                {user.role === 'distributor' ? 'Transfer Quantity' : 'Transfer Batch'}
              </h2>
              <button onClick={closeTransferModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-700">{selectedBatch.batchId}</p>
                <p className="text-sm text-amber-600">{selectedBatch.beerType} — {selectedBatch.quantity} units</p>
                {user.role === 'distributor' && transferQty && (
                  <p className="text-xs text-amber-500 mt-1">
                    Remaining after transfer: {Math.max(selectedBatch.quantity - (parseInt(transferQty, 10) || 0), 0)} units
                  </p>
                )}
              </div>
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
              {user.role === 'distributor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Transfer</label>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={e => setTransferQty(e.target.value)}
                    min="1"
                    max={selectedBatch.quantity}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Transferring...' : user.role === 'distributor' ? 'Transfer Quantity' : 'Transfer Batch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SALE MODAL ── */}
      {showSaleModal && selectedBatch && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">Record Sale</h2>
              <button onClick={() => setShowSaleModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSale} className="p-6 space-y-4">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-medium text-green-700">{selectedBatch.batchId}</p>
                <p className="text-sm text-green-600">{selectedBatch.beerType}</p>
                <p className="text-xs text-green-500 mt-1">Available: {selectedBatch.quantity} units</p>
              </div>
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

      {/* ── HISTORY MODAL ── */}
      {showHistoryModal && selectedBatch && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-800">History: {selectedBatch.batchId}</h2>
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
                        ? formatDateTime(new Date(record.timestamp.seconds * 1000).toISOString())
                        : '-'}
                    </span>
                  </div>
                  {record.value?.actionHistory?.slice(-1).map((action, j) => (
                    <div key={j}>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${
                        action.action === 'CREATED' ? 'bg-blue-100 text-blue-700' :
                        action.action === 'TRANSFERRED' ? 'bg-purple-100 text-purple-700' :
                        action.action === 'SALE_RECORDED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
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
                        <p className="text-sm text-gray-600 mt-1">
                          From: <span className="font-medium">{action.from}</span>
                          {' → '}
                          To: <span className="font-medium">{action.to}</span>
                        </p>
                      )}
                      {action.action === 'SALE_RECORDED' && (
                        <p className="text-sm text-emerald-700 mt-1">
                          Quantity Sold: <span className="font-semibold">{action.quantitySold}</span>
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2 truncate">TxID: {record.txId}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
