import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfigError } from './components/ConfigError';
import { isSupabaseConfigured } from './lib/supabase';
import { AppReadyGate } from './components/AppReadyGate';

// Auth Pages
import { Login } from './features/auth/pages/Login';
import { Register } from './features/auth/pages/Register';
import { ProfileSetup } from './features/auth/pages/ProfileSetup';

// Dashboard Pages
import { Layout as DashboardLayout } from './components/Layout';
import { Dashboard as Overview } from './features/overview/pages/Dashboard';
import { DispatchGrid as Loads } from './features/operations/pages/DispatchGrid';
import { LoadDetails } from './features/operations/pages/LoadDetails';
import { Drivers } from './pages/Drivers';
import { Dispatch } from './pages/Dispatch';
import { DumpstersInventory as Dumpsters } from './features/assets/pages/DumpstersInventory';
import { ClientDirectory as Customers } from './features/customers/pages/ClientDirectory';
import { Dumpyards } from './features/operations/pages/Dumpyards';
import { DispatcherMap } from './features/overview/pages/DispatcherMap';
import { AccessControl as Team } from './features/people/pages/AccessControl';
import { Settings } from './features/admin/pages/Settings';
import { AuditLogs } from './features/admin/pages/AuditLogs';
import { Billing as Fees } from './features/finance/pages/Billing';
import { WorkHours } from './pages/WorkHours';

// Driver Pages
import { DriverLayout } from './components/driver/DriverLayout';
import { MyLoads } from './features/driver-app/pages/MyLoads';
import { DriverLoadDetails } from './features/driver-app/pages/LoadDetails';
import { DriverProfile } from './features/driver-app/pages/Profile';
import { Work } from './pages/Work';

// Guards
import { RoleGuard } from './core/guards/RoleGuard';
import { TenantGuard } from './core/guards/TenantGuard';

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigError />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-right" />
        <Router>
          <AppReadyGate>
            <Routes>
              {/* Auth Group */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/profile-setup" element={<ProfileSetup />} />

              {/* Dashboard Group */}
              <Route 
                path="/" 
                element={
                  <TenantGuard>
                    <DashboardLayout />
                  </TenantGuard>
                }
              >
                <Route index element={<Overview />} />
                <Route path="dispatcher" element={<DispatcherMap />} />
                <Route path="loads" element={<Loads />} />
                <Route path="loads/:id" element={<LoadDetails />} />
                <Route path="drivers" element={<Drivers />} />
                <Route
                  path="dispatch"
                  element={
                    <RoleGuard allowedRoles={['admin', 'dispatcher']}>
                      <Dispatch />
                    </RoleGuard>
                  }
                />
                <Route path="dumpsters" element={<Dumpsters />} />
                <Route path="customers" element={<Customers />} />
                <Route path="dumpyards" element={<Dumpyards />} />
                <Route 
                  path="team" 
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <Team />
                    </RoleGuard>
                  } 
                />
                <Route 
                  path="settings" 
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <Settings />
                    </RoleGuard>
                  } 
                />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route
                  path="fees"
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <Fees />
                    </RoleGuard>
                  }
                />
                <Route
                  path="work-hours"
                  element={
                    <RoleGuard allowedRoles={['admin', 'dispatcher']}>
                      <WorkHours />
                    </RoleGuard>
                  }
                />
              </Route>

              {/* Driver Group */}
              <Route 
                path="/driver" 
                element={
                  <RoleGuard allowedRoles={['driver']}>
                    <DriverLayout />
                  </RoleGuard>
                }
              >
                <Route index element={<MyLoads />} />
                <Route path="loads/:id" element={<DriverLoadDetails />} />
                <Route path="profile" element={<DriverProfile />} />
                <Route path="work" element={<Work />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppReadyGate>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
