import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface TenantGuardProps {
  children: React.ReactNode;
}

export function TenantGuard({ children }: TenantGuardProps) {
  const { user, profile, loading, appReady } = useAuth();

  if (!appReady) {
    return null;
  }

  console.log('Auth Debug: TenantGuard check', { 
    hasUser: !!user, 
    hasProfile: !!profile, 
    tenantId: profile?.tenant_id 
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile?.tenant_id) {
    console.log('Auth Debug: TenantGuard redirecting to profile-setup');
    // If authenticated but no profile/tenant, redirect to setup
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
}
