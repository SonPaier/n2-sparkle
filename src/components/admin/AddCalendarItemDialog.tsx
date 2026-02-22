import { useState, useEffect } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Loader2, CalendarIcon, HardHat, MessageSquare } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import ServiceSelectionDrawer, { type ServiceWithCategory } from './ServiceSelectionDrawer';
import SelectedServicesList, { type ServiceItem } from './SelectedServicesList';
import { useEmployees } from '@/hooks/useEmployees';
import AssignedEmployeesChips from './AssignedEmployeesChips';
import EmployeeSelectionDrawer from './EmployeeSelectionDrawer';
import CustomerSearchInput, { type SelectedCustomer } from './CustomerSearchInput';
import CustomerAddressSelect from './CustomerAddressSelect';
import { Checkbox } from '@/components/ui/checkbox';

interface CalendarColumn {
  id: string;
  name: string;
}


export interface EditingCalendarItem {
  id: string;
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  customer_address_id?: string | null;
  assigned_employee_ids?: string[] | null;
  item_date: string;
  end_date?: string | null;
  start_time: string;
  end_time: string;
  column_id: string | null;
  admin_notes?: string | null;
  price?: number | null;
}

interface AddCalendarItemDialogProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  columns: CalendarColumn[];
  onSuccess: () => void;
  editingItem?: EditingCalendarItem | null;
  initialDate?: string;
  initialTime?: string;
  initialColumnId?: string;
}

const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 6; hour <= 19; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 19 && minute > 0) break;
      options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const AddCalendarItemDialog = ({
  open,
  onClose,
  instanceId,
  columns,
  onSuccess,
  editingItem = null,
  initialDate,
  initialTime,
  initialColumnId,
}: AddCalendarItemDialogProps) => {
  const isEditMode = !!editingItem?.id;
  const isMobile = useIsMobile();
  const { data: allEmployees = [] } = useEmployees(instanceId);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerAddressId, setCustomerAddressId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState('');
  const [reservationType, setReservationType] = useState<'single' | 'multi'>('single');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [adminNotes, setAdminNotes] = useState('');
  const [price, setPrice] = useState('');


  // Service selection state
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [allServices, setAllServices] = useState<ServiceWithCategory[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);

  // SMS notification state
  const [sendImmediateSms, setSendImmediateSms] = useState(false);
  const [immediateSmsTemplate, setImmediateSmsTemplate] = useState<string | null>(null);
  const [immediateSmsTemplateId, setImmediateSmsTemplateId] = useState<string | null>(null);
  const [existingSmsNotification, setExistingSmsNotification] = useState<{ id: string; status: string; sent_at: string | null } | null>(null);
  const [instanceShortName, setInstanceShortName] = useState('');

  // Fetch instance short_name
  useEffect(() => {
    if (!instanceId) return;
    const fetchInstance = async () => {
      const { data } = await (supabase.from('instances') as any)
        .select('short_name, name')
        .eq('id', instanceId)
        .single();
      if (data) setInstanceShortName(data.short_name || data.name || '');
    };
    fetchInstance();
  }, [instanceId]);

  // Check for existing SMS notification in edit mode
  useEffect(() => {
    if (!open || !isEditMode || !editingItem?.id) {
      setExistingSmsNotification(null);
      return;
    }
    const fetchExistingSms = async () => {
      const { data } = await (supabase.from('customer_sms_notifications') as any)
        .select('id, status, sent_at')
        .eq('calendar_item_id', editingItem.id)
        .limit(1);
      if (data && data.length > 0) {
        setExistingSmsNotification(data[0]);
      } else {
        setExistingSmsNotification(null);
      }
    };
    fetchExistingSms();
  }, [open, isEditMode, editingItem?.id]);
  useEffect(() => {
    if (!open) return;

    if (isEditMode && editingItem) {
      setTitle(editingItem.title || '');
      setCustomerName(editingItem.customer_name || '');
      setCustomerPhone(editingItem.customer_phone || '');
      setCustomerEmail(editingItem.customer_email || '');
      setCustomerId(editingItem.customer_id || null);
      setCustomerAddressId(editingItem.customer_address_id || null);
      setColumnId(editingItem.column_id || '');
      const fromDate = editingItem.item_date ? parseISO(editingItem.item_date) : new Date();
      const toDate = editingItem.end_date ? parseISO(editingItem.end_date) : fromDate;
      const isMulti = editingItem.end_date && !isSameDay(fromDate, toDate);
      setReservationType(isMulti ? 'multi' : 'single');
      setDateRange({ from: fromDate, to: toDate });
      setStartTime(editingItem.start_time || '08:00');
      setEndTime(editingItem.end_time || '09:00');
      setAdminNotes(editingItem.admin_notes || '');
      setPrice(editingItem.price?.toString() || '');
      setAssignedEmployeeIds(editingItem.assigned_employee_ids || []);
    } else {
      setTitle('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerId(null);
      setCustomerAddressId(null);
      setColumnId(initialColumnId || columns[0]?.id || '');
      const initDate = initialDate ? parseISO(initialDate) : new Date();
      setDateRange({ from: initDate, to: initDate });
      setReservationType('single');
      setStartTime(initialTime || '08:00');
      const startIdx = TIME_OPTIONS.indexOf(initialTime || '08:00');
      setEndTime(TIME_OPTIONS[Math.min(startIdx + 4, TIME_OPTIONS.length - 1)] || '09:00');
      setAdminNotes('');
      setPrice('');
      setAssignedEmployeeIds([]);
    }
    // Reset
    setSelectedServiceIds([]);
    setAllServices([]);
    setServiceItems([]);
    setSendImmediateSms(false);
    setImmediateSmsTemplate(null);
    setImmediateSmsTemplateId(null);
  }, [open, isEditMode, editingItem, initialDate, initialTime, initialColumnId, columns]);

  const handleSelectCustomer = (customer: SelectedCustomer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerEmail(customer.email || '');
  };

  const handleClearCustomer = () => {
    setCustomerId(null);
    setCustomerAddressId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  // Handle service selection confirmed
  const handleServicesConfirmed = (serviceIds: string[], totalDuration: number, services: ServiceWithCategory[]) => {
    setSelectedServiceIds(serviceIds);
    setAllServices(prev => {
      const map = new Map(prev.map(s => [s.id, s]));
      services.forEach(s => map.set(s.id, s));
      return Array.from(map.values());
    });

    // Create service items for new services
    setServiceItems(prev => {
      const existing = new Map(prev.map(si => [si.service_id, si]));
      return serviceIds.map(id => {
        if (existing.has(id)) return existing.get(id)!;
        const svc = services.find(s => s.id === id);
        return {
          service_id: id,
          custom_price: null,
          name: svc?.name,
          short_name: svc?.short_name,
          price: svc?.price,
        };
      });
    });

    // Auto-generate title from selected services
    if (services.length > 0) {
      const names = serviceIds.map(id => {
        const s = services.find(sv => sv.id === id);
        return s?.short_name || s?.name || '';
      }).filter(Boolean);
      if (names.length > 0 && !title.trim()) {
        setTitle(names.join(', '));
      }
    }

    // Update end time based on total duration
    if (totalDuration > 0) {
      const [h, m] = startTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + totalDuration;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      const newEnd = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
      const closestOption = TIME_OPTIONS.find(t => t >= newEnd) || TIME_OPTIONS[TIME_OPTIONS.length - 1];
      setEndTime(closestOption);
    }

    // Check for immediate SMS templates
    const fetchImmediateTemplates = async () => {
      const templateIds = services
        .filter(s => serviceIds.includes(s.id) && (s as any).notification_template_id)
        .map(s => (s as any).notification_template_id)
        .filter(Boolean);
      
      if (templateIds.length === 0) {
        setImmediateSmsTemplate(null);
        setImmediateSmsTemplateId(null);
        setSendImmediateSms(false);
        return;
      }

      const uniqueIds = [...new Set(templateIds)];
      const { data: templates } = await (supabase
        .from('sms_notification_templates') as any)
        .select('id, sms_template, items')
        .in('id', uniqueIds);

      if (templates) {
        for (const tmpl of templates) {
          const tmplItems = Array.isArray(tmpl.items) ? tmpl.items : [];
          const hasImmediate = tmplItems.some((item: any) => item.trigger_type === 'immediate');
          if (hasImmediate && tmpl.sms_template) {
            const preview = tmpl.sms_template.replace(/\{short_name\}/g, instanceShortName);
            setImmediateSmsTemplate(preview);
            setImmediateSmsTemplateId(tmpl.id);
            setSendImmediateSms(true);
            return;
          }
        }
      }
      setImmediateSmsTemplate(null);
      setImmediateSmsTemplateId(null);
      setSendImmediateSms(false);
    };
    fetchImmediateTemplates();
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServiceIds(prev => prev.filter(id => id !== serviceId));
    setServiceItems(prev => prev.filter(si => si.service_id !== serviceId));
  };

  const handlePriceChange = (serviceId: string, newPrice: number | null) => {
    setServiceItems(prev => prev.map(si =>
      si.service_id === serviceId ? { ...si, custom_price: newPrice } : si
    ));
  };

  const handleTotalPriceChange = (newTotal: number) => {
    setPrice(newTotal.toString());
  };

  const createAndSendSms = async (calendarItemId: string) => {
    try {
      const serviceType = allServices.find(s => (s as any).notification_template_id === immediateSmsTemplateId)?.name || 'serwis';
      
      // Create notification record
      const { data: notif, error: notifError } = await (supabase
        .from('customer_sms_notifications') as any)
        .insert({
          instance_id: instanceId,
          notification_template_id: immediateSmsTemplateId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          service_type: serviceType,
          months_after: 0,
          scheduled_date: format(dateRange!.from!, 'yyyy-MM-dd'),
          status: 'pending',
          calendar_item_id: calendarItemId,
        })
        .select('id')
        .single();

      if (notifError) {
        console.error('Error creating SMS notification:', notifError);
        return;
      }

      // Call edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      fetch(`https://${projectId}.supabase.co/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({
          phone: customerPhone.trim(),
          message: immediateSmsTemplate || '',
          instanceId: instanceId,
          notificationId: notif?.id,
        }),
      }).catch(err => console.error('Error calling send-sms:', err));
    } catch (err) {
      console.error('Error in createAndSendSms:', err);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Podaj tytuł zlecenia');
      return;
    }
    if (!columnId) {
      toast.error('Wybierz kolumnę');
      return;
    }
    if (!dateRange?.from) {
      toast.error('Wybierz datę');
      return;
    }
    if (startTime >= endTime) {
      toast.error('Godzina końca musi być późniejsza niż początku');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        instance_id: instanceId,
        column_id: columnId,
        title: title.trim(),
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_id: customerId || null,
        customer_address_id: customerAddressId || null,
        item_date: format(dateRange!.from!, 'yyyy-MM-dd'),
        end_date: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        start_time: startTime,
        end_time: endTime,
        admin_notes: adminNotes.trim() || null,
        price: price ? parseFloat(price) : null,
        assigned_employee_ids: assignedEmployeeIds.length > 0 ? assignedEmployeeIds : null,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('calendar_items')
          .update(data)
          .eq('id', editingItem!.id);
        if (error) throw error;

        // Send immediate SMS in edit mode if checkbox checked and no existing notification
        if (sendImmediateSms && immediateSmsTemplateId && customerPhone.trim() && !existingSmsNotification) {
          await createAndSendSms(editingItem!.id);
        }

        toast.success('Zlecenie zaktualizowane');
      } else {
        const { data: inserted, error } = await supabase
          .from('calendar_items')
          .insert({ ...data, status: 'confirmed' })
          .select('id')
          .single();
        if (error) throw error;

        // Send immediate SMS if checkbox checked
        if (sendImmediateSms && immediateSmsTemplateId && customerPhone.trim() && inserted) {
          await createAndSendSms(inserted.id);
        }

        toast.success('Zlecenie dodane');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving calendar item:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[90vh] overflow-y-auto' : 'sm:max-w-lg overflow-y-auto'}>
          <SheetHeader>
            <SheetTitle>{isEditMode ? 'Edytuj zlecenie' : 'Nowe zlecenie'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 py-4">
            {/* Services Selection */}
            <div className="space-y-2">
              <Label>Usługi</Label>
              <SelectedServicesList
                services={allServices}
                selectedServiceIds={selectedServiceIds}
                serviceItems={serviceItems}
                onRemoveService={handleRemoveService}
                onPriceChange={handlePriceChange}
                onAddMore={() => setServiceDrawerOpen(true)}
                onTotalPriceChange={handleTotalPriceChange}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Tytuł zlecenia *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Np. Wymiana oleju, Przegląd..." />
            </div>

            {/* Customer Search */}
            <div className="space-y-2">
              <Label>Klient</Label>
              <CustomerSearchInput
                instanceId={instanceId}
                selectedCustomer={customerId ? { id: customerId, name: customerName, phone: customerPhone, email: customerEmail || null, company: null } : null}
                onSelect={handleSelectCustomer}
                onClear={handleClearCustomer}
              />
            </div>

            {/* Customer details (manual or from selection) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imię klienta</Label>
                <Input value={customerName} onChange={(e) => { setCustomerName(e.target.value); if (customerId) setCustomerId(null); }} placeholder="Jan Kowalski" />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); if (customerId) setCustomerId(null); }} placeholder="+48 ..." type="tel" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={customerEmail} onChange={(e) => { setCustomerEmail(e.target.value); if (customerId) setCustomerId(null); }} placeholder="jan@example.com" type="email" />
            </div>

            {/* Customer Address */}
            <CustomerAddressSelect
              instanceId={instanceId}
              customerId={customerId}
              value={customerAddressId}
              onChange={setCustomerAddressId}
            />

            {/* Column */}
            <div className="space-y-2">
              <Label>Kolumna *</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue placeholder="Wybierz kolumnę" /></SelectTrigger>
                <SelectContent>
                  {columns.map((col) => <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Date - RadioGroup + Calendar */}
            <div className="space-y-2">
              <Label>Typ zlecenia</Label>
              <RadioGroup
                value={reservationType}
                onValueChange={(v: 'single' | 'multi') => {
                  setReservationType(v);
                  if (v === 'single' && dateRange?.from) {
                    setDateRange({ from: dateRange.from, to: dateRange.from });
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="type-single" />
                  <Label htmlFor="type-single" className="cursor-pointer font-normal">Jednodniowa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multi" id="type-multi" />
                  <Label htmlFor="type-multi" className="cursor-pointer font-normal">Wielodniowa</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      reservationType === 'multi' && dateRange.to && !isSameDay(dateRange.from, dateRange.to)
                        ? `${format(dateRange.from, 'd MMM', { locale: pl })} – ${format(dateRange.to, 'd MMM yyyy', { locale: pl })}`
                        : format(dateRange.from, 'EEEE, d MMM yyyy', { locale: pl })
                    ) : (
                      <span>Wybierz datę</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  {reservationType === 'single' ? (
                    <Calendar
                      mode="single"
                      selected={dateRange?.from}
                      onSelect={(date) => {
                        if (date) {
                          setDateRange({ from: date, to: date });
                          setDateRangeOpen(false);
                        }
                      }}
                      initialFocus
                      locale={pl}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  ) : (
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        setDateRange(range);
                        if (range?.from && range?.to) {
                          setDateRangeOpen(false);
                        }
                      }}
                      numberOfMonths={isMobile ? 1 : 2}
                      initialFocus
                      locale={pl}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Od</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Do</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Cena (PLN)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </div>

            {/* Assigned Employees */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <HardHat className="w-3.5 h-3.5" />
                Przypisani pracownicy
              </Label>
              <AssignedEmployeesChips
                employees={allEmployees}
                selectedIds={assignedEmployeeIds}
                onRemove={(id) => setAssignedEmployeeIds(prev => prev.filter(x => x !== id))}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setEmployeeDrawerOpen(true)}>
                {assignedEmployeeIds.length > 0 ? 'Zmień pracowników' : 'Przypisz pracowników'}
              </Button>
            </div>

            {/* SMS Notification */}
            {(() => {
              // Edit mode: show status or checkbox
              if (isEditMode && existingSmsNotification) {
                if (existingSmsNotification.sent_at) {
                  return (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <MessageSquare className="w-4 h-4" />
                      <span>Wysłano SMS — {format(new Date(existingSmsNotification.sent_at), 'd MMM yyyy, HH:mm', { locale: pl })}</span>
                    </div>
                  );
                }
                if (existingSmsNotification.status === 'pending') {
                  return (
                    <div className="flex items-center gap-2 text-sm text-orange-600 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <MessageSquare className="w-4 h-4" />
                      <span>SMS oczekuje na wysłanie</span>
                    </div>
                  );
                }
              }
              // Show checkbox if immediate template available and no existing sent SMS
              if (immediateSmsTemplate && (!existingSmsNotification || (!existingSmsNotification.sent_at && existingSmsNotification.status !== 'pending'))) {
                const hasPhone = !!customerPhone.trim();
                return (
                  <div className="space-y-2 p-3 border rounded-lg bg-card">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="send-sms"
                        checked={sendImmediateSms}
                        onCheckedChange={(checked) => setSendImmediateSms(!!checked)}
                        disabled={!hasPhone}
                        className="mt-0.5"
                      />
                      <label htmlFor="send-sms" className={`text-sm cursor-pointer ${!hasPhone ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-1 font-medium">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Wyślij powiadomienie SMS
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{immediateSmsTemplate}</p>
                      </label>
                    </div>
                    {!hasPhone && (
                      <p className="text-xs text-destructive ml-6">Wymagany numer telefonu klienta</p>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Dodatkowe informacje..." rows={3} />
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? 'Zapisz zmiany' : 'Dodaj zlecenie'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Service Selection Drawer */}
      <ServiceSelectionDrawer
        open={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        instanceId={instanceId}
        selectedServiceIds={selectedServiceIds}
        onConfirm={handleServicesConfirmed}
      />

      {/* Employee Selection Drawer */}
      <EmployeeSelectionDrawer
        open={employeeDrawerOpen}
        onClose={() => setEmployeeDrawerOpen(false)}
        employees={allEmployees}
        selectedIds={assignedEmployeeIds}
        onConfirm={setAssignedEmployeeIds}
      />
    </>
  );
};

export default AddCalendarItemDialog;
