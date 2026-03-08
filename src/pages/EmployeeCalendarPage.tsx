import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays, addDays } from 'date-fns';
import { Calendar as CalendarIcon, ClipboardCheck, Clock, LayoutDashboard, LogOut, Menu, MoreHorizontal, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AdminCalendar from '@/components/admin/AdminCalendar';
import AddCalendarItemDialog from '@/components/admin/AddCalendarItemDialog';
import CalendarItemDetailsDrawer from '@/components/admin/CalendarItemDetailsDrawer';
import AddBreakDialog from '@/components/admin/AddBreakDialog';
import CalendarMapPanel from '@/components/admin/CalendarMapPanel';
import CalendarMap from '@/components/admin/CalendarMap';
import ProtocolsView from '@/components/protocols/ProtocolsView';
import CreateProtocolForm from '@/components/protocols/CreateProtocolForm';
import NotificationsView from '@/components/admin/NotificationsView';
import EmployeeDashboard from '@/components/employee/EmployeeDashboard';
import EmployeeTimeTrackingView from '@/components/employee/EmployeeTimeTrackingView';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import type { CalendarItem, CalendarColumn, Break, AssignedEmployee } from '@/components/admin/AdminCalendar';
import type { EditingCalendarItem } from '@/components/admin/AddCalendarItemDialog';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotifications, createNotification } from '@/hooks/useNotifications';
import { useInstanceFeature } from '@/hooks/useInstanceFeatures';

import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { CalendarItemRow } from '@/components/employee/EmployeeDashboard';
type EmployeeView = 'dashboard' | 'kalendarz' | 'protokoly' | 'czas-pracy' | 'aktywnosci';

const EmployeeCalendarPage = () => {
  const { configId } = useParams<{ configId: string }>();
  const navigate = useNavigate();
  const { signOut, username, user } = useAuth();
  const [currentView, setCurrentView] = useState<EmployeeView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Config state
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [linkedEmployeeResolved, setLinkedEmployeeResolved] = useState(false);

  // Calendar state
  const [calendarColumns, setCalendarColumns] = useState<CalendarColumn[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarBreaks, setCalendarBreaks] = useState<Break[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingCalendarItem | null>(null);
  const [addBreakOpen, setAddBreakOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({ columnId: '', date: '', time: '' });
  const [newBreakData, setNewBreakData] = useState({ columnId: '', date: '', time: '' });
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [mapOpen, setMapOpen] = useState(false);
  const [dashboardMapOpen, setDashboardMapOpen] = useState(false);
  const [dashboardMapItems, setDashboardMapItems] = useState<CalendarItemRow[]>([]);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [hqLocation, setHqLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const isMobile = useIsMobile();
  const { data: workingHours } = useWorkingHours(instanceId);
  const { enabled: activitiesEnabled } = useInstanceFeature(instanceId, 'activities');
  const { enabled: protocolsEnabled } = useInstanceFeature(instanceId, 'protocols');
  const { enabled: remindersEnabled } = useInstanceFeature(instanceId, 'reminders');
  const { enabled: prioritiesEnabled } = useInstanceFeature(instanceId, 'priorities');
  const { unreadCount } = useNotifications(activitiesEnabled ? instanceId : null);
  const { settings: dashboardSettings } = useDashboardSettings(instanceId);
  const mainRef = useRef<HTMLElement>(null);

  // Protocol form state
  const [protocolFormOpen, setProtocolFormOpen] = useState(false);
  const [protocolEditId, setProtocolEditId] = useState<string | null>(null);
  const [protocolPrefill, setProtocolPrefill] = useState<{
    customerId?: string | null;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddressId?: string | null;
    calendarItemId?: string;
  }>({});

  // Scroll to top on view change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [currentView]);

  // Fetch config
  useEffect(() => {
    const fetchConfig = async () => {
      if (!configId) return;
      const { data, error } = await supabase
        .from('employee_calendar_configs')
        .select('*')
        .eq('id', configId)
        .eq('active', true)
        .maybeSingle();

      if (error || !data) {
        toast.error('Nie znaleziono konfiguracji kalendarza');
        setLoading(false);
        return;
      }

      setConfig(data);
      setInstanceId(data.instance_id);
      setLoading(false);
    };
    fetchConfig();
  }, [configId]);

  // Fetch columns (only those from config)
  const fetchColumns = useCallback(async () => {
    if (!instanceId || !config) return;
    const columnIds = config.column_ids || [];
    if (columnIds.length === 0) return;

    const { data, error } = await supabase
      .from('calendar_columns')
      .select('id, name, color')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .in('id', columnIds)
      .order('sort_order');
    if (error) { console.error('Error fetching columns:', error); return; }
    setCalendarColumns(data || []);
  }, [instanceId, config]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!instanceId || !config) return;
    const columnIds = config.column_ids || [];
    if (columnIds.length === 0) return;

    const rangeStart = format(subDays(currentCalendarDate, 7), 'yyyy-MM-dd');
    const rangeEnd = format(addDays(currentCalendarDate, mapOpen ? 30 : 14), 'yyyy-MM-dd');

    let query = supabase
      .from('calendar_items')
      .select('id, column_id, title, customer_name, customer_phone, customer_email, customer_id, customer_address_id, assigned_employee_ids, item_date, end_date, start_time, end_time, status, admin_notes, price, photo_urls, media_items, payment_status, order_number, priority')
      .eq('instance_id', instanceId)
      .in('column_id', columnIds)
      .gte('item_date', rangeStart)
      .lte('item_date', rangeEnd);

    // Filter by linked employee so employees only see their own assignments
    if (linkedEmployeeId) {
      query = query.contains('assigned_employee_ids', [linkedEmployeeId]);
    }

    const { data, error } = await query;
    if (error) { console.error('Error fetching items:', error); return; }

    const items = data || [];

    // Fetch address names
    const addressIds = [...new Set(items.filter(i => i.customer_address_id).map(i => i.customer_address_id!))];
    if (addressIds.length > 0) {
      const { data: addresses } = await supabase
        .from('customer_addresses')
        .select('id, name, lat, lng, city, street')
        .in('id', addressIds);
      if (addresses) {
        const addressMap = new Map(addresses.map(a => [a.id, { name: a.name, lat: a.lat, lng: a.lng, city: a.city, street: a.street }]));
        items.forEach(item => {
          if (item.customer_address_id) {
            const addr = addressMap.get(item.customer_address_id);
            (item as any).address_name = addr?.name || null;
            (item as any).address_lat = addr?.lat || null;
            (item as any).address_lng = addr?.lng || null;
            (item as any).address_city = addr?.city || null;
            (item as any).address_street = addr?.street || null;
          }
        });
      }
    }

    // Fetch assigned employees
    const allEmployeeIds = [...new Set(items.flatMap(i => i.assigned_employee_ids || []))];
    if (allEmployeeIds.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, photo_url')
        .in('id', allEmployeeIds);
      if (employees) {
        const empMap = new Map(employees.map(e => [e.id, e]));
        items.forEach(item => {
          if (item.assigned_employee_ids?.length) {
            (item as any).assigned_employees = item.assigned_employee_ids
              .map(id => empMap.get(id))
              .filter(Boolean) as AssignedEmployee[];
          }
        });
      }
    }

    setCalendarItems(items as CalendarItem[]);
  }, [instanceId, config, currentCalendarDate, mapOpen, linkedEmployeeId]);

  // Fetch breaks
  const fetchBreaks = useCallback(async () => {
    if (!instanceId || !config) return;
    const columnIds = config.column_ids || [];
    if (columnIds.length === 0) return;

    const rangeStart = format(subDays(currentCalendarDate, 7), 'yyyy-MM-dd');
    const rangeEnd = format(addDays(currentCalendarDate, 14), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('breaks')
      .select('id, column_id, break_date, start_time, end_time, note')
      .eq('instance_id', instanceId)
      .in('column_id', columnIds)
      .gte('break_date', rangeStart)
      .lte('break_date', rangeEnd);
    if (error) { console.error('Error fetching breaks:', error); return; }
    setCalendarBreaks(data || []);
  }, [instanceId, config, currentCalendarDate]);

  useEffect(() => {
    if ((currentView === 'kalendarz' || currentView === 'dashboard') && config) {
      fetchColumns();
    }
    if (currentView === 'kalendarz' && config) {
      fetchItems();
      fetchBreaks();
    }
  }, [currentView, config, fetchColumns, fetchItems, fetchBreaks]);

  // Fetch linked employee ID
  useEffect(() => {
    if (!instanceId || !user) return;
    supabase
      .from('employees')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('linked_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLinkedEmployeeId(data.id);
      });
  }, [instanceId, user]);

  // Fetch HQ location
  useEffect(() => {
    if (!instanceId) return;
    supabase
      .from('instances')
      .select('name, address_lat, address_lng')
      .eq('id', instanceId)
      .single()
      .then(({ data }) => {
        if (data && (data as any).address_lat && (data as any).address_lng) {
          setHqLocation({ lat: (data as any).address_lat, lng: (data as any).address_lng, name: data.name || 'Baza' });
        }
      });
  }, [instanceId]);

  // Realtime
  useEffect(() => {
    if (!instanceId || currentView !== 'kalendarz') return;
    const channel = supabase
      .channel('employee-calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_items', filter: `instance_id=eq.${instanceId}` }, () => {
        fetchItems();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks', filter: `instance_id=eq.${instanceId}` }, () => {
        fetchBreaks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, currentView, fetchItems, fetchBreaks]);

  const allowedActions = {
    add_item: true,
    edit_item: true,
    delete_item: true,
    change_time: true,
    change_column: true,
    edit_services: true,
    ...(config?.allowed_actions || {}),
  };

  const handleItemClick = (item: CalendarItem) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const handleAddItem = (columnId: string, date: string, time: string) => {
    if (!allowedActions.add_item) return;
    setEditingItem(null);
    setNewItemData({ columnId, date, time });
    setAddItemOpen(true);
  };

  const handleAddBreak = (columnId: string, date: string, time: string) => {
    setNewBreakData({ columnId, date, time });
    setAddBreakOpen(true);
  };

  const handleDeleteBreak = async (breakId: string) => {
    const { error } = await supabase.from('breaks').delete().eq('id', breakId);
    if (error) { toast.error('Błąd usuwania przerwy'); return; }
    fetchBreaks();
    toast.success('Przerwa usunięta');
  };

  const handleItemMove = async (itemId: string, newColumnId: string, newDate: string, newTime?: string) => {
    if (!allowedActions.change_time && !allowedActions.change_column) return;
    const item = calendarItems.find(i => i.id === itemId);
    if (!item) return;

    const updateData: any = { column_id: newColumnId, item_date: newDate };
    if (newTime) {
      const originalStart = parseFloat(item.start_time.split(':')[0]) + parseFloat(item.start_time.split(':')[1]) / 60;
      const originalEnd = parseFloat(item.end_time.split(':')[0]) + parseFloat(item.end_time.split(':')[1]) / 60;
      const duration = originalEnd - originalStart;
      const newStartParts = newTime.split(':').map(Number);
      const newEndTotal = newStartParts[0] + newStartParts[1] / 60 + duration;
      const endHour = Math.floor(newEndTotal);
      const endMin = Math.round((newEndTotal - endHour) * 60);
      updateData.start_time = newTime;
      updateData.end_time = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }

    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updateData } : i));
    const { error } = await supabase.from('calendar_items').update(updateData).eq('id', itemId);
    if (error) { toast.error('Błąd przenoszenia'); fetchItems(); }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!allowedActions.delete_item) return;
    await Promise.all([
      supabase.from('invoices').delete().eq('calendar_item_id', itemId),
      supabase.from('calendar_item_services').delete().eq('calendar_item_id', itemId),
      supabase.from('customer_sms_notifications').delete().eq('calendar_item_id', itemId),
      supabase.from('sms_logs').delete().eq('calendar_item_id', itemId),
      supabase.from('protocols').delete().eq('calendar_item_id', itemId),
    ]);
    const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
    if (error) { toast.error('Błąd usuwania'); return; }
    setCalendarItems(prev => prev.filter(i => i.id !== itemId));
    toast.success('Zlecenie usunięte');
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    setSelectedItem(prev => prev && prev.id === itemId ? { ...prev, status: newStatus } : prev);
    const { error } = await supabase.from('calendar_items').update({ status: newStatus }).eq('id', itemId);
    if (error) { toast.error('Błąd zmiany statusu'); fetchItems(); return; }
    setDashboardRefreshKey(k => k + 1);

    // Notify admins when employee starts/completes a task
    if (activitiesEnabled && instanceId && (newStatus === 'in_progress' || newStatus === 'completed')) {
      // Fetch item title directly from DB to ensure we have it regardless of view state
      let itemTitle = 'Zlecenie';
      const { data: itemData } = await supabase.from('calendar_items').select('title, customer_name').eq('id', itemId).single();
      if (itemData) {
        itemTitle = itemData.title || itemData.customer_name || 'Zlecenie';
      }

      const notifType = newStatus === 'in_progress' ? 'item_started' : 'item_completed';

      // Get employee name for the notification
      let employeeName = username || 'Pracownik';
      if (linkedEmployeeId) {
        const { data: empData } = await supabase.from('employees').select('name').eq('id', linkedEmployeeId).single();
        if (empData?.name) employeeName = empData.name;
      }

      const notifTitle = newStatus === 'in_progress'
        ? `Pracownik ${employeeName} rozpoczął zlecenie ${itemTitle}`
        : `Pracownik ${employeeName} zakończył zlecenie ${itemTitle}`;

      // Find admin user_ids for this instance via security definer function
      const { data: adminUsers } = await supabase.rpc('get_instance_admin_user_ids', { _instance_id: instanceId });
      for (const ar of adminUsers || []) {
        await createNotification({
          instanceId,
          userId: (ar as any).user_id,
          type: notifType,
          title: notifTitle,
          calendarItemId: itemId,
        });
      }
    }
  };

  const handleEditItem = (item: CalendarItem) => {
    if (!allowedActions.edit_item) return;
    setEditingItem({
      id: item.id, title: item.title, customer_name: item.customer_name,
      customer_phone: item.customer_phone, customer_email: item.customer_email,
      customer_id: item.customer_id, customer_address_id: item.customer_address_id,
      assigned_employee_ids: item.assigned_employee_ids, item_date: item.item_date,
      end_date: item.end_date, start_time: item.start_time, end_time: item.end_time,
      column_id: item.column_id, admin_notes: item.admin_notes, price: item.price,
      priority: (item as any).priority,
    });
    setDetailsOpen(false);
    setAddItemOpen(true);
  };

  const handleLogout = async () => { await signOut(); };
  const displayName = username || user?.email || 'Pracownik';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard' as EmployeeView, label: dashboardSettings.viewMode === 'week' ? 'Mój tydzień' : 'Mój dzień', icon: LayoutDashboard },
    { id: 'czas-pracy' as EmployeeView, label: 'Czas pracy', icon: Clock },
    ...(protocolsEnabled ? [{ id: 'protokoly' as EmployeeView, label: 'Protokoły', icon: ClipboardCheck }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar overlay - only on mobile when "Więcej" is tapped */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:sticky top-0 inset-y-0 left-0 z-[70] h-screen w-64 bg-card border-r border-border/50 transition-all duration-300 flex-shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <button onClick={() => setCurrentView('kalendarz')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="rounded-xl bg-primary flex items-center justify-center shrink-0 w-10 h-10">
                <span className="text-primary-foreground font-bold text-lg">N2</span>
              </div>
              <div className="text-left min-w-0 flex-1">
                <h1 className="font-bold text-foreground truncate">N2Service</h1>
              </div>
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={currentView === id ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => { setCurrentView(id); setSidebarOpen(false); }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Button>
            ))}
          </nav>

          <div className="p-4 space-y-3">
            <div className="border-t border-border/30 pt-3">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                Wyloguj ({displayName})
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main ref={mainRef} className="flex-1 overflow-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {currentView === 'dashboard' && instanceId && config ? (
            <>
              <EmployeeDashboard
                key={dashboardRefreshKey}
                instanceId={instanceId}
                columnIds={config.column_ids || []}
                hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                hideHours={config?.visible_fields && (config.visible_fields as any).hours === false}
                onItemClick={(item) => handleItemClick(item)}
                linkedEmployeeId={linkedEmployeeId}
                workingHours={workingHours}
                onOpenMap={(items) => {
                  setDashboardMapItems(items);
                  setDashboardMapOpen(true);
                }}
                remindersEnabled={remindersEnabled}
                prioritiesEnabled={prioritiesEnabled}
              />
              <CalendarItemDetailsDrawer
                item={selectedItem}
                open={detailsOpen}
                onClose={() => { setDetailsOpen(false); setSelectedItem(null); }}
                columns={calendarColumns}
                onStatusChange={handleStatusChange}
                onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
                onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
                canEditServices={!!allowedActions.edit_services}
                hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                hideHours={config?.visible_fields && (config.visible_fields as any).hours === false}
                onAddProtocol={protocolsEnabled ? async (item) => {
                  setDetailsOpen(false);
                  const { data: existing } = await supabase
                    .from('protocols')
                    .select('id')
                    .eq('calendar_item_id', item.id)
                    .eq('instance_id', instanceId!)
                    .maybeSingle();
                  setProtocolEditId(existing?.id || null);
                  setProtocolPrefill({
                    customerId: item.customer_id,
                    customerName: item.customer_name || '',
                    customerPhone: item.customer_phone || '',
                    customerEmail: item.customer_email || '',
                    customerAddressId: item.customer_address_id,
                    calendarItemId: item.id,
                  });
                  setProtocolFormOpen(true);
                } : undefined}
                instanceId={instanceId || undefined}
                forceSideRight
                isEmployee
              />
              <Sheet open={dashboardMapOpen} onOpenChange={setDashboardMapOpen}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0" hideCloseButton>
                  <SheetTitle className="sr-only">Mapa zleceń</SheetTitle>
                  <SheetDescription className="sr-only">Mapa</SheetDescription>
                  <div className="flex flex-col h-full">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <h3 className="font-bold text-lg">Mapa zleceń</h3>
                      <Button variant="ghost" size="icon" onClick={() => setDashboardMapOpen(false)}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <CalendarMap
                        items={dashboardMapItems.map(di => ({
                          id: di.id, title: di.title, item_date: di.item_date,
                          start_time: di.start_time, end_time: di.end_time,
                          column_id: di.column_id, status: di.status,
                          customer_name: di.customer_name, customer_phone: di.customer_phone,
                          customer_email: di.customer_email, customer_id: di.customer_id,
                          customer_address_id: di.customer_address_id,
                          assigned_employee_ids: di.assigned_employee_ids,
                          admin_notes: di.admin_notes, price: di.price,
                          address_lat: di.address_lat, address_lng: di.address_lng,
                          address_city: di.address_city, address_street: di.address_street,
                          address_name: di.address_name,
                        } as any))}
                        columns={calendarColumns}
                        onItemClick={(item) => { setDashboardMapOpen(false); handleItemClick(item); }}
                        hqLocation={hqLocation}
                        instanceId={instanceId || ''}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : currentView === 'czas-pracy' && instanceId ? (
            <EmployeeTimeTrackingView instanceId={instanceId} />
          ) : currentView === 'aktywnosci' && instanceId && activitiesEnabled ? (
            <NotificationsView
              instanceId={instanceId}
              onItemClick={(calendarItemId) => {
                supabase.from('calendar_items')
                  .select('id, column_id, title, customer_name, customer_phone, customer_email, customer_id, customer_address_id, assigned_employee_ids, item_date, end_date, start_time, end_time, status, admin_notes, price, photo_urls, media_items, payment_status, order_number')
                  .eq('id', calendarItemId)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      setSelectedItem(data as CalendarItem);
                      setDetailsOpen(true);
                    }
                  });
              }}
            />
          ) : currentView === 'protokoly' && instanceId ? (
            <ProtocolsView instanceId={instanceId} filterByUserId={user?.id} />
          ) : currentView === 'kalendarz' && instanceId ? (
            (() => {
              const calendarContent = (
                <>
                  <AdminCalendar
                    columns={calendarColumns}
                    items={calendarItems}
                    breaks={calendarBreaks}
                    onItemClick={handleItemClick}
                    onAddItem={undefined}
                    onAddBreak={handleAddBreak}
                    onDeleteBreak={handleDeleteBreak}
                    onItemMove={handleItemMove}
                    onDateChange={(date) => setCurrentCalendarDate(date)}
                    selectedItemId={selectedItem?.id}
                    onToggleMap={() => setMapOpen(prev => !prev)}
                    mapOpen={mapOpen}
                    hideHours={config?.visible_fields && (config.visible_fields as any).hours === false}
                    prioritiesEnabled={prioritiesEnabled}
                  />


                  <CalendarItemDetailsDrawer
                    item={selectedItem}
                    open={detailsOpen}
                    onClose={() => { setDetailsOpen(false); setSelectedItem(null); }}
                    columns={calendarColumns}
                    onStatusChange={handleStatusChange}
                    onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
                    onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
                    
                    canEditServices={!!allowedActions.edit_services}
                    hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                    hideHours={config?.visible_fields && (config.visible_fields as any).hours === false}
                    onAddProtocol={protocolsEnabled ? async (item) => {
                      setDetailsOpen(false);
                      const { data: existing } = await supabase
                        .from('protocols')
                        .select('id')
                        .eq('calendar_item_id', item.id)
                        .eq('instance_id', instanceId!)
                        .maybeSingle();
                      setProtocolEditId(existing?.id || null);
                      setProtocolPrefill({
                        customerId: item.customer_id,
                        customerName: item.customer_name || '',
                        customerPhone: item.customer_phone || '',
                        customerEmail: item.customer_email || '',
                        customerAddressId: item.customer_address_id,
                        calendarItemId: item.id,
                      });
                      setProtocolFormOpen(true);
                    } : undefined}
                    instanceId={instanceId || undefined}
                    isEmployee
                  />

                  <AddBreakDialog
                    open={addBreakOpen}
                    onOpenChange={setAddBreakOpen}
                    instanceId={instanceId}
                    columns={calendarColumns}
                    initialData={newBreakData}
                    onBreakAdded={() => fetchBreaks()}
                  />
                </>
              );

              return (
                <div className="flex-1 min-h-[600px] h-full relative">
                  {calendarContent}
                  {mapOpen && (
                    <CalendarMapPanel
                      items={calendarItems}
                      columns={calendarColumns}
                      onItemClick={handleItemClick}
                      onClose={() => setMapOpen(false)}
                      hqLocation={hqLocation}
                      instanceId={instanceId || ''}
                    />
                  )}
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Brak konfiguracji kalendarza</p>
            </div>
          )}
        </main>

        {/* Mobile bottom navigation bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 flex items-center justify-around h-14 pb-2.5">
          {[
            { id: 'dashboard' as EmployeeView, label: 'Mój dzień', icon: LayoutDashboard },
            { id: 'czas-pracy' as EmployeeView, label: 'Czas pracy', icon: Clock },
            ...(activitiesEnabled ? [{ id: 'aktywnosci' as EmployeeView, label: 'Aktywności', icon: Bell }] : []),
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors relative",
                currentView === id ? "text-primary font-semibold" : "text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {id === 'aktywnosci' && unreadCount > 0 && (
                <span className="absolute top-0.5 right-1/2 translate-x-3 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors",
              sidebarOpen ? "text-primary font-semibold" : "text-foreground"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Więcej</span>
          </button>
        </nav>
      </div>

      {/* Add/Edit order dialog - global so it works also from "Mój dzień" */}
      {instanceId && (
        <AddCalendarItemDialog
          open={addItemOpen}
          onClose={() => { setAddItemOpen(false); setEditingItem(null); }}
          instanceId={instanceId}
          columns={calendarColumns}
          onSuccess={() => { fetchItems(); setEditingItem(null); }}
          editingItem={editingItem}
          initialDate={newItemData.date}
          initialTime={newItemData.time}
          initialColumnId={newItemData.columnId}
        />
      )}

      {/* Protocol form - rendered outside view blocks so it's always available */}
      {instanceId && (
        <CreateProtocolForm
          open={protocolFormOpen}
          onClose={() => { setProtocolFormOpen(false); setProtocolPrefill({}); setProtocolEditId(null); }}
          instanceId={instanceId}
          onSuccess={() => { setProtocolFormOpen(false); setProtocolPrefill({}); setProtocolEditId(null); }}
          editingProtocolId={protocolEditId}
          prefillCustomerId={protocolPrefill.customerId}
          prefillCustomerName={protocolPrefill.customerName}
          prefillCustomerPhone={protocolPrefill.customerPhone}
          prefillCustomerEmail={protocolPrefill.customerEmail}
          prefillCustomerAddressId={protocolPrefill.customerAddressId}
          prefillCalendarItemId={protocolPrefill.calendarItemId}
        />
      )}

      {/* Global drawer for notifications view */}
      {currentView === 'aktywnosci' && (
        <CalendarItemDetailsDrawer
          item={selectedItem}
          open={detailsOpen}
          onClose={() => { setDetailsOpen(false); setSelectedItem(null); }}
          columns={calendarColumns}
          onStatusChange={handleStatusChange}
          onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
          onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
          canEditServices={!!allowedActions.edit_services}
          hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
          hideHours={config?.visible_fields && (config.visible_fields as any).hours === false}
          instanceId={instanceId || undefined}
          forceSideRight
          isEmployee
        />
      )}
    </div>
  );
};

export default EmployeeCalendarPage;
