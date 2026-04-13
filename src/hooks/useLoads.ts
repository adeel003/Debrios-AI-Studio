import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadService } from '../services/load.service';
import { LoadWithDetails, LoadStatus } from '../types/load';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handler';

interface LoadFilters {
  status?: string;
  driverId?: string;
  search?: string;
  sortBy?: 'created_at' | 'load_value';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function useLoads(filters: LoadFilters = {}) {
  const { profile, appReady } = useAuth();
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoads = useCallback(async () => {
    if (!appReady || !profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, count } = await loadService.getLoadsByTenant(profile.tenant_id, {
        status: filters.status,
        driverId: filters.driverId,
        search: filters.search,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        pageSize: filters.pageSize
      });

      setLoads(data);
      setTotalCount(count || 0);
    } catch (err: any) {
      handleError(err, 'useLoads:fetchLoads');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    filters.status, 
    filters.driverId, 
    filters.search, 
    filters.sortBy, 
    filters.sortOrder, 
    filters.page, 
    filters.pageSize, 
    profile?.tenant_id, 
    appReady
  ]);

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    
    fetchLoads();

    const subscription = supabase
      .channel('loads-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'loads',
        filter: `tenant_id=eq.${profile.tenant_id}`
      }, () => {
        fetchLoads();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchLoads, appReady, profile?.tenant_id]);

  const createLoad = async (loadData: any) => {
    if (!profile?.tenant_id) throw new Error('No tenant associated');
    return await loadService.createLoad({
      ...loadData,
      tenant_id: profile.tenant_id
    });
  };

  const updateLoadStatus = async (id: string, status: LoadStatus) => {
    return await loadService.updateLoadStatus(id, status);
  };

  const assignDriver = async (id: string, driverId: string) => {
    return await loadService.assignDriver(id, driverId);
  };

  return {
    loads,
    totalCount,
    loading,
    error,
    createLoad,
    updateLoadStatus,
    assignDriver,
    refresh: fetchLoads
  };
}

export function useLoad(id: string | undefined) {
  const { appReady } = useAuth();
  const [load, setLoad] = useState<LoadWithDetails | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoadDetails = useCallback(async () => {
    if (!appReady || !id || id === 'undefined') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await loadService.getLoadById(id);
      
      // Fetch events separately if needed, or include in getLoadById
      const { data: eventsData } = await supabase
        .from('load_events')
        .select('*')
        .eq('load_id', id)
        .order('created_at', { ascending: false });

      setLoad(data);
      setEvents(eventsData || []);
    } catch (err: any) {
      handleError(err, 'useLoad:fetchLoadDetails');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, appReady]);

  useEffect(() => {
    if (!appReady || !id || id === 'undefined') return;
    
    fetchLoadDetails();

    const subscription = supabase
      .channel(`load-${id}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads', filter: `id=eq.${id}` }, () => {
        fetchLoadDetails();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'load_events', filter: `load_id=eq.${id}` }, () => {
        fetchLoadDetails();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchLoadDetails, id, appReady]);

  const updateLoadStatus = async (status: LoadStatus) => {
    if (!id) return;
    return await loadService.updateLoadStatus(id, status);
  };

  const assignDriver = async (driverId: string) => {
    if (!id) return;
    return await loadService.assignDriver(id, driverId);
  };

  return { load, events, loading, error, updateLoadStatus, assignDriver, refresh: fetchLoadDetails };
}
