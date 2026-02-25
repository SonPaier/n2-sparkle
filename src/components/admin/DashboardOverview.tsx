import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, Bell, Clock, User, MapPin, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
  confirmed: { label: 'Potwierdzone', className: 'bg-blue-100 text-blue-800 border-blue-200' },
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

    // Fetch calendar items and reminders in parallel
    const [itemsRes, remindersRes] = await Promise.all([
      supabase
        .from('calendar_items')
        .select('id, title, customer_name, customer_phone, item_date, start_time, end_time, status, column_id, customer_address_id')
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

    // Fetch addresses for items
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
      const custMap = new Map((custRes.data as any[]).map((c: any) => [c.id as string, c.name as string]));
      remItems.forEach(r => { if (r.customer_id) r.customer_name = custMap.get(r.customer_id); });
    }
    if (typeRes.data) {
      const typeMap = new Map((typeRes.data as any[]).map((t: any) => [t.id as string, t.name as string]));
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

  const formatDateLabel = (date: string) => {
    try {
      return format(new Date(date + 'T00:00:00'), 'EEEE, d MMM', { locale: pl });
    } catch { return date; }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zlecenia column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Zlecenia</h2>
            <span className="text-sm text-muted-foreground">({items.length})</span>
          </div>

          <Section title="Dziś" count={todayItems.length} emptyText="Brak zleceń na dziś">
            {todayItems.map(item => <OrderCard key={item.id} item={item} />)}
          </Section>

          <Section title="Nadchodzące" count={upcomingItems.length} emptyText="Brak nadchodzących zleceń">
            {upcomingItems.map(item => <OrderCard key={item.id} item={item} showDate formatDateLabel={formatDateLabel} />)}
          </Section>
        </div>

        {/* Przypomnienia column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Przypomnienia</h2>
            <span className="text-sm text-muted-foreground">({reminders.length})</span>
          </div>

          <Section title="Dziś" count={todayReminders.length} emptyText="Brak przypomnień na dziś">
            {todayReminders.map(r => <ReminderCard key={r.id} reminder={r} />)}
          </Section>

          <Section title="Nadchodzące" count={upcomingReminders.length} emptyText="Brak nadchodzących przypomnień">
            {upcomingReminders.map(r => <ReminderCard key={r.id} reminder={r} showDate formatDateLabel={formatDateLabel} />)}
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, count, emptyText, children }: { title: string; count: number; emptyText: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-sm font-medium text-muted-foreground mb-2">{title} ({count})</h3>
    {count === 0 ? (
      <p className="text-sm text-muted-foreground/60 italic py-3">{emptyText}</p>
    ) : (
      <div className="space-y-2">{children}</div>
    )}
  </div>
);

const OrderCard = ({ item, showDate, formatDateLabel }: { item: CalendarItemRow; showDate?: boolean; formatDateLabel?: (d: string) => string }) => {
  const st = statusLabels[item.status] || { label: item.status, className: 'bg-muted text-muted-foreground' };
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm leading-tight">{item.title}</span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${st.className}`}>{st.label}</Badge>
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

export default DashboardOverview;
