import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/user';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
