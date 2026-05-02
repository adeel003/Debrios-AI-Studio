import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, AlertCircle, X, Play, CheckSquare,
  XSquare, Truck, UserSquare2, RefreshCw, Loader2, Radio,
  Search, Clock, ChevronRight, ArrowRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { canManageDispatch } from '../lib/rbac';
import { AccessDenied } from '../components/ui/AccessDenied';
import { dispatchService } from '../services/dispatch.service';
import { driverService } from '../services/driver.service';
import type { DispatchLoad, DumpsterRow, LoadEvent } from '../services/dispatch.service';
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
  dumpyard_required: 'bg-red-100 text-red-800',
};

const DRIVER_STATUS_COLORS: Record<string, string> = {
  available: 'text-green-600',
  busy: 'text-amber-600',
  off_duty: 'text-gray-400',
};

const COMPLETABLE = new Set(['assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required']);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function Dispatch() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  // ── Core data state (unchanged) ────────────────────────────────────────────
  const [loads, setLoads] = useState<DispatchLoad[]>([]);
  const [dumpsters, setDumpsters] = useState<DumpsterRow[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [dispatchingLoadId, setDispatchingLoadId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // ── New: search / filter ───────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── New: timeline drawer ───────────────────────────────────────────────────
  const [timelineLoadId, setTimelineLoadId] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<LoadEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // loads.dumpster_id has no FK — enrich client-side via Map.
  const dumpsterMap = useMemo(
    () => new Map(dumpsters.map((d) => [d.id, d])),
    [dumpsters],
  );

  // ── Data fetch (unchanged) ─────────────────────────────────────────────────
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

  // NOTE: Frontend RBAC guard — UX layer only. RPCs enforce isolation server-side.
  if (appReady && !canManageDispatch(role)) return <AccessDenied />;

  // ── Action helpers (unchanged) ─────────────────────────────────────────────
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

  // ── New: timeline helpers ──────────────────────────────────────────────────
  const openTimeline = async (loadId: string) => {
    if (!profile?.tenant_id) return;
    setTimelineLoadId(loadId);
    setTimelineEvents([]);
    setTimelineLoading(true);
    try {
      const events = await dispatchService.fetchLoadTimeline(profile.tenant_id, loadId);
      setTimelineEvents(events);
    } catch {
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const closeTimeline = () => {
    setTimelineLoadId(null);
    setTimelineEvents([]);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const filteredLoads = useMemo(() => {
    let result = loads;
    if (statusFilter !== 'all') result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.customer?.name?.toLowerCase().includes(q) ||
          l.driver?.full_name?.toLowerCase().includes(q) ||
          l.site?.site_name?.toLowerCase().includes(q) ||
          shortId(l.id).toLowerCase().includes(q),
      );
    }
    return result;
  }, [loads, search, statusFilter]);

  // Issues: dumpyard_required + scheduled loads unassigned for > 2 hours.
  const issues = useMemo(
    () =>
      loads.filter(
        (l) =>
          l.status === 'dumpyard_required' ||
          (l.status === 'scheduled' &&
            Date.now() - new Date(l.created_at).getTime() > TWO_HOURS_MS),
      ),
    [loads],
  );

  // Driver workload: group active loads by driver_id, sorted by load count desc.
  const driverWorkload = useMemo(() => {
    const byDriver = new Map<string, { driver: Driver; activeLoads: DispatchLoad[] }>();
    for (const driver of drivers) byDriver.set(driver.id, { driver, activeLoads: [] });
    for (const load of loads) {
      if (load.driver_id && byDriver.has(load.driver_id)) {
        byDriver.get(load.driver_id)!.activeLoads.push(load);
      }
    }
    return [...byDriver.values()].sort((a, b) => b.activeLoads.length - a.activeLoads.length);
  }, [drivers, loads]);

  // Dumpster stats: a dumpster is "deployed" if referenced by an active load.
  const assignedDumpsterIds = useMemo(
    () => new Set(loads.filter((l) => l.dumpster_id).map((l) => l.dumpster_id!)),
    [loads],
  );
  const dumpsterStats = useMemo(() => {
    const deployed = dumpsters.filter((d) => assignedDumpsterIds.has(d.id)).length;
    return { deployed, idle: dumpsters.length - deployed, total: dumpsters.length };
  }, [dumpsters, assignedDumpsterIds]);

  const availableDrivers = drivers.filter((d) => d.status === 'available');
  const dispatchingLoad = dispatchingLoadId
    ? (loads.find((l) => l.id === dispatchingLoadId) ?? null)
    : null;
  const timelineLoad = timelineLoadId
    ? (loads.find((l) => l.id === timelineLoadId) ?? null)
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-gray-500 mt-0.5 text-sm">Manage active loads and driver assignments.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI strip — 2-col mobile, 5-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
        {/* Spans both mobile columns so it centers on the last row */}
        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{availableDrivers.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Avail. Drivers</div>
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

      {/* Issues / Exceptions panel — only rendered when there are issues */}
      {issues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-red-900">
              {issues.length} issue{issues.length !== 1 ? 's' : ''} need attention
            </h3>
          </div>
          <div className="space-y-2">
            {issues.map((load) => (
              <div
                key={load.id}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                      STATUS_COLORS[load.status] ?? 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {STATUS_LABELS[load.status] ?? load.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {load.customer?.name ?? '—'}
                  </span>
                  {load.status === 'scheduled' && (
                    <span className="text-xs text-red-500 hidden sm:block flex-shrink-0">
                      Unassigned {formatDistanceToNow(new Date(load.created_at))}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openTimeline(load.id)}
                  className="ml-3 flex-shrink-0 text-xs text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
                >
                  History <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid: loads table (2/3) + sidebar (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Loads table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 whitespace-nowrap">Active Loads</h2>
              <span className="text-xs text-gray-400">
                {filteredLoads.length !== loads.length
                  ? `${filteredLoads.length} of ${loads.length}`
                  : `${loads.length} load${loads.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Customer, driver, load…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
              >
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredLoads.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center max-w-xs mx-auto">
                <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <ClipboardList className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">
                  {loads.length > 0 ? 'No matching loads' : 'No active loads'}
                </h3>
                <p className="text-sm text-gray-500">
                  {loads.length > 0
                    ? 'Try adjusting your search or filter.'
                    : 'All loads are completed or cancelled.'}
                </p>
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
                  {filteredLoads.map((load) => {
                    const rowBusy = actionLoading.has(load.id);
                    const dumpster = load.dumpster_id ? dumpsterMap.get(load.dumpster_id) : undefined;
                    return (
                      <tr
                        key={load.id}
                        onClick={() => openTimeline(load.id)}
                        className={cn(
                          'transition-colors cursor-pointer',
                          rowBusy
                            ? 'opacity-50 pointer-events-none'
                            : timelineLoadId === load.id
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50',
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
                        {/* stopPropagation so action buttons don't also open the timeline */}
                        <td
                          className="px-4 py-4 whitespace-nowrap text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rowBusy ? (
                            <div className="flex items-center justify-end">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {(load.status === 'scheduled' || load.status === 'assigned') && (
                                <button
                                  onClick={() => setDispatchingLoadId(load.id)}
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all"
                                >
                                  <Truck className="h-3 w-3" />
                                  {load.status === 'assigned' ? 'Re-dispatch' : 'Dispatch'}
                                </button>
                              )}
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

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Driver Workload Panel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Driver Workload</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {availableDrivers.length} of {drivers.length} available
              </p>
            </div>
            {drivers.length === 0 ? (
              <div className="py-10 text-center">
                <UserSquare2 className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No drivers registered.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {driverWorkload.map(({ driver, activeLoads }) => (
                  <div key={driver.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
                        driver.status === 'available'
                          ? 'bg-green-100'
                          : driver.status === 'busy'
                          ? 'bg-amber-100'
                          : 'bg-gray-100',
                      )}
                    >
                      {driver.driver_picture_url ? (
                        <img
                          src={driver.driver_picture_url}
                          alt={driver.full_name}
                          className="h-7 w-7 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <UserSquare2
                          className={cn(
                            'h-4 w-4',
                            DRIVER_STATUS_COLORS[driver.status] ?? 'text-gray-400',
                          )}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{driver.full_name}</p>
                      <p
                        className={cn(
                          'text-xs font-medium capitalize',
                          DRIVER_STATUS_COLORS[driver.status] ?? 'text-gray-400',
                        )}
                      >
                        {driver.status.replace('_', ' ')}
                      </p>
                    </div>
                    {activeLoads.length > 0 && (
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 flex-shrink-0">
                        {activeLoads.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dumpster Visibility Panel — hidden when no dumpsters registered */}
          {dumpsters.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Dumpsters</h2>
                <span className="text-xs text-gray-400">{dumpsterStats.total} total</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">Deployed</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{dumpsterStats.deployed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">Idle / Available</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{dumpsterStats.idle}</span>
                </div>
                <div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: dumpsterStats.total > 0
                          ? `${(dumpsterStats.deployed / dumpsterStats.total) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {dumpsterStats.total > 0
                      ? `${Math.round((dumpsterStats.deployed / dumpsterStats.total) * 100)}% deployed`
                      : 'No dumpsters'}
                  </p>
                </div>
                {/* List of currently deployed dumpsters */}
                {dumpsterStats.deployed > 0 && (
                  <div className="pt-1 border-t border-gray-50 space-y-1.5 max-h-36 overflow-y-auto">
                    {dumpsters
                      .filter((d) => assignedDumpsterIds.has(d.id))
                      .map((d) => {
                        const activeLoad = loads.find((l) => l.dumpster_id === d.id);
                        return (
                          <div key={d.id} className="flex items-center text-xs gap-2">
                            <span className="font-mono text-gray-700 flex-shrink-0">{d.asset_number}</span>
                            <span className="text-gray-400 truncate flex-1">
                              {activeLoad?.customer?.name ?? ''}
                            </span>
                            <span className="text-gray-400 flex-shrink-0">{d.size}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Load Timeline Drawer */}
      {timelineLoadId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeTimeline} />
          <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full">
            {/* Drawer header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Load #{shortId(timelineLoadId)}
                </h2>
                {timelineLoad && (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[timelineLoad.status] ?? 'bg-gray-100 text-gray-700',
                      )}
                    >
                      {STATUS_LABELS[timelineLoad.status] ?? timelineLoad.status}
                    </span>
                    <span className="text-xs text-gray-500">{timelineLoad.customer?.name ?? '—'}</span>
                  </div>
                )}
              </div>
              <button
                onClick={closeTimeline}
                className="text-gray-400 hover:text-gray-600 p-1 -mr-1 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            {/* Load detail summary */}
            {timelineLoad && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <p className="text-gray-400">Type</p>
                  <p className="text-gray-900 font-medium">{timelineLoad.load_type}</p>
                </div>
                <div>
                  <p className="text-gray-400">Driver</p>
                  <p className="text-gray-900 font-medium">{timelineLoad.driver?.full_name ?? '—'}</p>
                </div>
                {timelineLoad.site && (
                  <div className="col-span-2">
                    <p className="text-gray-400">Site</p>
                    <p className="text-gray-900 font-medium">{timelineLoad.site.site_name}</p>
                    <p className="text-gray-500">{timelineLoad.site.address}</p>
                  </div>
                )}
                {timelineLoad.notes && (
                  <div className="col-span-2">
                    <p className="text-gray-400">Notes</p>
                    <p className="text-gray-700">{timelineLoad.notes}</p>
                  </div>
                )}
              </div>
            )}
            {/* Timeline events */}
            <div className="flex-1 overflow-y-auto p-4">
              {timelineLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No events recorded yet.</p>
                </div>
              ) : (
                <div>
                  {timelineEvents.map((event, idx) => (
                    <div key={event.id} className="flex gap-3">
                      {/* Spine */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="h-2.5 w-2.5 rounded-full mt-1.5 bg-blue-400 ring-2 ring-white flex-shrink-0" />
                        {idx < timelineEvents.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={cn('pb-4 min-w-0', idx === timelineEvents.length - 1 && 'pb-2')}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {event.from_status && (
                            <>
                              <span className="text-xs text-gray-400">
                                {STATUS_LABELS[event.from_status] ?? event.from_status}
                              </span>
                              <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                            </>
                          )}
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              STATUS_COLORS[event.to_status] ?? 'bg-gray-100 text-gray-700',
                            )}
                          >
                            {STATUS_LABELS[event.to_status] ?? event.to_status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {format(new Date(event.created_at), 'MMM d, HH:mm')}
                          {event.actor_name && <span> · {event.actor_name}</span>}
                        </p>
                        {event.notes && (
                          <p className="text-xs text-gray-600 mt-1 italic bg-gray-50 rounded px-2 py-1">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Driver picker modal (unchanged) */}
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
                <p className="text-xs text-gray-400 mt-1">All drivers are on a job or offline.</p>
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
