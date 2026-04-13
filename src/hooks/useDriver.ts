import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { driverService } from '../services/driver.service';
import { loadService } from '../services/load.service';
import { Driver } from '../types/driver';
import { LoadWithDetails, LoadStatus } from '../types/load';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handler';

export function useDriver() {
  const { user, appReady } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDriverData = useCallback(async () => {
    if (!appReady || !user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      const driverData = await driverService.getDriverProfile(user.id);
      if (!driverData) {
        setLoading(false);
        return;
      }
      setDriver(driverData);

      const { data } = await loadService.getLoadsByTenant(driverData.tenant_id, {
        driverId: driverData.id
      });
      setLoads(data);
    } catch (err: any) {
      handleError(err, 'useDriver:fetchDriverData');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, appReady]);

  useEffect(() => {
    if (!appReady || !user) return;
    
    fetchDriverData();

    if (driver) {
      const subscription = supabase
        .channel(`driver-loads-${driver.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'loads', 
          filter: `driver_id=eq.${driver.id}` 
        }, () => {
          fetchDriverData();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [fetchDriverData, driver?.id, appReady, user]);

  const updateStatus = async (loadId: string, status: LoadStatus) => {
    return await loadService.updateLoadStatus(loadId, status);
  };

  return {
    driver,
    loads,
    loading,
    error,
    updateStatus,
    refresh: fetchDriverData
  };
}
