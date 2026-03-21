// import { useState, useEffect } from 'react';
// import { useAuth } from '../context/AuthContext';
// import { getBatches, createBatch, transferBatch, recordSale, getParticipants, getBatchHistory } from '../services/api';
// import toast from 'react-hot-toast';
// import { Plus, ArrowRight, ShoppingCart, History, X, Trash2 } from 'lucide-react';

// function formatDateTime(dateStr) {
//   if (!dateStr) return '-';
//   return new Date(dateStr).toLocaleString('en-US', {
//     month: 'short', day: 'numeric', year: 'numeric',
//     hour: '2-digit', minute: '2-digit',
//   });
// }

// function timeAgo(dateStr) {
//   if (!dateStr) return '';
//   const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
//   if (diff < 60) return `${diff}s ago`;
//   if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
//   if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
//   return `${Math.floor(diff / 86400)}d ago`;
// }

// const STATUS_COLORS = {
//   PRODUCED:       'bg-blue-100 text-blue-700',
//   IN_TRANSIT:     'bg-yellow-100 text-yellow-700',
//   PARTIALLY_SOLD: 'bg-orange-100 text-orange-700',
//   SOLD_OUT:       'bg-gray-100 text-gray-500',
// };

// const BEER_TYPES = [
//   'Primus Lager',
//   'Mutzig',
//   'Heineken',
//   'Turbo King',
//   'Guinness',
//   'Amstel',
//   'Bralirwa Special',
//   'Other',
// ];

// const INGREDIENT_OPTIONS = [
//   'Hops',
//   'Barley',
//   'Water',
//   'Yeast',
//   'Malt',
//   'Wheat',
//   'Sugar',
//   'Carbon Dioxide',
// ];

// export default function Batches() {
//   const { user } = useAuth();
//   const [batches, setBatches] = useState([]);
//   const [participants, setParticipants] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [showCreateModal, setShowCreateModal] = useState(false);
//   const [showTransferModal, setShowTransferModal] = useState(false);
//   const [showSaleModal, setShowSaleModal] = useState(false);
//   const [showHistoryModal, setShowHistoryModal] = useState(false);
//   const [selectedBatch, setSelectedBatch] = useState(null);
//   const [history, setHistory] = useState([]);
//   const [submitting, setSubmitting] = useState(false);

//   const [createForm, setCreateForm] = useState({
//     batchId: '',
//     beerType: '',
//     customBeerType: '',
//     quantity: '',
//     manufacturerId: '',
//     productionDate: '',
//     expirationDate: '',
//   });

//   // Auto-generate next batch IDs based on existing batches
//   const generateNextBatchIds = (existingBatches, count = 10) => {
//     const nums = existingBatches
//       .map(b => parseInt(b.batchId.replace(/\D/g, '')))
//       .filter(n => !isNaN(n));
//     const max = nums.length > 0 ? Math.max(...nums) : 0;
//     return Array.from({ length: count }, (_, i) =>
//       `BATCH${String(max + i + 1).padStart(3, '0')}`
//     );
//   };

//   // Ingredients as array of {name, amount, unit}
//   const [ingredients, setIngredients] = useState([
//     { name: 'Hops', amount: '', unit: 'kg' },
//   ]);

//   const [transferTo, setTransferTo] = useState('');
//   const [saleQty, setSaleQty] = useState('');

//   const fetchData = async () => {
//     try {
//       const [batchRes, partRes] = await Promise.all([getBatches(), getParticipants()]);
//       setBatches(batchRes.data.data || []);
//       setParticipants(partRes.data.data || []);
//     } catch (err) {
//       toast.error('Failed to load data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => { fetchData(); }, []);

//   const addIngredient = () => {
//     setIngredients([...ingredients, { name: 'Barley', amount: '', unit: 'kg' }]);
//   };

//   const removeIngredient = (index) => {
//     setIngredients(ingredients.filter((_, i) => i !== index));
//   };

//   const updateIngredient = (index, field, value) => {
//     const updated = [...ingredients];
//     updated[index][field] = value;
//     setIngredients(updated);
//   };

//   const handleCreate = async (e) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       // Build ingredients object from array
//       const ingredientsObj = {};
//       ingredients.forEach(ing => {
//         if (ing.name && ing.amount) {
//           ingredientsObj[ing.name.toLowerCase()] = `${ing.amount}${ing.unit}`;
//         }
//       });

//       const beerType = createForm.beerType === 'Other' ? createForm.customBeerType : createForm.beerType;

//       await createBatch({
//         batchId: createForm.batchId,
//         beerType,
//         quantity: parseInt(createForm.quantity),
//         manufacturerId: createForm.manufacturerId,
//         productionDate: createForm.productionDate,
//         expirationDate: createForm.expirationDate,
//         ingredients: ingredientsObj,
//       });

//       toast.success('Batch created on blockchain!');
//       setShowCreateModal(false);
//       setCreateForm({ batchId: '', beerType: '', customBeerType: '', quantity: '', manufacturerId: '', productionDate: '', expirationDate: '' });
//       setIngredients([{ name: 'Hops', amount: '', unit: 'kg' }]);
//       fetchData();
//     } catch (err) {
//       toast.error(err.response?.data?.error || 'Failed to create batch');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleTransfer = async (e) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await transferBatch(selectedBatch.batchId, transferTo);
//       toast.success('Batch transferred on blockchain!');
//       setShowTransferModal(false);
//       setTransferTo('');
//       fetchData();
//     } catch (err) {
//       toast.error(err.response?.data?.error || 'Failed to transfer batch');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleSale = async (e) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await recordSale(selectedBatch.batchId, parseInt(saleQty));
//       toast.success('Sale recorded on blockchain!');
//       setShowSaleModal(false);
//       setSaleQty('');
//       fetchData();
//     } catch (err) {
//       toast.error(err.response?.data?.error || 'Failed to record sale');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleHistory = async (batch) => {
//     setSelectedBatch(batch);
//     try {
//       const res = await getBatchHistory(batch.batchId);
//       setHistory(res.data.data || []);
//       setShowHistoryModal(true);
//     } catch (err) {
//       toast.error('Failed to load history');
//     }
//   };

//   // Manufacturer participants for dropdown
//   const manufacturerParticipants = participants.filter(p => p.role === 'manufacturer');

//   const transferTargets = participants.filter(p => {
//     if (user.role === 'manufacturer') return p.role === 'distributor';
//     if (user.role === 'distributor') {
//       if (p.role !== 'retailer') return false;
//       if (user.participantId) {
//         const myParticipant = participants.find(pt => pt.participantId === user.participantId);
//         if (myParticipant?.district && p.district) {
//           return myParticipant.district === p.district;
//         }
//       }
//       return true;
//     }
//     return false;
//   });

//   if (loading) return (
//     <div className="flex items-center justify-center h-64">
//       <div className="text-center">
//         <div className="text-4xl mb-3">🍺</div>
//         <p className="text-gray-500">Loading batches...</p>
//       </div>
//     </div>
//   );

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <h1 className="text-2xl font-bold text-gray-800">Beer Batches</h1>
//         {user.role === 'manufacturer' && (
//           <button
//             onClick={() => setShowCreateModal(true)}
//             className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
//           >
//             <Plus size={16} /> New Batch
//           </button>
//         )}
//       </div>

//       {/* Table */}
//       <div className="bg-white rounded-xl shadow-sm overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Batch ID</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Beer Type</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantity</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Location</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created At</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created By</th>
//                 <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-gray-100">
//               {batches.length === 0 ? (
//                 <tr><td colSpan={8} className="text-center py-8 text-gray-400">No batches found</td></tr>
//               ) : batches.map((batch) => (
//                 <tr key={batch.batchId} className="hover:bg-gray-50">
//                   <td className="px-6 py-4 text-sm font-medium text-amber-600">{batch.batchId}</td>
//                   <td className="px-6 py-4 text-sm text-gray-700">{batch.beerType}</td>
//                   <td className="px-6 py-4 text-sm text-gray-700">{batch.quantity}</td>
//                   <td className="px-6 py-4 text-sm text-gray-700">{batch.currentLocation}</td>
//                   <td className="px-6 py-4">
//                     <span className={`px-2 py Asc 1 rounded-full text-xs font-medium ${STATUS_COLORS[batch.status] || 'bg-gray-100'}`}>
//                       {batch.status}
//                     </span>
//                   </td>
//                   <td className="px-6 py-4">
//                     <p className="text-xs text-gray-600">{formatDateTime(batch.createdAt)}</p>
//                     <p className="text-xs text-gray-400">{timeAgo(batch.createdAt)}</p>
//                   </td>
//                   <td className="px-6 py-4 text-sm text-gray-500">
//                     {batch.actionHistory?.[0]?.performedBy?.name || '-'}
//                   </td>
//                   <td className="px-6 py-4">
//                     <div className="flex items-center gap-2">
//                       {(user.role === 'manufacturer' || user.role === 'distributor') &&
//                         batch.currentLocation === user.role.toUpperCase() && batch.status !== 'SOLD_OUT' && (
//                         <button
//                           onClick={() => { setSelectedBatch(batch); setShowTransferModal(true); }}
//                           className="p Asc 1.5 text-purple Asc -500 hover:bg-purple-50 rounded-lg transition"
//                           title="Transfer"
//                         >
//                           <ArrowRight Asc size={16} />
//                         </button>
//                       )}
//                       {user.role Asc === Asc 'retailer' && batch.currentLocation === Asc 'RETAILER' && batch.status !== Asc 'SOLD_OUT' && (
//                         <button Asc
//                           onClick={() => { setSelected Asc Batch(batch); setShowSaleModal(true); }}
//                           class AscName="p-1. Asc 5 text-green-500 hover:bg-green-50 rounded-lg transition"
//                           title="Record Sale"
//                         >
//                           <ShoppingCart size={16} />
//                         </ Ascbutton Asc >
//                       )}
//                       <button Asc
//                         onClick={() => handleHistory(batch)}
//                         className="p-1.5 text-blue Asc -500 hover:bg-blue-50 rounded-lg transition"
//                         title="History"
//                       >
//                         <History Asc size={16} />
//                       </button>
//                     </div>
//                   </td>
//                 Asc </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* ── CREATE MODAL ── */}
//       {/* ... rest of modals unchanged ... */}
//     </div>
//   );
// }
