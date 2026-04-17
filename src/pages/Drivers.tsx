import React, { useEffect, useState } from 'react';
import {
  UserSquare2, Phone, Award, Plus, AlertCircle, X,
  ChevronLeft, ChevronRight, Search, Power
} from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../lib/error-handler';
import { ExportButton } from '../components/ExportButton';
import { driverService } from '../services/driver.service';
import { Driver } from '../types/driver';
import { supabase } from '../lib/supabase';
import { format, isPast, addDays } from 'date-fns';

const STATUS_TABS = ['all', 'available', 'busy', 'off_duty'] as const;
type StatusTab = typeof STATUS_TABS[number];

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  busy: 'bg-yellow-100 text-yellow-800',
  off_duty: 'bg-gray-100 text-gray-800',
};

function ComplianceBadge({ label, date }: { label: string; date: string | null }) {
  if (!date) return (
    <div className="flex flex-col p-2 rounded bg-gray-50 border border-gray-100">
      <span className="text-[9px] text-gray-400 uppercase font-bold">{label}</span>
      <span className="text-[10px] text-gray-400">Not Set</span>
    </div>
  );

  const expiryDate = new Date(date);
  const expired = isPast(expiryDate);
  const nearExpiry = isPast(addDays(expiryDate, -30));

  return (
    <div className={cn(
      "flex flex-col p-2 rounded border",
      expired ? "bg-red-50 border-red-100" : nearExpiry ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100"
    )}>
      <span className={cn(
        "text-[9px] uppercase font-bold",
        expired ? "text-red-500" : nearExpiry ? "text-amber-600" : "text-green-600"
      )}>{label}</span>
      <span className={cn(
        "text-[10px] font-medium",
        expired ? "text-red-700" : nearExpiry ? "text-amber-800" : "text-green-800"
      )}>{format(expiryDate, 'MMM dd, yyyy')}</span>
    </div>
  );
}

const emptyForm = {
  full_name: '',
  phone: '',
  license_number: '',
  iqama_number: '',
  iqama_expiry: '',
  route_permit_expiry: '',
  driver_card_expiry: '',
  driver_license_expiry: '',
  driver_picture_url: '',
  status: 'available' as const,
  monthly_target_loads: 0,
};

export function Drivers() {
  const { profile, appReady } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTab>('all');
  const [page, setPage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const PAGE_SIZE = 12;

  const fetchDrivers = async () => {
    if (!appReady || !profile?.tenant_id) return;
    try {
      setLoading(true);
      const { data } = await driverService.getTenantDrivers(profile.tenant_id, { page: 0, pageSize: 200 });
      setDrivers(data);
    } catch (err: any) {
      handleError(err, 'Drivers:fetch');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchDrivers();

    const sub = supabase
      .channel('drivers-page-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drivers',
        filter: `tenant_id=eq.${profile.tenant_id}`,
      }, () => fetchDrivers())
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [profile?.tenant_id, appReady]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || d.full_name.toLowerCase().includes(q) || (d.phone || '').includes(q);
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleToggleStatus = async (driver: Driver) => {
    if (driver.status === 'busy') {
      toast.error(`${driver.full_name} is on an active job and cannot be toggled.`);
      return;
    }
    const next = driver.status === 'available' ? 'off_duty' : 'available';
    const toastId = toast.loading('Updating status…');
    try {
      const { error: err } = await supabase
        .from('drivers')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', driver.id);
      if (err) throw err;
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, status: next } : d));
      toast.success(`${driver.full_name} is now ${next.replace('_', ' ')}`, { id: toastId });
    } catch (err: any) {
      handleError(err, 'toggleStatus');
      toast.error('Failed to update status', { id: toastId });
    }
  };

  const handleOpenModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        full_name: driver.full_name,
        phone: driver.phone || '',
        license_number: driver.license_number || '',
        iqama_number: driver.iqama_number || '',
        iqama_expiry: driver.iqama_expiry || '',
        route_permit_expiry: driver.route_permit_expiry || '',
        driver_card_expiry: driver.driver_card_expiry || '',
        driver_license_expiry: driver.driver_license_expiry || '',
        driver_picture_url: driver.driver_picture_url || '',
        status: driver.status as any,
        monthly_target_loads: driver.monthly_target_loads || 0,
      });
    } else {
      setEditingDriver(null);
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    setIsSubmitting(true);
    const toastId = toast.loading(editingDriver ? 'Updating driver…' : 'Adding driver…');
    try {
      if (editingDriver) {
        const { error: err } = await supabase
          .from('drivers')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingDriver.id);
        if (err) throw err;
        toast.success('Driver updated', { id: toastId });
      } else {
        const { error: err } = await supabase
          .from('drivers')
          .insert([{ ...formData, tenant_id: profile.tenant_id }]);
        if (err) throw err;
        toast.success('Driver added', { id: toastId });
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save driver', { id: toastId });
      handleError(err, 'Drivers:submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && drivers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500">Manage fleet drivers and availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton data={drivers} filename="drivers_export" />
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md flex">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="ml-3 text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200 h-fit">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                statusFilter === tab
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === 'off_duty' ? 'Off Duty' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Counts */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing <span className="font-medium text-gray-900">{filtered.length}</span> driver{filtered.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` · ${statusFilter.replace('_', ' ')}`}
        </span>
        <span className="text-xs">
          {drivers.filter(d => d.status === 'available').length} available &nbsp;·&nbsp;
          {drivers.filter(d => d.status === 'busy').length} busy &nbsp;·&nbsp;
          {drivers.filter(d => d.status === 'off_duty').length} off duty
        </span>
      </div>

      {paginated.length === 0 ? (
        <div className="bg-white p-16 text-center rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center max-w-sm mx-auto">
            <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <UserSquare2 className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {search || statusFilter !== 'all' ? 'No drivers match your filters' : 'No drivers yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first driver to start assigning loads.'}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Driver
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map(driver => (
              <div key={driver.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                      {driver.driver_picture_url ? (
                        <img src={driver.driver_picture_url} alt={driver.full_name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserSquare2 className="h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{driver.full_name}</h3>
                        {driver.employee_id && (
                          <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {driver.employee_id}
                          </span>
                        )}
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', statusColors[driver.status])}>
                        {driver.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Quick status toggle */}
                  <button
                    onClick={() => handleToggleStatus(driver)}
                    disabled={driver.status === 'busy'}
                    title={
                      driver.status === 'busy'
                        ? 'Driver is on an active job'
                        : driver.status === 'available'
                        ? 'Set offline'
                        : 'Set available'
                    }
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      driver.status === 'busy'
                        ? "text-gray-300 cursor-not-allowed"
                        : driver.status === 'available'
                        ? "text-green-500 hover:bg-green-50 hover:text-green-700"
                        : "text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                    )}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5 mr-2 text-gray-400" />
                    {driver.phone || 'No phone'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Award className="h-3.5 w-3.5 mr-2 text-gray-400" />
                    License: {driver.license_number || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="text-gray-400 mr-2 text-xs font-medium">IQAMA</span>
                    {driver.iqama_number || 'N/A'}
                  </div>

                  <div className="pt-3 border-t border-gray-50 space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Compliance</p>
                    <div className="grid grid-cols-2 gap-2">
                      <ComplianceBadge label="Iqama" date={driver.iqama_expiry} />
                      <ComplianceBadge label="Route Permit" date={driver.route_permit_expiry} />
                      <ComplianceBadge label="Driver Card" date={driver.driver_card_expiry} />
                      <ComplianceBadge label="License" date={driver.driver_license_expiry} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleOpenModal(driver)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-white border border-gray-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{page * PAGE_SIZE + 1}</span>–
                <span className="font-medium">{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> of{' '}
                <span className="font-medium">{filtered.length}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDriver ? `Edit: ${editingDriver.full_name}` : 'Add New Driver'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input required type="text" placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" placeholder="+966 5X XXX XXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input type="text" placeholder="ABC123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.license_number}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Iqama Number *</label>
                  <input required type="text" placeholder="1234567890"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.iqama_number}
                    onChange={e => setFormData({ ...formData, iqama_number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Iqama Expiry *</label>
                  <input required type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.iqama_expiry}
                    onChange={e => setFormData({ ...formData, iqama_expiry: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route Permit Expiry *</label>
                  <input required type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.route_permit_expiry}
                    onChange={e => setFormData({ ...formData, route_permit_expiry: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver Card Expiry *</label>
                  <input required type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.driver_card_expiry}
                    onChange={e => setFormData({ ...formData, driver_card_expiry: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry *</label>
                  <input required type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.driver_license_expiry}
                    onChange={e => setFormData({ ...formData, driver_license_expiry: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Target Loads</label>
                  <input type="number" min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.monthly_target_loads}
                    onChange={e => setFormData({ ...formData, monthly_target_loads: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="available">Available</option>
                    <option value="off_duty">Off Duty</option>
                    {editingDriver && <option value="busy">Busy</option>}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Driver Picture URL</label>
                  <input type="url" placeholder="https://…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={formData.driver_picture_url}
                    onChange={e => setFormData({ ...formData, driver_picture_url: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Saving…' : editingDriver ? 'Update Driver' : 'Add Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
