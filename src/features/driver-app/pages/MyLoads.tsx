import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, ChevronRight, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useDriver } from '../../../hooks/useDriver';
import { cn, formatCurrency } from '../../../lib/utils';
import { format } from 'date-fns';

const statusColors = {
  assigned: 'bg-purple-100 text-purple-800',
  en_route: 'bg-yellow-100 text-yellow-800',
  on_site: 'bg-orange-100 text-orange-800',
  service_done: 'bg-indigo-100 text-indigo-800',
  dumpyard_required: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
};

const statusIcons = {
  assigned: <Clock className="h-4 w-4" />,
  en_route: <Truck className="h-4 w-4" />,
  on_site: <MapPin className="h-4 w-4" />,
  service_done: <CheckCircle2 className="h-4 w-4" />,
  dumpyard_required: <Truck className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
};

export function MyLoads() {
  const navigate = useNavigate();
  const { loads, loading, error, driver } = useDriver();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">No Driver Profile</h2>
        <p className="text-gray-500 mt-2">You don't have a driver profile associated with your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Loads</h1>
        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase">
          {loads.length} Active
        </div>
      </div>

      <div className="space-y-4">
        {loads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No loads assigned to you yet.</p>
          </div>
        ) : (
          loads.map((load) => (
            <button
              key={load.id}
              onClick={() => navigate(`/driver/loads/${load.id}`)}
              className="w-full text-left bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-bold capitalize flex items-center space-x-1",
                      statusColors[load.status as keyof typeof statusColors]
                    )}>
                      {statusIcons[load.status as keyof typeof statusIcons]}
                      <span>{load.status.replace('_', ' ')}</span>
                    </span>
                    <span className="text-xs text-gray-400 font-mono">#{load.id.slice(0, 8)}</span>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {load.customer.name}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      {load.customer.city}, {load.customer.country}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Assigned {format(new Date(load.created_at), 'MMM d, HH:mm')}
                </div>
                <div className="font-bold text-gray-900">
                  {load.load_value ? formatCurrency(load.load_value, load.currency) : 'N/A'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
