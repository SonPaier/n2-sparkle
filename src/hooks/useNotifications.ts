import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Notification {
  id: string;
  instance_id: string;
  user_id: string;
  type: string;
  title: string;
  description: string | null;
  calendar_item_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications(instanceId: string | null) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user || !instanceId) { setNotifications([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as unknown as Notification[]);
    }
    setLoading(false);
  }, [user, instanceId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime subscription
  const channelIdRef = useRef(`notifications-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!user || !instanceId) return;

    const channel = supabase
      .channel(channelIdRef.current)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, instanceId, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true } as any).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!user || !instanceId) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true } as any).eq('user_id', user.id).eq('instance_id', instanceId);
  };

  const deleteAll = async () => {
    if (!user || !instanceId) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user.id).eq('instance_id', instanceId);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteAll, refetch: fetchNotifications };
}

// Helper to insert a notification
export async function createNotification(params: {
  instanceId: string;
  userId: string;
  type: string;
  title: string;
  description?: string;
  calendarItemId?: string | null;
}) {
  await supabase.from('notifications').insert({
    instance_id: params.instanceId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    description: params.description || null,
    calendar_item_id: params.calendarItemId || null,
  } as any);
}
