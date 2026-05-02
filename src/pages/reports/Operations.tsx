import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Cell, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  BarChart2, AlertCircle, Download, RefreshCw, ChevronLeft, Clock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { canViewReports } from '../../lib/rbac';
import { AccessDenied } from '../../components/ui/AccessDenied';
import { DateRangeFilter, defaultDateRange } from '../../components/ui/DateRangeFilter';
import type { DateRange } from '../../components/ui/DateRangeFilter';
import { reportService } from '../../services/report.service';
import type { OperationsData, ReportLoad } from '../../services/report.service';
import { exportToCsv } from '../../lib/csvExport';
import { cn } from '../../lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bar: string }> = {
  scheduled:         { label: 'Scheduled',        color: 'bg-blue-100 text-blue-800',    bar: '#3B82F6' },
  assigned:          { label: 'Assigned',          color: 'bg-indigo-100 text-indigo-800', bar: '#6366F1' },
  en_route:          { label: 'En Route',          color: 'bg-purple-100 text-purple-800', bar: '#8B5CF6' },
  on_site:           { label: 'On Site',           color: 'bg-yellow-100 text-yellow-800', bar: '#F59E0B' },
  service_done:      { label: 'Service Done',      color: 'bg-orange-100 text-orange-800', bar: '#F97316' },
  dumpyard_required: { label: 'Dumpyard Req.',     color: 'bg-red-100 text-red-800',      bar: '#EF4444' },
  completed:         { label: 'Completed',         color: 'bg-emerald-100 text-emerald-800', bar: '#10B981' },
  cancelled:         { label: 'Cancelled',         color: 'bg-gray-100 text-gray-600',    bar: '#9CA3AF' },
};

const TYPE_COLORS: Record<string, string> = {
  'New Deployment': '#3B82F6',
  'Pickup':         '#10B981',
  'Exchange':       '#F59E0B',
};

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, highlight,
}: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border shadow-sm px-4 py-3',
      highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200',
    )}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={cn('text-2xl font-bold', highlight ? 'text-blue-700' : 'text-gray-900')}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Export helper ─────────────────────────────────────────────────────────────
function buildExportRows(loads: ReportLoad[]) {
  return loads.map((l) => ({
    ID:          shortId(l.id),
    Type:        l.load_type,
    Status:      l.status,
    Customer:    l.customer?.name ?? '',
    Driver:      l.driver?.full_name ?? '',
    Site:        l.site?.site_name ?? '',
    'Created At':   l.created_at,
    'Dispatched At': l.dispatched_at ?? '',
    'Completed At':  l.completed_at  ?? '',
    'Cancelled At':  l.cancelled_at  ?? '',
    'Value':         l.load_value    ?? '',
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Operations() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  const [range, setRange]     = useState<DateRange>(defaultDateRange);
  const [data, setData]       = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reportService.fetchOperationsData(
        profile.tenant_id, range.from, range.to,
      );
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load operations data');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, range]);

  useEffect(() => {
    if (appReady && profile?.tenant_id) load();
  }, [appReady, load, profile?.tenant_id]);

  if (appReady && !canViewReports(role)) return <AccessDenied />;

  // Build chart data
  const statusChartData = (data?.statusCounts ?? []).map((s) => ({
    label: STATUS_META[s.status]?.label ?? s.status,
    count: s.count,
    color: STATUS_META[s.status]?.bar ?? '#6B7280',
  }));

  const typeChartData = (data?.typeCounts ?? []).map((t) => ({
    label: t.load_type,
    count: t.count,
    color: TYPE_COLORS[t.load_type] ?? '#6B7280',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link to="/reports" className="hover:text-blue-600 transition-colors">Reports</Link>
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            Operations Report
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => data && exportToCsv(`operations-${range.from}-${range.to}`, buildExportRows(data.loads))}
            disabled={!data || data.loads.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard label="Total Loads"    value={String(data.totalLoads)}     highlight />
            <KpiCard label="Completed"      value={String(data.completedLoads)} />
            <KpiCard
              label="Cancelled"
              value={String(data.cancelledLoads)}
              sub={data.totalLoads > 0
                ? `${((data.cancelledLoads / data.totalLoads) * 100).toFixed(1)}%`
                : undefined}
            />
            <KpiCard label="Active"         value={String(data.activeLoads)} />
            <KpiCard
              label="Avg Completion"
              value={data.avgCompletionHours != null ? fmtHours(data.avgCompletionHours) : '—'}
              sub="dispatch → complete"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Daily trend (takes 2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Daily Load Volume
                <span className="ml-2 text-xs font-normal text-gray-400">(UTC days)</span>
              </p>
              {data.dailyTrend.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) => format(parseISO(d), 'MMM d')}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(d: string) => format(parseISO(d), 'MMM d, yyyy')}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone" dataKey="total" name="Total"
                      stroke="#3B82F6" strokeWidth={2} dot={false}
                    />
                    <Line
                      type="monotone" dataKey="completed" name="Completed"
                      stroke="#10B981" strokeWidth={2} dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Load type breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Load Types</p>
              {typeChartData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeChartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {typeChartData.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Status breakdown chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Load Status Breakdown</p>
            {statusChartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={statusChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 80, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Delayed loads table */}
          {data.delayedLoads.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Delayed Loads
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (active, no update in &gt; 4 h)
                  </span>
                </h2>
                <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  {data.delayedLoads.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Idle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.delayedLoads.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{shortId(l.id)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{l.load_type}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{l.customer?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{l.driver?.full_name ?? 'Unassigned'}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium text-amber-700">
                          {formatDistanceToNowStrict(new Date(l.updated_at))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.totalLoads === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
              <BarChart2 className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No loads found in this date range.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', meta?.color ?? 'bg-gray-100 text-gray-600')}>
      {meta?.label ?? status}
    </span>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center">
      <p className="text-xs text-gray-400">No data for this range.</p>
    </div>
  );
}
