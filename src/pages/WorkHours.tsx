import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Clock, Download, AlertCircle, Coffee, ChevronDown, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { canViewWorkHoursReport } from '../lib/rbac';
import { AccessDenied } from '../components/ui/AccessDenied';
import {
  workSessionService,
  sessionWorkedMinutes,
  formatMinutes,
} from '../services/workSession.service';
import type { WorkSessionWithDriver } from '../services/workSession.service';
import { cn } from '../lib/utils';

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface DriverSummary {
  driverId: string;
  driverName: string;
  sessions: WorkSessionWithDriver[];
  totalWorked: number;
  totalBreak: number;
}

export function WorkHours() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  const [dateFrom, setDateFrom] = useState(() =>
    isoDate(startOfWeek(new Date(), { weekStartsOn: 0 })),
  );
  const [dateTo, setDateTo] = useState(() =>
    isoDate(endOfWeek(new Date(), { weekStartsOn: 0 })),
  );
  const [sessions, setSessions] = useState<WorkSessionWithDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await workSessionService.fetchWorkHoursReport(
        profile.tenant_id,
        `${dateFrom}T00:00:00.000Z`,
        `${dateTo}T23:59:59.999Z`,
      );
      setSessions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, dateFrom, dateTo]);

  useEffect(() => {
    if (appReady && profile?.tenant_id) load();
  }, [appReady, load, profile?.tenant_id]);

  const driverSummaries = useMemo((): DriverSummary[] => {
    const map = new Map<string, DriverSummary>();
    for (const s of sessions) {
      const id   = s.driver_id;
      const name = s.driver?.full_name ?? 'Unknown Driver';
      if (!map.has(id)) {
        map.set(id, { driverId: id, driverName: name, sessions: [], totalWorked: 0, totalBreak: 0 });
      }
      const entry = map.get(id)!;
      entry.sessions.push(s);
      entry.totalWorked += sessionWorkedMinutes(s);
      entry.totalBreak  += s.total_break_minutes;
    }
    return [...map.values()].sort((a, b) => b.totalWorked - a.totalWorked);
  }, [sessions]);

  const toggleDriver = (id: string) => {
    setExpandedDrivers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const grandTotalWorked = driverSummaries.reduce((a, d) => a + d.totalWorked, 0);
  const grandTotalBreak  = driverSummaries.reduce((a, d) => a + d.totalBreak,  0);

  if (appReady && !canViewWorkHoursReport(role)) return <AccessDenied />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Work Hours Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Driver clock-in / clock-out sessions</p>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI strip */}
      {!loading && driverSummaries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Drivers', value: String(driverSummaries.length) },
            { label: 'Sessions', value: String(sessions.length) },
            { label: 'Total Worked', value: formatMinutes(grandTotalWorked) },
            { label: 'Total Breaks', value: formatMinutes(grandTotalBreak) },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : driverSummaries.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="h-8 w-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No sessions recorded in this date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider text-right">Sessions</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider text-right">Breaks</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 uppercase tracking-wider text-right">Net Worked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {driverSummaries.map((d) => {
                  const expanded = expandedDrivers.has(d.driverId);
                  return (
                    <React.Fragment key={d.driverId}>
                      {/* Summary row */}
                      <tr
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleDriver(d.driverId)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {expanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                              : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                            <span className="font-medium text-gray-900">{d.driverName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{d.sessions.length}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-1 text-amber-600">
                            <Coffee className="h-3 w-3" />
                            {formatMinutes(d.totalBreak)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatMinutes(d.totalWorked)}
                        </td>
                      </tr>

                      {/* Expanded session rows */}
                      {expanded && d.sessions.map((s) => (
                        <tr key={s.id} className="bg-gray-50/70">
                          <td className="pl-10 pr-4 py-2 text-gray-500 text-xs">
                            {format(parseISO(s.clocked_in_at), 'EEE, MMM d · h:mm a')}
                            {' — '}
                            {s.clocked_out_at
                              ? format(parseISO(s.clocked_out_at), 'h:mm a')
                              : <span className="text-green-600 font-medium">ongoing</span>}
                          </td>
                          <td className="px-4 py-2 text-right" />
                          <td className="px-4 py-2 text-right text-xs text-amber-600">
                            {s.total_break_minutes > 0 ? formatMinutes(s.total_break_minutes) : '—'}
                          </td>
                          <td className={cn(
                            'px-4 py-2 text-right text-xs font-medium',
                            s.clocked_out_at ? 'text-gray-700' : 'text-green-600',
                          )}>
                            {formatMinutes(sessionWorkedMinutes(s))}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export hint */}
      {!loading && driverSummaries.length > 0 && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          CSV export coming in a future release.
        </p>
      )}
    </div>
  );
}
