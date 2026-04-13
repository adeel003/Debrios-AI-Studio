import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

type Notification = Database['public']['Tables']['notifications']['Row'];

export function useNotifications() {
  const { user, profile, appReady } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Use a unique ID for this hook instance to avoid channel name collisions
  const hookId = useState(() => Math.random().toString(36).substring(7))[0];

  const fetchNotifications = useCallback(async () => {
    if (!appReady || !user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read_at).length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, appReady]);

  useEffect(() => {
    if (!appReady || !user) return;
    
    fetchNotifications();

    const subscription = supabase
      .channel(`notifications-${user.id}-${hookId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, fetchNotifications, hookId, appReady]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const createNotification = async (userId: string, title: string, message: string, type: string) => {
    if (!profile?.tenant_id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          tenant_id: profile.tenant_id,
          user_id: userId,
          title,
          message,
          type
        }]);
      if (error) throw error;
    } catch (err) {
      console.error('Error creating notification:', err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    createNotification,
    refresh: fetchNotifications
  };
}
