import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Bell, Clock, User, MapPin, Tag, CreditCard, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';

interface DashboardOverviewProps {
  instanceId: string;
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
  address_name?: string | null;
  payment_status: string | null;
  price: number | null;
}

interface ReminderRow {
  id: string;
  name: string;
  deadline: string;
  customer_id: string | null;
  reminder_type_id: string | null;
  status: string;
  customer_name?: string;
  reminder_type_name?: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  in_progress: { label: 'W trakcie', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  completed: { label: 'Zakończone', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Anulowane', className: 'bg-red-100 text-red-800 border-red-200' },
};

const DashboardOverview = ({ instanceId }: DashboardOverviewProps) => {
  const [items, setItems] = useState<CalendarItemRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const [itemsRes, remindersRes] = await Promise.all([
      supabase
        .from('calendar_items')
        .select('id, title, customer_name, customer_phone, item_date, start_time, end_time, status, column_id, customer_address_id, payment_status, price')
        .eq('instance_id', instanceId)
        .gte('item_date', weekStart)
        .lte('item_date', weekEnd)
        .neq('status', 'cancelled')
        .order('item_date')
        .order('start_time'),
      supabase
        .from('reminders')
        .select('id, name, deadline, customer_id, reminder_type_id, status')
        .eq('instance_id', instanceId)
        .eq('status', 'todo')
        .gte('deadline', weekStart)
        .lte('deadline', weekEnd)
        .order('deadline'),
    ]);

    const calItems = (itemsRes.data as CalendarItemRow[]) || [];
    const remItems = (remindersRes.data as ReminderRow[]) || [];

    // Fetch addresses
    const addressIds = [...new Set(calItems.filter(i => i.customer_address_id).map(i => i.customer_address_id!))];
    if (addressIds.length > 0) {
      const { data: addresses } = await supabase.from('customer_addresses').select('id, name').in('id', addressIds);
      if (addresses) {
        const addrMap = new Map(addresses.map(a => [a.id, a.name]));
        calItems.forEach(i => { if (i.customer_address_id) i.address_name = addrMap.get(i.customer_address_id); });
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
    setReminders(remItems);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const todayItems = items.filter(i => i.item_date === today);
  const upcomingItems = items.filter(i => i.item_date > today);

  const todayReminders = reminders.filter(r => r.deadline === today);
  const upcomingReminders = reminders.filter(r => r.deadline > today);

  // Payments: items with price > 0 and payment_status != 'paid'
  const paymentItems = items.filter(i => (i.price ?? 0) > 0 && i.payment_status !== 'paid');
  const todayPayments = paymentItems.filter(i => i.item_date === today);
  const upcomingPayments = paymentItems.filter(i => i.item_date > today);

  // Mock data for demo purposes
  const mockReminders = useMemo<ReminderRow[]>(() => {
    if (reminders.length > 0) return [];
    return [
      { id: 'mock-r1', name: 'Przegląd klimatyzacji', deadline: today, customer_id: null, reminder_type_id: null, status: 'todo', customer_name: 'Jan Kowalski', reminder_type_name: 'Przegląd' },
      { id: 'mock-r2', name: 'Odnowienie ubezpieczenia', deadline: today, customer_id: null, reminder_type_id: null, status: 'todo', customer_name: 'Anna Nowak', reminder_type_name: 'Ubezpieczenie' },
      { id: 'mock-r3', name: 'Badanie techniczne', deadline: format(new Date(Date.now() + 86400000 * 2), 'yyyy-MM-dd'), customer_id: null, reminder_type_id: null, status: 'todo', customer_name: 'Firma XYZ', reminder_type_name: 'Badanie' },
    ];
  }, [reminders.length, today]);

  const mockPayments = useMemo<CalendarItemRow[]>(() => {
    if (paymentItems.length > 0) return [];
    return items.slice(0, 3).map((item, idx) => ({
      ...item,
      id: `mock-p-${item.id}`,
      price: [350, 1200, 580][idx] ?? 500,
      payment_status: ['invoice_sent', 'overdue', 'not_invoiced'][idx] ?? 'not_invoiced',
    }));
  }, [paymentItems.length, items]);

  const allTodayReminders = todayReminders.length > 0 ? todayReminders : mockReminders.filter(r => r.deadline === today);
  const allUpcomingReminders = upcomingReminders.length > 0 ? upcomingReminders : mockReminders.filter(r => r.deadline > today);
  const allTodayPayments = todayPayments.length > 0 ? todayPayments : mockPayments.filter(i => i.item_date === today);
  const allUpcomingPayments = upcomingPayments.length > 0 ? upcomingPayments : mockPayments.filter(i => i.item_date > today);

  const formatDateLabel = (date: string) => {
    try {
      return format(new Date(date + 'T00:00:00'), 'EEEE, d MMM', { locale: pl });
    } catch { return date; }
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

      {/* DZIŚ */}
      <h2 className="text-lg font-semibold text-center mb-4">Dziś</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <DashboardColumn icon={<Calendar className="w-5 h-5 text-primary" />} title="Zlecenia" count={todayItems.length} emptyText="Brak zleceń na dziś">
          {todayItems.map(item => <OrderCard key={item.id} item={item} />)}
        </DashboardColumn>
        <DashboardColumn icon={<Bell className="w-5 h-5 text-primary" />} title="Przypomnienia" count={allTodayReminders.length} emptyText="Brak przypomnień na dziś">
          {allTodayReminders.map(r => <ReminderCard key={r.id} reminder={r} />)}
        </DashboardColumn>
        <DashboardColumn icon={<CreditCard className="w-5 h-5 text-primary" />} title="Płatności" count={allTodayPayments.length} emptyText="Brak płatności na dziś">
          {allTodayPayments.map(item => <PaymentCard key={item.id} item={item} />)}
        </DashboardColumn>
      </div>

      {/* NADCHODZĄCE */}
      <h2 className="text-lg font-semibold text-center mb-4">Nadchodzące</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardColumn icon={<Calendar className="w-5 h-5 text-primary" />} title="Zlecenia" count={upcomingItems.length} emptyText="Brak nadchodzących zleceń">
          {upcomingItems.slice(0, 3).map(item => <OrderCard key={item.id} item={item} showDate formatDateLabel={formatDateLabel} />)}
        </DashboardColumn>
        <DashboardColumn icon={<Bell className="w-5 h-5 text-primary" />} title="Przypomnienia" count={allUpcomingReminders.length} emptyText="Brak nadchodzących przypomnień">
          {allUpcomingReminders.slice(0, 3).map(r => <ReminderCard key={r.id} reminder={r} showDate formatDateLabel={formatDateLabel} />)}
        </DashboardColumn>
        <DashboardColumn icon={<CreditCard className="w-5 h-5 text-primary" />} title="Płatności" count={allUpcomingPayments.length} emptyText="Brak nadchodzących płatności">
          {allUpcomingPayments.slice(0, 3).map(item => <PaymentCard key={item.id} item={item} showDate formatDateLabel={formatDateLabel} />)}
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
        <div className="space-y-2">{children}</div>
      )}
    </CardContent>
  </Card>
);

const OrderCard = ({ item, showDate, formatDateLabel }: { item: CalendarItemRow; showDate?: boolean; formatDateLabel?: (d: string) => string }) => {
  const st = statusLabels[item.status] || { label: item.status, className: 'bg-muted text-muted-foreground' };
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm leading-tight">{item.title}</span>
          {item.status !== 'confirmed' && (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${st.className}`}>{st.label}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {showDate && formatDateLabel ? (
            <span>{formatDateLabel(item.item_date)}, {item.start_time}–{item.end_time}</span>
          ) : (
            <span>{item.start_time}–{item.end_time}</span>
          )}
        </div>
        {item.customer_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>{item.customer_name}</span>
          </div>
        )}
        {item.address_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{item.address_name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ReminderCard = ({ reminder, showDate, formatDateLabel }: { reminder: ReminderRow; showDate?: boolean; formatDateLabel?: (d: string) => string }) => (
  <Card className="shadow-sm">
    <CardContent className="p-3 space-y-1">
      <span className="font-medium text-sm leading-tight">{reminder.name}</span>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{showDate && formatDateLabel ? formatDateLabel(reminder.deadline) : 'Dziś'}</span>
      </div>
      {reminder.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{reminder.customer_name}</span>
        </div>
      )}
      {reminder.reminder_type_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Tag className="w-3 h-3" />
          <span>{reminder.reminder_type_name}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

const PaymentCard = ({ item, showDate, formatDateLabel }: { item: CalendarItemRow; showDate?: boolean; formatDateLabel?: (d: string) => string }) => (
  <Card className="shadow-sm">
    <CardContent className="p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm leading-tight">{item.title}</span>
        <InvoiceStatusBadge status={item.payment_status} size="sm" />
      </div>
      {showDate && formatDateLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDateLabel(item.item_date)}</span>
        </div>
      )}
      {item.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{item.customer_name}</span>
        </div>
      )}
      {(item.price ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          <span>{item.price?.toFixed(2)} PLN</span>
        </div>
      )}
    </CardContent>
  </Card>
);

export default DashboardOverview;
