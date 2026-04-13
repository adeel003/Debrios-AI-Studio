import React, { useEffect, useState } from 'react';
import { MapPin, Truck, Package, AlertCircle, Filter, Layers, Navigation, Plus, User as UserIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { LoadWithDetails } from '../../../types/load';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';

export function DispatcherMap() {
  const { profile } = useAuth();
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeLoads: 0,
    availableDrivers: 0,
    deployedDumpsters: 0,
    pendingPickups: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.tenant_id) return;
      try {
        setLoading(true);
        
        // Fetch active loads
        const { data: loadsData, error: loadsError } = await supabase
          .from('loads')
          .select(`
            *,
            customer:customers(*),
            driver:drivers(*)
          `)
          .eq('tenant_id', profile.tenant_id)
          .in('status', ['assigned', 'en_route', 'on_site', 'service_done', 'dumpyard_required']);
        
        if (loadsError) throw loadsError;
        setLoads(loadsData as any || []);

        // Fetch stats
        const [driversRes, dumpstersRes] = await Promise.all([
          supabase.from('drivers').select('id', { count: 'exact' }).eq('tenant_id', profile.tenant_id).eq('status', 'available'),
          supabase.from('dumpsters').select('id', { count: 'exact' }).eq('tenant_id', profile.tenant_id).eq('status', 'Assigned')
        ]);

        setStats({
          activeLoads: loadsData?.length || 0,
          availableDrivers: driversRes.count || 0,
          deployedDumpsters: dumpstersRes.count || 0,
          pendingPickups: loadsData?.filter(l => l.load_type === 'Pickup').length || 0
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time subscription
    const subscription = supabase
      .channel('dispatcher-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads', filter: `tenant_id=eq.${profile?.tenant_id}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.tenant_id]);

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatcher Dashboard</h1>
          <p className="text-gray-500 text-sm">Real-time fleet and operations overview.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Active Jobs" 
          value={stats.activeLoads} 
          icon={<Navigation className="w-4 h-4 text-blue-600" />} 
          color="blue" 
        />
        <StatCard 
          label="Available Drivers" 
          value={stats.availableDrivers} 
          icon={<Truck className="w-4 h-4 text-green-600" />} 
          color="green" 
        />
        <StatCard 
          label="Deployed Dumpsters" 
          value={stats.deployedDumpsters} 
          icon={<Package className="w-4 h-4 text-purple-600" />} 
          color="purple" 
        />
        <StatCard 
          label="Pending Pickups" 
          value={stats.pendingPickups} 
          icon={<AlertCircle className="w-4 h-4 text-orange-600" />} 
          color="orange" 
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden relative">
          {/* Mock Map Placeholder */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <MapPin className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Interactive Dispatcher Map</p>
            <p className="text-xs">Showing {loads.length} active units</p>
            
            {/* Mock Markers */}
            {loads.map((load, i) => (
              <div 
                key={load.id}
                className="absolute"
                style={{ 
                  top: `${30 + (i * 15) % 40}%`, 
                  left: `${20 + (i * 20) % 60}%` 
                }}
              >
                <div className="relative group">
                  <div className={cn(
                    "p-2 rounded-full shadow-lg cursor-pointer transition-transform hover:scale-110",
                    load.load_type === 'New Deployment' ? "bg-blue-600" : "bg-orange-600"
                  )}>
                    <Truck className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-white p-2 rounded-lg shadow-xl border border-gray-100 text-xs whitespace-nowrap">
                      <p className="font-bold">{load.customer.name}</p>
                      <p className="text-gray-500">{load.load_type}</p>
                      <p className="text-blue-600 font-medium">{load.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
            <button className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 text-gray-600">
              <Plus className="w-4 h-4" />
            </button>
            <button className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 text-gray-600">
              <div className="w-4 h-0.5 bg-gray-600 rounded-full" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Active Fleet</h3>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              {loads.length} Live
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : loads.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No active jobs at the moment.</p>
              </div>
            ) : (
              loads.map((load) => (
                <div key={load.id} className="p-3 bg-gray-50 rounded-xl border border-transparent hover:border-blue-200 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                      load.load_type === 'New Deployment' ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {load.load_type}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {format(new Date(load.updated_at), 'HH:mm')}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 truncate">{load.customer.name}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center text-xs text-gray-500">
                      <User className="w-3 h-3 mr-1" />
                      {load.driver?.full_name || 'Unassigned'}
                    </div>
                    <div className="text-[10px] font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-100">
                      {load.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600"
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={cn("p-2 rounded-lg", colors[color])}>
          {icon}
        </div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function User({ className }: { className?: string }) {
  return <Navigation className={className} />;
}
