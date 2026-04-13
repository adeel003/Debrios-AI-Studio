import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  const { profile } = useAuth();

  // If driver, redirect to driver interface
  if (profile?.role === 'driver') {
    return <Navigate to="/driver" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
        <div className="w-10" /> {/* Spacer for menu button */}
        <span className="text-xl font-bold text-blue-600">Debrios</span>
        <NotificationBell />
      </header>
      <header className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-30 items-center justify-end px-8">
        <NotificationBell />
      </header>
      <main className="lg:pl-64 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
