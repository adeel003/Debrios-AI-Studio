import React, { useEffect, useState } from 'react';
import { Users, Phone, MapPin, Plus, AlertCircle, Mail, X, Link as LinkIcon, ChevronLeft, ChevronRight, Building2, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { handleError } from '../../../lib/error-handler';
import { ExportButton } from '../../../components/ExportButton';
import { customerService } from '../../../services/customer.service';
import { Customer, CustomerStatus } from '../../../types/customer';
import { ClientSite } from '../../../types/load';
import { supabase } from '../../../lib/supabase';

export function ClientDirectory() {
  const { profile, appReady } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Sites management
  const [isSitesModalOpen, setIsSitesModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSite, setNewSite] = useState({
    site_name: '',
    address: '',
    google_maps_link: '',
    notes: ''
  });

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address_line1: '',
    city: '',
    country: 'Saudi Arabia',
    google_maps_link: '',
    status: 'active' as CustomerStatus
  });

  const extractLatLng = (url: string) => {
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    const qRegex = /q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qMatch = url.match(qRegex);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }
    return null;
  };

  const fetchCustomers = async () => {
    if (!appReady || !profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, count } = await customerService.getTenantCustomers(profile.tenant_id, {
        page,
        pageSize
      });
      
      setTotalCount(count);
      setCustomers(data);
    } catch (err: any) {
      handleError(err, 'Customers:fetchCustomers');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_sites')
        .select('*')
        .eq('customer_id', customerId)
        .order('site_name');
      if (error) throw error;
      setSites(data || []);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenSites = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchSites(customer.id);
    setIsSitesModalOpen(true);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !selectedCustomer) return;

    try {
      const { error } = await supabase
        .from('client_sites')
        .insert([{
          ...newSite,
          customer_id: selectedCustomer.id,
          tenant_id: profile.tenant_id
        }]);
      if (error) throw error;
      toast.success('Site added successfully');
      setNewSite({ site_name: '', address: '', google_maps_link: '', notes: '' });
      setIsAddingSite(false);
      fetchSites(selectedCustomer.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return;
    try {
      const { error } = await supabase
        .from('client_sites')
        .delete()
        .eq('id', siteId);
      if (error) throw error;
      toast.success('Site deleted successfully');
      if (selectedCustomer) fetchSites(selectedCustomer.id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    
    fetchCustomers();

    const subscription = supabase
      .channel('customers-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customers',
        filter: `tenant_id=eq.${profile.tenant_id}`
      }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.tenant_id, page, appReady]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setNewCustomer({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address_line1: customer.address_line1 || '',
        city: customer.city || '',
        country: customer.country || 'Saudi Arabia',
        google_maps_link: '', // We don't store the original link, just coords
        status: customer.status
      });
    } else {
      setEditingCustomer(null);
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
        address_line1: '',
        city: '',
        country: 'Saudi Arabia',
        google_maps_link: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.tenant_id) {
      toast.error('No tenant is associated with the current user');
      return;
    }

    if (newCustomer.google_maps_link && !newCustomer.google_maps_link.includes('google.com/maps')) {
      toast.error('Please enter a valid Google Maps URL');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(editingCustomer ? 'Updating customer...' : 'Creating customer...');

    try {
      const coords = newCustomer.google_maps_link ? extractLatLng(newCustomer.google_maps_link) : null;

      const customerData: Partial<Customer> = {
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        address_line1: newCustomer.address_line1,
        city: newCustomer.city,
        country: newCustomer.country,
        status: newCustomer.status,
        tenant_id: profile.tenant_id
      };

      if (coords) {
        customerData.lat = coords.lat;
        customerData.lng = coords.lng;
      }

      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.id, customerData);
        toast.success('Customer updated successfully', { id: toastId });
      } else {
        await customerService.createCustomer(customerData);
        toast.success('Customer added successfully', { id: toastId });
      }

      setIsModalOpen(false);
      setEditingCustomer(null);
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
        address_line1: '',
        city: '',
        country: 'Saudi Arabia',
        google_maps_link: '',
        status: 'active'
      });
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${editingCustomer ? 'update' : 'add'} customer`, { id: toastId });
      handleError(err, editingCustomer ? 'handleUpdateCustomer' : 'handleCreateCustomer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers Management</h1>
            <p className="text-gray-500">Manage your client database and locations.</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton data={customers} filename="customers_export" />
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </button>
          </div>
        </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center max-w-sm mx-auto">
                      <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">No customers yet</h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Start by adding your first customer to manage their loads and locations.
                      </p>
                      <button 
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Customer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4 font-medium text-gray-900">{customer.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <Phone className="h-3 w-3 mr-2 text-gray-400" />
                        {customer.phone || 'No phone'}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Mail className="h-3 w-3 mr-2 text-gray-400" />
                        {customer.email || 'No email'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center">
                        <MapPin className="h-3 w-3 mr-2 text-gray-400" />
                        {customer.address_line1 || 'No address'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 ml-5">
                        {customer.city}, {customer.country}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                        customer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button 
                          onClick={() => handleOpenSites(customer)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Building2 className="w-4 h-4 mr-1" />
                          Sites
                        </button>
                        <button 
                          onClick={() => handleOpenModal(customer)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{page * pageSize + 1}</span> to{' '}
            <span className="font-medium">{Math.min((page + 1) * pageSize, totalCount)}</span> of{' '}
            <span className="font-medium">{totalCount}</span> results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Sites Modal */}
      {isSitesModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage Sites</h2>
                <p className="text-sm text-gray-500">{selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsSitesModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {isAddingSite ? (
                <form onSubmit={handleCreateSite} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                  <h3 className="font-bold text-gray-900 text-sm">Add New Site</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Site Name *</label>
                      <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={newSite.site_name}
                        onChange={(e) => setNewSite({ ...newSite, site_name: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Address *</label>
                      <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={newSite.address}
                        onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Google Maps Link</label>
                      <input
                        type="url"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={newSite.google_maps_link}
                        onChange={(e) => setNewSite({ ...newSite, google_maps_link: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSite(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      Save Site
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingSite(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Site
                </button>
              )}

              <div className="space-y-4">
                {sites.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 italic">No sites added yet.</p>
                ) : (
                  sites.map((site) => (
                    <div key={site.id} className="p-4 border border-gray-100 rounded-xl hover:border-blue-100 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{site.site_name}</h4>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {site.address}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {site.google_maps_link && (
                            <a
                              href={site.google_maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-blue-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteSite(site.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Acme Corp"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 (555) 000-0000"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contact@company.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123 Logistics Way"
                    value={newCustomer.address_line1}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address_line1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="New York"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="USA"
                    value={newCustomer.country}
                    onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="url"
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://www.google.com/maps/..."
                      value={newCustomer.google_maps_link}
                      onChange={(e) => setNewCustomer({ ...newCustomer, google_maps_link: e.target.value })}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">Coordinates will be extracted automatically if possible.</p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (editingCustomer ? 'Updating...' : 'Creating...') : (editingCustomer ? 'Update Customer' : 'Create Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
