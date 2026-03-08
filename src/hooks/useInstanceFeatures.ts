import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const featureCache = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function getCacheKey(instanceId: string, featureKey: string) {
  return `${instanceId}:${featureKey}`;
}

function notifyListeners(key: string) {
  listeners.get(key)?.forEach(fn => fn());
}

export function useInstanceFeature(instanceId: string | null, featureKey: string) {
  const cacheKey = instanceId ? getCacheKey(instanceId, featureKey) : '';
  const [enabled, setEnabled] = useState(() => featureCache.get(cacheKey) ?? true);
  const [loading, setLoading] = useState(!featureCache.has(cacheKey));

  useEffect(() => {
    if (!instanceId) return;
    const key = getCacheKey(instanceId, featureKey);

    // Subscribe to changes from other hook instances
    if (!listeners.has(key)) listeners.set(key, new Set());
    const update = () => setEnabled(featureCache.get(key) ?? true);
    listeners.get(key)!.add(update);

    // Fetch if not cached
    if (!featureCache.has(key)) {
      setLoading(true);
      supabase
        .from('instance_features')
        .select('enabled')
        .eq('instance_id', instanceId)
        .eq('feature_key', featureKey)
        .maybeSingle()
        .then(({ data, error }) => {
          const val = !error && data ? data.enabled : true;
          featureCache.set(key, val);
          notifyListeners(key);
          setLoading(false);
        });
    } else {
      setEnabled(featureCache.get(key) ?? true);
      setLoading(false);
    }

    return () => { listeners.get(key)?.delete(update); };
  }, [instanceId, featureKey]);

  const toggle = useCallback(async (value: boolean) => {
    if (!instanceId) return;
    const key = getCacheKey(instanceId, featureKey);
    featureCache.set(key, value);
    notifyListeners(key);

    const { error } = await supabase
      .from('instance_features')
      .upsert(
        { instance_id: instanceId, feature_key: featureKey, enabled: value, updated_at: new Date().toISOString() },
        { onConflict: 'instance_id,feature_key' }
      );
    if (error) {
      console.error('Error toggling feature:', error);
      featureCache.set(key, !value);
      notifyListeners(key);
    }
  }, [instanceId, featureKey]);

  return { enabled, loading, toggle };
}
