import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Download, RefreshCw, ChevronLeft, AlertCircle,
  XCircle, Clock, UserX, Package, DollarSign, Ban,
} from 'lucide-react';
import { formatDistanceToNowStrict, format, parseISO } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { canViewReports } from '../../lib/rbac';
import { AccessDenied } from '../../components/ui/AccessDenied';
import { DateRangeFilter, defaultDateRange } from '../../components/ui/DateRangeFilter';
import type { DateRange } from '../../components/ui/DateRangeFilter';
import { reportService } from '../../services/report.service';
import type {
  ExceptionLoad, ExceptionData, ExceptionType, ExceptionSeverity,
} from '../../services/report.service';
import { exportToCsv } from '../../lib/csvExport';
import { cn } from '../../lib/utils';

// ── Metadata ──────────────────────────────────────────────────────────────────
interface ExTypeMeta {
  label:   string;
  icon:    React.FC<{ className?: string }>;
  badge:   string; // Tailwind classes for the count badge
  rowBg:   string; // row highlight
}

const EXCEPTION_META: Record<ExceptionType, ExTypeMeta> = {
  dumpyard_required: {
    label:  'Dumpyard Required',
    icon:   XCircle,
    badge:  'bg-red-100 text-red-700 border-red-200',
    rowBg:  'bg-red-50/50',
  },
  missing_driver: {
    label:  'No Driver Assigned',
    icon:   UserX,
    badge:  'bg-red-100 text-red-700 border-red-200',
    rowBg:  'bg-red-50/50',
  },
  delayed: {
    label:  'Delayed (> 4 h)',
    icon:   Clock,
    badge:  'bg-amber-100 text-amber-700 border-amber-200',
    rowBg:  'bg-amber-50/40',
  },
  missing_dumpster: {
    label:  'No Dumpster',
    icon:   Package,
    badge:  'bg-amber-100 text-amber-700 border-amber-200',
    rowBg:  'bg-amber-50/40',
  },
  cancelled: {
    label:  'Cancelled',
    icon:   Ban,
    badge:  'bg-gray-100 text-gray-600 border-gray-200',
    rowBg:  '',
  },
  missing_value: {
    label:  'Missing Value',
    icon:   DollarSign,
    badge:  'bg-blue-100 text-blue-700 border-blue-200',
    rowBg:  'bg-blue-50/30',
  },
};

const SEVERITY_BADGE: Record<ExceptionSeverity, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  warning:  'bg-amber-100 text-amber-700 border border-amber-200',
  info:     'bg-blue-100 text-blue-700 border border-blue-200',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled:         'bg-blue-100 text-blue-800',
  assigned:          'bg-indigo-100 text-indigo-800',
  en_route:          'bg-purple-100 text-purple-800',
  on_site:           'bg-yellow-100 text-yellow-800',
  service_done:      'bg-orange-100 text-orange-800',
  dumpyard_required: 'bg-red-100 text-red-800',
  completed:         'bg-emerald-100 text-emerald-800',
  cancelled:         'bg-gray-100 text-gray-600',
};

type TabKey = 'all' | ExceptionType;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',              label: 'All' },
  { key: 'dumpyard_required', label: 'Dumpyard' },
  { key: 'missing_driver',   label: 'No Driver' },
  { key: 'delayed',          label: 'Delayed' },
  { key: 'missing_dumpster', label: 'No Dumpster' },
  { key: 'cancelled',        label: 'Cancelled' },
  { key: 'missing_value',    label: 'No Value' },
];

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

function buildCsvRows(exceptions: ExceptionLoad[]) {
  return exceptions.map((ex) => ({
    ID:               shortId(ex.id),
    'Exception Type': EXCEPTION_META[ex.exceptionType]?.label ?? ex.exceptionType,
    Severity:         ex.severity,
    'Load Type':      ex.load_type,
    Status:           ex.status,
    Customer:         ex.customer?.name   ?? '',
    Driver:           ex.driver?.full_name ?? 'Unassigned',
    Site:             ex.site?.site_name  ?? '',
    'Age (h)':        ex.ageHours.toFixed(1),
    'Created At':     ex.created_at,
    'Updated At':     ex.updated_at,
    'Cancelled At':   ex.cancelled_at ?? '',
    'Completed At':   ex.completed_at ?? '',
    'Load Value':     ex.load_value ?? '',
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Exceptions() {
  const { profile, appReady } = useAuth();
  const role = profile?.role ?? null;

  const [range, setRange]       = useState<DateRange>(defaultDateRange);
  const [data, setData]         = useState<ExceptionData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [activeTab, setTab]     = useState<TabKey>('all');

  const load = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reportService.fetchExceptionData(
        profile.tenant_id, range.from, range.to,
      );
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load exception data');
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, range]);

  useEffect(() => {
    if (appReady && profile?.tenant_id) load();
  }, [appReady, load, profile?.tenant_id]);

  const visibleExceptions = useMemo(() => {
    if (!data) return [];
    return activeTab === 'all'
      ? data.exceptions
      : data.exceptions.filter((ex) => ex.exceptionType === activeTab);
  }, [data, activeTab]);

  if (appReady && !canViewReports(role)) return <AccessDenied />;

  const totalExceptions = data?.exceptions.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link to="/reports" className="hover:text-blue-600 transition-colors">
              Reports
            </Link>
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Exception Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cancelled loads, stuck jobs, missing assignments, and incomplete data.
          </p>
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
            onClick={() =>
              data &&
              exportToCsv(
                `exceptions-${range.from}-${range.to}`,
                buildCsvRows(visibleExceptions),
              )
            }
            disabled={!data || visibleExceptions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary badge cards */}
      {loading && !data ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.entries(EXCEPTION_META) as [ExceptionType, ExTypeMeta][]).map(
            ([type, meta]) => {
              const Icon  = meta.icon;
              const count = data.counts[type] ?? 0;
              return (
                <button
                  key={type}
                  onClick={() => setTab(activeTab === type ? 'all' : type)}
                  className={cn(
                    'text-left rounded-xl border shadow-sm px-3 py-3 transition-all',
                    activeTab === type
                      ? 'ring-2 ring-blue-500 ring-offset-1 bg-white border-blue-200'
                      : 'bg-white border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        count > 0 ? 'text-red-400' : 'text-gray-300',
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        count > 0
                          ? (meta.badge.includes('red')
                              ? 'text-red-600'
                              : meta.badge.includes('amber')
                              ? 'text-amber-600'
                              : meta.badge.includes('blue')
                              ? 'text-blue-600'
                              : 'text-gray-500')
                          : 'text-gray-300',
                      )}
                    >
                      {count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-tight">{meta.label}</p>
                </button>
              );
            },
          )}
        </div>
      ) : null}

      {/* Tab strip */}
      {data && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? totalExceptions
                : (data.counts[tab.key as ExceptionType] ?? 0);
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'text-xs font-bold rounded-full px-1.5',
                      activeTab === tab.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Exception table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="py-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : !data || visibleExceptions.length === 0 ? (
          <div className="py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {!data
                ? 'Loading…'
                : activeTab === 'all'
                ? 'No exceptions found for this date range.'
                : `No "${EXCEPTION_META[activeTab as ExceptionType]?.label ?? activeTab}" exceptions.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Exception
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleExceptions.map((ex) => {
                  const meta = EXCEPTION_META[ex.exceptionType];
                  const Icon = meta?.icon ?? AlertTriangle;
                  return (
                    <tr
                      key={`${ex.id}-${ex.exceptionType}`}
                      className={cn('hover:bg-gray-50 transition-colors', meta?.rowBg ?? '')}
                    >
                      {/* Severity */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                            SEVERITY_BADGE[ex.severity],
                          )}
                        >
                          {ex.severity}
                        </span>
                      </td>

                      {/* Exception type */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <Icon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {meta?.label ?? ex.exceptionType}
                        </span>
                      </td>

                      {/* Load ID */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {shortId(ex.id)}
                      </td>

                      {/* Load type */}
                      <td className="px-4 py-3 text-xs text-gray-700">{ex.load_type}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            STATUS_COLORS[ex.status] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {ex.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-[120px] truncate">
                        {ex.customer?.name ?? '—'}
                      </td>

                      {/* Driver */}
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {ex.driver?.full_name ?? (
                          <span className="text-red-500 font-medium">Unassigned</span>
                        )}
                      </td>

                      {/* Age */}
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                        {ex.exceptionType === 'cancelled' && ex.cancelled_at
                          ? formatDistanceToNowStrict(parseISO(ex.cancelled_at))
                          : ex.exceptionType === 'missing_value' && ex.completed_at
                          ? formatDistanceToNowStrict(parseISO(ex.completed_at))
                          : formatDistanceToNowStrict(parseISO(ex.updated_at))}
                        {' ago'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row count footer */}
      {data && visibleExceptions.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {visibleExceptions.length} exception{visibleExceptions.length !== 1 ? 's' : ''} shown
        </p>
      )}
    </div>
  );
}
