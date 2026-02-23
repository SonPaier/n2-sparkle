import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Invoice } from './invoicing.types';

export function useInvoices(instanceId: string | null, calendarItemId?: string) {
  return useQuery({
    queryKey: ['invoices', instanceId, calendarItemId],
    enabled: !!instanceId,
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('instance_id', instanceId!)
        .order('created_at', { ascending: false });

      if (calendarItemId) {
        query = query.eq('calendar_item_id', calendarItemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Invoice[];
    },
  });
}
