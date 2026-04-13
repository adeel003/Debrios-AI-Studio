import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Truck, 
  User, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  XCircle,
  Navigation,
  ExternalLink
} from 'lucide-react';
import { useLoad } from '../../../hooks/useLoads';
import { useDriver } from '../../../hooks/useDriver';
import { cn, formatCurrency } from '../../../lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const statusColors = {
  assigned: 'bg-purple-100 text-purple-800',
  en_route: 'bg-yellow-100 text-yellow-800',
  on_site: 'bg-orange-100 text-orange-800',
  service_done: 'bg-indigo-100 text-indigo-800',
  dumpyard_required: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function DriverLoadDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { load, loading, error, refresh } = useLoad(id);
  const { updateStatus } = useDriver();
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary',
  });

  const handleStatusUpdate = (status: any) => {
    const statusMessages = {
      en_route: 'Are you sure you want to start this job? This will mark the load as en-route.',
      on_site: 'Mark this load as arrived on site?',
      service_done: 'Mark the service as completed on site?',
      dumpyard_required: 'Does this load require a dumpyard visit?',
      completed: 'Are you sure you want to complete this job? This will finalize the delivery.',
    };

    setConfirmConfig({
      isOpen: true,
      title: `Update Status to ${status.replace('_', ' ')}?`,
      message: statusMessages[status as keyof typeof statusMessages] || 'Confirm status update.',
      variant: status === 'completed' ? 'primary' : 'warning',
      onConfirm: async () => {
        const toastId = toast.loading('Updating status...');
        try {
          await updateStatus(id!, status);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          toast.success('Status updated successfully', { id: toastId });
          refresh();
        } catch (err: any) {
          toast.error(err.message, { id: toastId });
        }
      }
    });
  };

  const openMaps = () => {
    if (load?.google_maps_link) {
      window.open(load.google_maps_link, '_blank');
      return;
    }
    if (!load?.customer) return;
    const { address_line1, city, country, lat, lng } = load.customer;
    const query = lat && lng ? `${lat},${lng}` : `${address_line1}, ${city}, ${country}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !load) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Load not found</h2>
        <p className="text-gray-500 mt-2">{error || 'The requested load could not be found.'}</p>
        <button
          onClick={() => navigate('/driver')}
          className="mt-6 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Loads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/driver')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>
        <span className={cn(
          "px-3 py-1 rounded-full text-sm font-bold capitalize",
          statusColors[load.status as keyof typeof statusColors]
        )}>
          {load.status.replace('_', ' ')}
        </span>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{load.customer.name}</h2>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-500">#{load.id.slice(0, 8)}</p>
                  <span className="text-gray-300">•</span>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(load.load_value || 0, load.currency)}</p>
                </div>
              </div>
            </div>
            <a 
              href={`tel:${load.customer.phone}`}
              className="p-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-colors"
            >
              <Phone size={24} />
            </a>
          </div>

          <div className="space-y-4">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-gray-900">{load.customer.address_line1}</p>
                <p className="text-sm text-gray-500">{load.customer.city}, {load.customer.country}</p>
              </div>
              <button 
                onClick={openMaps}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Navigation size={20} />
              </button>
            </div>
            
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-5 w-5 text-gray-400 mr-3" />
              Assigned {format(new Date(load.created_at), 'MMM d, HH:mm')}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        {load.status === 'assigned' && (
          <button
            onClick={() => handleStatusUpdate('en_route')}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            <Truck className="mr-2 h-6 w-6" />
            Start Job (En Route)
          </button>
        )}

        {load.status === 'en_route' && (
          <button
            onClick={() => handleStatusUpdate('on_site')}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            <MapPin className="mr-2 h-6 w-6" />
            Arrived On Site
          </button>
        )}

        {load.status === 'on_site' && (
          <button
            onClick={() => handleStatusUpdate('service_done')}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            <CheckCircle2 className="mr-2 h-6 w-6" />
            Service Done
          </button>
        )}

        {load.status === 'service_done' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleStatusUpdate('dumpyard_required')}
              className="py-5 bg-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-amber-600 transition-all active:scale-[0.98] flex items-center justify-center"
            >
              To Dumpyard
            </button>
            <button
              onClick={() => handleStatusUpdate('completed')}
              className="py-5 bg-green-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700 transition-all active:scale-[0.98] flex items-center justify-center"
            >
              Complete
            </button>
          </div>
        )}

        {load.status === 'dumpyard_required' && (
          <button
            onClick={() => handleStatusUpdate('completed')}
            className="w-full py-5 bg-green-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-green-700 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            <CheckCircle2 className="mr-2 h-6 w-6" />
            Finish Job
          </button>
        )}

        {load.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 p-6 rounded-2xl flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mb-2" />
            <h3 className="text-lg font-bold text-green-900">Job Completed</h3>
            <p className="text-sm text-green-700">This load has been successfully delivered.</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
      />
    </div>
  );
}
