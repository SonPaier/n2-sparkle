import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays, addDays } from 'date-fns';
import { Calendar as CalendarIcon, ClipboardCheck, LayoutDashboard, LogOut, Menu, MoreHorizontal, X } from 'lucide-react';
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
import ProtocolsView from '@/components/protocols/ProtocolsView';
import CreateProtocolForm from '@/components/protocols/CreateProtocolForm';
import EmployeeDashboard from '@/components/employee/EmployeeDashboard';
import type { CalendarItem, CalendarColumn, Break, AssignedEmployee } from '@/components/admin/AdminCalendar';
import type { EditingCalendarItem } from '@/components/admin/AddCalendarItemDialog';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

type EmployeeView = 'dashboard' | 'kalendarz' | 'protokoly';

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
  const [hqLocation, setHqLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const isMobile = useIsMobile();

  // Protocol form state
  const [protocolFormOpen, setProtocolFormOpen] = useState(false);
  const [protocolPrefill, setProtocolPrefill] = useState<{
    customerId?: string | null;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddressId?: string | null;
    calendarItemId?: string;
  }>({});

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

    const { data, error } = await supabase
      .from('calendar_items')
      .select('id, column_id, title, customer_name, customer_phone, customer_email, customer_id, customer_address_id, assigned_employee_ids, item_date, end_date, start_time, end_time, status, admin_notes, price, photo_urls, media_items, payment_status')
      .eq('instance_id', instanceId)
      .in('column_id', columnIds)
      .gte('item_date', rangeStart)
      .lte('item_date', rangeEnd);
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
  }, [instanceId, config, currentCalendarDate, mapOpen]);

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

  const allowedActions = config?.allowed_actions || {};

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
    const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
    if (error) { toast.error('Błąd usuwania'); return; }
    setCalendarItems(prev => prev.filter(i => i.id !== itemId));
    toast.success('Zlecenie usunięte');
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    setSelectedItem(prev => prev && prev.id === itemId ? { ...prev, status: newStatus } : prev);
    const { error } = await supabase.from('calendar_items').update({ status: newStatus }).eq('id', itemId);
    if (error) { toast.error('Błąd zmiany statusu'); fetchItems(); }
    else toast.success('Status zmieniony');
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
    { id: 'dashboard' as EmployeeView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kalendarz' as EmployeeView, label: 'Kalendarz', icon: CalendarIcon },
    { id: 'protokoly' as EmployeeView, label: 'Protokoły', icon: ClipboardCheck },
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
        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {currentView === 'dashboard' && instanceId && config ? (
            <>
              <EmployeeDashboard
                instanceId={instanceId}
                columnIds={config.column_ids || []}
                hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                onItemClick={(item) => handleItemClick(item)}
                linkedEmployeeId={linkedEmployeeId}
              />
              <CalendarItemDetailsDrawer
                item={selectedItem}
                open={detailsOpen}
                onClose={() => { setDetailsOpen(false); setSelectedItem(null); }}
                columns={calendarColumns}
                onDelete={allowedActions.delete_item ? handleDeleteItem : undefined}
                onEdit={allowedActions.edit_item ? handleEditItem : undefined}
                onStatusChange={handleStatusChange}
                onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
                onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
                hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                onAddProtocol={(item) => {
                  setDetailsOpen(false);
                  setProtocolPrefill({
                    customerId: item.customer_id,
                    customerName: item.customer_name || '',
                    customerPhone: item.customer_phone || '',
                    customerEmail: item.customer_email || '',
                    customerAddressId: item.customer_address_id,
                    calendarItemId: item.id,
                  });
                  setProtocolFormOpen(true);
                }}
                instanceId={instanceId || undefined}
                forceSideRight
              />
            </>
          ) : currentView === 'protokoly' && instanceId ? (
            <ProtocolsView instanceId={instanceId} />
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
                  />

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

                  <CalendarItemDetailsDrawer
                    item={selectedItem}
                    open={detailsOpen}
                    onClose={() => { setDetailsOpen(false); setSelectedItem(null); }}
                    columns={calendarColumns}
                    onDelete={allowedActions.delete_item ? handleDeleteItem : undefined}
                    onEdit={allowedActions.edit_item ? handleEditItem : undefined}
                    onStatusChange={handleStatusChange}
                    onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
                    onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
                    hidePrices={config?.visible_fields && (config.visible_fields as any).price === false}
                    onAddProtocol={(item) => {
                      setDetailsOpen(false);
                      setProtocolPrefill({
                        customerId: item.customer_id,
                        customerName: item.customer_name || '',
                        customerPhone: item.customer_phone || '',
                        customerEmail: item.customer_email || '',
                        customerAddressId: item.customer_address_id,
                        calendarItemId: item.id,
                      });
                      setProtocolFormOpen(true);
                    }}
                    instanceId={instanceId || undefined}
                  />

                  <AddBreakDialog
                    open={addBreakOpen}
                    onOpenChange={setAddBreakOpen}
                    instanceId={instanceId}
                    columns={calendarColumns}
                    initialData={newBreakData}
                    onBreakAdded={() => fetchBreaks()}
                  />
                  {instanceId && (
                    <CreateProtocolForm
                      open={protocolFormOpen}
                      onClose={() => { setProtocolFormOpen(false); setProtocolPrefill({}); }}
                      instanceId={instanceId}
                      onSuccess={() => { setProtocolFormOpen(false); setProtocolPrefill({}); }}
                      editingProtocolId={null}
                      prefillCustomerId={protocolPrefill.customerId}
                      prefillCustomerName={protocolPrefill.customerName}
                      prefillCustomerPhone={protocolPrefill.customerPhone}
                      prefillCustomerEmail={protocolPrefill.customerEmail}
                      prefillCustomerAddressId={protocolPrefill.customerAddressId}
                      prefillCalendarItemId={protocolPrefill.calendarItemId}
                    />
                  )}
                </>
              );

              const mapPanel = mapOpen ? (
                <CalendarMapPanel
                  items={calendarItems}
                  columns={calendarColumns}
                  onItemClick={handleItemClick}
                  onClose={() => setMapOpen(false)}
                  hqLocation={hqLocation}
                />
              ) : null;

              if (isMobile && mapOpen) {
                return (
                  <div className="flex-1 min-h-[600px] h-full relative">
                    {calendarContent}
                    <Drawer open={mapOpen} onOpenChange={setMapOpen}>
                      <DrawerContent className="h-[90vh]">
                        {mapPanel}
                      </DrawerContent>
                    </Drawer>
                  </div>
                );
              }

              if (mapOpen) {
                return (
                  <div className="flex flex-1 min-h-[600px] h-full">
                    <div className="w-1/2 min-w-0 relative">
                      {calendarContent}
                    </div>
                    <div className="w-1/2 min-w-0">
                      {mapPanel}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex-1 min-h-[600px] h-full relative">
                  {calendarContent}
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
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 flex items-center justify-around h-14">
          {[
            { id: 'dashboard' as EmployeeView, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'protokoly' as EmployeeView, label: 'Protokoły', icon: ClipboardCheck },
            { id: 'kalendarz' as EmployeeView, label: 'Kalendarz', icon: CalendarIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors",
                currentView === id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs transition-colors",
              sidebarOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>Więcej</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default EmployeeCalendarPage;
