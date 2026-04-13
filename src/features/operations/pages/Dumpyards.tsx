import React, { useEffect, useState } from 'react';
import { Truck, MapPin, Plus, Edit2, Trash2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Dumpyard } from '../../../types/load';
import toast from 'react-hot-toast';
import { cn } from '../../../lib/utils';

export function Dumpyards() {
  const { profile } = useAuth();
  const [dumpyards, setDumpyards] = useState<Dumpyard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDumpyard, setEditingDumpyard] = useState<Dumpyard | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    region_or_city: '',
    google_maps_link: '',
    active: true,
    notes: ''
  });

  const fetchDumpyards = async () => {
    if (!profile?.tenant_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dumpyards')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('name');
      
      if (error) throw error;
      setDumpyards(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDumpyards();
  }, [profile?.tenant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSubmitting(true);
    try {
      if (editingDumpyard) {
        const { error } = await supabase
          .from('dumpyards')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDumpyard.id);
        if (error) throw error;
        toast.success('Dumpyard updated successfully');
      } else {
        const { error } = await supabase
          .from('dumpyards')
          .insert([{
            ...formData,
            tenant_id: profile.tenant_id
          }]);
        if (error) throw error;
        toast.success('Dumpyard added successfully');
      }
      setIsModalOpen(false);
      fetchDumpyards();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (dumpyard: Dumpyard) => {
    try {
      const { error } = await supabase
        .from('dumpyards')
        .update({ active: !dumpyard.active })
        .eq('id', dumpyard.id);
      if (error) throw error;
      fetchDumpyards();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (dumpyard: Dumpyard) => {
    setEditingDumpyard(dumpyard);
    setFormData({
      name: dumpyard.name,
      region_or_city: dumpyard.region_or_city || '',
      google_maps_link: dumpyard.google_maps_link || '',
      active: dumpyard.active,
      notes: dumpyard.notes || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dumpyards</h1>
          <p className="text-gray-500">Manage disposal locations for your fleet.</p>
        </div>
        <button
          onClick={() => {
            setEditingDumpyard(null);
            setFormData({ name: '', region_or_city: '', google_maps_link: '', active: true, notes: '' });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Dumpyard
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : dumpyards.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No dumpyards found</h3>
          <p className="text-gray-500">Add your first disposal location to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dumpyards.map((dumpyard) => (
            <div key={dumpyard.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-50 rounded-lg mr-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{dumpyard.name}</h3>
                    <p className="text-sm text-gray-500">{dumpyard.region_or_city}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(dumpyard)}
                  className={cn(
                    "p-1 rounded-full transition-colors",
                    dumpyard.active ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"
                  )}
                >
                  {dumpyard.active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </button>
              </div>

              {dumpyard.notes && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{dumpyard.notes}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex space-x-2">
                  {dumpyard.google_maps_link && (
                    <a
                      href={dumpyard.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(dumpyard)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingDumpyard ? 'Edit Dumpyard' : 'Add New Dumpyard'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region / City</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.region_or_city}
                  onChange={(e) => setFormData({ ...formData, region_or_city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.google_maps_link}
                  onChange={(e) => setFormData({ ...formData, google_maps_link: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingDumpyard ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
