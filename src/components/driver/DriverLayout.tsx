import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Truck, LogOut, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NotificationBell } from '../NotificationBell';

export function DriverLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/driver" className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">Driver Hub</span>
          </Link>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="bg-white border-t border-gray-200 sticky bottom-0 z-30 sm:hidden">
        <div className="grid grid-cols-2 h-16">
          <Link
            to="/driver"
            className={cn(
              "flex flex-col items-center justify-center space-y-1",
              location.pathname === '/driver' ? "text-blue-600" : "text-gray-500"
            )}
          >
            <Truck size={24} />
            <span className="text-xs font-medium">My Loads</span>
          </Link>
          <Link
            to="/driver/profile"
            className={cn(
              "flex flex-col items-center justify-center space-y-1",
              location.pathname === '/driver/profile' ? "text-blue-600" : "text-gray-500"
            )}
          >
            <User size={24} />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
