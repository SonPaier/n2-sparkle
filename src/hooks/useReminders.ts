import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReminderType {
  id: string;
  instance_id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

export interface Reminder {
  id: string;
  instance_id: string;
  name: string;
  reminder_type_id: string | null;
  deadline: string;
  days_before: number;
  customer_id: string | null;
  assigned_user_id: string | null;
  notes: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_customer_email: boolean;
  notify_customer_sms: boolean;
  is_recurring: boolean;
  recurring_type: string | null;
  recurring_value: number | null;
  status: string;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
  assigned_employee_id: string | null;
  visible_for_employee: boolean;
  // Joined
  reminder_type_name?: string;
  customer_name?: string;
  assigned_employee_name?: string;
}

export function useReminderTypes(instanceId: string | null) {
  const [types, setTypes] = useState<ReminderType[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('reminder_types')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .order('sort_order');
    setLoading(false);
    if (error) { console.error(error); return; }
    setTypes((data as any[]) || []);
  }, [instanceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addType = async (name: string) => {
    if (!instanceId) return;
    const { error } = await supabase.from('reminder_types').insert({ instance_id: instanceId, name } as any);
    if (error) { toast.error('Błąd dodawania typu'); return; }
    toast.success('Typ dodany');
    fetch();
  };

  const updateType = async (id: string, name: string) => {
    const { error } = await supabase.from('reminder_types').update({ name } as any).eq('id', id);
    if (error) { toast.error('Błąd edycji typu'); return; }
    toast.success('Typ zaktualizowany');
    fetch();
  };

  const deleteType = async (id: string) => {
    const { error } = await supabase.from('reminder_types').update({ active: false } as any).eq('id', id);
    if (error) { toast.error('Błąd usuwania typu'); return; }
    toast.success('Typ usunięty');
    fetch();
  };

  return { types, loading, refetch: fetch, addType, updateType, deleteType };
}

export function useReminders(instanceId: string | null) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const isFirstLoad = useRef(true);

  const fetch = useCallback(async () => {
    if (!instanceId) return;
    if (isFirstLoad.current) {
      setLoading(true);
    }
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('instance_id', instanceId)
      .order('deadline', { ascending: true });
    if (isFirstLoad.current) {
      setLoading(false);
      isFirstLoad.current = false;
    }
    if (error) { console.error(error); return; }

    const items = (data as any[]) || [];

    // Fetch type names
    const typeIds = [...new Set(items.filter(i => i.reminder_type_id).map(i => i.reminder_type_id))];
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('reminder_types').select('id, name').in('id', typeIds);
      if (types) {
        const typeMap = new Map((types as any[]).map(t => [t.id, t.name]));
        items.forEach(i => { if (i.reminder_type_id) i.reminder_type_name = typeMap.get(i.reminder_type_id); });
      }
    }

    // Fetch customer names
    const customerIds = [...new Set(items.filter(i => i.customer_id).map(i => i.customer_id))];
    if (customerIds.length > 0) {
      const { data: customers } = await supabase.from('customers').select('id, name').in('id', customerIds);
      if (customers) {
        const custMap = new Map(customers.map(c => [c.id, c.name]));
        items.forEach(i => { if (i.customer_id) i.customer_name = custMap.get(i.customer_id); });
      }
    }

    // Fetch assigned employee names
    const employeeIds = [...new Set(items.filter(i => i.assigned_employee_id).map(i => i.assigned_employee_id))];
    if (employeeIds.length > 0) {
      const { data: employees } = await supabase.from('employees').select('id, name').in('id', employeeIds);
      if (employees) {
        const empMap = new Map((employees as any[]).map(e => [e.id, e.name]));
        items.forEach(i => { if (i.assigned_employee_id) i.assigned_employee_name = empMap.get(i.assigned_employee_id); });
      }
    }

    setReminders(items);
  }, [instanceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveReminder = async (reminder: Partial<Reminder> & { instance_id: string }, id?: string) => {
    if (id) {
      const { error } = await supabase.from('reminders').update(reminder as any).eq('id', id);
      if (error) { toast.error('Błąd zapisywania'); return false; }
      toast.success('Przypomnienie zaktualizowane');
    } else {
      const { error } = await supabase.from('reminders').insert(reminder as any);
      if (error) { toast.error('Błąd tworzenia'); return false; }
      toast.success('Przypomnienie utworzone');
    }
    fetch();
    return true;
  };

  const updateStatus = async (id: string, status: string, reminder?: Reminder) => {
    const { error } = await supabase.from('reminders').update({ status } as any).eq('id', id);
    if (error) { toast.error('Błąd zmiany statusu'); return; }

    // If recurring and marked done, create next occurrence
    if (status === 'done' && reminder?.is_recurring && reminder.recurring_type) {
      const nextDeadline = getNextRecurringDeadline(reminder.deadline, reminder.recurring_type, reminder.recurring_value);
      if (nextDeadline) {
        await supabase.from('reminders').insert({
          instance_id: reminder.instance_id,
          name: reminder.name,
          reminder_type_id: reminder.reminder_type_id,
          deadline: nextDeadline,
          days_before: reminder.days_before,
          customer_id: reminder.customer_id,
          assigned_user_id: reminder.assigned_user_id,
          notes: reminder.notes,
          notify_email: reminder.notify_email,
          notify_sms: reminder.notify_sms,
          notify_customer_email: reminder.notify_customer_email,
          notify_customer_sms: reminder.notify_customer_sms,
          is_recurring: true,
          recurring_type: reminder.recurring_type,
          recurring_value: reminder.recurring_value,
          assigned_employee_id: reminder.assigned_employee_id,
          visible_for_employee: reminder.visible_for_employee,
          status: 'todo',
        } as any);
      }
    }

    fetch();
    toast.success(status === 'done' ? 'Oznaczono jako wykonane' : status === 'cancelled' ? 'Anulowane' : 'Przywrócono');
  };

  const deleteReminder = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) { toast.error('Błąd usuwania'); return; }
    toast.success('Przypomnienie usunięte');
    fetch();
  };

  return { reminders, loading, refetch: fetch, saveReminder, updateStatus, deleteReminder };
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getNextRecurringDeadline(currentDeadline: string, recurringType: string, recurringValue: number | null): string | null {
  const current = new Date(currentDeadline + 'T00:00:00');
  if (recurringType === 'monthly' && recurringValue) {
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(recurringValue, maxDay));
    return fmtDate(next);
  }
  if (recurringType === 'weekly') {
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    return fmtDate(next);
  }
  return null;
}
