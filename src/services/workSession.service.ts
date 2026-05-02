// NOTE: All write paths go through SECURITY DEFINER RPCs.
// Direct INSERT/UPDATE on session tables is blocked by RLS.

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type WorkSession = Database['public']['Tables']['driver_work_sessions']['Row'];
export type WorkSessionEvent = Database['public']['Tables']['driver_work_session_events']['Row'];
export type DriverLiveStatus = Database['public']['Tables']['driver_live_status']['Row'];
export type DriverLoadSession = Database['public']['Tables']['driver_load_sessions']['Row'];

export interface WorkSessionWithDriver extends WorkSession {
  driver: { full_name: string } | null;
}

export const workSessionService = {
  // Driver: clock in. Returns the new session id.
  async clockIn(notes?: string): Promise<string> {
    const { data, error } = await supabase.rpc('driver_clock_in', {
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  // Driver: clock out.
  async clockOut(notes?: string): Promise<void> {
    const { error } = await supabase.rpc('driver_clock_out', {
      p_notes: notes ?? null,
    });
    if (error) throw error;
  },

  // Driver: start a break within the open session.
  async startBreak(reason?: string): Promise<void> {
    const { error } = await supabase.rpc('driver_start_break', {
      p_reason: reason ?? null,
    });
    if (error) throw error;
  },

  // Driver: end the current break.
  async endBreak(): Promise<void> {
    const { error } = await supabase.rpc('driver_end_break', {});
    if (error) throw error;
  },

  // Driver: fetch the currently open session (null if clocked out).
  async fetchMyOpenSession(
    driverId: string,
    tenantId: string,
  ): Promise<WorkSession | null> {
    const { data, error } = await supabase
      .from('driver_work_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('driver_id', driverId)
      .is('clocked_out_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as WorkSession | null;
  },

  // Driver: fetch today's closed + open sessions.
  async fetchMyTodaySessions(
    driverId: string,
    tenantId: string,
  ): Promise<WorkSession[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('driver_work_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('driver_id', driverId)
      .gte('clocked_in_at', todayStart.toISOString())
      .order('clocked_in_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkSession[];
  },

  // Dispatch board: fetch live status for all drivers in the tenant.
  async fetchLiveStatus(tenantId: string): Promise<DriverLiveStatus[]> {
    const { data, error } = await supabase
      .from('driver_live_status')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data ?? []) as DriverLiveStatus[];
  },

  // Admin/Dispatcher: sessions within a date range, joined with driver name.
  async fetchWorkHoursReport(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<WorkSessionWithDriver[]> {
    const { data, error } = await supabase
      .from('driver_work_sessions')
      .select('*, driver:drivers(full_name)')
      .eq('tenant_id', tenantId)
      .gte('clocked_in_at', dateFrom)
      .lte('clocked_in_at', dateTo)
      .order('clocked_in_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkSessionWithDriver[];
  },

  // Admin: correct timestamps on a closed session.
  async adminCorrectSession(
    sessionId: string,
    clockedInAt: string,
    clockedOutAt: string,
    reason: string,
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_correct_session', {
      p_session_id:     sessionId,
      p_clocked_in_at:  clockedInAt,
      p_clocked_out_at: clockedOutAt,
      p_reason:         reason,
    });
    if (error) throw error;
  },
};

// Utility: compute worked minutes from a session (excludes breaks).
export function sessionWorkedMinutes(s: WorkSession): number {
  const end = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date();
  const totalMs = end.getTime() - new Date(s.clocked_in_at).getTime();
  return Math.max(0, Math.floor(totalMs / 60_000) - s.total_break_minutes);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
