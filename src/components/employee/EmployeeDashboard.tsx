import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { getNextWorkingDays } from '@/lib/workingDaysUtils';
import { pl } from 'date-fns/locale';
import { Calendar, Bell, ChevronRight, MessageSquare, MapPin, Settings2 } from 'lucide-react';
import { getPriorityConfig, DEFAULT_PRIORITY } from '@/lib/priorityUtils';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import DashboardSettingsDrawer from '@/components/admin/DashboardSettingsDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatPhoneDisplay, normalizePhone } from '@/lib/phoneUtils';

type WorkingHours = Record<string, { open: string; close: string } | null> | null;

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Do wykonania', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  in_progress: { label: 'W trakcie', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  completed: { label: 'Zakończone', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'Anulowane', cls: 'bg-red-100 text-red-800 border-red-300' },
};

interface EmployeeDashboardProps {
  instanceId: string;
  columnIds: string[];
  hidePrices?: boolean;
  hideHours?: boolean;
  onItemClick?: (item: any) => void;
  linkedEmployeeId?: string | null;
  workingHours?: WorkingHours;
  onOpenMap?: (items: CalendarItemRow[]) => void;
  viewModeLabel?: string;
  remindersEnabled?: boolean;
  prioritiesEnabled?: boolean;
}

export interface CalendarItemRow {
  id: string;
  title: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_id: string | null;
  customer_address_id: string | null;
  item_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  status: string;
  column_id: string | null;
  assigned_employee_ids: string[] | null;
  admin_notes: string | null;
  price: number | null;
  payment_status: string | null;
  address_name?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  employee_names?: string[];
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

const EmployeeDashboard = ({ instanceId, columnIds, hidePrices, hideHours, onItemClick, linkedEmployeeId, workingHours, onOpenMap, remindersEnabled = true, prioritiesEnabled = false }: EmployeeDashboardProps) => {
  const [items, setItems] = useState<CalendarItemRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, save: saveSettings } = useDashboardSettings(instanceId);

  const [stableWorkingHours, setStableWorkingHours] = useState<WorkingHours>(workingHours ?? null);

  // Guard: only update stableWorkingHours when we get real data (not undefined during refetch)
  useEffect(() => {
    if (workingHours !== undefined) {
      setStableWorkingHours(workingHours ?? null);
    }
  }, [workingHours]);

  const daysCount = settings.viewMode === 'week' ? 7 : 3;
  const businessDays = useMemo(() => getNextWorkingDays(daysCount, stableWorkingHours), [stableWorkingHours, daysCount]);
  const dateStart = businessDays[0];
  const dateEnd = businessDays[businessDays.length - 1];

  const fetchData = useCallback(async () => {
    if (!instanceId || columnIds.length === 0) { setLoading(false); return; }
    setLoading(true);

    let itemsQuery = supabase
        .from('calendar_items')
        .select('id, column_id, title, customer_name, customer_phone, customer_email, customer_id, customer_address_id, assigned_employee_ids, item_date, end_date, start_time, end_time, status, admin_notes, price, payment_status, priority')
        .eq('instance_id', instanceId)
        .in('column_id', columnIds)
        .lte('item_date', dateEnd)
        .or(`end_date.gte.${dateStart},item_date.gte.${dateStart}`)
        .neq('status', 'cancelled')
        .order('item_date')
        .order('start_time');

    if (linkedEmployeeId) {
      itemsQuery = itemsQuery.contains('assigned_employee_ids', [linkedEmployeeId]);
    }

    const [itemsRes, remindersRes] = await Promise.all([
      itemsQuery,
      (supabase
        .from('reminders')
        .select('id, name, deadline, customer_id, reminder_type_id, status, days_before')
        .eq('instance_id', instanceId)
        .eq('status', 'todo') as any)
        .eq('visible_for_employee', true)
        .order('deadline'),
    ]);

    const calItems = (itemsRes.data as CalendarItemRow[]) || [];
    const remItems = (remindersRes.data as ReminderRow[]) || [];

    // Fetch addresses (including lat, lng for map)
    const addressIds = [...new Set(calItems.filter(i => i.customer_address_id).map(i => i.customer_address_id!))];
    if (addressIds.length > 0) {
      const { data: addresses } = await supabase.from('customer_addresses').select('id, name, street, city, lat, lng').in('id', addressIds);
      if (addresses) {
        const addrMap = new Map(addresses.map(a => [a.id, a]));
        calItems.forEach(i => {
          if (i.customer_address_id) {
            const addr = addrMap.get(i.customer_address_id);
            if (addr) {
              i.address_name = addr.name;
              i.address_street = addr.street;
              i.address_city = addr.city;
              i.address_lat = addr.lat;
              i.address_lng = addr.lng;
            }
          }
        });
      }
    }

    // Fetch employee names
    const allEmpIds = [...new Set(calItems.flatMap(i => i.assigned_employee_ids || []))];
    if (allEmpIds.length > 0) {
      const { data: employees } = await supabase.from('employees').select('id, name').in('id', allEmpIds);
      if (employees) {
        const empMap = new Map(employees.map(e => [e.id, e.name]));
        calItems.forEach(i => {
          if (i.assigned_employee_ids?.length) {
            i.employee_names = i.assigned_employee_ids.map(id => empMap.get(id)).filter(Boolean) as string[];
          }
        });
      }
    }

    // Fetch reminder customer/type names
    const customerIds = [...new Set(remItems.filter(r => r.customer_id).map(r => r.customer_id!))];
    const typeIds = [...new Set(remItems.filter(r => r.reminder_type_id).map(r => r.reminder_type_id!))];
    const [custRes, typeRes] = await Promise.all([
      customerIds.length > 0 ? supabase.from('customers').select('id, name').in('id', customerIds) : { data: [] },
      typeIds.length > 0 ? supabase.from('reminder_types').select('id, name').in('id', typeIds) : { data: [] },
    ]);
    if (custRes.data) {
      const custMap = new Map((custRes.data as any[]).map(c => [c.id, c.name]));
      remItems.forEach(r => { if (r.customer_id) r.customer_name = custMap.get(r.customer_id); });
    }
    if (typeRes.data) {
      const typeMap = new Map((typeRes.data as any[]).map(t => [t.id, t.name]));
      remItems.forEach(r => { if (r.reminder_type_id) r.reminder_type_name = typeMap.get(r.reminder_type_id); });
    }

    // Filter reminders within notification window
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filteredReminders = remItems.filter(r => {
      const deadlineDate = new Date(r.deadline + 'T00:00:00');
      const notifyDate = new Date(deadlineDate);
      notifyDate.setDate(notifyDate.getDate() - r.days_before);
      return notifyDate <= today;
    });

    setItems(calItems.sort((a, b) => {
      const dateCmp = a.item_date.localeCompare(b.item_date);
      if (dateCmp !== 0) return dateCmp;
      const aPri = a.priority ?? DEFAULT_PRIORITY;
      const bPri = b.priority ?? DEFAULT_PRIORITY;
      return aPri - bPri;
    }));
    setReminders(filteredReminders);
    setLoading(false);
  }, [instanceId, columnIds, dateStart, dateEnd, linkedEmployeeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReminderDone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('reminders').update({ status: 'done' } as any).eq('id', id);
    if (error) { toast.error('Błąd zmiany statusu'); return; }
    toast.success('Przypomnienie oznaczone jako wykonane');
    fetchData();
  };

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
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map(i => (
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

  const dashboardTitle = settings.viewMode === 'week' ? 'Mój tydzień' : 'Mój dzień';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Ustawienia widoku">
            <Settings2 className="w-5 h-5" />
          </Button>
          {onOpenMap && (
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onOpenMap(items)}>
              <MapPin className="w-4 h-4" />
              Mapa
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zlecenia */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Zlecenia</h3>
              <span className="text-sm text-muted-foreground">({items.length})</span>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-3">Brak zleceń</p>
            ) : (
              <div>
                {items.map((item, idx) => {
                  const pill = getDayPill(item.item_date, item.end_date);
                  const statusCfg = STATUS_CONFIG[item.status] || { label: item.status, cls: 'bg-muted text-muted-foreground' };
                  const addr = buildDisplayAddress(item);
                  const mapsUrl = buildGoogleMapsUrl(item);
                  const phone = item.customer_phone;
                  const normalizedPhone = phone ? normalizePhone(phone) : null;

                  return (
                    <div
                      key={item.id}
                      className={`py-3 px-1 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border ${idx === 0 ? 'border-t' : ''}`}
                      onClick={() => onItemClick?.(item)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="text-lg font-bold leading-tight">{item.title}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={`text-[11px] px-2 py-0.5 ${pill.cls}`}>{pill.label}</Badge>
                            <Badge className={`text-[11px] px-2 py-0.5 ${statusCfg.cls}`}>{statusCfg.label}</Badge>
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
                        </div>
                        <div className="w-10 shrink-0 flex items-center justify-center">
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Przypomnienia - hide entire section when count = 0 or reminders disabled */}
        {remindersEnabled && reminders.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Przypomnienia</h3>
                <span className="text-sm text-muted-foreground">({reminders.length})</span>
              </div>
              <div>
                {reminders.map((r, idx) => {
                  const deadlineDate = new Date(r.deadline + 'T00:00:00');
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const days = differenceInDays(deadlineDate, today);
                  const deadlineLabel = days === 0 ? 'Deadline: Dziś' : days === 1 ? 'Deadline: Jutro' : days < 0 ? `Deadline: ${Math.abs(days)} dni temu` : `Deadline: za ${days} dni`;

                  const urgencyBadge = days <= 3
                    ? { cls: 'bg-red-500 text-white', label: 'PILNE' }
                    : days <= 7
                    ? { cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200', label: 'WKRÓTCE' }
                    : { cls: '', label: null };

                  return (
                    <div
                      key={r.id}
                      className={`py-3 px-1 transition-colors border-b border-border ${idx === 0 ? 'border-t' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          className="mt-0.5 shrink-0"
                          onClick={(e) => handleReminderDone(r.id, e)}
                        />
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-base leading-tight">{r.name}</span>
                            {urgencyBadge.label && (
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${urgencyBadge.cls}`}>
                                {urgencyBadge.label}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-foreground">{deadlineLabel}</div>
                          {r.customer_name && (
                            <div className="text-sm text-foreground">{r.customer_name}</div>
                          )}
                          {r.reminder_type_name && (
                            <div className="text-sm text-muted-foreground">{r.reminder_type_name}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DashboardSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
        isEmployee
      />
    </div>
  );
};

export default EmployeeDashboard;
