import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getBatches, getParticipants, splitBatch, transferBatch } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowRight, X, Clock, Package, Beer, UserRound, Plus, Trash2 } from 'lucide-react';

const STATUS_COLORS = {
  PRODUCED:       'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  IN_TRANSIT:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  SPLIT:          'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  SPLIT_OUT:      'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
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

const ROLE_COLORS = {
  supplier:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  manufacturer: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  distributor:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  retailer:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};

export default function Transfers() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferAllocations, setTransferAllocations] = useState([{ toParticipantId: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [batchRes, partRes] = await Promise.all([
        getBatches(),
        getParticipants(),
      ]);
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

  const openTransferModal = (batch) => {
    setSelectedBatch(batch);
    setTransferTo('');
    setTransferAllocations([{ toParticipantId: '', quantity: String(batch.quantity || '') }]);
    setShowModal(true);
  };

  const closeTransferModal = () => {
    setShowModal(false);
    setTransferTo('');
    setTransferAllocations([{ toParticipantId: '', quantity: '' }]);
    setSelectedBatch(null);
  };

  const getParticipant = (participantId) =>
    participants.find(p => p.participantId === participantId);

  const getParticipantName = (participantId, fallback = '-') => {
    const participant = getParticipant(participantId);
    return participant ? `${participant.name} (${participant.participantId})` : (participantId || fallback);
  };

  const generateSplitBatchId = (sourceBatchId, index) => {
    const stamp = Date.now().toString(36).toUpperCase();
    return `${sourceBatchId}-S${index + 1}-${stamp}`;
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (user.role === 'distributor') {
        const allocations = transferAllocations.map(a => ({
          toParticipantId: a.toParticipantId,
          quantity: parseInt(a.quantity, 10),
        }));

        if (allocations.some(a => !a.toParticipantId || Number.isNaN(a.quantity) || a.quantity <= 0)) {
          toast.error('Select a retailer and positive quantity for every split.');
          return;
        }

        const retailerIds = allocations.map(a => a.toParticipantId);
        if (new Set(retailerIds).size !== retailerIds.length) {
          toast.error('Use each retailer once. Combine quantities for the same retailer.');
          return;
        }

        const totalQuantity = allocations.reduce((sum, a) => sum + a.quantity, 0);
        if (totalQuantity > selectedBatch.quantity) {
          toast.error(`You only have ${selectedBatch.quantity} units available.`);
          return;
        }

        if (allocations.length === 1 && totalQuantity === selectedBatch.quantity) {
          await transferBatch(selectedBatch.batchId, allocations[0].toParticipantId);
        } else {
          for (const [index, allocation] of allocations.entries()) {
            const newBatchId = generateSplitBatchId(selectedBatch.batchId, index);
            await splitBatch(selectedBatch.batchId, newBatchId, allocation.quantity);
            await transferBatch(newBatchId, allocation.toParticipantId);
          }
        }
      } else {
        await transferBatch(selectedBatch.batchId, transferTo);
      }

      toast.success(user.role === 'distributor' ? 'Batch distributed on blockchain!' : 'Batch transferred on blockchain!');
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
      } else {
        toast.error(raw || 'Transfer failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
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

  // Only show batches assigned to the current participant that can be transferred
  const myBatches = visibleBatches.filter(b =>
    b.currentLocation === user.role.toUpperCase() &&
    b.status !== 'SOLD_OUT' &&
    b.status !== 'SPLIT_OUT' &&
    Number(b.quantity) > 0
  );

  // Filter participants for transfer target
  const transferTargets = participants.filter(p => {
    if (user.role === 'manufacturer') return p.role === 'distributor';
    if (user.role === 'distributor') {
      if (p.role !== 'retailer') return false;
      if (user.participantId) {
        const myParticipant = participants.find(pt => pt.participantId === user.participantId);
        if (myParticipant?.district && p.district) return myParticipant.district === p.district;
      }
      return true;
    }
    return false;
  });

  const updateAllocation = (index, field, value) => {
    setTransferAllocations(current => current.map((allocation, idx) =>
      idx === index ? { ...allocation, [field]: value } : allocation
    ));
  };

  const addAllocation = () => {
    setTransferAllocations(current => [...current, { toParticipantId: '', quantity: '' }]);
  };

  const removeAllocation = (index) => {
    setTransferAllocations(current => current.filter((_, idx) => idx !== index));
  };

  const allocatedQuantity = transferAllocations.reduce((sum, allocation) => {
    const qty = parseInt(allocation.quantity, 10);
    return sum + (Number.isNaN(qty) ? 0 : qty);
  }, 0);

  const canTransfer = user.role === 'manufacturer' || user.role === 'distributor';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Beer size={36} className="mx-auto mb-3 text-amber-600" />
        <p className="text-gray-500">Loading transfers...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="page-title">Transfers</h1>
        <p className="page-subtitle">Track and manage batch transfers across the supply chain</p>
      </div>

      {/* My Batches Ready to Transfer */}
      {canTransfer && (
        <div className="panel">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package size={18} className="text-amber-600" />
              My Batches — Ready to Transfer
            </h2>
          </div>
          <div className="p-5">
            {myBatches.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No batches available for transfer</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myBatches.map(batch => (
                  <div key={batch.batchId} className="border border-gray-200 rounded-lg p-4 hover:border-amber-300 transition bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-amber-600">{batch.batchId}</p>
                        <p className="text-sm text-gray-600">{batch.beerType}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[batch.status]}`}>
                        {batch.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1 mb-4">
                      <p>Quantity: <span className="font-medium text-gray-700">{batch.quantity}</span></p>
                      <p>Location: <span className="font-medium text-gray-700">{batch.currentLocation}</span></p>
                      <p>Owner: <span className="font-medium text-gray-700">{batch.currentOwnerId}</span></p>
                    </div>
                    <button
                      onClick={() => openTransferModal(batch)}
                      className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-sm font-medium transition"
                    >
                      <ArrowRight size={16} />
                      {user.role === 'distributor' ? 'Distribute Batch' : 'Transfer Batch'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Progress Steppers by Batch */}
      <div className="panel">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={18} className="text-sky-600" />
            Transfer Progress by Batch
          </h2>
        </div>
        <div className="p-5">
          {visibleBatches.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">No batches found</p>
          ) : (
            <div className="space-y-8">
              {[...visibleBatches].reverse().map(batch => {
                // Build the transfer chain for this batch
                const actions = (batch.actionHistory || []).filter(a => a.action === 'TRANSFERRED');
                if (actions.length === 0) return null;
                // Build participant chain: start with initial owner, then each transfer's 'to'
                const createdAction = (batch.actionHistory || []).find(a => a.action === 'CREATED');
                const manufacturer = getParticipant(batch.manufacturerId);
                const participantChain = [
                  {
                    name: manufacturer?.name || createdAction?.performedBy?.name || batch.manufacturerId,
                    participantId: batch.manufacturerId,
                    role: manufacturer?.role || 'manufacturer',
                    mspId: manufacturer?.mspId || batch.mspId || '',
                    time: batch.createdAt,
                    isCurrent: false,
                  }
                ];
                actions.forEach((a, idx) => {
                  const toParticipant = getParticipant(a.to);
                  participantChain.push({
                    name: toParticipant?.name || a.toName || a.to || a.toMspId,
                    participantId: a.to,
                    role: toParticipant?.role || a.toRole || a.toMspId?.replace('MSP','').toLowerCase() || '',
                    mspId: toParticipant?.mspId || a.toMspId || '',
                    time: a.timestamp,
                    isCurrent: idx === actions.length - 1 && batch.status !== 'SOLD_OUT',
                  });
                });
                // Mark last as current if not sold out
                if (batch.status !== 'SOLD_OUT') participantChain[participantChain.length-1].isCurrent = true;
                // Calculate total sold for this batch
                const sales = (batch.actionHistory || []).filter(a => a.action === 'SALE_RECORDED');
                const totalSold = sales.reduce((sum, s) => sum + (s.quantitySold || 0), 0);
                const remaining = batch.quantity;
                return (
                  <div key={batch.batchId} className="bg-gray-50 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-amber-600">{batch.batchId}</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[batch.status]}`}>{batch.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{batch.beerType} — {remaining} units remaining</p>
                    <div className="flex gap-4 mb-2 text-xs text-gray-500">
                      <span>Quantity Sold: <b className="text-emerald-700">{totalSold}</b></span>
                      <span>Quantity Remaining: <b className="text-amber-700">{remaining}</b></span>
                    </div>
                    {/* Horizontal Stepper */}
                    <div className="flex items-center overflow-x-auto gap-0">
                      {participantChain.map((p, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className={`flex flex-col items-center px-3 ${p.isCurrent ? 'font-bold text-violet-700' : 'text-gray-700'}`}> 
                            <div className={`rounded-full w-10 h-10 flex items-center justify-center mb-1 ring-2 ${p.isCurrent ? 'ring-violet-400 bg-violet-50' : 'ring-gray-200 bg-white'}`}>
                              <UserRound size={20} />
                            </div>
                            <span className="text-xs truncate max-w-[110px]" title={p.participantId}>{p.name}</span>
                            <span className={`text-[10px] mt-0.5 px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600'}`}>{p.role}</span>
                            <span className="text-[10px] text-gray-400">{formatDateTime(p.time)}</span>
                          </div>
                          {idx < participantChain.length - 1 && (
                            <ArrowRight size={20} className="mx-1 text-violet-400" />
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Details of last transfer */}
                    {actions.length > 0 && (
                      <div className="mt-4 text-xs text-gray-500">
                        <div className="flex flex-wrap gap-4 items-center">
                          <span>Last Transfer:</span>
                          <span>From <b>{getParticipantName(actions[actions.length-1].from)}</b> ({actions[actions.length-1].fromMspId})</span>
                          <ArrowRight size={14} className="text-violet-400" />
                          <span>To <b>{getParticipantName(actions[actions.length-1].to)}</b> ({actions[actions.length-1].toMspId})</span>
                          <span>at {formatDateTime(actions[actions.length-1].timestamp)}</span>
                          {actions[actions.length-1].performedBy && (
                            <span>by <b>{actions[actions.length-1].performedBy.name}</b> ({actions[actions.length-1].performedBy.email})</span>
                          )}
                          {actions[actions.length-1].txId && (
                            <span>TxID: {actions[actions.length-1].txId}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showModal && selectedBatch && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-800">
                {user.role === 'distributor' ? 'Distribute Batch' : 'Transfer Batch'}
              </h2>
              <button onClick={closeTransferModal}><X size={20} /></button>
            </div>
            <div className="p-6">
              {/* Batch info */}
              <div className="bg-amber-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-amber-700">{selectedBatch.batchId}</p>
                <p className="text-sm text-amber-600">{selectedBatch.beerType} — {selectedBatch.quantity} units</p>
                <p className="text-xs text-amber-500 mt-1">
                  Currently at: {selectedBatch.currentLocation} with {getParticipantName(selectedBatch.currentOwnerId)}
                </p>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4">
                {transferTargets.length === 0 ? (
                  <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                    No {user.role === 'manufacturer' ? 'distributors' : 'retailers'} registered yet.
                    Please register a participant first.
                  </p>
                ) : user.role === 'distributor' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Retailer allocations
                      </label>
                      <button
                        type="button"
                        onClick={addAllocation}
                        className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-800"
                      >
                        <Plus size={14} />
                        Add retailer
                      </button>
                    </div>

                    <div className="space-y-2">
                      {transferAllocations.map((allocation, index) => (
                        <div key={index} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                          <select
                            value={allocation.toParticipantId}
                            onChange={e => updateAllocation(index, 'toParticipantId', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            <option value="">Select retailer</option>
                            {transferTargets.map(p => (
                              <option key={p.participantId} value={p.participantId}>
                                {p.name} ({p.participantId}){p.district ? ` - ${p.district}` : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            max={selectedBatch.quantity}
                            value={allocation.quantity}
                            onChange={e => updateAllocation(index, 'quantity', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeAllocation(index)}
                            disabled={transferAllocations.length === 1}
                            className="icon-button text-red-500 hover:bg-red-50 disabled:opacity-40"
                            title="Remove allocation"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="text-gray-500">Allocated</span>
                      <span className={allocatedQuantity > selectedBatch.quantity ? 'font-semibold text-red-600' : 'font-semibold text-gray-700'}>
                        {allocatedQuantity} / {selectedBatch.quantity} units
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transfer To (Distributor)
                    </label>
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
                  </div>
                )}

                {/* Arrow visualization */}
                {(transferTo || transferAllocations.some(a => a.toParticipantId)) && (
                  <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">From</p>
                      <p className="text-sm font-medium text-gray-700">{getParticipantName(selectedBatch.currentOwnerId)}</p>
                      <p className="text-xs text-gray-400">{user.mspId}</p>
                    </div>
                    <ArrowRight size={20} className="text-purple-400" />
                    <div className="text-center">
                      <p className="text-xs text-gray-400">To</p>
                      {user.role === 'distributor' ? (
                        <div className="space-y-1">
                          {transferAllocations.filter(a => a.toParticipantId).map((allocation, index) => (
                            <p key={`${allocation.toParticipantId}-${index}`} className="text-sm font-medium text-gray-700">
                              {getParticipantName(allocation.toParticipantId)} ({allocation.quantity || 0})
                            </p>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-700">{getParticipantName(transferTo)}</p>
                          <p className="text-xs text-gray-400">
                            {participants.find(p => p.participantId === transferTo)?.mspId}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || transferTargets.length === 0}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : user.role === 'distributor' ? 'Confirm Distribution' : 'Confirm Transfer'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
