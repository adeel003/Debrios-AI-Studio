import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency } from '../lib/utils';

interface DashboardChartsProps {
  loads: any[];
  fees: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardCharts({ loads, fees }: DashboardChartsProps) {
  // 1. Revenue by Day (Last 7 days)
  const revenueData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayLoads = loads.filter(l => l.status === 'completed' && l.completed_at?.startsWith(date));
      const revenue = dayLoads.reduce((acc, l) => acc + (l.load_value || 0), 0);
      return {
        date: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }),
        revenue
      };
    });
  }, [loads]);

  // 2. Loads by Status
  const statusData = React.useMemo(() => {
    const statuses = ['scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled'];
    return statuses.map(status => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: loads.filter(l => l.status === status).length
    }));
  }, [loads]);

  // 3. Driver Performance (Loads completed)
  const driverPerformance = React.useMemo(() => {
    const driversMap: Record<string, { name: string, completed: number }> = {};
    loads.filter(l => l.status === 'completed' && l.driver).forEach(l => {
      const driverId = l.driver_id;
      if (!driversMap[driverId]) {
        driversMap[driverId] = { name: l.driver.full_name, completed: 0 };
      }
      driversMap[driverId].completed += 1;
    });
    return Object.values(driversMap).sort((a, b) => b.completed - a.completed).slice(0, 5);
  }, [loads]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[350px]">
        <h3 className="text-sm font-bold text-gray-900 mb-6">Revenue Trend (Last 7 Days)</h3>
        <div className="h-64 w-full relative">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(value) => `⃁${value}`}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[350px]">
        <h3 className="text-sm font-bold text-gray-900 mb-6">Load Status Distribution</h3>
        <div className="h-64 w-full relative flex items-center">
          <div className="absolute inset-0 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          </div>
          <div className="space-y-2 pr-4 relative z-10">
            {statusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-gray-500 mr-2">{entry.name}:</span>
                <span className="font-bold text-gray-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver Performance */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 min-h-[350px]">
        <h3 className="text-sm font-bold text-gray-900 mb-6">Top Driver Performance (Completed Loads)</h3>
        <div className="h-64 w-full relative">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={driverPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 500 }}
                width={120}
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey="completed" 
                fill="#3b82f6" 
                radius={[0, 4, 4, 0]} 
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
