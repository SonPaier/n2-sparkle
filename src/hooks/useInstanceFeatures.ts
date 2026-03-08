import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInstanceFeature(instanceId: string | null, featureKey: string) {
  const queryClient = useQueryClient();

  const { data: enabled = true, isLoading: loading } = useQuery({
    queryKey: ['instance_feature', instanceId, featureKey],
    queryFn: async () => {
      if (!instanceId) return true;
      const { data, error } = await supabase
        .from('instance_features')
        .select('enabled')
        .eq('instance_id', instanceId)
        .eq('feature_key', featureKey)
        .maybeSingle();

      if (!error && data) return data.enabled;
      return true; // no row = enabled by default
    },
    enabled: !!instanceId,
    staleTime: 30_000,
  });

  const toggle = useCallback(async (value: boolean) => {
    if (!instanceId) return;
    // Optimistic update
    queryClient.setQueryData(['instance_feature', instanceId, featureKey], value);

    const { error } = await supabase
      .from('instance_features')
      .upsert(
        { instance_id: instanceId, feature_key: featureKey, enabled: value, updated_at: new Date().toISOString() },
        { onConflict: 'instance_id,feature_key' }
      );
    if (error) {
      console.error('Error toggling feature:', error);
      queryClient.setQueryData(['instance_feature', instanceId, featureKey], !value); // rollback
    }
  }, [instanceId, featureKey, queryClient]);

  return { enabled, loading, toggle };
}
