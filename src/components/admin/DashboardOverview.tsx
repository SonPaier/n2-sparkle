import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { getNextWorkingDays } from '@/lib/workingDaysUtils';
import { pl } from 'date-fns/locale';
import { Calendar, Bell, Clock, User, Tag, CreditCard, DollarSign, ChevronRight, MessageSquare, Settings2 } from 'lucide-react';
import { getPriorityConfig, DEFAULT_PRIORITY } from '@/lib/priorityUtils';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import DashboardSettingsDrawer from '@/components/admin/DashboardSettingsDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { toast } from 'sonner';
import { formatPhoneDisplay, normalizePhone } from '@/lib/phoneUtils';

type WorkingHours = Record<string, { open: string; close: string } | null> | null;

interface DashboardOverviewProps {
  instanceId: string;
  workingHours?: WorkingHours;
  onItemClick?: (itemId: string) => void;
  onReminderClick?: (reminderId: string) => void;
  onPaymentClick?: (itemId: string) => void;
  onViewNotifications?: () => void;
  remindersEnabled?: boolean;
  prioritiesEnabled?: boolean;
}

interface CalendarItemRow {
  id: string;
  title: string;
  customer_name: string | null;
  customer_phone: string | null;
  item_date: string;
  end_date: string | null;
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
  priority?: number | null;
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

const getDayPill = (itemDate: string, endDate?: string | null) => {
  const date = new Date(itemDate + 'T00:00:00');
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (endDate && endDate !== itemDate) {
    const end = new Date(endDate + 'T00:00:00');
    const startName = capitalize(format(date, 'EEEE', { locale: pl }));
    const endName = capitalize(format(end, 'EEEE', { locale: pl }));
    return { label: `${startName} - ${endName}`, cls: 'bg-purple-500 text-white border-transparent' };
  }

  if (isToday(date)) return { label: 'Dziś', cls: 'bg-green-500 text-white border-transparent' };
  if (isTomorrow(date)) return { label: 'Jutro', cls: 'bg-purple-500 text-white border-transparent' };
  const dayName = format(date, 'EEEE', { locale: pl });
  return { label: capitalize(dayName), cls: 'bg-purple-500 text-white border-transparent' };
};

const DashboardOverview = ({ instanceId, workingHours, onItemClick, onReminderClick, onPaymentClick, onViewNotifications, remindersEnabled = true, prioritiesEnabled = false }: DashboardOverviewProps) => {
  const [items, setItems] = useState<CalendarItemRow[]>([]);
  const [allPaymentItems, setAllPaymentItems] = useState<CalendarItemRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, save: saveSettings } = useDashboardSettings(instanceId);

  const daysCount = settings.viewMode === 'week' ? 7 : 2;
  const workingDaysForFetch = useMemo(() => getNextWorkingDays(daysCount, workingHours ?? null), [workingHours, daysCount]);
  const fetchDateStart = workingDaysForFetch[0] || format(new Date(), 'yyyy-MM-dd');
  const fetchDateEnd = workingDaysForFetch[workingDaysForFetch.length - 1] || format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const selectFields = 'id, title, customer_name, customer_phone, item_date, end_date, start_time, end_time, status, column_id, customer_address_id, assigned_employee_ids, payment_status, price, priority';

    const [itemsRes, paymentItemsRes, remindersRes, overdueInvoicesRes] = await Promise.all([
      supabase
        .from('calendar_items')
        .select(selectFields)
        .eq('instance_id', instanceId)
        .lte('item_date', fetchDateEnd)
        .or(`end_date.gte.${fetchDateStart},item_date.gte.${fetchDateStart}`)
        .neq('status', 'cancelled')
        .order('item_date')
        .order('start_time'),
      supabase
        .from('calendar_items')
        .select(selectFields)
        .eq('instance_id', instanceId)
        .eq('status', 'completed')
        .eq('payment_status', 'not_invoiced')
        .order('item_date')
        .limit(100),
      supabase
        .from('reminders')
        .select('id, name, deadline, customer_id, reminder_type_id, status, days_before')
        .eq('instance_id', instanceId)
        .eq('status', 'todo')
        .order('deadline'),
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

    const overdueMap = new Map<string, string>();
    ((overdueInvoicesRes.data as any[]) || []).forEach((inv) => {
      if (inv.calendar_item_id) overdueMap.set(inv.calendar_item_id, inv.payment_to);
    });

    const overdueItemIds = [...overdueMap.keys()].filter(id => !payItems.find(p => p.id === id));
    let overdueCalItems: CalendarItemRow[] = [];
    if (overdueItemIds.length > 0) {
      const { data } = await supabase
        .from('calendar_items')
        .select(selectFields)
        .in('id', overdueItemIds);
      overdueCalItems = (data as CalendarItemRow[]) || [];
    }

    const allPayItems = [...overdueCalItems, ...payItems];
    allPayItems.forEach(item => {
      const paymentTo = overdueMap.get(item.id);
      if (paymentTo) {
        const days = differenceInDays(new Date(), new Date(paymentTo + 'T00:00:00'));
        if (days > 0) item.overdue_days = days;
      }
    });

    allPayItems.sort((a, b) => {
      if (a.overdue_days && !b.overdue_days) return -1;
      if (!a.overdue_days && b.overdue_days) return 1;
      if (a.overdue_days && b.overdue_days) return b.overdue_days - a.overdue_days;
      return a.item_date.localeCompare(b.item_date);
    });

    const allItemsForResolve = [...calItems];
    allPayItems.forEach(pi => {
      if (!allItemsForResolve.find(ci => ci.id === pi.id)) allItemsForResolve.push(pi);
    });

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
    setAllPaymentItems(allPayItems);
    setReminders(remItems);
    setLoading(false);
  }, [instanceId, fetchDateStart, fetchDateEnd]);

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

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const workingDays = useMemo(() => getNextWorkingDays(daysCount, workingHours ?? null), [workingHours, daysCount]);
  const dashboardItems = items.filter(i => {
    const endDate = (i as any).end_date || i.item_date;
    return workingDays.some(day => i.item_date <= day && endDate >= day);
  }).sort((a, b) => {
    // Sort by date first (today first), then by priority (lower number = higher priority)
    const dateCmp = a.item_date.localeCompare(b.item_date);
    if (dateCmp !== 0) return dateCmp;
    const aPri = a.priority ?? DEFAULT_PRIORITY;
    const bPri = b.priority ?? DEFAULT_PRIORITY;
    return aPri - bPri;
  });

  const todayReminders = reminders.filter(r => {
    const deadlineDate = new Date(r.deadline + 'T00:00:00');
    const notifyDate = new Date(deadlineDate);
    notifyDate.setDate(notifyDate.getDate() - r.days_before);
    return notifyDate <= todayDate;
  });

  const buildDisplayAddress = (item: CalendarItemRow) => {
    const parts = [item.address_city, item.address_street].filter(Boolean);
    return parts.join(', ');
  };

  const buildFullAddress = (item: CalendarItemRow) => {
    const parts = [item.address_name, item.address_street, item.address_city].filter(Boolean);
    return parts.join(', ');
  };

  const buildGoogleMapsUrl = (item: CalendarItemRow) => {
    const addr = buildFullAddress(item);
    if (!addr) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
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

  const visibleCount = [settings.visibleSections.orders, remindersEnabled && settings.visibleSections.reminders, settings.visibleSections.payments].filter(Boolean).length;
  const gridCols = visibleCount === 1 ? 'md:grid-cols-1' : visibleCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          {settings.viewMode === 'week' ? 'Mój tydzień' : 'Mój dzień'}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Ustawienia widoku">
            <Settings2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
        {settings.visibleSections.orders && (
          <DashboardColumn icon={<Calendar className="w-5 h-5 text-primary" />} title="Zlecenia" count={dashboardItems.length} emptyText="Brak zleceń na najbliższe dni robocze">
            {dashboardItems.map((item, idx) => {
              const pill = getDayPill(item.item_date, item.end_date);
              const addr = buildDisplayAddress(item);
              const mapsUrl = buildGoogleMapsUrl(item);
              const phone = item.customer_phone;
              const normalizedPhone = phone ? normalizePhone(phone) : null;

              return (
                <div
                  key={item.id}
                  className={`py-3 px-1 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border ${idx === 0 ? 'border-t' : ''}`}
                  onClick={() => onItemClick?.(item.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="text-lg font-bold leading-tight">{item.title}</div>
                      <div>
                      <Badge className={`text-[11px] px-2 py-0.5 ${pill.cls}`}>{pill.label}</Badge>
                      {prioritiesEnabled && item.priority != null && item.priority !== DEFAULT_PRIORITY && (() => {
                        const cfg = getPriorityConfig(item.priority);
                        return <Badge className={`text-[11px] px-2 py-0.5 border ${cfg.badgeCls}`}>{cfg.label}</Badge>;
                      })()}
                      </div>
                      {addr && mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1.5"
                          onClick={e => e.stopPropagation()}
                        >
                          {addr}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                        </a>
                      ) : addr ? (
                        <span className="text-sm text-foreground">{addr}</span>
                      ) : null}
                      {item.customer_name && (
                        <div className="text-sm text-foreground">{item.customer_name}</div>
                      )}
                      {normalizedPhone && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${normalizedPhone}`}
                            className="text-sm text-primary hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {formatPhoneDisplay(phone!)}
                          </a>
                          <a
                            href={`sms:${normalizedPhone}`}
                            className="text-muted-foreground hover:text-primary"
                            onClick={e => e.stopPropagation()}
                            title="Wyślij SMS"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                      {(item.price ?? 0) > 0 && (
                        <div className="text-sm font-medium text-foreground">
                          {item.price?.toFixed(2)} PLN
                        </div>
                      )}
                    </div>
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </DashboardColumn>
        )}
        {remindersEnabled && settings.visibleSections.reminders && (
          <DashboardColumn icon={<Bell className="w-5 h-5 text-primary" />} title="Przypomnienia" count={todayReminders.length} emptyText="Brak przypomnień">
            {todayReminders.map((r, idx) => (
              <ReminderCard key={r.id} reminder={r} isFirst={idx === 0} onDone={(e) => handleReminderDone(r.id, e)} onClick={() => onReminderClick?.(r.id)} />
            ))}
          </DashboardColumn>
        )}
        {settings.visibleSections.payments && (
          <DashboardColumn icon={<CreditCard className="w-5 h-5 text-primary" />} title="Płatności" count={allPaymentItems.length} emptyText="Brak płatności do rozliczenia">
            {allPaymentItems.map((item, idx) => (
              <PaymentCard key={item.id} item={item} isFirst={idx === 0} onClick={() => onPaymentClick?.(item.id)} />
            ))}
          </DashboardColumn>
        )}
      </div>

      <DashboardSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />
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

function getReminderUrgency(deadline: string): { badge: string; label: string | null } {
  const d = new Date(deadline + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return { badge: 'bg-red-500 text-white', label: 'PILNE' };
  if (days <= 7) return { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', label: 'WKRÓTCE' };
  return { badge: 'bg-green-100 text-green-700 border border-green-200', label: null };
}

const ReminderCard = ({ reminder, isFirst, onDone, onClick }: {
  reminder: ReminderRow; isFirst?: boolean;
  onDone: (e: React.MouseEvent) => void; onClick?: () => void;
}) => {
  const urgency = getReminderUrgency(reminder.deadline);
  return (
    <div
      className={`py-3 px-1 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border ${isFirst ? 'border-t' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          className="mt-0.5 shrink-0"
          onClick={onDone}
        />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm leading-tight">{reminder.name}</span>
            {urgency.label && (
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${urgency.badge}`}>
                {urgency.label}
              </span>
            )}
          </div>
          <div className="text-sm text-foreground">{formatReminderDeadline(reminder.deadline)}</div>
          {reminder.customer_name && (
            <div className="text-sm text-foreground">{reminder.customer_name}</div>
          )}
          {reminder.reminder_type_name && (
            <div className="text-sm text-muted-foreground">{reminder.reminder_type_name}</div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatReminderDeadline(deadline: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline + 'T00:00:00');
  const days = differenceInDays(deadlineDate, today);
  if (days === 0) return 'Deadline: Dziś';
  if (days === 1) return 'Deadline: Jutro';
  if (days < 0) return `Deadline: ${Math.abs(days)} dni temu`;
  return `Deadline: za ${days} dni`;
}

const PaymentCard = ({ item, isFirst, onClick }: {
  item: CalendarItemRow; isFirst?: boolean; onClick?: () => void;
}) => (
  <div
    className={`py-3 px-1 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border ${isFirst ? 'border-t' : ''}`}
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
      <div className="text-sm text-muted-foreground">
        {format(new Date(item.item_date + 'T00:00:00'), 'd MMM', { locale: pl })}
      </div>
      {item.customer_name && (
        <div className="text-sm text-foreground">{item.customer_name}</div>
      )}
      {(item.price ?? 0) > 0 && (
        <div className="text-sm font-medium text-foreground">
          {item.price?.toFixed(2)} PLN
        </div>
      )}
    </div>
  </div>
);

export default DashboardOverview;
