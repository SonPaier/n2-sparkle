import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Mail, Clock, Trash2, Pencil, Check, RotateCcw, X, FileText, DollarSign, MapPin, HardHat, MessageSquare, MoreVertical, ChevronDown, Plus, ClipboardCheck, Send, Loader2, Camera } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';
import EmployeeSelectionDrawer from './EmployeeSelectionDrawer';
import { ProtocolPhotosUploader } from '@/components/protocols/ProtocolPhotosUploader';
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
}

const statusLabels: Record<string, string> = {
  pending: 'Do potwierdzenia',
  confirmed: 'Potwierdzone',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
  change_requested: 'Prośba o zmianę',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-slate-100 text-slate-700 border-slate-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  change_requested: 'bg-red-100 text-red-800 border-red-300',
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
}: CalendarItemDetailsDrawerProps) => {
  const isMobile = useIsMobile();
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

  // Photos state
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);
  // Customer detail drawer
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [customerDetailData, setCustomerDetailData] = useState<Customer | null>(null);
  const { data: allEmployees = [] } = useEmployees(instanceId || null);

  useEffect(() => {
    if (item) {
      setNotesValue(item.admin_notes || '');
      setEditingNotes(false);
      // Load photos from item
      const photos = Array.isArray(item.photo_urls) ? item.photo_urls : [];
      setItemPhotos(photos as string[]);
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
      // Get services linked to this calendar item
      const { data: itemServices } = await supabase
        .from('calendar_item_services')
        .select('service_id')
        .eq('calendar_item_id', item.id);
      if (!itemServices?.length) { setAvailableSmsTemplates([]); return; }

      const serviceIds = itemServices.map(s => s.service_id);
      // Get services with notification_template_id
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

  // Check which templates already have SMS sent
  const sentTemplateIds = new Set(smsNotifications.map(n => n.id ? n.service_type : ''));
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

      // Refresh SMS list
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

  const column = columns.find(c => c.id === item.column_id);
  const formattedDate = item.item_date
    ? format(new Date(item.item_date), 'EEEE, d MMMM yyyy', { locale: pl })
    : '';

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
    // Update local state
    if (item.assigned_employees) {
      item.assigned_employees = item.assigned_employees.filter(e => e.id !== empId);
    }
    item.assigned_employee_ids = newIds;
    onStatusChange?.(item.id, item.status); // trigger refresh
  };

  const handleEmployeesConfirmed = async (ids: string[]) => {
    const { error } = await supabase
      .from('calendar_items')
      .update({ assigned_employee_ids: ids.length > 0 ? ids : null })
      .eq('id', item.id);
    if (error) { toast.error('Błąd przypisania pracowników'); return; }
    onStatusChange?.(item.id, item.status); // trigger refresh
  };

  // Footer button config based on status
  const renderFooter = () => {
    const editBtn = onEdit && (
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
      <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center gap-2">
        {editBtn}
        {item.status !== 'completed' && moreMenu}

        {item.status === 'pending' && statusDropdown(
          'Potwierdź',
          () => onStatusChange?.(item.id, 'confirmed'),
          'bg-amber-500 hover:bg-amber-600 text-white',
          [
            { label: 'W trakcie', status: 'in_progress', icon: <Clock className="w-4 h-4 mr-2" /> },
            { label: 'Zakończone', status: 'completed', icon: <Check className="w-4 h-4 mr-2" /> },
            { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
            { label: 'Prośba o zmianę', status: 'change_requested', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
          ]
        )}

        {item.status === 'confirmed' && onStartWork && statusDropdown(
          'Rozpocznij pracę',
          () => onStartWork(item.id),
          'bg-emerald-600 hover:bg-emerald-700 text-white',
          [
            { label: 'Do potwierdzenia', status: 'pending', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
            { label: 'Zakończone', status: 'completed', icon: <Check className="w-4 h-4 mr-2" /> },
            { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
            { label: 'Prośba o zmianę', status: 'change_requested', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
          ]
        )}

        {item.status === 'in_progress' && onEndWork && statusDropdown(
          'Zakończ pracę',
          () => onEndWork(item.id),
          'bg-sky-500 hover:bg-sky-600 text-white',
          [
            { label: 'Do potwierdzenia', status: 'pending', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
            { label: 'Potwierdzone', status: 'confirmed', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
            { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
            { label: 'Prośba o zmianę', status: 'change_requested', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
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
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'pending')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Do potwierdzenia
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Potwierdzone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                W trakcie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'cancelled')}>
                <X className="w-4 h-4 mr-2" />
                Anulowane
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'change_requested')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Prośba o zmianę
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
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'pending')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Do potwierdzenia
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Potwierdzone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                <Clock className="w-4 h-4 mr-2" />
                W trakcie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'completed')}>
                <Check className="w-4 h-4 mr-2" />
                Zakończone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'change_requested')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Prośba o zmianę
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {item.status === 'change_requested' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 bg-white">
                Prośba o zmianę
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'pending')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Do potwierdzenia
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                <Check className="w-4 h-4 mr-2" />
                Potwierdzone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                <Clock className="w-4 h-4 mr-2" />
                W trakcie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'completed')}>
                <Check className="w-4 h-4 mr-2" />
                Zakończone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'cancelled')}>
                <X className="w-4 h-4 mr-2" />
                Anulowane
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          hideCloseButton
          hideOverlay
          className={`flex flex-col p-0 gap-0 z-[1000] ${isMobile ? 'h-[85vh]' : 'sm:max-w-lg'}`}
        >
          {/* Accessible title */}
          <SheetTitle className="sr-only">{item.title}</SheetTitle>
          <SheetDescription className="sr-only">Szczegóły zlecenia</SheetDescription>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[item.status] || 'bg-muted'}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                  {column && (
                    <span className="text-xs text-muted-foreground">{column.name}</span>
                  )}
                </div>
                <h3 className="text-base font-semibold mt-1">{item.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Customer */}
            {(item.customer_name || item.customer_phone || item.customer_email) && (
              <div className="space-y-2">
                {item.customer_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    {item.customer_id ? (
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline cursor-pointer text-left"
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
                      <span className="font-medium">{item.customer_name}</span>
                    )}
                    {item.customer_phone && (
                      <a href={`tel:${item.customer_phone}`} className="ml-auto p-1 rounded hover:bg-muted">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    )}
                    {item.customer_phone && (
                      <a href={`sms:${item.customer_phone}`} className="p-1 rounded hover:bg-muted">
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </a>
                    )}
                  </div>
                )}
                {addressLabel && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{addressLabel}</span>
                      {addressCoords && (
                        <a
                          href={`https://www.google.com/maps?q=${addressCoords.lat},${addressCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto p-1 rounded hover:bg-muted"
                          title="Otwórz w Google Maps"
                        >
                          <svg viewBox="0 0 92.3 132.3" className="w-5 h-5">
                            <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"/>
                            <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-32.4L10.8 16.5z"/>
                            <path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.1 27.7-32.1-5.6-10.8-15.3-19-27.2-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"/>
                            <path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.6-8.3 4.2-11.4L4.6 68.1c5.5 11.9 13.6 21.5 19.8 29.7l35.3-40.9c-3.2 3.9-8.1 6.3-13.5 6.9"/>
                            <path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L24.4 97.8c2.6 3.4 5 6.7 7 9.9 6.5 10.4 11 21.2 14.8 24.6 3.8-3.4 8.3-14.2 12.9-23.1"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    {addressStreet && (
                      <div className="text-sm text-foreground ml-6">{addressStreet}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            {item.price != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-bold">{item.price.toFixed(2)} PLN</span>
              </div>
            )}

            {/* Completed: FV + SMS buttons */}
            {item.status === 'completed' && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info('Wkrótce dostępne')}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Wyślij FV
                </Button>
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
              </div>
            )}
            {/* Assigned Employees - N2Wash style pills */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardHat className="w-4 h-4 text-muted-foreground" />
                Przypisani pracownicy
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.assigned_employees && item.assigned_employees.map(emp => (
                  <span key={emp.id} className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                    {emp.name}
                    <button
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {instanceId && (
                  <button
                    onClick={() => setEmployeeDrawerOpen(true)}
                    className="inline-flex items-center gap-1 border border-dashed border-border rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Dodaj
                  </button>
                )}
              </div>
            </div>

            {/* Notes - inline editable */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Notatki
              </div>
              {editingNotes ? (
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  onBlur={handleNotesBlur}
                  autoFocus
                  rows={3}
                  className="text-sm"
                  placeholder="Dodaj notatkę..."
                />
              ) : (
                <p
                  onClick={() => setEditingNotes(true)}
                  className={`text-sm ml-6 whitespace-pre-wrap cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 min-h-[2rem] ${notesValue ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {notesValue || 'Kliknij, aby dodać notatkę...'}
                </p>
              )}
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Camera className="w-4 h-4 text-muted-foreground" />
                Zdjęcia
              </div>
              <ProtocolPhotosUploader
                photos={itemPhotos}
                onPhotosChange={(newPhotos) => {
                  setItemPhotos(newPhotos);
                  // Auto-save to calendar_items
                  supabase
                    .from('calendar_items')
                    .update({ photo_urls: newPhotos } as any)
                    .eq('id', item.id)
                    .then(({ error }) => {
                      if (error) console.error('Error saving photos:', error);
                    });
                }}
                storageBucket="protocol-photos"
                filePrefix="zlecenie"
                onAutoSave={(newPhotos) => {
                  setItemPhotos(newPhotos);
                  supabase
                    .from('calendar_items')
                    .update({ photo_urls: newPhotos } as any)
                    .eq('id', item.id)
                    .then(({ error }) => {
                      if (error) console.error('Error saving photo annotation:', error);
                    });
                }}
              />
            </div>

            {/* Add Protocol button */}
            {onAddProtocol && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onAddProtocol(item)}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Dodaj protokół
              </Button>
            )}

            {(smsNotifications.length > 0 || unsent.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Powiadomienie SMS
                </div>
                {smsNotifications.map(sms => (
                  <div key={sms.id} className="ml-6 text-sm">
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
          </div>

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
        />
      )}

      {/* Customer Detail Drawer */}
      <CustomerEditDrawer
        customer={customerDetailData}
        instanceId={instanceId || null}
        open={customerDetailOpen}
        onClose={() => { setCustomerDetailOpen(false); setCustomerDetailData(null); }}
      />
    </>
  );
};

export default CalendarItemDetailsDrawer;
