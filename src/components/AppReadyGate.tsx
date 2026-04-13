import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ErrorScreen } from './ui/ErrorScreen';

export function AppReadyGate({ children }: { children: React.ReactNode }) {
  const { user, profile, appReady, signOut, loading, profileLoading, error: bootError } = useAuth();
  const location = useLocation();
  const [showTimeout, setShowTimeout] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!appReady && !bootError) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 10000); // 10 seconds timeout
    }
    return () => clearTimeout(timer);
  }, [appReady, bootError]);

  // Public routes that don't need auth
  const isPublicRoute = ['/login', '/signup'].includes(location.pathname);

  if (bootError) {
    return (
      <ErrorScreen 
        title="Connection Error"
        message={bootError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!appReady) {
    if (showTimeout) {
      return (
        <ErrorScreen 
          title="Initialization Timeout"
          message="The application is taking longer than expected to start. This could be due to a slow connection or a temporary issue."
          onRetry={() => window.location.reload()}
        />
      );
    }

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 z-50 p-4">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Initializing application...</p>
      </div>
    );
  }

  if (isPublicRoute) {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }
 
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
 
  if (!profile) {
    if (location.pathname === '/profile-setup') {
      return <>{children}</>;
    }
    return <Navigate to="/profile-setup" replace />;
  }
 
  return <>{children}</>;
}
