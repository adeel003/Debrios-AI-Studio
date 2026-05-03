import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BookOpen, AlertCircle, Search, Download,
  TrendingDown, Database as DatabaseIcon, CheckCircle2, Clock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../lib/error-handler';
import { ExportButton } from '../components/ExportButton';
import { dumpsterLedgerService } from '../services/dumpsterLedger.service';
import type { DumpsterLedgerRow, LedgerSummary } from '../services/dumpsterLedger.service';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Available:        'bg-blue-100 text-blue-800',
  Assigned:         'bg-purple-100 text-purple-800',
  'Out of Service': 'bg-gray-100 text-gray-700',
};

const CONDITION_COLORS: Record<string, string> = {
  'Able to Rent':   'bg-green-100 text-green-800',
  'Damaged':        'bg-red-100 text-red-800',
  'Under Maintenance': 'bg-amber-100 text-amber-800',
};

const STATUS_OPTIONS = ['All', 'Available', 'Assigned', 'Out of Service'];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  accent?: 'green' | 'amber' | 'red' | 'blue';
}) {
  const iconClasses = {
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-600',
    blue:  'bg-blue-50 text-blue-600',
  }[accent ?? 'blue'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <div className="flex items-start gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', iconClasses)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DumpsterLedger() {
  const { profile, appReady } = useAuth();

  const [rows, setRows]       = useState<DumpsterLedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('All');
  const [month, setMonth]           = useState(currentMonth);
  const [avgDailyRate, setRate]     = useState<number>(0);

  const load = useCallback(async () => {
    if (!appReady || !profile?.tenant_id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await dumpsterLedgerService.fetchLedger(
        profile.tenant_id,
        month,
        avgDailyRate,
      );
      setRows(result.rows);
      setSummary(result.summary);
    } catch (err: any) {
      handleError(err, 'DumpsterLedger:fetch');
      setError(err.message ?? 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, [appReady, profile?.tenant_id, month, avgDailyRate]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || r.asset_number.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const exportRows = useMemo(
    () =>
      visible.map((r) => ({
        'Asset #':          r.asset_number,
        Size:               r.size,
        Condition:          r.condition,
        Status:             r.status,
        'Total Rentals':    r.totalRentals,
        'Month Rentals':    r.thisMonthRentals,
        'Utilized Days':    r.utilizedDays,
        'Idle Days':        r.idleDays,
        'Est. Idle Loss':   r.estimatedIdleLoss.toFixed(2),
        'Last Rented':      r.lastRentedDate
          ? format(parseISO(r.lastRentedDate), 'yyyy-MM-dd')
          : '',
      })),
    [visible],
  );

  if (loading && rows.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Dumpster Ledger
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Rental activity, utilization, and idle-loss estimates per asset.
          </p>
        </div>
        <ExportButton data={exportRows} filename="dumpster_ledger" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Dumpsters"
            value={String(summary.totalDumpsters)}
            icon={DatabaseIcon}
            accent="blue"
          />
          <SummaryCard
            label="Active (Assigned)"
            value={String(summary.activeDumpsters)}
            sub={summary.totalDumpsters > 0
              ? `${((summary.activeDumpsters / summary.totalDumpsters) * 100).toFixed(0)}% of fleet`
              : undefined}
            icon={CheckCircle2}
            accent="green"
          />
          <SummaryCard
            label="Idle (Available)"
            value={String(summary.idleDumpsters)}
            sub={summary.totalDumpsters > 0
              ? `${((summary.idleDumpsters / summary.totalDumpsters) * 100).toFixed(0)}% of fleet`
              : undefined}
            icon={Clock}
            accent="amber"
          />
          <SummaryCard
            label="Est. Idle Loss"
            value={avgDailyRate > 0 ? formatCurrency(summary.totalIdleLoss) : '—'}
            sub={avgDailyRate > 0 ? `${formatCurrency(avgDailyRate)}/day rate` : 'Set a daily rate below'}
            icon={TrendingDown}
            accent="red"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search asset number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
          ))}
        </select>

        {/* Month */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-400 font-medium px-0.5">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Avg daily rate */}
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-gray-400 font-medium px-0.5">Avg Daily Rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⃁</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={avgDailyRate || ''}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              className="pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-32 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Row count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing <span className="font-medium text-gray-900">{visible.length}</span> of{' '}
          <span className="font-medium text-gray-900">{rows.length}</span> dumpsters
          {statusFilter !== 'All' && ` · ${statusFilter}`}
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-blue-500">
            <div className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            Refreshing…
          </span>
        )}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white p-16 text-center rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center max-w-sm mx-auto">
            <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <DatabaseIcon className="h-8 w-8 text-blue-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No dumpsters found</h3>
            <p className="text-sm text-gray-500">
              {search || statusFilter !== 'All'
                ? 'Try adjusting your search or status filter.'
                : 'Add dumpsters in the Dumpsters Inventory page first.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Asset #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rentals
                  <span className="block normal-case font-normal text-gray-400">total / month</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Utilized
                  <span className="block normal-case font-normal text-gray-400">days</span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Idle
                  <span className="block normal-case font-normal text-gray-400">days</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Est. Loss
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Last Rented
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((row) => (
                <tr key={row.id} className={cn(
                  'hover:bg-gray-50 transition-colors',
                  row.idleDays > 20 && avgDailyRate > 0 ? 'bg-red-50/30' : '',
                )}>
                  <td className="px-4 py-3 font-mono font-bold text-sm text-blue-600">
                    {row.asset_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {row.size}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      CONDITION_COLORS[row.condition] ?? 'bg-gray-100 text-gray-700',
                    )}>
                      {row.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700',
                    )}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="font-semibold text-gray-900">{row.totalRentals}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className={cn(
                      'font-medium',
                      row.thisMonthRentals > 0 ? 'text-emerald-600' : 'text-gray-400',
                    )}>
                      {row.thisMonthRentals}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-sm font-semibold',
                      row.utilizedDays > 0 ? 'text-emerald-700' : 'text-gray-400',
                    )}>
                      {row.utilizedDays}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-sm font-semibold',
                      row.idleDays > 20
                        ? 'text-red-600'
                        : row.idleDays > 10
                        ? 'text-amber-600'
                        : 'text-gray-500',
                    )}>
                      {row.idleDays}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {avgDailyRate > 0 && row.estimatedIdleLoss > 0 ? (
                      <span className="text-red-600">{formatCurrency(row.estimatedIdleLoss)}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {row.lastRentedDate
                      ? format(parseISO(row.lastRentedDate), 'MMM d, yyyy')
                      : <span className="text-gray-300">Never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer totals */}
          {visible.length > 0 && avgDailyRate > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {visible.length} asset{visible.length !== 1 ? 's' : ''} shown
              </span>
              <span className="font-semibold text-gray-900">
                Total est. idle loss:{' '}
                <span className="text-red-600">
                  {formatCurrency(visible.reduce((s, r) => s + r.estimatedIdleLoss, 0))}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
