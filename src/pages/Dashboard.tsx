import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, subDays, addDays } from 'date-fns';
import { Calendar, Users, BadgeDollarSign, Settings, HardHat, ClipboardCheck, Receipt } from 'lucide-react';
import DashboardLayout, { type ViewType } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import SettingsView from '@/components/admin/SettingsView';
import ServicesView from '@/components/admin/ServicesView';
import CustomersView from '@/components/admin/CustomersView';
import AdminCalendar from '@/components/admin/AdminCalendar';
import AddCalendarItemDialog from '@/components/admin/AddCalendarItemDialog';
import CalendarItemDetailsDrawer from '@/components/admin/CalendarItemDetailsDrawer';
import AddBreakDialog from '@/components/admin/AddBreakDialog';
import CalendarMapPanel from '@/components/admin/CalendarMapPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CalendarItem, CalendarColumn, Break, AssignedEmployee } from '@/components/admin/AdminCalendar';
import type { EditingCalendarItem } from '@/components/admin/AddCalendarItemDialog';
import { EmployeesView } from '@/components/admin/employees';
import ProtocolsView from '@/components/protocols/ProtocolsView';
import SettlementsView from '@/components/admin/SettlementsView';
import CreateProtocolForm from '@/components/protocols/CreateProtocolForm';
import SmsNotificationsView from '@/components/admin/SmsNotificationsView';
import { MessageSquare } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

const validViews: ViewType[] = ['kalendarz', 'klienci', 'uslugi', 'pracownicy', 'protokoly', 'rozliczenia', 'powiadomienia-sms', 'ustawienia'];

const viewConfig: Record<ViewType, { label: string; icon: React.ElementType; description: string }> = {
  kalendarz: { label: 'Kalendarz', icon: Calendar, description: 'Zarządzaj harmonogramem i rezerwacjami' },
  klienci: { label: 'Klienci', icon: Users, description: 'Przeglądaj i zarządzaj bazą klientów' },
  pracownicy: { label: 'Pracownicy', icon: HardHat, description: 'Zarządzaj pracownikami i czasem pracy' },
  protokoly: { label: 'Protokoły', icon: ClipboardCheck, description: 'Protokoły serwisowe zakończenia prac' },
  rozliczenia: { label: 'Rozliczenia', icon: Receipt, description: 'Rozliczenia i statusy płatności zleceń' },
  uslugi: { label: 'Usługi', icon: BadgeDollarSign, description: 'Konfiguruj usługi i cennik' },
  'powiadomienia-sms': { label: 'Powiadomienia SMS', icon: MessageSquare, description: 'Szablony powiadomień SMS dla klientów' },
  ustawienia: { label: 'Ustawienia', icon: Settings, description: 'Ustawienia systemu i konfiguracja' },
};

const Dashboard = () => {
  const { view } = useParams<{ view?: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isMobile = useIsMobile();

  const currentView: ViewType = view && validViews.includes(view as ViewType) ? (view as ViewType) : 'kalendarz';

  const adminRole = roles.find(r => (r.role === 'admin' || r.role === 'employee') && r.instance_id);
  const instanceId = adminRole?.instance_id ?? null;

  const basePath = window.location.pathname.includes('/admin') ? '/admin' : '';

  const handleViewChange = (newView: ViewType) => {
    navigate(newView === 'kalendarz' ? `${basePath || '/admin'}` : `${basePath || '/admin'}/${newView}`, { replace: true });
  };

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

  // Protocol form state
  const [protocolFormOpen, setProtocolFormOpen] = useState(false);
  const [protocolPrefill, setProtocolPrefill] = useState<{
    customerId?: string | null;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddressId?: string | null;
    calendarItemId?: string | null;
  }>({});

  // Fetch columns
  const fetchColumns = useCallback(async () => {
    if (!instanceId) return;
    const { data, error } = await supabase
      .from('calendar_columns')
      .select('id, name, color')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .order('sort_order');
    if (error) { console.error('Error fetching columns:', error); return; }
    setCalendarColumns(data || []);
  }, [instanceId]);

  // Fetch items for date range
  const fetchItems = useCallback(async () => {
    if (!instanceId) return;
    const rangeStart = format(subDays(currentCalendarDate, 7), 'yyyy-MM-dd');
    const rangeEnd = format(addDays(currentCalendarDate, mapOpen ? 30 : 14), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('calendar_items')
      .select('id, column_id, title, customer_name, customer_phone, customer_email, customer_id, customer_address_id, assigned_employee_ids, item_date, end_date, start_time, end_time, status, admin_notes, price, photo_urls, payment_status')
      .eq('instance_id', instanceId)
      .gte('item_date', rangeStart)
      .lte('item_date', rangeEnd);
    if (error) { console.error('Error fetching items:', error); return; }
    
    const items = data || [];
    
    // Fetch address names for items that have customer_address_id
    const addressIds = [...new Set(items.filter(i => i.customer_address_id).map(i => i.customer_address_id!))];
    if (addressIds.length > 0) {
      const { data: addresses } = await supabase
        .from('customer_addresses')
        .select('id, name, lat, lng, city')
        .in('id', addressIds);
      
      if (addresses) {
        const addressMap = new Map(addresses.map(a => [a.id, { name: a.name, lat: a.lat, lng: a.lng, city: a.city }]));
        items.forEach(item => {
          if (item.customer_address_id) {
            const addr = addressMap.get(item.customer_address_id);
            (item as any).address_name = addr?.name || null;
            (item as any).address_lat = addr?.lat || null;
            (item as any).address_lng = addr?.lng || null;
            (item as any).address_city = addr?.city || null;
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
  }, [instanceId, currentCalendarDate, mapOpen]);

  // Fetch breaks
  const fetchBreaks = useCallback(async () => {
    if (!instanceId) return;
    const rangeStart = format(subDays(currentCalendarDate, 7), 'yyyy-MM-dd');
    const rangeEnd = format(addDays(currentCalendarDate, 14), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('breaks')
      .select('id, column_id, break_date, start_time, end_time, note')
      .eq('instance_id', instanceId)
      .gte('break_date', rangeStart)
      .lte('break_date', rangeEnd);
    if (error) { console.error('Error fetching breaks:', error); return; }
    setCalendarBreaks(data || []);
  }, [instanceId, currentCalendarDate]);

  useEffect(() => {
    if (currentView === 'kalendarz') {
      fetchColumns();
      fetchItems();
      fetchBreaks();
    }
  }, [currentView, fetchColumns, fetchItems, fetchBreaks]);

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

  // Realtime subscription
  useEffect(() => {
    if (!instanceId || currentView !== 'kalendarz') return;

    const channel = supabase
      .channel('calendar-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_items', filter: `instance_id=eq.${instanceId}` }, () => {
        fetchItems();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks', filter: `instance_id=eq.${instanceId}` }, () => {
        fetchBreaks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [instanceId, currentView, fetchItems, fetchBreaks]);

  // Handlers
  const handleItemClick = (item: CalendarItem) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const handleAddItem = (columnId: string, date: string, time: string) => {
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

    // Optimistic update
    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updateData } : i));

    const { error } = await supabase.from('calendar_items').update(updateData).eq('id', itemId);
    if (error) {
      toast.error('Błąd przenoszenia');
      fetchItems(); // rollback
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
    if (error) { toast.error('Błąd usuwania'); return; }
    setCalendarItems(prev => prev.filter(i => i.id !== itemId));
    toast.success('Zlecenie usunięte');
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    // Optimistic update
    setCalendarItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    setSelectedItem(prev => prev && prev.id === itemId ? { ...prev, status: newStatus } : prev);

    const { error } = await supabase.from('calendar_items').update({ status: newStatus }).eq('id', itemId);
    if (error) {
      toast.error('Błąd zmiany statusu');
      fetchItems();
    } else {
      toast.success('Status zmieniony');
    }
  };

  const handleEditItem = (item: CalendarItem) => {
    setEditingItem({
      id: item.id,
      title: item.title,
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      customer_email: item.customer_email,
      customer_id: item.customer_id,
      customer_address_id: item.customer_address_id,
      assigned_employee_ids: item.assigned_employee_ids,
      item_date: item.item_date,
      end_date: item.end_date,
      start_time: item.start_time,
      end_time: item.end_time,
      column_id: item.column_id,
      admin_notes: item.admin_notes,
      price: item.price,
    });
    setDetailsOpen(false);
    setAddItemOpen(true);
  };

  const handleItemSuccess = () => {
    fetchItems();
    setEditingItem(null);
  };

  const handleDateChange = (date: Date) => {
    setCurrentCalendarDate(date);
  };

  const renderContent = () => {
    if (currentView === 'ustawienia') {
      return <SettingsView instanceId={instanceId} />;
    }

    if (currentView === 'uslugi' && instanceId) {
      return <div className="max-w-4xl mx-auto"><ServicesView instanceId={instanceId} /></div>;
    }

    if (currentView === 'klienci' && instanceId) {
      return <CustomersView instanceId={instanceId} />;
    }

    if (currentView === 'pracownicy' && instanceId) {
      return <EmployeesView instanceId={instanceId} />;
    }

    if (currentView === 'protokoly' && instanceId) {
      return <div className="max-w-4xl mx-auto"><ProtocolsView instanceId={instanceId} /></div>;
    }

    if (currentView === 'rozliczenia' && instanceId) {
      return <SettlementsView instanceId={instanceId} />;
    }

    if (currentView === 'powiadomienia-sms') {
      return <SmsNotificationsView instanceId={instanceId} />;
    }

    if (currentView === 'kalendarz' && instanceId) {
      const calendarContent = (
        <>
          <AdminCalendar
            columns={calendarColumns}
            items={calendarItems}
            breaks={calendarBreaks}
            onItemClick={handleItemClick}
            onAddItem={handleAddItem}
            onAddBreak={handleAddBreak}
            onDeleteBreak={handleDeleteBreak}
            onItemMove={handleItemMove}
            onDateChange={handleDateChange}
            selectedItemId={selectedItem?.id}
            onToggleMap={() => setMapOpen(prev => !prev)}
            mapOpen={mapOpen}
          />

          <AddCalendarItemDialog
            open={addItemOpen}
            onClose={() => { setAddItemOpen(false); setEditingItem(null); }}
            instanceId={instanceId}
            columns={calendarColumns}
            onSuccess={handleItemSuccess}
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
            onDelete={handleDeleteItem}
            onEdit={handleEditItem}
            onStatusChange={handleStatusChange}
            onStartWork={(itemId) => handleStatusChange(itemId, 'in_progress')}
            onEndWork={(itemId) => handleStatusChange(itemId, 'completed')}
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

      // Mobile: map in drawer
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

      // Desktop with map: 50/50 layout
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

      // Default: calendar only
      return (
        <div className="flex-1 min-h-[600px] h-full relative">
          {calendarContent}
        </div>
      );
    }

    const { label, icon: Icon, description } = viewConfig[currentView];
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{label}</h2>
          <p className="text-muted-foreground max-w-md">{description}</p>
        </div>
        <div className="px-4 py-2 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground">Placeholder — wkrótce tu będzie pełna funkcjonalność</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout currentView={currentView} onViewChange={handleViewChange} instanceId={instanceId}>
      {renderContent()}
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
    </DashboardLayout>
  );
};

export default Dashboard;
