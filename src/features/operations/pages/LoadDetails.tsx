import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Truck, 
  User, 
  MapPin, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  History,
  ArrowRight,
  Calendar,
  Phone,
  Mail,
  CreditCard,
  X,
  ChevronRight,
  Edit2
} from 'lucide-react';
import { useLoad } from '../../../hooks/useLoads';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, cn } from '../../../lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '../../../components/ui/Skeleton';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { handleError } from '../../../lib/error-handler';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  en_route: 'bg-yellow-100 text-yellow-800',
  on_site: 'bg-orange-100 text-orange-800',
  service_done: 'bg-indigo-100 text-indigo-800',
  dumpyard_required: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusTimelineColors: Record<string, string> = {
  scheduled: 'text-blue-600 bg-blue-50',
  assigned: 'text-purple-600 bg-purple-50',
  en_route: 'text-yellow-600 bg-yellow-50',
  on_site: 'text-orange-600 bg-orange-50',
  service_done: 'text-indigo-600 bg-indigo-50',
  dumpyard_required: 'text-amber-600 bg-amber-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
};

export function LoadDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { load, events, loading, error, updateLoadStatus, assignDriver, refresh } = useLoad(id);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [editData, setEditData] = React.useState({
    load_value: 0,
    weight_kg: 0,
    notes: ''
  });
  const [confirmConfig, setConfirmConfig] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary',
  });

  const handleStatusUpdate = (status: any) => {
    if (!id) return;
    const statusMessages = {
      en_route: 'Are you sure you want to start this load? This will mark it as en-route.',
      on_site: 'Mark this load as arrived on site?',
      service_done: 'Mark the service as completed on site?',
      dumpyard_required: 'Does this load require a dumpyard visit?',
      completed: 'Are you sure you want to complete this load? This will finalize the delivery.',
      cancelled: 'Are you sure you want to cancel this load? This action cannot be undone.',
    };

    setConfirmConfig({
      isOpen: true,
      title: `Update Status to ${status.replace('_', ' ')}?`,
      message: statusMessages[status as keyof typeof statusMessages] || 'Confirm status update.',
      variant: status === 'cancelled' ? 'danger' : status === 'completed' ? 'primary' : 'warning',
      onConfirm: async () => {
        const toastId = toast.loading('Updating status...');
        setIsUpdating(true);
        try {
          await updateLoadStatus(status);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          toast.success('Status updated successfully', { id: toastId });
        } catch (err: any) {
          handleError(err, 'handleStatusUpdate');
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const fetchDrivers = React.useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'available');
      if (error) throw error;
      setDrivers(data || []);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  }, [profile?.tenant_id]);

  React.useEffect(() => {
    if (isAssignModalOpen) {
      fetchDrivers();
    }
  }, [isAssignModalOpen, fetchDrivers]);

  React.useEffect(() => {
    if (load) {
      setEditData({
        load_value: load.load_value || 0,
        weight_kg: load.weight_kg || 0,
        notes: load.notes || ''
      });
    }
  }, [load]);

  const handleAssignDriver = async (driverId: string) => {
    const toastId = toast.loading('Assigning driver...');
    try {
      await assignDriver(driverId);
      toast.success('Driver assigned successfully', { id: toastId });
      setIsAssignModalOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign driver', { id: toastId });
    }
  };

  const handleEditLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const toastId = toast.loading('Updating load...');
    try {
      const { error } = await supabase
        .from('loads')
        .update({
          load_value: editData.load_value,
          weight_kg: editData.weight_kg,
          notes: editData.notes
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Load updated successfully', { id: toastId });
      setIsEditModalOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update load', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !load) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Load not found</h2>
        <p className="text-gray-500 mt-2">{error || 'The requested load could not be found.'}</p>
        <button
          onClick={() => navigate('/loads')}
          className="mt-6 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/loads')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loads
        </button>
        <div className="flex items-center space-x-2">
          <span className={cn(
            "px-3 py-1 rounded-full text-sm font-bold capitalize",
            statusColors[load.status]
          )}>
            {load.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Truck className="mr-2 h-5 w-5 text-blue-600" />
                Load Details
              </h2>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </button>
                <span className="text-xs font-mono text-gray-500">ID: {load.id}</span>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</label>
                  <div className="mt-1 flex items-start">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{load.customer.name}</p>
                      <p className="text-sm text-gray-500 flex items-center mt-0.5">
                        <Phone className="h-3 w-3 mr-1" /> {load.customer.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pickup Address</label>
                  <div className="mt-1 flex items-start text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                    <div>
                      <p>{load.customer.address_line1}</p>
                      <p>{load.customer.city}, {load.customer.country}</p>
                      {load.google_maps_link && (
                        <a 
                          href={load.google_maps_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View on Google Maps
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Driver</label>
                  {load.driver ? (
                    <div className="mt-1 flex items-start">
                      <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <Truck className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{load.driver.full_name}</p>
                        <p className="text-sm text-gray-500 flex items-center mt-0.5">
                          <Phone className="h-3 w-3 mr-1" /> {load.driver.phone || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-gray-500 italic mb-2">No driver assigned yet.</p>
                      <button
                        onClick={() => setIsAssignModalOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Truck className="mr-2 h-3 w-3" />
                        Assign Driver
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weight</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{load.weight_kg ? `${load.weight_kg} kg` : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Created</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{format(new Date(load.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <History className="mr-2 h-5 w-5 text-blue-600" />
                Load Timeline
              </h2>
            </div>
            <div className="p-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {events.map((event, idx) => (
                    <li key={event.id}>
                      <div className="relative pb-8">
                        {idx !== events.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white",
                              statusTimelineColors[event.to_status] || 'bg-gray-100 text-gray-600'
                            )}>
                              <Clock className="h-4 w-4" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900 font-medium">
                                Status changed to <span className="capitalize">{event.to_status.replace('_', ' ')}</span>
                              </p>
                              {event.notes && (
                                <p className="mt-1 text-sm text-gray-500 italic">"{event.notes}"</p>
                              )}
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-gray-500">
                              {format(new Date(event.created_at), 'MMM d, HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                Financial Summary
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Load Value</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(load.load_value || 0, load.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Platform Fee ({((load.tenant?.fee_rate || 0.01) * 100).toFixed(1)}%)</span>
                <span className="text-sm font-medium text-red-600">-{formatCurrency((load.load_value || 0) * (load.tenant?.fee_rate || 0.01), load.currency)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Net Revenue</span>
                <span className="text-xl font-black text-green-600">{formatCurrency((load.load_value || 0) * (1 - (load.tenant?.fee_rate || 0.01)), load.currency)}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold mb-2 flex items-center">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Quick Actions
            </h3>
            <p className="text-blue-100 text-sm mb-4">Manage this load's lifecycle directly from here.</p>
            <div className="space-y-2">
              {load.status === 'assigned' && (
                <button 
                  onClick={() => handleStatusUpdate('en_route')}
                  disabled={isUpdating}
                  className="w-full py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Mark as En Route
                </button>
              )}
              {load.status === 'en_route' && (
                <button 
                  onClick={() => handleStatusUpdate('on_site')}
                  disabled={isUpdating}
                  className="w-full py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Mark as Arrived On Site
                </button>
              )}
              {load.status === 'on_site' && (
                <button 
                  onClick={() => handleStatusUpdate('service_done')}
                  disabled={isUpdating}
                  className="w-full py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Mark Service Done
                </button>
              )}
              {load.status === 'service_done' && (
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleStatusUpdate('dumpyard_required')}
                    disabled={isUpdating}
                    className="py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    To Dumpyard
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate('completed')}
                    disabled={isUpdating}
                    className="py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    Complete
                  </button>
                </div>
              )}
              {load.status === 'dumpyard_required' && (
                <button 
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={isUpdating}
                  className="w-full py-2 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Mark as Completed
                </button>
              )}
              {['scheduled', 'assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(load.status) && (
                <button 
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={isUpdating}
                  className="w-full py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  Cancel Load
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
      />

      {/* Assign Driver Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Assign Driver</h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {drivers.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No available drivers found.</p>
                </div>
              ) : (
                drivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div>
                      <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{driver.full_name}</div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Truck className="h-3 w-3 mr-1" />
                        Available
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end mt-8">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Load Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Load</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditLoad} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Load Value</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={editData.load_value}
                  onChange={(e) => setEditData({ ...editData, load_value: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={editData.weight_kg}
                  onChange={(e) => setEditData({ ...editData, weight_kg: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
