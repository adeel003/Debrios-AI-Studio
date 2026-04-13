import React, { useEffect, useState, useMemo } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp,
  Activity,
  AlertCircle,
  Clock,
  User,
  ArrowRight,
  Layout,
  RefreshCw,
  Database as DatabaseIcon
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, cn } from '../../../lib/utils';
import { Database } from '../../../types/database';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { DashboardCharts } from '../../../components/DashboardCharts';
import { LiveActivity } from '../../../components/LiveActivity';
import { OnboardingFlow } from '../../../components/OnboardingFlow';
import { handleError } from '../../../lib/error-handler';
import { useAuth } from '../../../contexts/AuthContext';

type Load = Database['public']['Tables']['loads']['Row'] & {
  customer: Database['public']['Tables']['customers']['Row'];
  driver: Database['public']['Tables']['drivers']['Row'] | null;
};

type Driver = Database['public']['Tables']['drivers']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

export function Dashboard() {
  const { profile, appReady } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!appReady || !profile?.tenant_id) return;

    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [loadsRes, driversRes, customersRes, feesRes] = await Promise.all([
        supabase.from('loads').select('*, customer:customers(*), driver:drivers(*)').eq('tenant_id', profile.tenant_id),
        supabase.from('drivers').select('*').eq('tenant_id', profile.tenant_id),
        supabase.from('customers').select('*').eq('tenant_id', profile.tenant_id),
        supabase.from('platform_fees').select('*').eq('tenant_id', profile.tenant_id).gte('created_at', todayISO)
      ]);

      if (loadsRes.error) throw loadsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (customersRes.error) throw customersRes.error;
      if (feesRes.error) throw feesRes.error;

      setLoads(loadsRes.data as Load[]);
      setDrivers(driversRes.data as Driver[]);
      setCustomers(customersRes.data as Customer[]);
      setFees(feesRes.data || []);
    } catch (err: any) {
      handleError(err, 'Dashboard:fetchData');
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;

    fetchData();

    const loadsSub = supabase
      .channel('dashboard-loads')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'loads',
        filter: `tenant_id=eq.${profile.tenant_id}`
      }, () => {
        fetchData(true);
      })
      .subscribe();

    return () => {
      loadsSub.unsubscribe();
    };
  }, [profile?.tenant_id, appReady]);

  // Stats Calculation
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const completedToday = loads.filter(l => l.status === 'completed' && l.completed_at?.startsWith(today)).length;
    const activeJobs = loads.filter(l => ['assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required'].includes(l.status)).length;
    const scheduled = loads.filter(l => l.status === 'scheduled').length;
    
    const availableDrivers = drivers.filter(d => d.status === 'available').length;
    const activeDrivers = drivers.filter(d => d.status === 'busy').length;

    const todayRevenue = loads
      .filter(l => l.status === 'completed' && l.completed_at?.startsWith(today))
      .reduce((acc, l) => acc + (l.load_value || 0), 0);
    
    const todayFees = fees.reduce((acc, f) => acc + (f.fee_amount || 0), 0);

    return {
      activeLoads: activeJobs,
      completedToday,
      scheduled,
      availableDrivers,
      activeDrivers,
      customerCount: customers.length,
      revenue: todayRevenue,
      fees: todayFees
    };
  }, [loads, drivers, customers, fees]);

  if (loading) {
    return <LoadingState message="Loading Debrios Dashboard..." />;
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debrios Logistics Overview</h1>
          <p className="text-gray-500">Real-time fleet and load operations for {profile?.full_name}'s company.</p>
        </div>
        <div className="flex items-center space-x-4">
          <LiveActivity data={[10, 15, 8, 12, 20, 18, 25]} />
          {isRefreshing && <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />}
        </div>
      </div>

      {/* Pilot Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
              Pilot Program Active
            </div>
            <h2 className="text-2xl font-bold">Welcome to the Debrios Pilot!</h2>
            <p className="text-blue-100 text-sm max-w-xl">
              You are among the first companies to use Debrios. We are here to support your logistics operations 24/7. 
              Please use the "Pilot Feedback" button in the sidebar to report any issues.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-medium text-blue-100">Direct Support</p>
              <p className="text-sm font-bold">adeelrazzaq89@gmail.com</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 bg-blue-400/10 rounded-full blur-3xl" />
      </motion.div>

      {/* Onboarding Checklist */}
      <OnboardingFlow 
        stats={{
          customers: stats.customerCount,
          drivers: drivers.length,
          loads: loads.length
        }} 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Active Loads" 
          value={stats.activeLoads} 
          subValue={`${stats.scheduled} scheduled`}
          icon={Truck}
          color="blue"
        />
        <StatCard 
          title="Delivered Today" 
          value={stats.completedToday} 
          subValue="Loads finalized"
          icon={CheckCircle2}
          color="green"
        />
        <StatCard 
          title="Available Fleet" 
          value={stats.availableDrivers} 
          subValue={`${stats.activeDrivers} currently busy`}
          icon={Activity}
          color="purple"
        />
        <StatCard 
          title="Today's Revenue" 
          value={formatCurrency(stats.revenue)} 
          subValue={`Fees: ${formatCurrency(stats.fees)}`}
          icon={DollarSign}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-gray-400" />
              Operational Performance
            </h3>
            <DashboardCharts loads={loads} fees={fees} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Load Activity</h3>
              <Link to="/loads" className="text-sm text-blue-600 hover:underline">View all loads</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loads.slice(0, 5).map(load => (
                    <tr key={load.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">#{load.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{load.customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          load.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {load.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">{formatCurrency(load.load_value || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Fleet Status</h3>
            <div className="space-y-4">
              {drivers.slice(0, 6).map(driver => (
                <div key={driver.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold mr-3">
                      {driver.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{driver.full_name}</p>
                      <p className="text-[10px] text-gray-500">{driver.status}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    driver.status === 'available' ? 'bg-green-500' : 'bg-amber-500'
                  )} />
                </div>
              ))}
            </div>
            <Link to="/drivers" className="block text-center mt-6 text-xs text-blue-600 font-medium hover:underline">
              Manage Fleet
            </Link>
          </section>

          <section className="bg-blue-600 p-6 rounded-xl shadow-lg text-white">
            <h3 className="text-sm font-bold mb-2 uppercase tracking-wider opacity-80">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/loads" className="bg-white/10 hover:bg-white/20 p-3 rounded-lg text-center transition-colors">
                <Truck className="h-5 w-5 mx-auto mb-1" />
                <span className="text-[10px] font-bold">New Load</span>
              </Link>
              <Link to="/drivers" className="bg-white/10 hover:bg-white/20 p-3 rounded-lg text-center transition-colors">
                <User className="h-5 w-5 mx-auto mb-1" />
                <span className="text-[10px] font-bold">Add Driver</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subValue, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={cn("p-2 rounded-lg", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{subValue}</p>
      </div>
    </motion.div>
  );
}
