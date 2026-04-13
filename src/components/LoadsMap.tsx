import React, { useMemo } from 'react';
import { MapPin, Truck, Navigation } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoadsMapProps {
  loads: any[];
  customers: any[];
}

export function LoadsMap({ loads, customers }: LoadsMapProps) {
  // Filter customers with valid lat/lng, or provide fallback
  const activeCustomers = useMemo(() => {
    return customers.map(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      
      // If invalid, use a default (e.g., center of USA) but mark as invalid
      const isValid = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      
      return {
        ...c,
        lat: isValid ? lat : 39.8283, // Center of USA
        lng: isValid ? lng : -98.5795,
        isFallback: !isValid
      };
    });
  }, [customers]);

  // Calculate bounds for scaling
  const bounds = useMemo(() => {
    if (activeCustomers.length === 0) return { minLat: 24, maxLat: 49, minLng: -125, maxLng: -66 }; // USA bounds
    
    let minLat = activeCustomers[0].lat;
    let maxLat = activeCustomers[0].lat;
    let minLng = activeCustomers[0].lng;
    let maxLng = activeCustomers[0].lng;

    activeCustomers.forEach(c => {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    });

    // Add some padding
    const latPadding = Math.max((maxLat - minLat) * 0.2, 2);
    const lngPadding = Math.max((maxLng - minLng) * 0.2, 2);

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding
    };
  }, [activeCustomers]);

  const getXY = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const y = 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    return { x: `${x}%`, y: `${y}%` };
  };

  return (
    <div className="relative w-full h-[600px] bg-slate-50 rounded-xl border border-gray-200 overflow-hidden shadow-inner">
      {/* Grid Lines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-gray-200 shadow-sm z-10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Active Load</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <span>Customer Location</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
          <span>Missing Coordinates</span>
        </div>
      </div>

      {/* Customers */}
      {activeCustomers.map(customer => {
        const { x, y } = getXY(customer.lat, customer.lng);
        const hasActiveLoad = loads.some(l => l.customer_id === customer.id && l.status === 'in_progress');
        
        return (
          <div 
            key={customer.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
            style={{ left: x, top: y }}
          >
            <div className={cn(
              "p-1.5 rounded-full transition-all duration-300 shadow-sm",
              hasActiveLoad ? "bg-blue-600 scale-125 z-30" : 
              customer.isFallback ? "bg-amber-400 scale-90 opacity-50" : "bg-gray-400 scale-100 opacity-60 hover:opacity-100"
            )}>
              {hasActiveLoad ? (
                <Truck size={12} className="text-white" />
              ) : (
                <MapPin size={10} className="text-white" />
              )}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
              <div className="bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap shadow-xl">
                <p className="font-bold">{customer.name}</p>
                <p className="opacity-70">{customer.city}</p>
                {customer.isFallback && <p className="text-amber-400 mt-0.5 italic">Location Estimated (No Lat/Lng)</p>}
                {hasActiveLoad && <p className="text-blue-400 font-bold mt-0.5">Active Load In-Progress</p>}
              </div>
              <div className="w-2 h-2 bg-gray-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {activeCustomers.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <Navigation size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">No customer coordinates available for map view.</p>
          <p className="text-xs">Add lat/lng to customers to see them on the map.</p>
        </div>
      )}
    </div>
  );
}
