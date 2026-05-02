import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, AlertCircle, X, Play, CheckSquare,
  XSquare, Truck, UserSquare2, RefreshCw, Loader2, Radio,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { canManageDispatch } from '../lib/rbac';
import { AccessDenied } from '../components/ui/AccessDenied';
import { dispatchService } from '../services/dispatch.service';
import { driverService } from '../services/driver.service';
import type { DispatchLoad, DumpsterRow } from '../services/dispatch.service';
import type { Driver } from '../types/driver';
import { cn } from '../lib/utils';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  assigned: 'Assigned',
  en_route: 'En Route',
  on_site: 'On Site',
  service_done: 'Service Done',
  dumpyard_required: 'Dumpyard Required',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-purple-100 text-purple-800',
  on_site: 'bg-yellow-100 text-yellow-800',
  service_done: 'bg-orange-100 text-orange-800',
  dumpyard_required: 'bg-cyan-100 text-cyan-800',
};

const COMPLETABLE = new Set(['assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required']);

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function Dispatch() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [dumpsters, setDumpsters] = useState<DumpsterRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Tracks which load IDs have an in-flight RPC so the row dims and buttons hide.
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  // When non-null, the dispatch-driver picker modal is open for this load ID.
  const [dispatchingLoadId, setDispatchingLoadId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // loads.dumpster_id has no FK — enrich client-side using a Map keyed on dumpster id.
  const dumpsterMap = useMemo(
    () => new Map(dumpsters.map((d) => [d.id, d])),
    [dumpsters],
  );

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setError(null);
    try {
      const [boardData, driversData] = await Promise.all([
        dispatchService.fetchDispatchData(profile.tenant_id),
        driverService.getTenantDrivers(profile.tenant_id, { page: 0, pageSize: 200 }),
      ]);
      setLoads(boardData.loads);
      setDumpsters(boardData.dumpsters);
      setCompletedToday(boardData.completedToday);
      setDrivers(driversData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dispatch data');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchData();
  }, [appReady, profile?.tenant_id, fetchData]);

  // NOTE: Frontend RBAC guard. All RPC calls use SECURITY DEFINER functions
  // that enforce tenant isolation server-side — this guard is a UX layer only.
  if (appReady && !canManageDispatch(role)) {
    return <AccessDenied />;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const markRow = (id: string, busy: boolean) => {
    setActionLoading((prev) => {
      const next = new Set(prev);
      busy ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const runAction = async (
    loadId: string,
    action: () => Promise<void>,
    fallbackMsg: string,
  ) => {
    markRow(loadId, true);
    setActionError(null);
    try {
      await action();
      await fetchData();
    } catch (err: any) {
      setActionError(err.message || fallbackMsg);
    } finally {
      markRow(loadId, false);
    }
  };

  const handleDispatch = async (driverId: string) => {
    if (!dispatchingLoadId) return;
    setAssigning(true);
    setActionError(null);
    try {
      await dispatchService.dispatchJob(dispatchingLoadId, driverId);
      setDispatchingLoadId(null);
      await fetchData();
    } catch (err: any) {
      setDispatchingLoadId(null);
      setActionError(err.message || 'Failed to dispatch job');
    } finally {
      setAssigning(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const availableDrivers = drivers.filter((d) => d.status === 'available');
  const dispatchingLoad = dispatchingLoadId
    ? (loads.find((l) => l.id === dispatchingLoadId) ?? null)
    : null;
  const unassignedCount = loads.filter((l) => l.status === 'scheduled').length;
  const assignedCount = loads.filter((l) => l.status === 'assigned').length;
  const inProgressCount = loads.filter((l) =>
    ['en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(l.status),
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-gray-500 mt-0.5">Manage active loads and driver assignments.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{unassignedCount}</div>
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
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-emerald-600">{completedToday}</div>
          <div className="text-xs text-gray-500 mt-0.5">Done Today</div>
        </div>
      </div>

      {/* Error banners */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3 flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">
            <X size={16} />
          </button>
        </div>
      )}
      {actionError && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="ml-3 flex-1">
            <p className="text-sm text-amber-800">{actionError}</p>
          </div>
          <button onClick={() => setActionError(null)} className="text-amber-400 hover:text-amber-600 ml-2">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Loads table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Active Loads</h2>
          <span className="text-xs text-gray-400">{loads.length} load{loads.length !== 1 ? 's' : ''}</span>
        </div>

        {loads.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center max-w-xs mx-auto">
              <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <ClipboardList className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">No active loads</h3>
              <p className="text-sm text-gray-500">All loads are completed or cancelled.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Load #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer / Site</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dumpster</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.map((load) => {
                  const rowBusy = actionLoading.has(load.id);
                  const dumpster = load.dumpster_id ? dumpsterMap.get(load.dumpster_id) : undefined;
                  return (
                    <tr
                      key={load.id}
                      className={cn(
                        'transition-colors',
                        rowBusy ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50',
                      )}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-500">#{shortId(load.id)}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-700">{load.load_type}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            STATUS_COLORS[load.status] ?? 'bg-gray-100 text-gray-700',
                          )}
                        >
                          {STATUS_LABELS[load.status] ?? load.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {load.customer?.name ?? '—'}
                        </div>
                        {load.site && (
                          <div className="text-xs text-gray-400">{load.site.site_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {dumpster ? (
                          <div>
                            <span className="text-sm font-mono text-gray-700">{dumpster.asset_number}</span>
                            <div className="text-xs text-gray-400">{dumpster.size}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {load.driver ? (
                          <div className="flex items-center text-sm text-gray-700">
                            <Truck className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                            {load.driver.full_name}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-400">
                        {format(new Date(load.created_at), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {rowBusy ? (
                          <div className="flex items-center justify-end">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* scheduled|assigned → dispatch (open driver picker) */}
                            {(load.status === 'scheduled' || load.status === 'assigned') && (
                              <button
                                onClick={() => setDispatchingLoadId(load.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all"
                              >
                                <Truck className="h-3 w-3" />
                                {load.status === 'assigned' ? 'Re-dispatch' : 'Dispatch'}
                              </button>
                            )}
                            {/* assigned → start */}
                            {load.status === 'assigned' && (
                              <button
                                onClick={() =>
                                  runAction(load.id, () => dispatchService.startJob(load.id), 'Failed to start job')
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-all"
                              >
                                <Play className="h-3 w-3" />
                                Start
                              </button>
                            )}
                            {/* any active state → complete */}
                            {COMPLETABLE.has(load.status) && (
                              <button
                                onClick={() =>
                                  runAction(load.id, () => dispatchService.completeJob(load.id), 'Failed to complete job')
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                              >
                                <CheckSquare className="h-3 w-3" />
                                Complete
                              </button>
                            )}
                            {/* scheduled|assigned → cancel (before driver is en route) */}
                            {(load.status === 'scheduled' || load.status === 'assigned') && (
                              <button
                                onClick={() =>
                                  runAction(load.id, () => dispatchService.cancelJob(load.id), 'Failed to cancel job')
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all"
                              >
                                <XSquare className="h-3 w-3" />
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Driver picker modal — opens when "Dispatch" is clicked */}
      {dispatchingLoadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Assign Driver</h2>
              <button
                onClick={() => setDispatchingLoadId(null)}
                disabled={assigning}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Load <span className="font-mono font-medium">#{shortId(dispatchingLoadId)}</span> — select an available driver.
            </p>

            {/* Warning shown when the load already has a driver assigned.
                dispatch_job accepts assigned→assigned so this is a real re-assignment. */}
            {dispatchingLoad?.status === 'assigned' && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  This load is already assigned to{' '}
                  <span className="font-medium">
                    {dispatchingLoad.driver?.full_name ?? 'a driver'}
                  </span>
                  . Selecting a new driver will replace the current assignment.
                </p>
              </div>
            )}

            {availableDrivers.length === 0 ? (
              <div className="py-10 text-center">
                <UserSquare2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">No drivers available</p>
                <p className="text-xs text-gray-400 mt-1">
                  All drivers are on a job or offline.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availableDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => handleDispatch(driver.id)}
                    disabled={assigning}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="h-9 w-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {driver.driver_picture_url ? (
                        <img
                          src={driver.driver_picture_url}
                          alt={driver.full_name}
                          className="h-9 w-9 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <UserSquare2 className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</p>
                      <p className="text-xs text-green-600 font-medium">Available</p>
                    </div>
                    {assigning && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setDispatchingLoadId(null)}
                disabled={assigning}
                className="w-full py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
