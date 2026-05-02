// All queries are tenant_id scoped. Aggregation is performed client-side
// to avoid custom RPC/view dependencies — data volumes per tenant are
// small enough that this is acceptable for Phase 1.

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type LoadStatus = Database['public']['Tables']['loads']['Row']['status'];
type LoadType   = Database['public']['Tables']['loads']['Row']['load_type'];

// ── Shared load projection used by all report queries ───────────────────────
const REPORT_SELECT = `
  id, load_type, status, created_at, dispatched_at, started_at,
  completed_at, cancelled_at, updated_at, driver_id, dumpster_id,
  load_value,
  customer:customers(name),
  driver:drivers(full_name),
  site:client_sites(site_name)
` as const;

export interface ReportLoad {
  id:            string;
  load_type:     LoadType;
  status:        LoadStatus;
  created_at:    string;
  dispatched_at: string | null;
  started_at:    string | null;
  completed_at:  string | null;
  cancelled_at:  string | null;
  updated_at:    string;
  driver_id:     string | null;
  dumpster_id:   string | null;
  load_value:    number | null;
  customer:      { name: string } | null;
  driver:        { full_name: string } | null;
  site:          { site_name: string } | null;
}

// ── Operations ───────────────────────────────────────────────────────────────
export interface DailyPoint {
  day:       string; // YYYY-MM-DD (local date of created_at)
  total:     number;
  completed: number;
}

export interface StatusCount { status: LoadStatus; count: number }
export interface TypeCount   { load_type: LoadType; count: number }

export interface OperationsData {
  loads:               ReportLoad[];
  totalLoads:          number;
  completedLoads:      number;
  cancelledLoads:      number;
  activeLoads:         number;
  avgCompletionHours:  number | null;
  statusCounts:        StatusCount[];
  typeCounts:          TypeCount[];
  dailyTrend:          DailyPoint[];
  delayedLoads:        ReportLoad[];
}

// A load is "delayed" if it is still active AND has not been touched in 4 h.
const DELAY_MS = 4 * 60 * 60 * 1_000;

// ── Exceptions ───────────────────────────────────────────────────────────────
export type ExceptionSeverity = 'critical' | 'warning' | 'info';

export interface ExceptionLoad extends ReportLoad {
  exceptionType: ExceptionType;
  severity:      ExceptionSeverity;
  ageHours:      number;
}

export type ExceptionType =
  | 'dumpyard_required'
  | 'missing_driver'
  | 'delayed'
  | 'missing_dumpster'
  | 'cancelled'
  | 'missing_value';

export interface ExceptionData {
  exceptions: ExceptionLoad[];
  counts:     Record<ExceptionType, number>;
}

// Severity ordering for dedup (lower index = higher priority).
const SEVERITY_ORDER: ExceptionSeverity[] = ['critical', 'warning', 'info'];

function classifyActive(l: ReportLoad, nowMs: number): ExceptionLoad | null {
  const ageHours = (nowMs - new Date(l.updated_at).getTime()) / 3_600_000;

  if (l.status === 'dumpyard_required') {
    return { ...l, exceptionType: 'dumpyard_required', severity: 'critical', ageHours };
  }
  if (l.driver_id === null && l.status !== 'scheduled') {
    return { ...l, exceptionType: 'missing_driver', severity: 'critical', ageHours };
  }
  if (ageHours > DELAY_MS / 3_600_000) {
    return { ...l, exceptionType: 'delayed', severity: 'warning', ageHours };
  }
  if (
    l.dumpster_id === null &&
    (l.load_type === 'Pickup' || l.load_type === 'Exchange')
  ) {
    return { ...l, exceptionType: 'missing_dumpster', severity: 'warning', ageHours };
  }
  return null;
}

// ── Service ──────────────────────────────────────────────────────────────────
export const reportService = {

  // ── Operations Report ─────────────────────────────────────────────────────
  async fetchOperationsData(
    tenantId: string,
    dateFrom: string,
    dateTo:   string,
  ): Promise<OperationsData> {
    // Timezone-safe: treat dateFrom/dateTo as UTC day boundaries.
    // Supabase stores created_at in UTC; using T00:00:00Z and T23:59:59.999Z
    // means the filter is deterministic regardless of the client's local TZ.
    const from = `${dateFrom}T00:00:00.000Z`;
    const to   = `${dateTo}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('loads')
      .select(REPORT_SELECT)
      .eq('tenant_id', tenantId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const loads = (data ?? []) as unknown as ReportLoad[];
    const nowMs = Date.now();

    // --- Counts ---
    const completedLoads = loads.filter((l) => l.status === 'completed').length;
    const cancelledLoads = loads.filter((l) => l.status === 'cancelled').length;
    const activeLoads    = loads.filter(
      (l) => l.status !== 'completed' && l.status !== 'cancelled',
    ).length;

    // --- Average completion time (dispatch → complete) in hours ---
    const completedWithTimes = loads.filter(
      (l) => l.status === 'completed' && l.dispatched_at && l.completed_at,
    );
    const avgCompletionHours =
      completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, l) => {
            const ms =
              new Date(l.completed_at!).getTime() -
              new Date(l.dispatched_at!).getTime();
            return sum + ms / 3_600_000;
          }, 0) / completedWithTimes.length
        : null;

    // --- Status counts ---
    const statusMap = new Map<LoadStatus, number>();
    for (const l of loads) statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1);
    const statusCounts: StatusCount[] = [...statusMap.entries()].map(
      ([status, count]) => ({ status, count }),
    );

    // --- Type counts ---
    const typeMap = new Map<LoadType, number>();
    for (const l of loads) typeMap.set(l.load_type, (typeMap.get(l.load_type) ?? 0) + 1);
    const typeCounts: TypeCount[] = [...typeMap.entries()].map(
      ([load_type, count]) => ({ load_type, count }),
    );

    // --- Daily trend (group by local date of created_at) ---
    // Slice to the YYYY-MM-DD portion of the ISO string. Supabase returns
    // timestamps in UTC, so all dates here are UTC-day buckets. Consistent
    // within a single report — the chart x-axis label calls this out as UTC.
    const dayMap = new Map<string, { total: number; completed: number }>();
    for (const l of loads) {
      const day = l.created_at.slice(0, 10);
      const entry = dayMap.get(day) ?? { total: 0, completed: 0 };
      entry.total++;
      if (l.status === 'completed') entry.completed++;
      dayMap.set(day, entry);
    }
    const dailyTrend: DailyPoint[] = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, { total, completed }]) => ({ day, total, completed }));

    // --- Delayed loads ---
    const delayedLoads = loads.filter(
      (l) =>
        l.status !== 'completed' &&
        l.status !== 'cancelled' &&
        nowMs - new Date(l.updated_at).getTime() > DELAY_MS,
    );

    return {
      loads,
      totalLoads: loads.length,
      completedLoads,
      cancelledLoads,
      activeLoads,
      avgCompletionHours,
      statusCounts,
      typeCounts,
      dailyTrend,
      delayedLoads,
    };
  },

  // ── Exception Report ───────────────────────────────────────────────────────
  async fetchExceptionData(
    tenantId: string,
    dateFrom: string,
    dateTo:   string,
  ): Promise<ExceptionData> {
    const from  = `${dateFrom}T00:00:00.000Z`;
    const to    = `${dateTo}T23:59:59.999Z`;
    const nowMs = Date.now();

    // Three parallel fetches:
    // 1. All currently active (non-terminal) loads — always current, no date filter.
    // 2. Cancelled loads within the selected range.
    // 3. Completed loads with missing/zero value within the selected range.
    const [activeRes, cancelledRes, missingValueRes] = await Promise.all([
      supabase
        .from('loads')
        .select(REPORT_SELECT)
        .eq('tenant_id', tenantId)
        .not('status', 'in', '(completed,cancelled)')
        .order('updated_at', { ascending: true }),

      supabase
        .from('loads')
        .select(REPORT_SELECT)
        .eq('tenant_id', tenantId)
        .eq('status', 'cancelled')
        .gte('cancelled_at', from)
        .lte('cancelled_at', to)
        .order('cancelled_at', { ascending: false }),

      supabase
        .from('loads')
        .select(REPORT_SELECT)
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_at', from)
        .lte('completed_at', to)
        .or('load_value.is.null,load_value.eq.0')
        .order('completed_at', { ascending: false }),
    ]);

    if (activeRes.error)       throw activeRes.error;
    if (cancelledRes.error)    throw cancelledRes.error;
    if (missingValueRes.error) throw missingValueRes.error;

    const activeLoads       = (activeRes.data      ?? []) as unknown as ReportLoad[];
    const cancelledLoads    = (cancelledRes.data    ?? []) as unknown as ReportLoad[];
    const missingValueLoads = (missingValueRes.data ?? []) as unknown as ReportLoad[];

    const raw: ExceptionLoad[] = [];

    for (const l of activeLoads) {
      const ex = classifyActive(l, nowMs);
      if (ex) raw.push(ex);
    }

    for (const l of cancelledLoads) {
      const ageHours =
        (nowMs - new Date(l.cancelled_at ?? l.updated_at).getTime()) / 3_600_000;
      raw.push({ ...l, exceptionType: 'cancelled', severity: 'warning', ageHours });
    }

    for (const l of missingValueLoads) {
      const ageHours =
        (nowMs - new Date(l.completed_at ?? l.updated_at).getTime()) / 3_600_000;
      raw.push({ ...l, exceptionType: 'missing_value', severity: 'info', ageHours });
    }

    // Deduplicate by load ID — keep the highest-severity classification.
    const dedupMap = new Map<string, ExceptionLoad>();
    for (const ex of raw) {
      const existing = dedupMap.get(ex.id);
      if (
        !existing ||
        SEVERITY_ORDER.indexOf(ex.severity) <
          SEVERITY_ORDER.indexOf(existing.severity)
      ) {
        dedupMap.set(ex.id, ex);
      }
    }

    const exceptions: ExceptionLoad[] = [...dedupMap.values()].sort((a, b) => {
      const sev =
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
      return sev !== 0 ? sev : b.ageHours - a.ageHours;
    });

    const counts = {
      dumpyard_required: 0,
      missing_driver:    0,
      delayed:           0,
      missing_dumpster:  0,
      cancelled:         0,
      missing_value:     0,
    } satisfies Record<ExceptionType, number>;

    for (const ex of exceptions) counts[ex.exceptionType]++;

    return { exceptions, counts };
  },

  // ── Landing Page — lightweight exception badge counts ───────────────────��─
  // Active-state counts only (no date range) + today's cancelled count.
  async fetchExceptionCounts(tenantId: string): Promise<Record<ExceptionType, number>> {
    const delayThreshold = new Date(Date.now() - DELAY_MS).toISOString();
    const todayStart     = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [dumpyard, delayed, missingDriver, missingDumpster, cancelledToday, missingValue] =
      await Promise.all([
        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'dumpyard_required'),

        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .not('status', 'in', '(completed,cancelled,dumpyard_required)')
          .lt('updated_at', delayThreshold),

        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('driver_id', null)
          .not('status', 'in', '(scheduled,completed,cancelled,dumpyard_required)'),

        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('dumpster_id', null)
          .in('load_type', ['Pickup', 'Exchange'])
          .not('status', 'in', '(completed,cancelled,dumpyard_required)'),

        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'cancelled')
          .gte('cancelled_at', todayStart.toISOString()),

        supabase
          .from('loads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'completed')
          .or('load_value.is.null,load_value.eq.0'),
      ]);

    return {
      dumpyard_required: dumpyard.count      ?? 0,
      delayed:           delayed.count       ?? 0,
      missing_driver:    missingDriver.count  ?? 0,
      missing_dumpster:  missingDumpster.count ?? 0,
      cancelled:         cancelledToday.count ?? 0,
      missing_value:     missingValue.count   ?? 0,
    };
  },
};
