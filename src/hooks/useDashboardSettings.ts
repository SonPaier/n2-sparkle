import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardSettings {
  viewMode: 'day' | 'week';
  visibleSections: {
    orders: boolean;
    reminders: boolean;
    payments: boolean;
  };
}

const DEFAULT_SETTINGS: DashboardSettings = {
  viewMode: 'day',
  visibleSections: { orders: true, reminders: true, payments: true },
};

export function useDashboardSettings(instanceId: string | null) {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instanceId) { setLoading(false); return; }

    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('dashboard_user_settings' as any)
        .select('view_mode, visible_sections')
        .eq('user_id', user.id)
        .eq('instance_id', instanceId)
        .maybeSingle();

      if (data) {
        setSettings({
          viewMode: (data as any).view_mode || 'day',
          visibleSections: {
            orders: true,
            reminders: true,
            payments: true,
            ...((data as any).visible_sections || {}),
          },
        });
      }
      setLoading(false);
    };
    fetch();
  }, [instanceId]);

  const save = useCallback(async (newSettings: DashboardSettings) => {
    if (!instanceId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      instance_id: instanceId,
      view_mode: newSettings.viewMode,
      visible_sections: newSettings.visibleSections,
    };

    // Upsert using on conflict
    const { error } = await (supabase.from('dashboard_user_settings' as any) as any)
      .upsert(payload, { onConflict: 'user_id,instance_id' });

    if (!error) {
      setSettings(newSettings);
    }
    return error;
  }, [instanceId]);

  return { settings, loading, save };
}
