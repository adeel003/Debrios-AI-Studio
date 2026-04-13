import React, { useEffect, useState, useCallback } from 'react';
import { History, Clock, AlertCircle, Info, Tag, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { auditService } from '../../../services/audit.service';
import { handleError } from '../../../lib/error-handler';

const PAGE_SIZE = 20;

export function AuditLogs() {
  const { profile, appReady } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    actor_id: '',
    search: '',
    date: '',
  });

  const [actors, setActors] = useState<{id: string, full_name: string}[]>([]);

  const fetchActors = async () => {
    if (!appReady || !profile?.tenant_id) return;
    try {
      const data = await auditService.getTenantActors(profile.tenant_id);
      setActors(data);
    } catch (err: any) {
      handleError(err, 'AuditLogs:fetchActors');
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!appReady || !profile?.tenant_id) return;
    try {
      setLoading(true);
      const { data, count } = await auditService.getTenantLogs(profile.tenant_id, {
        page,
        pageSize: PAGE_SIZE,
        action: filters.action,
        entityType: filters.entity_type,
        actorId: filters.actor_id,
        date: filters.date
      });
      
      setLogs(data);
      setTotalCount(count);
    } catch (err: any) {
      handleError(err, 'AuditLogs:fetchLogs');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, page, filters, appReady]);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchLogs();
  }, [fetchLogs, profile?.tenant_id, appReady]);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchActors();
  }, [profile?.tenant_id, appReady]);

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
    login: 'bg-purple-100 text-purple-800',
  };

  if (loading && logs.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500">Timeline of all system actions and changes.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Action</label>
          <select
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={filters.action}
            onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }}
          >
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Entity Type</label>
          <select
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={filters.entity_type}
            onChange={(e) => { setFilters({ ...filters, entity_type: e.target.value }); setPage(0); }}
          >
            <option value="">All Entities</option>
            <option value="load">Load</option>
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
            <option value="tenant">Organization</option>
            <option value="profile">User</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">User</label>
          <select
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={filters.actor_id}
            onChange={(e) => { setFilters({ ...filters, actor_id: e.target.value }); setPage(0); }}
          >
            <option value="">All Users</option>
            {actors.map(actor => (
              <option key={actor.id} value={actor.id}>{actor.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
          <input
            type="date"
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={filters.date}
            onChange={(e) => { setFilters({ ...filters, date: e.target.value }); setPage(0); }}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setFilters({ action: '', entity_type: '', actor_id: '', search: '', date: '' }); setPage(0); }}
            className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset Filters
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {log.actor?.full_name || 'System'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                      actionColors[log.action] || 'bg-gray-100 text-gray-800'
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Tag className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="capitalize">{log.entity_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {log.action === 'update' ? (
                      <span>Modified {Object.keys(log.new_data as any || {}).join(', ')}</span>
                    ) : (
                      <span>{log.action}d {log.entity_type}</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Info className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No logs found matching your criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{page * PAGE_SIZE + 1}</span> to{' '}
            <span className="font-medium">{Math.min((page + 1) * PAGE_SIZE, totalCount)}</span> of{' '}
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
              disabled={(page + 1) * PAGE_SIZE >= totalCount}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
