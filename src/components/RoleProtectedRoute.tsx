import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'dispatcher' | 'driver')[];
}

export function RoleProtectedRoute({ children, allowedRoles }: RoleProtectedRouteProps) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile || !allowedRoles.includes(profile.role as any)) {
    // If they don't have a profile yet (first user), allow them to see dashboard to set it up
    // or redirect to login if not authenticated (handled by Layout)
    if (!profile && allowedRoles.includes('admin')) {
        return <>{children}</>;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
