import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { InvoicingSettings, InvoicingProvider, ProviderConfig, DocumentKind } from './invoicing.types';

export function useInvoicingSettings(instanceId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['invoicing_settings', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoicing_settings')
        .select('*')
        .eq('instance_id', instanceId!)
        .maybeSingle();
      if (error) throw error;
      return data as InvoicingSettings | null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (settings: Partial<InvoicingSettings>) => {
      const payload = {
        instance_id: instanceId!,
        ...settings,
      };
      const { error } = await supabase
        .from('invoicing_settings')
        .upsert(payload as any, { onConflict: 'instance_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicing_settings', instanceId] });
      toast.success('Ustawienia zapisane');
    },
    onError: (err: any) => {
      console.error('Error saving invoicing settings:', err);
      toast.error('Błąd zapisu ustawień');
    },
  });

  const saveSettings = (settings: Partial<InvoicingSettings>) => {
    if (!instanceId) return;
    upsertMutation.mutate(settings);
  };

  const activateProvider = (provider: InvoicingProvider, config: ProviderConfig) => {
    saveSettings({
      provider,
      provider_config: config as any,
      active: true,
    });
  };

  const deactivateProvider = () => {
    saveSettings({
      provider: null,
      provider_config: {} as any,
      active: false,
    });
  };

  return {
    settings: query.data,
    isLoading: query.isLoading,
    saveSettings,
    activateProvider,
    deactivateProvider,
    isSaving: upsertMutation.isPending,
  };
}
