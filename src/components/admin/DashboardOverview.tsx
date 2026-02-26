import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Bell, Clock, User, MapPin, Tag, CreditCard, DollarSign, HardHat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { toast } from 'sonner';

interface DashboardOverviewProps {
  instanceId: string;
  onItemClick?: (itemId: string) => void;
  onReminderClick?: (reminderId: string) => void;
  onPaymentClick?: (itemId: string) => void;
}

interface CalendarItemRow {
  id: string;
  title: string;
  customer_name: string | null;
  customer_phone: string | null;
  item_date: string;
  start_time: string;
  end_time: string;
  status: string;
  column_id: string | null;
  customer_address_id: string | null;
  assigned_employee_ids: string[] | null;
  address_name?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  payment_status: string | null;
  price: number | null;
  employee_names?: string[];
  overdue_days?: number;
}

interface ReminderRow {
  id: string;
  name: string;
  deadline: string;
  customer_id: string | null;
  reminder_type_id: string | null;
  status: string;
  days_before: number;
  customer_name?: string;
  reminder_type_name?: string;
}

const DashboardOverview = ({ instanceId, onItemClick, onReminderClick, onPaymentClick }: DashboardOverviewProps) => {
  const [items, setItems] = useState<CalendarItemRow[]>([]);
  const [allPaymentItems, setAllPaymentItems] = useState<CalendarItemRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const selectFields = 'id, title, customer_name, customer_phone, item_date, start_time, end_time, status, column_id, customer_address_id, assigned_employee_ids, payment_status, price';

    const [itemsRes, paymentItemsRes, remindersRes, overdueInvoicesRes] = await Promise.all([
      // Weekly items for orders section
      supabase
        .from('calendar_items')
        .select(selectFields)
        .eq('instance_id', instanceId)
        .gte('item_date', weekStart)
        .lte('item_date', weekEnd)
        .neq('status', 'cancelled')
        .order('item_date')
        .order('start_time'),
      // Unsettled completed items for payments section (completed + not_invoiced, no date filter)
      supabase
        .from('calendar_items')
        .select(selectFields)
        .eq('instance_id', instanceId)
        .eq('status', 'completed')
        .eq('payment_status', 'not_invoiced')
        .order('item_date')
        .limit(100),
      // All todo reminders (no date range filter)
      supabase
        .from('reminders')
        .select('id, name, deadline, customer_id, reminder_type_id, status, days_before')
        .eq('instance_id', instanceId)
        .eq('status', 'todo')
        .order('deadline'),
      // Overdue invoices
      supabase
        .from('invoices')
        .select('calendar_item_id, payment_to')
        .eq('instance_id', instanceId)
        .not('status', 'in', '("paid","cancelled")')
        .not('payment_to', 'is', null)
        .lt('payment_to', today),
    ]);

    const calItems = (itemsRes.data as CalendarItemRow[]) || [];
    const payItems = (paymentItemsRes.data as CalendarItemRow[]) || [];
    const remItems = (remindersRes.data as ReminderRow[]) || [];

    // Build overdue map: calendar_item_id -> payment_to
    const overdueMap = new Map<string, string>();
    ((overdueInvoicesRes.data as any[]) || []).forEach((inv) => {
      if (inv.calendar_item_id) overdueMap.set(inv.calendar_item_id, inv.payment_to);
    });

    // Fetch overdue calendar items (items with overdue invoices not already in payItems)
    const overdueItemIds = [...overdueMap.keys()].filter(id => !payItems.find(p => p.id === id));
    let overdueCalItems: CalendarItemRow[] = [];
    if (overdueItemIds.length > 0) {
      const { data } = await supabase
        .from('calendar_items')
        .select(selectFields)
        .in('id', overdueItemIds);
      overdueCalItems = (data as CalendarItemRow[]) || [];
    }

    // Combine: overdue items + unsettled completed items
    const allPayItems = [...overdueCalItems, ...payItems];

    // Mark overdue days
    allPayItems.forEach(item => {
      const paymentTo = overdueMap.get(item.id);
      if (paymentTo) {
        const days = differenceInDays(new Date(), new Date(paymentTo + 'T00:00:00'));
        if (days > 0) item.overdue_days = days;
      }
    });

    // Sort: overdue first (most overdue on top), then by item_date asc (oldest first)
    allPayItems.sort((a, b) => {
      if (a.overdue_days && !b.overdue_days) return -1;
      if (!a.overdue_days && b.overdue_days) return 1;
      if (a.overdue_days && b.overdue_days) return b.overdue_days - a.overdue_days;
      return a.item_date.localeCompare(b.item_date);
    });
    const filteredPayItems = allPayItems;

    // Combine all items for address/employee resolution
    const allItemsForResolve = [...calItems];
    filteredPayItems.forEach(pi => {
      if (!allItemsForResolve.find(ci => ci.id === pi.id)) allItemsForResolve.push(pi);
    });

    // Fetch addresses
    const addressIds = [...new Set(allItemsForResolve.filter(i => i.customer_address_id).map(i => i.customer_address_id!))];
    if (addressIds.length > 0) {
      const { data: addresses } = await supabase.from('customer_addresses').select('id, name, street, city').in('id', addressIds);
      if (addresses) {
        const addrMap = new Map(addresses.map(a => [a.id, a]));
        allItemsForResolve.forEach(i => {
          if (i.customer_address_id) {
            const addr = addrMap.get(i.customer_address_id);
            if (addr) { i.address_name = addr.name; i.address_street = addr.street; i.address_city = addr.city; }
          }
        });
      }
    }

    // Fetch employee names
    const allEmpIds = [...new Set(allItemsForResolve.flatMap(i => i.assigned_employee_ids || []))];
    if (allEmpIds.length > 0) {
      const { data: employees } = await supabase.from('employees').select('id, name').in('id', allEmpIds);
      if (employees) {
        const empMap = new Map(employees.map(e => [e.id, e.name]));
        allItemsForResolve.forEach(i => {
          if (i.assigned_employee_ids?.length) {
            i.employee_names = i.assigned_employee_ids.map(id => empMap.get(id)).filter(Boolean) as string[];
          }
        });
      }
    }

    // Fetch customer names and type names for reminders
    const customerIds = [...new Set(remItems.filter(r => r.customer_id).map(r => r.customer_id!))];
    const typeIds = [...new Set(remItems.filter(r => r.reminder_type_id).map(r => r.reminder_type_id!))];
    const [custRes, typeRes] = await Promise.all([
      customerIds.length > 0 ? supabase.from('customers').select('id, name').in('id', customerIds) : { data: [] },
      typeIds.length > 0 ? supabase.from('reminder_types').select('id, name').in('id', typeIds) : { data: [] },
    ]);
    if (custRes.data) {
      const custMap = new Map((custRes.data as any[]).map((c: any) => [c.id, c.name]));
      remItems.forEach(r => { if (r.customer_id) r.customer_name = custMap.get(r.customer_id); });
    }
    if (typeRes.data) {
      const typeMap = new Map((typeRes.data as any[]).map((t: any) => [t.id, t.name]));
      remItems.forEach(r => { if (r.reminder_type_id) r.reminder_type_name = typeMap.get(r.reminder_type_id); });
    }

    setItems(calItems);
    setAllPaymentItems(filteredPayItems);
    setReminders(remItems);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReminderDone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('reminders').update({ status: 'done' }).eq('id', id);
    if (error) {
      toast.error('Błąd zmiany statusu');
      return;
    }
    toast.success('Przypomnienie oznaczone jako wykonane');
    fetchData();
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDate = new Date(today + 'T00:00:00');

  // Orders: today + tomorrow
  const tomorrow = format(new Date(todayDate.getTime() + 86400000), 'yyyy-MM-dd');
  const dashboardItems = items.filter(i => i.item_date === today || i.item_date === tomorrow);

  // Reminders: notification window check (deadline - days_before <= today)
  const todayReminders = reminders.filter(r => {
    const deadlineDate = new Date(r.deadline + 'T00:00:00');
    const notifyDate = new Date(deadlineDate);
    notifyDate.setDate(notifyDate.getDate() - r.days_before);
    return notifyDate <= todayDate;
  });

  const formatDateLabel = (date: string) => {
    try {
      return format(new Date(date + 'T00:00:00'), 'EEEE, d MMM', { locale: pl });
    } catch { return date; }
  };

  const buildFullAddress = (item: CalendarItemRow) => {
    const parts = [item.address_name, item.address_street, item.address_city].filter(Boolean);
    return parts.join(', ');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardColumn icon={<Calendar className="w-5 h-5 text-primary" />} title="Zlecenia" count={dashboardItems.length} emptyText="Brak zleceń na dziś i jutro">
          {dashboardItems.map((item, idx) => (
            <OrderCard key={item.id} item={item} fullAddress={buildFullAddress(item)} showDate formatDateLabel={formatDateLabel} isFirst={idx === 0} onClick={() => onItemClick?.(item.id)} />
          ))}
        </DashboardColumn>
        <DashboardColumn icon={<Bell className="w-5 h-5 text-primary" />} title="Przypomnienia" count={todayReminders.length} emptyText="Brak przypomnień">
          {todayReminders.map((r, idx) => (
            <ReminderCard key={r.id} reminder={r} isFirst={idx === 0} onDone={(e) => handleReminderDone(r.id, e)} onClick={() => onReminderClick?.(r.id)} />
          ))}
        </DashboardColumn>
        <DashboardColumn icon={<CreditCard className="w-5 h-5 text-primary" />} title="Płatności" count={allPaymentItems.length} emptyText="Brak płatności do rozliczenia">
          {allPaymentItems.map((item, idx) => (
            <PaymentCard key={item.id} item={item} isFirst={idx === 0} onClick={() => onPaymentClick?.(item.id)} />
          ))}
        </DashboardColumn>
      </div>
    </div>
  );
};

/* Column wrapper with header */
const DashboardColumn = ({ icon, title, count, emptyText, children }: {
  icon: React.ReactNode; title: string; count: number; emptyText: string; children: React.ReactNode;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">({count})</span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic py-3">{emptyText}</p>
      ) : (
        <div>{children}</div>
      )}
    </CardContent>
  </Card>
);

const OrderCard = ({ item, fullAddress, showDate, formatDateLabel, isFirst, onClick }: {
  item: CalendarItemRow; fullAddress: string; showDate?: boolean; formatDateLabel?: (d: string) => string; isFirst?: boolean; onClick?: () => void;
}) => (
  <div
    className={`py-3 px-1 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${isFirst ? 'border-t' : ''}`}
    onClick={onClick}
  >
    <div className="space-y-1">
      <span className="font-medium text-sm leading-tight">{item.title}</span>
      <div className="flex items-center gap-1.5 text-xs text-foreground">
        <Clock className="w-3 h-3" />
        {showDate && formatDateLabel ? (
          <span>{formatDateLabel(item.item_date)}, {item.start_time}–{item.end_time}</span>
        ) : (
          <span>{item.start_time}–{item.end_time}</span>
        )}
      </div>
      {item.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <User className="w-3 h-3" />
          <span>{item.customer_name}</span>
        </div>
      )}
      {fullAddress && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <MapPin className="w-3 h-3" />
          <span>{fullAddress}</span>
        </div>
      )}
      {item.employee_names && item.employee_names.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <HardHat className="w-3 h-3" />
          <span>{item.employee_names.join(', ')}</span>
        </div>
      )}
    </div>
  </div>
);

const ReminderCard = ({ reminder, showDate, formatDateLabel, isFirst, onDone, onClick }: {
  reminder: ReminderRow; showDate?: boolean; formatDateLabel?: (d: string) => string; isFirst?: boolean;
  onDone: (e: React.MouseEvent) => void; onClick?: () => void;
}) => (
  <div
    className={`py-3 px-1 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${isFirst ? 'border-t' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start gap-2">
      <Checkbox
        className="mt-0.5 shrink-0"
        onClick={onDone}
      />
      <div className="space-y-1 min-w-0">
        <span className="font-medium text-sm leading-tight">{reminder.name}</span>
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Clock className="w-3 h-3" />
          <span>{showDate && formatDateLabel ? formatDateLabel(reminder.deadline) : formatReminderDeadline(reminder.deadline)}</span>
        </div>
        {reminder.customer_name && (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <User className="w-3 h-3" />
            <span>{reminder.customer_name}</span>
          </div>
        )}
        {reminder.reminder_type_name && (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <Tag className="w-3 h-3" />
            <span>{reminder.reminder_type_name}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

/** Show "Dziś" or relative date for reminder deadline */
function formatReminderDeadline(deadline: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline + 'T00:00:00');
  const days = differenceInDays(deadlineDate, today);
  if (days === 0) return 'Dziś';
  if (days === 1) return 'Jutro';
  if (days < 0) return `${Math.abs(days)} dni temu`;
  return `za ${days} dni`;
}

const PaymentCard = ({ item, showDate, formatDateLabel, isFirst, onClick }: {
  item: CalendarItemRow; showDate?: boolean; formatDateLabel?: (d: string) => string; isFirst?: boolean; onClick?: () => void;
}) => (
  <div
    className={`py-3 px-1 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${isFirst ? 'border-t' : ''}`}
    onClick={onClick}
  >
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-tight">{item.title}</span>
        {item.overdue_days && item.overdue_days > 0 ? (
          <span className="text-xs bg-red-600 text-white rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
            Po terminie ({item.overdue_days} dni)
          </span>
        ) : (
          <InvoiceStatusBadge status={item.payment_status} size="sm" />
        )}
      </div>
      {showDate && formatDateLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDateLabel(item.item_date)}</span>
        </div>
      )}
      {!showDate && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Clock className="w-3 h-3" />
          <span>{format(new Date(item.item_date + 'T00:00:00'), 'd MMM', { locale: pl })}</span>
        </div>
      )}
      {item.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <User className="w-3 h-3" />
          <span>{item.customer_name}</span>
        </div>
      )}
      {(item.price ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <DollarSign className="w-3 h-3" />
          <span>{item.price?.toFixed(2)} PLN</span>
        </div>
      )}
    </div>
  </div>
);

export default DashboardOverview;
