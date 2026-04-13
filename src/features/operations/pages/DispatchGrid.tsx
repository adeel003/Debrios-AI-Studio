import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Truck, 
  User, 
  MapPin, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  ArrowUpDown,
  X,
  ChevronLeft,
  Map as MapIcon, 
  List
} from 'lucide-react';
import { useLoads } from '../../../hooks/useLoads';
import { useAuth } from '../../../contexts/AuthContext';
import { ExportButton } from '../../../components/ExportButton';
import { formatCurrency, cn } from '../../../lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { LoadsMap } from '../../../components/LoadsMap';
import { handleError } from '../../../lib/error-handler';
import { customerService } from '../../../services/customer.service';
import { driverService } from '../../../services/driver.service';
import { Customer } from '../../../types/customer';
import { Driver } from '../../../types/driver';
import { Load, LoadWithDetails, ClientSite, Dumpyard } from '../../../types/load';
import { supabase } from '../../../lib/supabase';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-purple-100 text-purple-800',
  on_site: 'bg-yellow-100 text-yellow-800',
  service_done: 'bg-orange-100 text-orange-800',
  dumpyard_required: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function DispatchGrid() {
  const { profile, appReady } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: '',
    driverId: '',
    search: '',
    sortBy: 'created_at' as 'created_at' | 'load_value',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 0,
    pageSize: 10
  });

  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const { loads, totalCount, loading, error, createLoad, updateLoadStatus, assignDriver } = useLoads(filters);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  
  const [confirmConfig, setConfirmConfig] = useState<{
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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [dumpyards, setDumpyards] = useState<Dumpyard[]>([]);
  const [deployedLoads, setDeployedLoads] = useState<LoadWithDetails[]>([]);
  
  const [newLoad, setNewLoad] = useState({
    customer_id: '',
    driver_id: '',
    site_id: '',
    dumpyard_id: '',
    parent_load_id: '',
    google_maps_link: '',
    load_type: 'New Deployment' as 'New Deployment' | 'Pickup' | 'Exchange',
    load_value: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!appReady || !profile?.tenant_id) return;

      try {
        const [custRes, drivRes, dumpRes] = await Promise.all([
          customerService.getTenantCustomers(profile.tenant_id, { pageSize: 100 }),
          driverService.getTenantDrivers(profile.tenant_id),
          supabase.from('dumpyards').select('*').eq('tenant_id', profile.tenant_id).eq('active', true)
        ]);
        
        setCustomers(custRes.data);
        setDrivers(drivRes.data);
        setDumpyards(dumpRes.data || []);
      } catch (err: any) {
        handleError(err, 'Loads:fetchData');
      }
    };
    fetchData();
  }, [appReady, profile?.tenant_id]);

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!newLoad.customer_id) {
        setSites([]);
        setDeployedLoads([]);
        return;
      }
      try {
        const [sitesRes, deployedRes] = await Promise.all([
          supabase.from('client_sites').select('*').eq('customer_id', newLoad.customer_id),
          supabase.from('loads')
            .select('*, customer:customers(*), driver:drivers(*)')
            .eq('customer_id', newLoad.customer_id)
            .in('status', ['on_site', 'completed'])
            .order('created_at', { ascending: false })
        ]);

        if (sitesRes.error) throw sitesRes.error;
        if (deployedRes.error) throw deployedRes.error;

        setSites(sitesRes.data || []);
        setDeployedLoads(deployedRes.data as LoadWithDetails[] || []);
      } catch (err: any) {
        console.error('Error fetching customer data:', err);
        toast.error('Failed to fetch customer sites or deployed loads');
      }
    };
    fetchCustomerData();
  }, [newLoad.customer_id]);

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoad.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (newLoad.load_type === 'New Deployment') {
      if (!newLoad.google_maps_link) {
        toast.error('Google Maps link is required for New Deployment');
        return;
      }
      if (newLoad.load_value <= 0) {
        toast.error('Load value must be greater than 0 for New Deployment');
        return;
      }
    } else {
      // Pickup or Exchange
      if (!newLoad.parent_load_id) {
        toast.error(`Please select an existing load to ${newLoad.load_type.toLowerCase()}`);
        return;
      }
    }

    const toastId = toast.loading('Creating load...');
    try {
      const loadData: any = {
        customer_id: newLoad.customer_id,
        site_id: newLoad.site_id || null,
        dumpyard_id: newLoad.dumpyard_id || null,
        parent_load_id: newLoad.parent_load_id || null,
        google_maps_link: newLoad.google_maps_link || null,
        load_type: newLoad.load_type,
        load_value: newLoad.load_type === 'New Deployment' ? newLoad.load_value : 0,
        status: newLoad.driver_id ? 'assigned' : 'scheduled'
      };

      if (newLoad.driver_id) {
        loadData.driver_id = newLoad.driver_id;
        loadData.dispatched_at = new Date().toISOString();
      }

      await createLoad(loadData);
      setIsCreateModalOpen(false);
      setNewLoad({ 
        customer_id: '', 
        driver_id: '', 
        site_id: '', 
        dumpyard_id: '', 
        parent_load_id: '',
        google_maps_link: '',
        load_type: 'New Deployment', 
        load_value: 0 
      });
      toast.success('Load created successfully', { id: toastId });
    } catch (err: any) {
      handleError(err, 'handleCreateLoad');
    }
  };

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedLoadId) return;
    const toastId = toast.loading('Assigning driver...');
    try {
      await assignDriver(selectedLoadId, driverId);
      setIsAssignModalOpen(false);
      setSelectedLoadId(null);
      toast.success('Driver assigned successfully', { id: toastId });
    } catch (err: any) {
      handleError(err, 'handleAssignDriver');
    }
  };

  const handleStatusUpdate = (id: string, status: any) => {
    const statusMessages = {
      in_progress: 'Are you sure you want to start this load? This will mark it as in-progress.',
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
        try {
          await updateLoadStatus(id, status);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          toast.success('Status updated successfully', { id: toastId });
        } catch (err: any) {
          handleError(err, 'handleStatusUpdate');
        }
      }
    });
  };

  const toggleSort = (field: 'created_at' | 'load_value') => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loads Management</h1>
          <p className="text-gray-500">Track and manage your logistics operations in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'table' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
              title="Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                "p-2 rounded-md transition-all",
                viewMode === 'map' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
              title="Map View"
            >
              <MapIcon size={18} />
            </button>
          </div>
          <ExportButton data={loads} filename="loads_export" />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Load
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="assigned">Assigned</option>
            <option value="en_route">En Route</option>
            <option value="on_site">On Site</option>
            <option value="service_done">Service Done</option>
            <option value="dumpyard_required">Dumpyard Required</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
            value={filters.driverId}
            onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}
          >
            <option value="">All Drivers</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content View */}
      {viewMode === 'table' ? (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {loading && loads.length === 0 ? (
              <div className="p-6">
                <TableSkeleton cols={6} rows={8} />
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleSort('load_value')}
                    >
                      <div className="flex items-center">
                        Value
                        <ArrowUpDown className={cn("ml-1 h-3 w-3", filters.sortBy === 'load_value' ? 'text-blue-600' : 'text-gray-400')} />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Created At
                        <ArrowUpDown className={cn("ml-1 h-3 w-3", filters.sortBy === 'created_at' ? 'text-blue-600' : 'text-gray-400')} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loads.map((load) => (
                    <tr 
                      key={load.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/loads/${load.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{load.customer.name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {load.customer.city || 'No location'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {load.driver ? (
                          <div className="flex items-center group/driver">
                            <Truck className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{load.driver.full_name}</span>
                            {['scheduled', 'dispatched'].includes(load.status) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLoadId(load.id);
                                  setIsAssignModalOpen(true);
                                }}
                                className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover/driver:opacity-100 transition-opacity"
                                title="Reassign Driver"
                              >
                                <Truck className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoadId(load.id);
                              setIsAssignModalOpen(true);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Assign Driver
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                          statusColors[load.status]
                        )}>
                          {load.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(load.load_value || 0, load.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(load.created_at), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end space-x-2">
                          {load.status === 'assigned' && (
                            <button
                              onClick={() => handleStatusUpdate(load.id, 'en_route')}
                              className="text-yellow-600 hover:text-yellow-900 p-1 rounded-md hover:bg-yellow-50"
                              title="Start Load"
                            >
                              <Clock className="h-5 w-5" />
                            </button>
                          )}
                          {['en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(load.status) && (
                            <button
                              onClick={() => handleStatusUpdate(load.id, 'completed')}
                              className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-50"
                              title="Complete Load"
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                          )}
                          {['scheduled', 'assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(load.status) && (
                            <button
                              onClick={() => handleStatusUpdate(load.id, 'cancelled')}
                              className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50"
                              title="Cancel Load"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => navigate(`/loads/${load.id}`)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && loads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center max-w-sm mx-auto">
                          <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Truck className="h-8 w-8 text-blue-400" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">No loads found</h3>
                          <p className="text-sm text-gray-500 mb-6">
                            {filters.search || filters.status || filters.driverId 
                              ? "Try adjusting your filters to find what you're looking for."
                              : "Start by creating your first load to manage your logistics operations."}
                          </p>
                          <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Your First Load
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{filters.page * filters.pageSize + 1}</span> to{' '}
              <span className="font-medium">{Math.min((filters.page + 1) * filters.pageSize, totalCount)}</span> of{' '}
              <span className="font-medium">{totalCount}</span> results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.max(0, f.page - 1) }))}
                disabled={filters.page === 0}
                className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={(filters.page + 1) * filters.pageSize >= totalCount}
                className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <LoadsMap loads={loads} customers={customers} />
      )}

      {/* Create Load Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create New Load</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateLoad} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Load Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['New Deployment', 'Pickup', 'Exchange'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewLoad({ ...newLoad, load_type: type as any })}
                        className={cn(
                          "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                          newLoad.load_type === type 
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Customer *</label>
                    <button 
                      type="button"
                      onClick={() => navigate('/customers')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add New
                    </button>
                  </div>
                  <select
                    required
                    className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                    value={newLoad.customer_id}
                    onChange={(e) => setNewLoad({ ...newLoad, customer_id: e.target.value, site_id: '', parent_load_id: '' })}
                  >
                    <option value="">Select a customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {newLoad.customer_id && (newLoad.load_type === 'Pickup' || newLoad.load_type === 'Exchange') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Deployed Load *</label>
                    <select
                      required
                      className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                      value={newLoad.parent_load_id}
                      onChange={(e) => setNewLoad({ ...newLoad, parent_load_id: e.target.value })}
                    >
                      <option value="">Select an existing deployment</option>
                      {deployedLoads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.load_type} - {format(new Date(l.created_at), 'MMM d')} (#{l.id.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                    {deployedLoads.length === 0 && (
                      <p className="mt-1 text-xs text-red-500">No deployed loads found for this customer.</p>
                    )}
                  </div>
                )}

                {newLoad.load_type === 'New Deployment' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link *</label>
                    <input
                      type="url"
                      required
                      className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                      placeholder="Paste Google Maps link here"
                      value={newLoad.google_maps_link}
                      onChange={(e) => setNewLoad({ ...newLoad, google_maps_link: e.target.value })}
                    />
                  </div>
                )}

                {newLoad.customer_id && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Site (Optional)</label>
                    <select
                      className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                      value={newLoad.site_id}
                      onChange={(e) => setNewLoad({ ...newLoad, site_id: e.target.value })}
                    >
                      <option value="">Default Address</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.site_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dumpyard (Optional)</label>
                  <select
                    className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                    value={newLoad.dumpyard_id}
                    onChange={(e) => setNewLoad({ ...newLoad, dumpyard_id: e.target.value })}
                  >
                    <option value="">No dumpyard assigned</option>
                    {dumpyards.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Driver (Optional)</label>
                  <select
                    className="block w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg"
                    value={newLoad.driver_id}
                    onChange={(e) => setNewLoad({ ...newLoad, driver_id: e.target.value })}
                  >
                    <option value="">No driver assigned (Scheduled)</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.status !== 'available'}>
                        {d.full_name} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>

                {newLoad.load_type === 'New Deployment' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Load Value (⃁) *</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-sm">⃁</span>
                      </div>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 text-sm border-gray-300 rounded-lg py-2"
                        placeholder="0.00"
                        value={newLoad.load_value || ''}
                        onChange={(e) => setNewLoad({ ...newLoad, load_value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}
              </div>
              {newLoad.load_value > 0 && (
                <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-700">Estimated Revenue:</span>
                    <span className="font-bold text-emerald-800">{formatCurrency(newLoad.load_value)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                >
                  Create Load
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              {drivers.filter(d => d.status === 'available').length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No available drivers found.</p>
                </div>
              ) : (
                drivers.filter(d => d.status === 'available').map((driver) => (
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

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
      />
    </div>
  );
}
