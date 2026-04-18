import React, { useEffect, useState, useCallback } from 'react';
import {
  Truck, User, AlertCircle, X, ChevronRight,
  Radio, UserSquare2, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../lib/error-handler';
import { driverService } from '../services/driver.service';
import { Driver } from '../types/driver';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { TableSkeleton } from '../components/ui/Skeleton';

interface ActiveLoad {
  id: string;
  status: string;
  load_type: string;
  load_value: number | null;
  currency: string | null;
  created_at: string;
  dispatched_at: string | null;
  customer: { name: string; city: string | null } | null;
  driver: { full_name: string } | null;
}

const JOB_STATUSES = ['scheduled', 'assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required'];

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-purple-100 text-purple-800',
  on_site: 'bg-yellow-100 text-yellow-800',
  service_done: 'bg-orange-100 text-orange-800',
  dumpyard_required: 'bg-cyan-100 text-cyan-800',
};

const driverStatusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  busy: 'bg-yellow-100 text-yellow-800',
  off_duty: 'bg-gray-100 text-gray-800',
};

export function Dispatch() {
  const { profile, appReady } = useAuth();
  const canAssign = ['admin', 'dispatcher'].includes(profile?.role || '');

  const [jobs, setJobs] = useState<ActiveLoad[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign flow state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      setLoadingJobs(true);
      const { data, error: err } = await supabase
        .from('loads')
        .select('id, status, load_type, load_value, currency, created_at, dispatched_at, customer:customers(name, city), driver:drivers(full_name)')
        .eq('tenant_id', profile.tenant_id)
        .in('status', JOB_STATUSES)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setJobs((data as ActiveLoad[]) || []);
    } catch (err: any) {
      handleError(err, 'Dispatch:fetchJobs');
      setError(err.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [profile?.tenant_id]);

  const fetchDrivers = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      setLoadingDrivers(true);
      const { data } = await driverService.getTenantDrivers(profile.tenant_id, { page: 0, pageSize: 100 });
      setDrivers(data);
    } catch (err: any) {
      handleError(err, 'Dispatch:fetchDrivers');
    } finally {
      setLoadingDrivers(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchJobs();
    fetchDrivers();

    const loadsSub = supabase
      .channel('dispatch-loads')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'loads',
        filter: `tenant_id=eq.${profile.tenant_id}`,
      }, () => fetchJobs())
      .subscribe();

    const driversSub = supabase
      .channel('dispatch-drivers')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'drivers',
        filter: `tenant_id=eq.${profile.tenant_id}`,
      }, () => fetchDrivers())
      .subscribe();

    return () => {
      loadsSub.unsubscribe();
      driversSub.unsubscribe();
    };
  }, [appReady, profile?.tenant_id, fetchJobs, fetchDrivers]);

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedJobId) return;
    setIsAssigning(true);
    const toastId = toast.loading('Assigning driver…');
    try {
      const { error: err } = await supabase
        .from('loads')
        .update({
          driver_id: driverId,
          status: 'assigned',
          dispatched_at: new Date().toISOString(),
        })
        .eq('id', selectedJobId);

      if (err) throw err;

      toast.success('Driver assigned', { id: toastId });
      setSelectedJobId(null);
      fetchJobs();
      fetchDrivers();
    } catch (err: any) {
      handleError(err, 'Dispatch:assignDriver');
      toast.error(err.message || 'Failed to assign driver', { id: toastId });
    } finally {
      setIsAssigning(false);
    }
  };

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const scheduledCount = jobs.filter(j => j.status === 'scheduled').length;
  const assignedCount = jobs.filter(j => j.status === 'assigned').length;
  const inProgressCount = jobs.filter(j => ['en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(j.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-gray-500 mt-0.5">Real-time job assignment and fleet tracking.</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{scheduledCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Unassigned</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-indigo-600">{assignedCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Assigned</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-purple-600">{inProgressCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">In Progress</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md flex">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="ml-3 text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main layout: Jobs | Fleet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Jobs list — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active Jobs</h2>
            <span className="text-xs text-gray-400">{jobs.length} total</span>
          </div>

          <div className="overflow-x-auto">
            {loadingJobs && jobs.length === 0 ? (
              <div className="p-6"><TableSkeleton cols={4} rows={6} /></div>
            ) : jobs.length === 0 ? (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center max-w-xs mx-auto">
                  <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                    <Truck className="h-7 w-7 text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">No active jobs</h3>
                  <p className="text-xs text-gray-500">All jobs are completed or cancelled.</p>
                </div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    {canAssign && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map(job => (
                    <tr
                      key={job.id}
                      className={cn(
                        "transition-colors",
                        selectedJobId === job.id ? "bg-blue-50" : "hover:bg-gray-50"
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{job.customer?.name ?? '—'}</div>
                        <div className="text-xs text-gray-400">{job.customer?.city ?? ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', statusColors[job.status])}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.driver ? (
                          <div className="flex items-center text-sm text-gray-700">
                            <Truck className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                            {job.driver.full_name}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {job.load_value ? formatCurrency(job.load_value, job.currency ?? undefined) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {format(new Date(job.created_at), 'MMM d, HH:mm')}
                      </td>
                      {canAssign && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all",
                              selectedJobId === job.id
                                ? "bg-blue-600 text-white"
                                : "text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                            )}
                          >
                            <Truck className="h-3 w-3" />
                            {selectedJobId === job.id ? 'Selected' : 'Assign'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Fleet panel — 1/3 width */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Fleet Status</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {availableDrivers.length} of {drivers.length} available
            </p>
          </div>

          {/* Assign prompt */}
          {canAssign && selectedJobId && (
            <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Select an available driver below to assign the job.
              <button onClick={() => setSelectedJobId(null)} className="ml-auto text-blue-400 hover:text-blue-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
            {loadingDrivers && drivers.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-10 text-center">
                <UserSquare2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No drivers registered.</p>
              </div>
            ) : (
              drivers.map(driver => {
                const isAvailable = driver.status === 'available';
                const canSelect = canAssign && selectedJobId && isAvailable && !isAssigning;

                return (
                  <button
                    key={driver.id}
                    onClick={() => canSelect && handleAssignDriver(driver.id)}
                    disabled={!canSelect}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                      canSelect
                        ? "border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                        : "border-gray-100 bg-gray-50 cursor-default"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        isAvailable ? "bg-green-100" : "bg-gray-100"
                      )}>
                        {driver.driver_picture_url ? (
                          <img src={driver.driver_picture_url} alt={driver.full_name}
                            className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserSquare2 className={cn("h-4 w-4", isAvailable ? "text-green-600" : "text-gray-400")} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{driver.full_name}</div>
                        <span className={cn('text-xs font-medium capitalize px-1.5 py-0.5 rounded-full', driverStatusColors[driver.status])}>
                          {driver.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {canSelect && (
                      <ChevronRight className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
