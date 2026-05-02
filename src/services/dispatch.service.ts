// NOTE: All RPC calls use SECURITY DEFINER functions that enforce tenant
// isolation server-side. This service is the frontend orchestration layer only.
// Supabase RLS and the RPC logic are the final enforcement boundary.

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type LoadStatus = Database['public']['Tables']['loads']['Row']['status'];
export type LoadType = Database['public']['Tables']['loads']['Row']['load_type'];
export type DumpsterRow = Database['public']['Tables']['dumpsters']['Row'];

// Statuses that represent a load still requiring operator attention.
export const ACTIVE_STATUSES: LoadStatus[] = [
  'scheduled',
  'assigned',
  'en_route',
  'on_site',
  'service_done',
  'dumpyard_required',
];

// loads.dumpster_id has no FK to dumpsters (declared as placeholder in schema).
// Dumpster details are fetched separately and enriched client-side via dumpsterMap.
export interface DispatchLoad {
  id: string;
  load_type: LoadType;
  status: LoadStatus;
  notes: string | null;
  driver_id: string | null;
  dumpster_id: string | null;
  dispatched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  customer: { name: string } | null;
  driver: { full_name: string } | null;
  // site: FK loads.site_id → client_sites.id exists — join works
  site: { site_name: string; address: string } | null;
}

export interface LoadEvent {
  id: string;
  load_id: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
  // actor_name is resolved via a separate profiles query (load_events.actor_id → auth.users,
  // not profiles.id — no direct FK so PostgREST cannot auto-join).
  actor_name: string | null;
}

export interface DispatchBoardData {
  loads: DispatchLoad[];
  dumpsters: DumpsterRow[];
  completedToday: number;
}

export const dispatchService = {
  // Single parallel fetch for everything the dispatch board needs.
  // All queries are tenant_id scoped. The completedToday count failure is
  // non-fatal — the board falls back to 0 rather than crashing.
  async fetchDispatchData(tenantId: string): Promise<DispatchBoardData> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [loadsRes, dumpstersRes, completedTodayRes] = await Promise.all([
      supabase
        .from('loads')
        .select(`
          id, load_type, status, notes, driver_id, dumpster_id,
          dispatched_at, started_at, completed_at, created_at, updated_at,
          customer:customers(name),
          driver:drivers(full_name),
          site:client_sites(site_name, address)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false }),

      supabase
        .from('dumpsters')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('asset_number', { ascending: true }),

      supabase
        .from('loads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_at', todayStart.toISOString()),
    ]);

    if (loadsRes.error) throw loadsRes.error;
    if (dumpstersRes.error) throw dumpstersRes.error;
    // completedToday error is non-fatal

    return {
      loads: (loadsRes.data ?? []) as unknown as DispatchLoad[],
      dumpsters: (dumpstersRes.data ?? []) as DumpsterRow[],
      completedToday: completedTodayRes.count ?? 0,
    };
  },

  // Lazy-loaded for the timeline drawer. load_events.actor_id references auth.users
  // (not profiles), so actor names require a second profiles query keyed on profiles.id.
  async fetchLoadTimeline(tenantId: string, loadId: string): Promise<LoadEvent[]> {
    const { data: events, error } = await supabase
      .from('load_events')
      .select('id, load_id, actor_id, from_status, to_status, notes, created_at')
      .eq('tenant_id', tenantId)
      .eq('load_id', loadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!events || events.length === 0) return [];

    // Collect unique non-null actor IDs and resolve full names from profiles.
    const actorIds = [
      ...new Set(
        events
          .map((e) => e.actor_id as string | null)
          .filter((id): id is string => id !== null),
      ),
    ];

    const actorMap = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const { data: actorProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds)
        .eq('tenant_id', tenantId);
      for (const p of actorProfiles ?? []) {
        actorMap.set(p.id, p.full_name);
      }
    }

    return events.map((e) => ({
      id: e.id as string,
      load_id: e.load_id as string,
      actor_id: e.actor_id as string | null,
      from_status: e.from_status as string | null,
      to_status: e.to_status as string,
      notes: e.notes as string | null,
      created_at: e.created_at as string,
      actor_name: e.actor_id ? (actorMap.get(e.actor_id as string) ?? null) : null,
    }));
  },

  // dispatch_job: scheduled|assigned → assigned, driver: available → on_job
  async dispatchJob(loadId: string, driverId: string): Promise<void> {
    const { error } = await supabase.rpc('dispatch_job', {
      p_job_id: loadId,
      p_driver_id: driverId,
    });
    if (error) throw error;
  },

  // start_job: assigned → en_route
  async startJob(loadId: string): Promise<void> {
    const { error } = await supabase.rpc('start_job', { p_job_id: loadId });
    if (error) throw error;
  },

  // complete_job: assigned|en_route|on_site|service_done|dumpyard_required → completed
  async completeJob(loadId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_job', { p_job_id: loadId });
    if (error) throw error;
  },

  // cancel_job: any non-terminal → cancelled; driver released if was on this load
  async cancelJob(loadId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_job', { p_job_id: loadId });
    if (error) throw error;
  },
};
