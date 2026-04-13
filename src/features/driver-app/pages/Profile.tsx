import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useDriver } from '../../../hooks/useDriver';
import { User, LogOut, Award, Phone, Shield, Calendar, CreditCard, MapPin } from 'lucide-react';
import { format, isPast, addDays } from 'date-fns';
import { cn } from '../../../lib/utils';

function ComplianceItem({ icon: Icon, label, date, value }: { icon: any; label: string; date: string | null; value?: string | null }) {
  const expiryDate = date ? new Date(date) : null;
  const expired = expiryDate ? isPast(expiryDate) : false;
  const nearExpiry = expiryDate ? isPast(addDays(expiryDate, -30)) : false;

  return (
    <div className="flex items-start p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className={cn(
        "p-2 rounded-lg mr-3",
        expired ? "bg-red-100 text-red-600" : nearExpiry ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="flex flex-col">
          {value && <p className="font-medium text-gray-900 truncate">{value}</p>}
          <p className={cn(
            "text-sm font-medium",
            expired ? "text-red-600" : nearExpiry ? "text-amber-600" : "text-gray-500"
          )}>
            {expiryDate ? `Expires: ${format(expiryDate, 'MMM dd, yyyy')}` : 'Expiry: Not Set'}
            {expired && <span className="ml-2 text-[10px] font-bold uppercase tracking-tight bg-red-600 text-white px-1.5 py-0.5 rounded">Expired</span>}
            {!expired && nearExpiry && <span className="ml-2 text-[10px] font-bold uppercase tracking-tight bg-amber-500 text-white px-1.5 py-0.5 rounded">Expiring Soon</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DriverProfile() {
  const { user, signOut } = useAuth();
  const { driver, loading } = useDriver();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">No Driver Profile</h2>
        <p className="text-gray-500 mt-2">You don't have a driver profile associated with your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-blue-50 overflow-hidden border-2 border-white shadow-inner">
            {driver.driver_picture_url ? (
              <img 
                src={driver.driver_picture_url} 
                alt={driver.full_name} 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="h-12 w-12 text-blue-600" />
            )}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-gray-900">{driver.full_name}</h2>
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {driver.employee_id}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">{user?.email}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Phone className="h-5 w-5 text-gray-400 mr-3" />
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="font-medium text-gray-900">{driver.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Shield className="h-5 w-5 text-gray-400 mr-3" />
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</p>
                <p className="font-medium text-gray-900 capitalize">{driver.status.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 w-full text-left">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
              <Award className="h-4 w-4 mr-2 text-blue-600" />
              Compliance & Documents
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ComplianceItem 
                icon={CreditCard} 
                label="Iqama" 
                value={driver.iqama_number} 
                date={driver.iqama_expiry} 
              />
              <ComplianceItem 
                icon={Award} 
                label="Driver License" 
                value={driver.license_number} 
                date={driver.driver_license_expiry} 
              />
              <ComplianceItem 
                icon={MapPin} 
                label="Route Permit" 
                date={driver.route_permit_expiry} 
              />
              <ComplianceItem 
                icon={Calendar} 
                label="Driver Card" 
                date={driver.driver_card_expiry} 
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut()}
        className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center border border-red-100"
      >
        <LogOut className="mr-2 h-5 w-5" />
        Sign Out
      </button>
    </div>
  );
}
