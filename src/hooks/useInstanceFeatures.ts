import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useInstanceFeature(instanceId: string | null, featureKey: string) {
  const [enabled, setEnabled] = useState(true); // default: enabled
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!instanceId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('instance_features')
      .select('enabled')
      .eq('instance_id', instanceId)
      .eq('feature_key', featureKey)
      .maybeSingle();

    if (!error && data) {
      setEnabled(data.enabled);
    } else {
      setEnabled(true); // no row = enabled by default
    }
    setLoading(false);
  }, [instanceId, featureKey]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = useCallback(async (value: boolean) => {
    if (!instanceId) return;
    setEnabled(value);
    const { error } = await supabase
      .from('instance_features')
      .upsert(
        { instance_id: instanceId, feature_key: featureKey, enabled: value, updated_at: new Date().toISOString() },
        { onConflict: 'instance_id,feature_key' }
      );
    if (error) {
      console.error('Error toggling feature:', error);
      setEnabled(!value); // rollback
    }
  }, [instanceId, featureKey]);

  return { enabled, loading, toggle };
}
