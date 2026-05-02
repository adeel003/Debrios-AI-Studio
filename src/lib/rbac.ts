import type { UserRole } from '../types/user';

// IMPORTANT: These helpers are frontend visibility and UX guards only.
// They control what buttons render and what pages show — they do NOT replace
// Supabase RLS policies. Row-level security in Supabase is the final enforcement
// layer for all data reads and writes. A user who bypasses the UI (e.g. via
// direct API calls) must still be blocked by RLS.

export function canViewDrivers(role: UserRole | null): boolean {
  return role === 'admin' || role === 'dispatcher';
}

// Covers creating and editing driver profiles. Dispatcher is included because
// operational teams need to onboard and update driver records.
export function canManageDrivers(role: UserRole | null): boolean {
  return role === 'admin' || role === 'dispatcher';
}

// Hard delete is irreversible and has no soft-delete safety net yet.
// Restrict to admin only until an archiving/recovery mechanism exists.
export function canDeleteDrivers(role: UserRole | null): boolean {
  return role === 'admin';
}

export function canManageDispatch(role: UserRole | null): boolean {
  return role === 'admin' || role === 'dispatcher';
}

// Financial analytics (dumpster ledger, idle loss, platform fees).
export function canViewFinancials(role: UserRole | null): boolean {
  return role === 'admin' || role === 'collector';
}

export function canManageFinancials(role: UserRole | null): boolean {
  return role === 'admin';
}

// Dispatch board: see clocked-in / on-break badge per driver.
export function canViewDriverStatus(role: UserRole | null): boolean {
  return role === 'admin' || role === 'dispatcher';
}

// Work Hours report page.
export function canViewWorkHoursReport(role: UserRole | null): boolean {
  return role === 'admin' || role === 'dispatcher';
}

// Drivers may clock in/out and start/end breaks for themselves.
export function canManageOwnSession(role: UserRole | null): boolean {
  return role === 'driver';
}

// Admins may correct (edit) closed sessions retroactively.
export function canCorrectSessions(role: UserRole | null): boolean {
  return role === 'admin';
}
