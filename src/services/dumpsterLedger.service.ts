import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type Dumpster = Database['public']['Tables']['dumpsters']['Row'];

interface LoadSlice {
  id: string;
  dumpster_id: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface DumpsterLedgerRow {
  id: string;
  asset_number: string;
  size: string;
  condition: string;
  status: string;
  notes: string | null;
  totalRentals: number;
  thisMonthRentals: number;
  utilizedDays: number;
  idleDays: number;
  lastRentedDate: string | null;
  estimatedIdleLoss: number;
}

export interface LedgerSummary {
  totalDumpsters: number;
  activeDumpsters: number;
  idleDumpsters: number;
  totalIdleLoss: number;
}

function daysInMonthFor(year: number, mon: number): number {
  // new Date(year, mon, 0) = last day of the mon-th month (1-indexed)
  return new Date(year, mon, 0).getDate();
}

function msBetweenDates(from: string, to: string): number {
  return new Date(to).getTime() - new Date(from).getTime();
}

export const dumpsterLedgerService = {
  async fetchLedger(
    tenantId: string,
    month: string,       // 'YYYY-MM'
    avgDailyRate: number,
  ): Promise<{ rows: DumpsterLedgerRow[]; summary: LedgerSummary }> {
    const [year, mon] = month.split('-').map(Number);
    const periodDays = daysInMonthFor(year, mon);
    const lastDay = String(periodDays).padStart(2, '0');
    const monthStart = `${month}-01T00:00:00.000Z`;
    const monthEnd   = `${month}-${lastDay}T23:59:59.999Z`;

    const [dumpstersRes, allLoadsRes, monthLoadsRes] = await Promise.all([
      supabase
        .from('dumpsters')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('asset_number'),

      supabase
        .from('loads')
        .select('id, dumpster_id, dispatched_at, completed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .not('dumpster_id', 'is', null)
        .not('dispatched_at', 'is', null)
        .order('dispatched_at', { ascending: false }),

      supabase
        .from('loads')
        .select('id, dumpster_id, dispatched_at, completed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .not('dumpster_id', 'is', null)
        .not('dispatched_at', 'is', null)
        .gte('dispatched_at', monthStart)
        .lte('dispatched_at', monthEnd),
    ]);

    if (dumpstersRes.error)  throw dumpstersRes.error;
    if (allLoadsRes.error)   throw allLoadsRes.error;
    if (monthLoadsRes.error) throw monthLoadsRes.error;

    const dumpsters  = (dumpstersRes.data  ?? []) as Dumpster[];
    const allLoads   = (allLoadsRes.data   ?? []) as LoadSlice[];
    const monthLoads = (monthLoadsRes.data ?? []) as LoadSlice[];

    // Index loads by dumpster_id
    const allByDumpster = new Map<string, LoadSlice[]>();
    for (const l of allLoads) {
      if (!l.dumpster_id) continue;
      const bucket = allByDumpster.get(l.dumpster_id) ?? [];
      bucket.push(l);
      allByDumpster.set(l.dumpster_id, bucket);
    }

    const monthByDumpster = new Map<string, LoadSlice[]>();
    for (const l of monthLoads) {
      if (!l.dumpster_id) continue;
      const bucket = monthByDumpster.get(l.dumpster_id) ?? [];
      bucket.push(l);
      monthByDumpster.set(l.dumpster_id, bucket);
    }

    const MS_PER_DAY = 86_400_000;

    const rows: DumpsterLedgerRow[] = dumpsters.map((d) => {
      const allForThis   = allByDumpster.get(d.id)   ?? [];
      const monthForThis = monthByDumpster.get(d.id) ?? [];

      const totalRentals     = allForThis.length;
      const thisMonthRentals = monthForThis.length;

      // Sum of (completed_at - dispatched_at) in days for this month's completed loads
      let utilizedMs = 0;
      for (const l of monthForThis) {
        if (l.dispatched_at && l.completed_at) {
          const ms = msBetweenDates(l.dispatched_at, l.completed_at);
          if (ms > 0) utilizedMs += ms;
        }
      }
      const utilizedDays = Math.min(
        Math.round(utilizedMs / MS_PER_DAY),
        periodDays,
      );
      const idleDays = Math.max(0, periodDays - utilizedDays);

      // allLoads are ordered desc by dispatched_at so the first entry is most recent
      const lastRentedDate = allForThis[0]?.dispatched_at ?? null;

      const estimatedIdleLoss = idleDays * avgDailyRate;

      return {
        id: d.id,
        asset_number: d.asset_number,
        size: d.size,
        condition: d.condition,
        status: d.status,
        notes: d.notes,
        totalRentals,
        thisMonthRentals,
        utilizedDays,
        idleDays,
        lastRentedDate,
        estimatedIdleLoss,
      };
    });

    const summary: LedgerSummary = {
      totalDumpsters: rows.length,
      activeDumpsters: rows.filter((r) => r.status === 'Assigned').length,
      idleDumpsters:   rows.filter((r) => r.status === 'Available').length,
      totalIdleLoss:   rows.reduce((s, r) => s + r.estimatedIdleLoss, 0),
    };

    return { rows, summary };
  },
};
