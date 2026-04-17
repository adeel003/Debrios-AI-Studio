import React, { useEffect, useState } from 'react';
import { Database as DatabaseIcon, Plus, AlertCircle, X, ChevronLeft, ChevronRight, Search, Filter, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { handleError } from '../../../lib/error-handler';
import { supabase } from '../../../lib/supabase';
import { Database } from '../../../types/database';

type Dumpster = Database['public']['Tables']['dumpsters']['Row'];

const SIZES = ['5 yard', '10 yard', '15 yard', '20 yard', '30 yard', '40 yard'];
const CONDITIONS = ['Able to Rent', 'Damaged', 'Under Maintenance'];
const STATUSES = ['Available', 'Assigned', 'Out of Service'];

export function DumpstersInventory() {
  const { profile, appReady } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDumpster, setEditingDumpster] = useState<Dumpster | null>(null);
  
  // Filters
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const pageSize = 10;

  const [formData, setFormData] = useState({
    size: SIZES[0],
    condition: CONDITIONS[0],
    status: STATUSES[0],
    notes: '',
    location_link: ''
  });

  const fetchDumpsters = async () => {
    if (!appReady || !profile?.tenant_id) return;

    try {
      setLoading(true);
      let query = supabase
        .from('dumpsters')
        .select('*', { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .order('asset_number', { ascending: false });

      if (search) {
        query = query.ilike('asset_number', `%${search}%`);
      }
      if (sizeFilter) {
        query = query.eq('size', sizeFilter);
      }
      if (conditionFilter) {
        query = query.eq('condition', conditionFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      setDumpsters(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      handleError(err, 'Dumpsters:fetchDumpsters');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchDumpsters();
  }, [profile?.tenant_id, page, search, sizeFilter, conditionFilter, statusFilter, appReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSubmitting(true);
    const toastId = toast.loading(editingDumpster ? 'Updating dumpster...' : 'Adding dumpster...');

    try {
      const payload: any = { ...formData };
      if (payload.location_link === '') payload.location_link = null;

      if (editingDumpster) {
        const { error } = await supabase
          .from('dumpsters')
          .update({
            ...payload,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDumpster.id);
        if (error) throw error;
        toast.success('Dumpster updated successfully', { id: toastId });
      } else {
        const { error } = await supabase
          .from('dumpsters')
          .insert([{
            ...payload,
            tenant_id: profile.tenant_id
          }]);
        if (error) throw error;
        toast.success('Dumpster added successfully', { id: toastId });
      }

      setIsModalOpen(false);
      setEditingDumpster(null);
      setFormData({ size: SIZES[0], condition: CONDITIONS[0], status: STATUSES[0], notes: '', location_link: '' });
      fetchDumpsters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save dumpster', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (dumpster: Dumpster) => {
    setEditingDumpster(dumpster);
    setFormData({
      size: dumpster.size,
      condition: dumpster.condition,
      status: dumpster.status,
      notes: dumpster.notes || '',
      location_link: (dumpster as any).location_link || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this dumpster?')) return;

    const toastId = toast.loading('Deleting dumpster...');
    try {
      const { error } = await supabase.from('dumpsters').delete().eq('id', id);
      if (error) throw error;
      toast.success('Dumpster deleted successfully', { id: toastId });
      fetchDumpsters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete dumpster', { id: toastId });
    }
  };

  if (loading && dumpsters.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dumpsters Inventory</h1>
          <p className="text-gray-500">Track and manage your company's dumpster assets.</p>
        </div>
        <button 
          onClick={() => {
            setEditingDumpster(null);
            setFormData({ size: SIZES[0], condition: CONDITIONS[0], status: STATUSES[0], notes: '', location_link: '' });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Dumpster
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search asset number..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
        >
          <option value="">All Sizes</option>
          {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
        >
          <option value="">All Conditions</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {dumpsters.length === 0 ? (
        <div className="bg-white p-16 text-center rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center max-w-sm mx-auto">
            <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <DatabaseIcon className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No dumpsters found</h3>
            <p className="text-sm text-gray-500 mb-6">
              {search || sizeFilter || conditionFilter || statusFilter 
                ? "Try adjusting your filters to find what you're looking for."
                : "Start by adding your first dumpster to the inventory."}
            </p>
            {!search && !sizeFilter && !conditionFilter && !statusFilter && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Dumpster
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dumpsters.map((dumpster) => (
                <tr key={dumpster.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-blue-600">
                    {dumpster.asset_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {dumpster.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium",
                      dumpster.condition === 'Able to Rent' ? 'bg-green-100 text-green-800' :
                      dumpster.condition === 'Damaged' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    )}>
                      {dumpster.condition}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium",
                      dumpster.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                      dumpster.status === 'Assigned' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    )}>
                      {dumpster.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(dumpster as any).location_link ? (
                      <a
                        href={(dumpster as any).location_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Open <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => handleEdit(dumpster)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(dumpster.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{page * pageSize + 1}</span> to{' '}
              <span className="font-medium">{Math.min((page + 1) * pageSize, totalCount)}</span> of{' '}
              <span className="font-medium">{totalCount}</span> results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
                className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDumpster ? `Edit Dumpster ${editingDumpster.asset_number}` : 'Add New Dumpster'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                >
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Link</label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/?q=…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.location_link}
                  onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">Optional Google Maps (or any) URL pointing at the dumpster's current location.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  rows={3}
                  placeholder="Optional notes about this dumpster..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingDumpster ? 'Update Dumpster' : 'Add Dumpster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
