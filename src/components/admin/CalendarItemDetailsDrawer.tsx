import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Mail, Clock, Trash2, Pencil, Check, RotateCcw, X, FileText, DollarSign, MapPin, HardHat, MessageSquare, MoreVertical, ChevronDown, Plus, ClipboardCheck, Send, Loader2, Camera } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import CustomerEditDrawer from './CustomerEditDrawer';
import type { Customer } from './CustomersView';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { LightTabsList, LightTabsTrigger } from '@/components/ui/light-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EmployeeSelectionDrawer from './EmployeeSelectionDrawer';
import { MediaUploader } from '@/components/media/MediaUploader';
import type { MediaItem } from '@/components/media/mediaTypes';
import { CreateInvoiceDrawer } from '@/components/invoicing/CreateInvoiceDrawer';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { useInvoicingSettings } from '@/components/invoicing/useInvoicingSettings';
import { useInvoices } from '@/components/invoicing/useInvoices';
import CustomerOrderCard from './CustomerOrderCard';
import ServiceSelectionDrawer, { type ServiceWithCategory } from './ServiceSelectionDrawer';
import { useInstanceFeature } from '@/hooks/useInstanceFeatures';
import { getPriorityConfig, DEFAULT_PRIORITY } from '@/lib/priorityUtils';
import type { CalendarItem, CalendarColumn, AssignedEmployee } from './AdminCalendar';

interface SmsNotificationInfo {
  id: string;
  status: string;
  sent_at: string | null;
  service_type: string;
  template_name?: string;
}

interface AvailableSmsTemplate {
  templateId: string;
  templateName: string;
  smsTemplate: string;
  serviceName: string;
}

interface CalendarItemDetailsDrawerProps {
  item: CalendarItem | null;
  open: boolean;
  onClose: () => void;
  columns: CalendarColumn[];
  onDelete?: (itemId: string) => void;
  onEdit?: (item: CalendarItem) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
  onStartWork?: (itemId: string) => void;
  onEndWork?: (itemId: string) => void;
  onAddProtocol?: (item: CalendarItem) => void;
  instanceId?: string;
  hidePrices?: boolean;
  hideHours?: boolean;
  forceSideRight?: boolean;
  isEmployee?: boolean;
  canEditServices?: boolean;
}

const statusLabels: Record<string, string> = {
  confirmed: 'Do wykonania',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
  change_requested: 'Prośba o zmianę',
};

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-slate-100 text-slate-700 border-slate-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  change_requested: 'bg-red-100 text-red-800 border-red-300',
};

// Inline editable quantity cell
const InlineQuantityEdit = ({
  value,
  unit,
  onSave,
}: {
  value: number;
  unit: string;
  onSave: (newQty: number) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => { setLocalValue(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const qty = Math.max(1, localValue || 1);
    if (qty !== value) onSave(qty);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-foreground whitespace-nowrap w-16 text-right hover:text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
      >
        {value} {unit}
      </button>
    );
  }

  return (
    <span className="whitespace-nowrap w-20 text-right inline-flex items-center justify-end gap-1">
      <input
        type="number"
        min={1}
        autoFocus
        value={localValue}
        onChange={e => setLocalValue(parseInt(e.target.value) || 1)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        className="w-14 text-right text-sm border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <span className="text-muted-foreground text-sm">{unit}</span>
    </span>
  );
};

// Receipt-style services summary
const ServicesSummary = ({
  itemId,
  instanceId,
  hidePrices = false,
  allowEdit = false,
}: {
  itemId: string;
  instanceId: string;
  hidePrices?: boolean;
  allowEdit?: boolean;
}) => {
  const queryClient = useQueryClient();
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);

  const { data: servicesData = [] } = useQuery({
    queryKey: ['calendar-item-services-summary', itemId],
    queryFn: async () => {
      const { data: itemServices } = await supabase
        .from('calendar_item_services')
        .select('service_id, custom_price, quantity')
        .eq('calendar_item_id', itemId);
      if (!itemServices?.length) return [];

      const serviceIds = itemServices.map(s => s.service_id);
      const { data: services } = await supabase
        .from('unified_services')
        .select('id, name, short_name, price, unit')
        .in('id', serviceIds);

      return itemServices.map(is => {
        const svc = (services || []).find(s => s.id === is.service_id);
        const price = is.custom_price ?? svc?.price ?? 0;
        const qty = (is as any).quantity ?? 1;
        return {
          service_id: is.service_id,
          name: svc?.name || '',
          quantity: qty,
          unit: svc?.unit || 'szt.',
          price,
          total: price * qty,
        };
      });
    },
    enabled: !!itemId,
    staleTime: 0,
  });

  const handleQuantityChange = async (serviceId: string, newQty: number) => {
    try {
      const { error } = await supabase
        .from('calendar_item_services')
        .update({ quantity: newQty } as any)
        .eq('calendar_item_id', itemId)
        .eq('service_id', serviceId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['calendar-item-services-summary', itemId] });
      toast.success('Zapisano ilość');
    } catch (err) {
      console.error('Error updating quantity:', err);
      toast.error('Nie udało się zapisać');
    }
  };

  const handleServicesConfirmed = async (
    serviceIds: string[],
    _totalDuration: number,
    _services: ServiceWithCategory[],
  ) => {
    try {
      const { data: existingRows } = await supabase
        .from('calendar_item_services')
        .select('service_id, custom_price, quantity')
        .eq('calendar_item_id', itemId);

      const existingMap = new Map((existingRows || []).map((row: any) => [row.service_id, row]));

      await supabase
        .from('calendar_item_services')
        .delete()
        .eq('calendar_item_id', itemId);

      if (serviceIds.length > 0) {
        const rowsToInsert = serviceIds.map(serviceId => {
          const existing = existingMap.get(serviceId);
          return {
            calendar_item_id: itemId,
            instance_id: instanceId,
            service_id: serviceId,
            custom_price: existing?.custom_price ?? null,
            quantity: existing?.quantity ?? 1,
          };
        });

        const { error: insertError } = await (supabase
          .from('calendar_item_services') as any)
          .insert(rowsToInsert);

        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ['calendar-item-services-summary', itemId] });
      toast.success('Zaktualizowano usługi i produkty');
    } catch (error) {
      console.error('Error updating services in details drawer:', error);
      toast.error('Nie udało się zapisać usług');
    }
  };

  if (!servicesData.length && !allowEdit) return null;

  const grandTotal = servicesData.reduce((sum, s) => sum + s.total, 0);
  const selectedServiceIds = servicesData.map(s => s.service_id);

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">Usługi i produkty</span>
      <div className="space-y-0.5">
        {servicesData.map((s, i) => (
          <div key={i} className="flex items-start text-sm gap-2">
            <span className="flex-1 line-clamp-2">{s.name}</span>
            {allowEdit ? (
              <InlineQuantityEdit
                value={s.quantity}
                unit={s.unit}
                onSave={(qty) => handleQuantityChange(s.service_id, qty)}
              />
            ) : (
              <span className="text-muted-foreground whitespace-nowrap w-16 text-right">{s.quantity} {s.unit}</span>
            )}
            {!hidePrices && (
              <>
                <span className="text-muted-foreground whitespace-nowrap w-16 text-right">{s.price} zł</span>
                <span className="font-semibold whitespace-nowrap w-20 text-right">{s.total.toFixed(0)} zł</span>
              </>
            )}
          </div>
        ))}
        {!hidePrices && servicesData.length > 0 && (
          <div className="border-t border-border pt-1.5 mt-1.5 flex items-center justify-between">
            <span className="text-sm font-bold">Razem netto</span>
            <span className="text-base font-bold">{grandTotal.toFixed(0)} zł</span>
          </div>
        )}
      </div>

      {allowEdit && (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setServiceDrawerOpen(true)}
          >
            Dodaj
          </Button>
        </div>
      )}

      <ServiceSelectionDrawer
        open={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        instanceId={instanceId}
        selectedServiceIds={selectedServiceIds}
        hidePricesAndDuration={hidePrices}
        onConfirm={handleServicesConfirmed}
      />
    </div>
  );
};

const CalendarItemDetailsDrawer = ({
  item,
  open,
  onClose,
  columns,
  onDelete,
  onEdit,
  onStatusChange,
  onStartWork,
  onEndWork,
  onAddProtocol,
  instanceId,
  hidePrices,
  hideHours,
  forceSideRight,
  isEmployee,
  canEditServices = false,
}: CalendarItemDetailsDrawerProps) => {
  const isMobile = useIsMobile();
  // All drawers now open from the right
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [addressStreet, setAddressStreet] = useState<string>('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [smsNotifications, setSmsNotifications] = useState<SmsNotificationInfo[]>([]);
  const [protocolToken, setProtocolToken] = useState<string | null>(null);
  
  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // SMS templates & sending
  const [availableSmsTemplates, setAvailableSmsTemplates] = useState<AvailableSmsTemplate[]>([]);
  const [sendingSms, setSendingSms] = useState(false);
  const [instanceShortName, setInstanceShortName] = useState('');

  // Employee management
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);

  // Media items state
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  // Customer detail drawer
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [customerDetailData, setCustomerDetailData] = useState<Customer | null>(null);
  // Invoice drawer
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  // History item drawer
  const [historyDetailItem, setHistoryDetailItem] = useState<CalendarItem | null>(null);
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const { data: allEmployees = [] } = useEmployees(instanceId || null);
  const { enabled: employeesEnabled } = useInstanceFeature(instanceId || null, 'employees');
  const { enabled: prioritiesEnabled } = useInstanceFeature(instanceId || null, 'priorities');
  const { settings: invoicingSettings } = useInvoicingSettings(instanceId || null);
  const { data: itemInvoices = [], refetch: refetchInvoices } = useInvoices(instanceId || null, item?.id);

  // Work times query (work_started_at, work_ended_at)
  const { data: workTimesData } = useQuery({
    queryKey: ['work-times', item?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('calendar_items')
        .select('work_started_at, work_ended_at')
        .eq('id', item!.id)
        .single();
      return data as { work_started_at: string | null; work_ended_at: string | null } | null;
    },
    enabled: !!item?.id && (item?.status === 'completed' || item?.status === 'in_progress') && open,
    staleTime: 0,
  });

  const customerAddressId = item?.customer_address_id;
  const { data: historyItems = [] } = useQuery({
    queryKey: ['address-history', customerAddressId, item?.id],
    queryFn: async () => {
      if (!customerAddressId) return [];
      const { data: items, error } = await supabase
        .from('calendar_items')
        .select('*')
        .eq('customer_address_id', customerAddressId)
        .neq('id', item!.id)
        .order('item_date', { ascending: false })
        .limit(50);
      if (error || !items) return [];

      // Fetch services for these items
      const itemIds = items.map(i => i.id);
      const { data: services } = await supabase
        .from('calendar_item_services')
        .select('calendar_item_id, service_id, custom_price')
        .in('calendar_item_id', itemIds);

      // Fetch service names
      const serviceIds = [...new Set((services || []).map(s => s.service_id))];
      const { data: serviceDetails } = serviceIds.length > 0
        ? await supabase.from('unified_services').select('id, name, price').in('id', serviceIds)
        : { data: [] };

      // Fetch protocols
      const { data: protocols } = await supabase
        .from('protocols')
        .select('calendar_item_id, public_token')
        .in('calendar_item_id', itemIds);

      const serviceMap = new Map((serviceDetails || []).map(s => [s.id, s]));
      const protocolMap = new Map((protocols || []).map(p => [p.calendar_item_id, p.public_token]));

      // Fetch employee names
      const allEmpIds = [...new Set(items.flatMap(i => i.assigned_employee_ids || []))];
      const { data: employees } = allEmpIds.length > 0
        ? await supabase.from('employees').select('id, name').in('id', allEmpIds)
        : { data: [] };
      const empMap = new Map((employees || []).map(e => [e.id, e.name]));

      return items.map(ci => {
        const ciServices = (services || [])
          .filter(s => s.calendar_item_id === ci.id)
          .map(s => {
            const svc = serviceMap.get(s.service_id);
            return { name: svc?.name || '', price: s.custom_price ?? svc?.price ?? undefined };
          });
        const empNames = (ci.assigned_employee_ids || []).map(id => empMap.get(id)).filter(Boolean) as string[];
        return {
          ...ci,
          services: ciServices,
          protocolPublicToken: protocolMap.get(ci.id) || undefined,
          employeeNames: empNames,
        };
      });
    },
    enabled: !!customerAddressId && !!item?.id && open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (item) {
      setNotesValue(item.admin_notes || '');
      setEditingNotes(false);
      // Load media_items with fallback from photo_urls
      const raw = (item as any).media_items;
      if (Array.isArray(raw) && raw.length > 0) {
        setMediaItems(raw as MediaItem[]);
      } else {
        const photos = Array.isArray(item.photo_urls) ? (item.photo_urls as string[]) : [];
        setMediaItems(photos.map((url: string) => ({ type: 'image' as const, url })));
      }
    }
  }, [item?.id, item?.admin_notes]);

  // Fetch address
  useEffect(() => {
    if (!item?.customer_address_id) { setAddressLabel(null); setAddressStreet(''); setAddressCoords(null); return; }
   const fetchAddr = async () => {
      const { data } = await supabase
        .from('customer_addresses')
        .select('name, street, city, lat, lng')
        .eq('id', item.customer_address_id!)
        .single();
      if (data) {
        setAddressLabel(data.name || '');
        setAddressCoords(data.lat && data.lng ? { lat: data.lat, lng: data.lng } : null);
        setAddressStreet([data.street, data.city].filter(Boolean).join(', '));
      }
    };
    fetchAddr();
  }, [item?.customer_address_id]);

  // Fetch protocol linked to this calendar item
  useEffect(() => {
    if (!item?.id || !open) { setProtocolToken(null); return; }
    const fetchProtocol = async () => {
      const { data } = await (supabase.from('protocols') as any)
        .select('public_token')
        .eq('calendar_item_id', item.id)
        .limit(1)
        .maybeSingle();
      setProtocolToken(data?.public_token || null);
    };
    fetchProtocol();
  }, [item?.id, open]);

  // Fetch SMS notifications
  useEffect(() => {
    if (!item?.id || !open) { setSmsNotifications([]); return; }
    const fetchSms = async () => {
      const { data } = await (supabase.from('customer_sms_notifications') as any)
        .select('id, status, sent_at, service_type')
        .eq('calendar_item_id', item.id);
      if (data) setSmsNotifications(data);
    };
    fetchSms();
  }, [item?.id, open]);

  // Fetch instance short_name
  useEffect(() => {
    if (!instanceId || !open) return;
    supabase.from('instances').select('short_name').eq('id', instanceId).single()
      .then(({ data }) => { if (data) setInstanceShortName(data.short_name || ''); });
  }, [instanceId, open]);

  // Fetch available SMS templates from item's services
  useEffect(() => {
    if (!item?.id || !open || !instanceId) { setAvailableSmsTemplates([]); return; }
    const fetchTemplates = async () => {
      const { data: itemServices } = await supabase
        .from('calendar_item_services')
        .select('service_id')
        .eq('calendar_item_id', item.id);
      if (!itemServices?.length) { setAvailableSmsTemplates([]); return; }

      const serviceIds = itemServices.map(s => s.service_id);
      const { data: services } = await supabase
        .from('unified_services')
        .select('id, name, notification_template_id')
        .in('id', serviceIds);
      
      const templatesWithService = (services || []).filter(s => s.notification_template_id);
      if (!templatesWithService.length) { setAvailableSmsTemplates([]); return; }

      const templateIds = [...new Set(templatesWithService.map(s => s.notification_template_id!))];
      const { data: templates } = await supabase
        .from('sms_notification_templates')
        .select('id, name, sms_template, items')
        .in('id', templateIds);

      const available: AvailableSmsTemplate[] = [];
      for (const tmpl of templates || []) {
        const tmplItems = Array.isArray(tmpl.items) ? tmpl.items : [];
        const hasImmediate = tmplItems.some((i: any) => i.trigger_type === 'immediate');
        if (hasImmediate && tmpl.sms_template) {
          const svc = templatesWithService.find(s => s.notification_template_id === tmpl.id);
          available.push({
            templateId: tmpl.id,
            templateName: tmpl.name,
            smsTemplate: tmpl.sms_template,
            serviceName: svc?.name || '',
          });
        }
      }
      setAvailableSmsTemplates(available);
    };
    fetchTemplates();
  }, [item?.id, open, instanceId]);

  const unsent = availableSmsTemplates.filter(t => 
    !smsNotifications.some(n => n.service_type === t.serviceName)
  );

  const handleSendSms = async (template: AvailableSmsTemplate) => {
    if (!item?.customer_phone || !instanceId) {
      toast.error('Brak numeru telefonu klienta');
      return;
    }
    setSendingSms(true);
    try {
      const { data: notif, error: notifError } = await (supabase
        .from('customer_sms_notifications') as any)
        .insert({
          instance_id: instanceId,
          notification_template_id: template.templateId,
          customer_name: item.customer_name || '',
          customer_phone: item.customer_phone,
          service_type: template.serviceName,
          months_after: 0,
          scheduled_date: item.item_date,
          status: 'pending',
          calendar_item_id: item.id,
        })
        .select('id')
        .single();

      if (notifError) throw notifError;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const message = template.smsTemplate;

      await fetch(`https://${projectId}.supabase.co/functions/v1/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
        body: JSON.stringify({
          phone: item.customer_phone,
          message,
          instanceId,
          notificationId: notif?.id,
        }),
      });

      const { data: refreshed } = await (supabase.from('customer_sms_notifications') as any)
        .select('id, status, sent_at, service_type')
        .eq('calendar_item_id', item.id);
      if (refreshed) setSmsNotifications(refreshed);

      toast.success('SMS wysłany');
    } catch (err) {
      console.error('Error sending SMS:', err);
      toast.error('Błąd wysyłania SMS');
    } finally {
      setSendingSms(false);
    }
  };

  if (!item) return null;

  const shortDate = (() => {
    if (!item.item_date) return '';
    const startStr = format(new Date(item.item_date), 'EE, d MMM yyyy', { locale: pl });
    if (item.end_date && item.end_date !== item.item_date) {
      const endStr = format(new Date(item.end_date), 'd MMM yyyy', { locale: pl });
      return `${startStr} – ${endStr}`;
    }
    return startStr;
  })();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      onDelete?.(item.id);
      setDeleteDialogOpen(false);
      onClose();
    } catch {
      toast.error('Błąd podczas usuwania');
    } finally {
      setDeleting(false);
    }
  };

  const handleNotesBlur = async () => {
    setEditingNotes(false);
    if (notesValue === (item.admin_notes || '')) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('calendar_items')
      .update({ admin_notes: notesValue.trim() || null })
      .eq('id', item.id);
    setSavingNotes(false);
    if (error) {
      toast.error('Błąd zapisu notatek');
      setNotesValue(item.admin_notes || '');
    }
  };

  const handleRemoveEmployee = async (empId: string) => {
    const newIds = (item.assigned_employee_ids || []).filter(id => id !== empId);
    const { error } = await supabase
      .from('calendar_items')
      .update({ assigned_employee_ids: newIds.length > 0 ? newIds : null })
      .eq('id', item.id);
    if (error) { toast.error('Błąd usuwania pracownika'); return; }
    if (item.assigned_employees) {
      item.assigned_employees = item.assigned_employees.filter(e => e.id !== empId);
    }
    item.assigned_employee_ids = newIds;
  };

  const handleEmployeesConfirmed = async (ids: string[]) => {
    const { error } = await supabase
      .from('calendar_items')
      .update({ assigned_employee_ids: ids.length > 0 ? ids : null })
      .eq('id', item.id);
    if (error) { toast.error('Błąd przypisania pracowników'); return; }
  };

  // Footer
  const renderFooter = () => {
    const protocolBtn = onAddProtocol && (
      <Button variant="outline" className="bg-white flex-1" onClick={() => onAddProtocol(item)}>
        Protokół
      </Button>
    );

    const editBtn = !isEmployee && onEdit && (
      <Button variant="outline" className="bg-white flex-1" onClick={() => onEdit(item)}>
        <Pencil className="w-4 h-4 mr-1" />
        Edytuj
      </Button>
    );

    const moreMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="bg-white shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onDelete && (
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Usuń
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const statusDropdown = (mainLabel: string, mainAction: () => void, mainColor: string, otherStatuses: { label: string; status: string; icon: React.ReactNode }[]) => (
      <div className="flex flex-1">
        <Button
          className={`${mainColor} flex-1 rounded-r-none`}
          onClick={mainAction}
        >
          {mainLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={`${mainColor} rounded-l-none border-l border-white/20 px-2`}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {otherStatuses.map(s => (
              <DropdownMenuItem key={s.status} onClick={() => onStatusChange?.(item.id, s.status)}>
                {s.icon}
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

    return (
      <div className="flex-shrink-0 border-t border-border px-4 py-3 flex items-center gap-1.5">
        {!isEmployee && item.status !== 'completed' && moreMenu}
        {protocolBtn}
        {editBtn}

        {isEmployee ? (
          <>
            {item.status === 'confirmed' && onStartWork && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1" onClick={() => onStartWork(item.id)}>
                Rozpocznij pracę
              </Button>
            )}
            {item.status === 'in_progress' && onEndWork && (
              <Button className="bg-sky-500 hover:bg-sky-600 text-white flex-1" onClick={() => onEndWork(item.id)}>
                Zakończ pracę
              </Button>
            )}
            {item.status === 'completed' && (
              <Button variant="outline" className="flex-1 bg-white" disabled>
                Zakończone
              </Button>
            )}
            {item.status === 'cancelled' && (
              <Button variant="outline" className="flex-1 bg-white" disabled>
                Anulowane
              </Button>
            )}
          </>
        ) : (
          <>
            {item.status === 'confirmed' && onStartWork && statusDropdown(
              'Rozpocznij pracę',
              () => onStartWork(item.id),
              'bg-emerald-600 hover:bg-emerald-700 text-white',
              [
                { label: 'Zakończone', status: 'completed', icon: <Check className="w-4 h-4 mr-2" /> },
                { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
              ]
            )}

            {item.status === 'in_progress' && onEndWork && statusDropdown(
              'Zakończ pracę',
              () => onEndWork(item.id),
              'bg-sky-500 hover:bg-sky-600 text-white',
              [
                { label: 'Do wykonania', status: 'confirmed', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
                { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
              ]
            )}

            {item.status === 'completed' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 bg-white">
                    Zakończone
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Do wykonania
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    W trakcie
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'cancelled')}>
                    <X className="w-4 h-4 mr-2" />
                    Anulowane
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {item.status === 'cancelled' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 bg-white">
                    Anulowane
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Do wykonania
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                    <Clock className="w-4 h-4 mr-2" />
                    W trakcie
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'completed')}>
                    <Check className="w-4 h-4 mr-2" />
                    Zakończone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    );
  };

  if (!item) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" hideCloseButton hideOverlay className={`flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full ${isEmployee ? 'sm:!w-full sm:!max-w-full' : ''}`}>
          <SheetTitle className="sr-only">Szczegóły</SheetTitle>
          <SheetDescription className="sr-only">Brak danych</SheetDescription>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          hideCloseButton
          hideOverlay
          className={`flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full ${isEmployee ? 'sm:!w-full sm:!max-w-full' : ''}`}
        >
          {/* Accessible title */}
          <SheetTitle className="sr-only">{item.title}</SheetTitle>
          <SheetDescription className="sr-only">Szczegóły zlecenia</SheetDescription>

          {/* Header - fixed */}
          <div className="px-6 pt-6 pb-4 shrink-0">
            {/* Line 1: Service name + X */}
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-bold truncate pr-2">{item.title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-primary/5 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Line 2: date + time */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[14px] text-foreground capitalize">{shortDate}</span>
              {!hideHours && item.start_time && item.end_time && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[14px] font-medium">{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                </>
              )}
            </div>
            {/* Line 3: badges */}
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className={statusColors[item.status] || 'bg-muted'}>
                {statusLabels[item.status] || item.status}
              </Badge>
              {!isEmployee && item.status !== 'confirmed' && (
                <InvoiceStatusBadge status={itemInvoices.length > 0 ? (itemInvoices[0].status === 'sent' ? 'invoice_sent' : itemInvoices[0].status === 'paid' ? 'paid' : 'invoice_sent') : (item as any).payment_status} />
              )}
              {prioritiesEnabled && (item as any).priority != null && (item as any).priority !== DEFAULT_PRIORITY && (() => {
                const cfg = getPriorityConfig((item as any).priority);
                return <Badge className={`${cfg.badgeCls} border`}>{cfg.label}</Badge>;
              })()}
            </div>
          </div>

          {/* Tabbed Content */}
          <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 shrink-0">
              <LightTabsList>
                <LightTabsTrigger value="general">Ogólne</LightTabsTrigger>
                <LightTabsTrigger value="media">Pliki</LightTabsTrigger>
                <LightTabsTrigger value="history">Historia</LightTabsTrigger>
              </LightTabsList>
            </div>

            {/* Tab: Ogólne */}
            <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-4 space-y-5 m-0">
              {/* Order number */}
              {item.order_number && (
                <div className="space-y-1">
                  <span className="text-sm font-medium">Numer zlecenia</span>
                  <p className="text-sm">{item.order_number}</p>
                </div>
              )}

              {/* Customer */}
              {(item.customer_name || item.customer_phone || item.customer_email) && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Klient</span>
                  {item.customer_name && (
                    <div className="flex items-center gap-1.5">
                      {item.customer_id ? (
                        <button
                          type="button"
                          className="font-medium text-[15px] text-primary hover:underline cursor-pointer text-left"
                          onClick={async () => {
                            const { data } = await supabase
                              .from('customers')
                              .select('*')
                              .eq('id', item.customer_id!)
                              .single();
                            if (data) {
                              setCustomerDetailData(data as Customer);
                              setCustomerDetailOpen(true);
                            }
                          }}
                        >
                          {item.customer_name}
                        </button>
                      ) : (
                        <span className="font-medium text-[15px]">{item.customer_name}</span>
                      )}
                      {item.customer_phone && (
                        <a href={`tel:${item.customer_phone}`} className="p-1 rounded hover:bg-primary/5">
                          <Phone className="w-[17px] h-[17px] text-primary" />
                        </a>
                      )}
                      {item.customer_phone && (
                        <a href={`sms:${item.customer_phone}`} className="p-1 rounded hover:bg-primary/5">
                          <MessageSquare className="w-[17px] h-[17px] text-primary" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Location */}
              {(addressLabel || addressStreet) && (
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Lokalizacja</span>
                  {addressLabel && (
                  <div>
                    <span className="font-medium text-[15px]">{addressLabel}</span>
                  </div>
                  )}
                  {addressStreet && (
                    <div>
                      {addressCoords ? (
                        <a
                          href={`https://www.google.com/maps?q=${addressCoords.lat},${addressCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[15px] text-primary hover:underline inline-flex items-center gap-1.5"
                        >
                          {addressStreet}
                          <svg viewBox="0 0 92.3 132.3" className="w-4 h-4 shrink-0">
                            <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"/>
                            <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-32.4L10.8 16.5z"/>
                            <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.1 27.7-32.1-5.6-10.8-15.3-19-27.2-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"/>
                            <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.6-8.3 4.2-11.4L4.6 68.1c5.5 11.9 13.6 21.5 19.8 29.7l35.3-40.9c-3.2 3.9-8.1 6.3-13.5 6.9"/>
                            <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L24.4 97.8c2.6 3.4 5 6.7 7 9.9 6.5 10.4 11 21.2 14.8 24.6 3.8-3.4 8.3-14.2 12.9-23.1"/>
                          </svg>
                        </a>
                      ) : (
                        <span className="text-[15px] text-foreground">{addressStreet}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Employees */}
              {employeesEnabled && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Przypisani pracownicy
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {isEmployee ? (
                    // Readonly: show from allEmployees + assigned_employee_ids
                    (item.assigned_employee_ids || []).map(empId => {
                      const emp = allEmployees.find(e => e.id === empId);
                      return emp ? (
                        <span key={emp.id} className="inline-flex items-center bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                          {emp.name}
                        </span>
                      ) : null;
                    })
                  ) : (
                    <>
                      {(() => {
                        const emps = item.assigned_employees && item.assigned_employees.length > 0
                          ? item.assigned_employees
                          : (item.assigned_employee_ids || []).map(id => allEmployees.find(e => e.id === id)).filter(Boolean).map(e => ({ id: e!.id, name: e!.name }));
                        return emps.map(emp => (
                          <span key={emp.id} className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                            {emp.name}
                            <button
                              onClick={() => handleRemoveEmployee(emp.id)}
                              className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ));
                      })()}
                      {instanceId && (
                        <button
                          onClick={() => setEmployeeDrawerOpen(true)}
                          className="inline-flex items-center gap-1 border border-dashed border-border rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Dodaj
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Notatki
                </div>
                {editingNotes ? (
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={handleNotesBlur}
                    autoFocus
                    rows={3}
                    className="text-[15px]"
                    placeholder="Dodaj notatkę..."
                  />
                ) : (
                  <p
                    onClick={() => setEditingNotes(true)}
                    className={`text-[15px] whitespace-pre-wrap cursor-pointer hover:bg-primary/5 rounded p-1 -m-1 min-h-[2rem] ${notesValue ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {notesValue || 'Kliknij, aby dodać notatkę...'}
                  </p>
                )}
              </div>

              {/* Services & Products */}
              {instanceId && (
                <ServicesSummary
                  itemId={item.id}
                  instanceId={instanceId}
                  hidePrices={!!hidePrices}
                  allowEdit={!isEmployee || !!canEditServices}
                />
              )}


              {/* FV + SMS section */}
              {!hidePrices && (item.status === 'completed' || item.status === 'in_progress') && (
                <div className="space-y-2 pt-2 border-t border-border">
                  {/* Work time info */}
                  {(item.status === 'completed' || item.status === 'in_progress') && workTimesData && (() => {
                    const startDt = workTimesData.work_started_at ? new Date(workTimesData.work_started_at) : null;
                    const endDt = workTimesData.work_ended_at ? new Date(workTimesData.work_ended_at) : null;
                    if (!startDt) return null;

                    const startH = format(startDt, 'HH:mm');
                    const endH = endDt ? format(endDt, 'HH:mm') : '—';

                    let durationStr = '';
                    if (startDt && endDt) {
                      const diffMin = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
                      const hours = Math.floor(Math.abs(diffMin) / 60);
                      const mins = Math.abs(diffMin) % 60;
                      durationStr = `${hours}h ${mins.toString().padStart(2, '0')} min`;
                    }

                    const dateStr = format(startDt, 'd MMMM yyyy', { locale: pl });
                    const sameDay = endDt && format(startDt, 'yyyy-MM-dd') === format(endDt, 'yyyy-MM-dd');
                    const endDateStr = endDt && !sameDay ? format(endDt, 'd MMMM yyyy', { locale: pl }) : '';

                    return (
                      <div className="flex items-center gap-1.5 text-sm text-foreground flex-wrap">
                        <span className="font-medium shrink-0">Czas realizacji:</span>
                        <span>od {startH}{endDateStr ? ` (${dateStr})` : ''} do {endH}</span>
                        {sameDay && <span>, {dateStr}</span>}
                        {endDateStr && <span>, {endDateStr}</span>}
                        {!endDt && <span>, {dateStr}</span>}
                        {durationStr && <span className="font-semibold">({durationStr})</span>}
                      </div>
                    );
                  })()}
                  {invoicingSettings?.active && itemInvoices.length === 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setInvoiceDrawerOpen(true)}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Wystaw FV
                    </Button>
                  )}
                  {itemInvoices.length > 0 && (
                    <div className="space-y-1">
                      {itemInvoices.map(inv => {
                        const hasPdf = inv.pdf_url || inv.provider === 'ifirma';
                        const handlePdfClick = async () => {
                          if (inv.pdf_url) {
                            window.open(inv.pdf_url, '_blank');
                          } else {
                            try {
                              const session = await supabase.auth.getSession();
                              const token = session.data.session?.access_token;
                              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoicing-api`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                },
                                body: JSON.stringify({ action: 'get_ifirma_pdf', instanceId, invoiceId: inv.id }),
                              });
                              if (!res.ok) throw new Error(await res.text());
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `faktura-${inv.invoice_number || inv.id}.pdf`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err: any) {
                              console.error('PDF download error:', err);
                              toast.error('Błąd pobierania PDF');
                            }
                          }
                        };
                        const priceDisplay = item.price != null ? `${item.price.toFixed(2)} zł netto` : `${inv.total_gross?.toFixed(2)} ${inv.currency}`;
                        return (
                          <button
                            key={inv.id}
                            onClick={hasPdf ? handlePdfClick : undefined}
                            className={`flex items-center gap-2 text-[15px] w-full text-left ${hasPdf ? 'text-primary hover:underline cursor-pointer' : 'text-foreground'}`}
                          >
                            <span className="font-medium">{inv.invoice_number || 'Faktura'},</span>
                            <span>{priceDisplay}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {item.status === 'completed' && itemInvoices.length === 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      disabled={!item.customer_phone}
                      onClick={() => {
                        const phone = item.customer_phone || '';
                        let message = `Prośba o rozliczenie "${item.title}"`;
                        if (item.price != null) message += ` w kwocie ${item.price.toFixed(2)} PLN`;
                        message += '.';
                        if (protocolToken) {
                          message += ` Link do protokołu: ${window.location.origin}/protocol/${protocolToken}`;
                        }
                        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_self');
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Wyślij SMS o rozliczeniu
                    </Button>
                  )}
                </div>
              )}

              {(smsNotifications.length > 0 || unsent.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Powiadomienie SMS
                  </div>
                  {smsNotifications.map(sms => (
                    <div key={sms.id} className="ml-6 text-[15px]">
                      {sms.sent_at ? (
                        <span className="text-emerald-600">
                          ✓ Wysłano SMS ({sms.service_type}) — {format(new Date(sms.sent_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                        </span>
                      ) : sms.status === 'pending' ? (
                        <span className="text-orange-600">
                          ⏳ SMS oczekuje na wysłanie ({sms.service_type})
                        </span>
                      ) : sms.status === 'failed' ? (
                        <span className="text-destructive">
                          ✗ Błąd wysyłki SMS ({sms.service_type})
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {unsent.map(template => (
                    <div key={template.templateId} className="ml-6 space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Szablon: {template.templateName}
                      </p>
                      <p className="text-xs bg-muted rounded p-2 whitespace-pre-wrap">
                        {template.smsTemplate.replace(/\{short_name\}/g, instanceShortName)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sendingSms || !item.customer_phone}
                        onClick={() => handleSendSms(template)}
                        className="text-xs"
                      >
                        {sendingSms ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                        Wyślij SMS
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Media */}
            <TabsContent value="media" className="flex-1 overflow-y-auto px-6 py-4 m-0">
              <MediaUploader
                items={mediaItems}
                onItemsChange={setMediaItems}
                filePrefix="zlecenie"
                enableAnnotation
                onAutoSave={(newItems) => {
                  setMediaItems(newItems);
                  supabase
                    .from('calendar_items')
                    .update({ media_items: newItems, photo_urls: newItems.filter(i => i.type === 'image').map(i => i.url) } as any)
                    .eq('id', item.id)
                    .then(({ error }) => {
                      if (error) console.error('Error saving media:', error);
                    });
                }}
              />
            </TabsContent>

            {/* Tab: Historia */}
            <TabsContent value="history" className="flex-1 overflow-y-auto px-6 py-4 m-0">
              {!customerAddressId ? (
                <EmptyState icon={MapPin} message="Przypisz adres serwisowy, aby zobaczyć historię lokalizacji." />
              ) : historyItems.length === 0 ? (
                <EmptyState icon={Clock} message="Brak innych zleceń dla tej lokalizacji." />
              ) : (
                <div className="space-y-2">
                  {historyItems.map((hi: any) => (
                    <CustomerOrderCard
                      key={hi.id}
                      itemDate={hi.item_date}
                      endDate={hi.end_date}
                      title={hi.title}
                      status={hi.status}
                      services={hi.services || []}
                      price={hi.price}
                      hidePrices={hidePrices}
                      assignedEmployeeNames={hi.employeeNames}
                      onClick={() => {
                        const histItem: CalendarItem = {
                          id: hi.id, title: hi.title, item_date: hi.item_date, end_date: hi.end_date,
                          start_time: hi.start_time, end_time: hi.end_time, column_id: hi.column_id,
                          status: hi.status, admin_notes: hi.admin_notes, price: hi.price,
                          customer_id: hi.customer_id, customer_address_id: hi.customer_address_id,
                          assigned_employee_ids: hi.assigned_employee_ids,
                          customer_name: hi.customer_name, customer_phone: hi.customer_phone,
                          customer_email: hi.customer_email, photo_urls: hi.photo_urls,
                        };
                        setHistoryDetailItem(histItem);
                        setHistoryDetailOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          {renderFooter()}
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć "{item.title}"? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee Selection Drawer */}
      {instanceId && (
        <EmployeeSelectionDrawer
          open={employeeDrawerOpen}
          onClose={() => setEmployeeDrawerOpen(false)}
          employees={allEmployees}
          selectedIds={item.assigned_employee_ids || []}
          onConfirm={handleEmployeesConfirmed}
          instanceId={instanceId}
          orderDateFrom={item.item_date}
          orderDateTo={item.end_date}
        />
      )}

      {/* Customer Detail Drawer */}
      <CustomerEditDrawer
        customer={customerDetailData}
        instanceId={instanceId || null}
        open={customerDetailOpen}
        onClose={() => { setCustomerDetailOpen(false); setCustomerDetailData(null); }}
      />

      {/* Invoice Drawer */}
      {instanceId && (
        <CreateInvoiceDrawer
          open={invoiceDrawerOpen}
          onClose={() => setInvoiceDrawerOpen(false)}
          instanceId={instanceId}
          calendarItemId={item.id}
          customerId={item.customer_id}
          customerName={item.customer_name}
          customerEmail={item.customer_email}
          onSuccess={() => {
            refetchInvoices();
            onStatusChange?.(item.id, item.status);
          }}
        />
      )}

      {/* History Item Detail Drawer */}
      <CalendarItemDetailsDrawer
        item={historyDetailItem}
        open={historyDetailOpen}
        onClose={() => { setHistoryDetailOpen(false); setHistoryDetailItem(null); }}
        columns={columns}
        instanceId={instanceId}
        hidePrices={hidePrices}
        hideHours={hideHours}
        forceSideRight
        isEmployee={isEmployee}
      />
    </>
  );
};

export default CalendarItemDetailsDrawer;
