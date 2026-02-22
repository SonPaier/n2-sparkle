import { useState, useEffect } from 'react';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AssignedCustomer {
  customer_name: string;
  customer_phone: string;
  service_type: string;
  scheduled_date: string;
  status: string;
}

interface TemplateAssignedCustomersProps {
  templateId: string | null;
  instanceId: string | null;
}

/**
 * Displays a list of customers assigned to an SMS notification template.
 * Fetches unique customers from customer_sms_notifications table.
 */
export const TemplateAssignedCustomers = ({ templateId, instanceId }: TemplateAssignedCustomersProps) => {
  const [customers, setCustomers] = useState<AssignedCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (templateId && instanceId) {
      fetchAssignedCustomers();
    } else {
      setLoading(false);
    }
  }, [templateId, instanceId]);

  const fetchAssignedCustomers = async () => {
    if (!templateId || !instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('customer_sms_notifications') as any)
        .select('customer_name, customer_phone, service_type, scheduled_date, status')
        .eq('notification_template_id', templateId)
        .eq('instance_id', instanceId)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;

      // Deduplicate by phone
      const uniqueMap = new Map<string, AssignedCustomer>();
      (data || []).forEach((r: AssignedCustomer) => {
        if (!uniqueMap.has(r.customer_phone)) {
          uniqueMap.set(r.customer_phone, r);
        }
      });

      setCustomers(Array.from(uniqueMap.values()));
    } catch (error) {
      console.error('Error fetching assigned customers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Brak przypisanych klientów</p>
        <p className="text-sm text-muted-foreground mt-1">
          Klienci zostaną przypisani automatycznie po wykonaniu usługi z tym szablonem
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        {customers.length} {customers.length === 1 ? 'klient' : 'klientów'} przypisanych do tego szablonu
      </p>
      {customers.map((customer, index) => (
        <div
          key={`${customer.customer_phone}-${index}`}
          className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">{customer.customer_name}</div>
            <div className="text-sm text-muted-foreground">{customer.customer_phone}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">{customer.service_type}</div>
            <div className="text-xs text-muted-foreground">{customer.scheduled_date}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
