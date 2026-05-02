import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Coffee, LogIn, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { driverService } from '../services/driver.service';
import {
  workSessionService,
  sessionWorkedMinutes,
  formatMinutes,
} from '../services/workSession.service';
import type { WorkSession } from '../services/workSession.service';
import type { Driver } from '../types/driver';
import { cn } from '../lib/utils';

// Elapsed timer that re-renders every 30 s.
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Work() {
  const { user, appReady } = useAuth();
  const now = useNow();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [openSession, setOpenSession] = useState<WorkSession | null>(null);
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const d = await driverService.getDriverProfile(user.id);
      if (!d) { setLoading(false); return; }
      setDriver(d);
      const [open, today] = await Promise.all([
        workSessionService.fetchMyOpenSession(d.id, d.tenant_id),
        workSessionService.fetchMyTodaySessions(d.id, d.tenant_id),
      ]);
      setOpenSession(open);
      setTodaySessions(today);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (appReady) refresh();
  }, [appReady, refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setActionLoading(true);
    setError(null);
    try {
      await fn();
      await refresh();
      toast.success(label);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockIn  = () => run('Clocked in', () => workSessionService.clockIn());
  const handleClockOut = () => run('Clocked out', () => workSessionService.clockOut());
  const handleBreakStart = () => run('Break started', () => workSessionService.startBreak());
  const handleBreakEnd   = () => run('Back to work', () => workSessionService.endBreak());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No driver profile linked to your account.</p>
      </div>
    );
  }

  const isOnBreak   = openSession?.break_started_at != null;
  const isClockedIn = openSession != null;

  // Elapsed worked time for the open session (live).
  const openWorkedMin = openSession ? sessionWorkedMinutes(openSession) : 0;

  // Current break elapsed.
  const openBreakMin = isOnBreak && openSession?.break_started_at
    ? Math.max(0, Math.floor(
        (now.getTime() - new Date(openSession.break_started_at).getTime()) / 60_000,
      ))
    : 0;

  // Total worked today (all closed sessions + open session if any).
  const totalTodayMin = todaySessions.reduce((acc, s) => acc + sessionWorkedMinutes(s), 0);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-2">
      {/* Status card */}
      <div className={cn(
        'rounded-2xl border shadow-sm p-6',
        isOnBreak
          ? 'bg-amber-50 border-amber-200'
          : isClockedIn
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200',
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center',
            isOnBreak ? 'bg-amber-100' : isClockedIn ? 'bg-green-100' : 'bg-gray-100',
          )}>
            {isOnBreak
              ? <Coffee className="h-5 w-5 text-amber-600" />
              : isClockedIn
              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
              : <Clock className="h-5 w-5 text-gray-400" />}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">
              {isOnBreak ? 'On Break' : isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </p>
            {isClockedIn && openSession && (
              <p className="text-xs text-gray-500">
                Since {format(new Date(openSession.clocked_in_at), 'h:mm a')}
                {' · '}
                {formatDistanceToNowStrict(new Date(openSession.clocked_in_at), { addSuffix: false })} ago
              </p>
            )}
          </div>
        </div>

        {isClockedIn && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Worked</p>
              <p className="text-xl font-bold text-gray-900">{formatMinutes(openWorkedMin)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">
                {isOnBreak ? 'Break (current)' : 'Total Breaks'}
              </p>
              <p className="text-xl font-bold text-gray-900">
                {isOnBreak
                  ? formatMinutes(openBreakMin)
                  : formatMinutes(openSession?.total_break_minutes ?? 0)}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {!isClockedIn && (
            <button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Clock In
            </button>
          )}

          {isClockedIn && !isOnBreak && (
            <>
              <button
                onClick={handleBreakStart}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                <Coffee className="h-4 w-4" />
                Start Break
              </button>
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 font-semibold py-3 rounded-xl border border-red-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Clock Out
              </button>
            </>
          )}

          {isClockedIn && isOnBreak && (
            <>
              <button
                onClick={handleBreakEnd}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                End Break
              </button>
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 font-semibold py-3 rounded-xl border border-red-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Clock Out
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Today's summary */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Today</h2>
          <span className="text-xs text-gray-400 font-medium">
            {formatMinutes(totalTodayMin)} total
          </span>
        </div>

        {todaySessions.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="h-7 w-7 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No sessions recorded today.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todaySessions.map((s) => {
              const worked = sessionWorkedMinutes(s);
              const isOpen = s.clocked_out_at == null;
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0',
                    isOpen ? 'bg-green-500' : 'bg-gray-300',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {format(new Date(s.clocked_in_at), 'h:mm a')}
                      {' — '}
                      {isOpen
                        ? <span className="text-green-600 font-medium">ongoing</span>
                        : format(new Date(s.clocked_out_at!), 'h:mm a')}
                    </p>
                    {s.total_break_minutes > 0 && (
                      <p className="text-xs text-gray-400">
                        {formatMinutes(s.total_break_minutes)} break
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                    {formatMinutes(worked)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
