import { useState, useEffect } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Loader2, CalendarIcon, HardHat, MessageSquare, X, FolderKanban } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/hooks/useNotifications';
import { useInstanceFeature } from '@/hooks/useInstanceFeatures';
import { PRIORITY_OPTIONS, DEFAULT_PRIORITY } from '@/lib/priorityUtils';
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
import CustomerEditDrawer from './CustomerEditDrawer';
import type { Customer } from './CustomersView';

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
  photo_urls?: string[] | null;
  priority?: number | null;
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
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  initialCustomerEmail?: string;
  initialCustomerAddressId?: string;
  initialServiceIds?: string[];
  initialProjectId?: string;
  onCustomerClick?: (customerId: string) => void;
}

const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 6; hour <= 19; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
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
  initialCustomerId,
  initialCustomerName,
  initialCustomerPhone,
  initialCustomerEmail,
  initialCustomerAddressId,
  initialServiceIds,
  initialProjectId,
  onCustomerClick,
}: AddCalendarItemDialogProps) => {
  const isEditMode = !!editingItem?.id;
  const isMobile = useIsMobile();
  const { enabled: activitiesEnabled } = useInstanceFeature(instanceId, 'activities');
  const { enabled: employeesEnabled } = useInstanceFeature(instanceId, 'employees');
  const { enabled: prioritiesEnabled } = useInstanceFeature(instanceId, 'priorities');
  const { enabled: projectsEnabled } = useInstanceFeature(instanceId, 'projects');
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
  const [durationPreset, setDurationPreset] = useState('');

  const WORK_DAY_MINUTES = 9 * 60;
  const handleDurationPreset = (preset: string) => {
    setDurationPreset(preset);
    const fractions: Record<string, number> = { full: 1, half: 0.5, third: 1/3, quarter: 0.25 };
    const fraction = fractions[preset];
    if (!fraction) return;
    const minutes = Math.round(WORK_DAY_MINUTES * fraction);
    const [h, m] = startTime.split(':').map(Number);
    const endMin = h * 60 + m + minutes;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const newEnd = `${String(Math.min(endH, 23)).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const closestOption = TIME_OPTIONS.find(t => t >= newEnd) || TIME_OPTIONS[TIME_OPTIONS.length - 1];
    setEndTime(closestOption);
  };
  const [adminNotes, setAdminNotes] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY);


  // Service selection state
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [allServices, setAllServices] = useState<ServiceWithCategory[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);

  // Customer detail drawer state
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);
  const [customerDetailData, setCustomerDetailData] = useState<Customer | null>(null);
  // Add new customer drawer state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCustomerPrefilledName, setAddCustomerPrefilledName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<{ id: string; title: string; customer_id: string | null; customer_address_id: string | null }[]>([]);

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

  // Fetch available projects
  useEffect(() => {
    if (!open || !instanceId || !projectsEnabled) { setAvailableProjects([]); return; }
    supabase.from('projects' as any).select('id, title, customer_id, customer_address_id').eq('instance_id', instanceId).in('status', ['not_started', 'in_progress', 'completed']).order('created_at', { ascending: false })
      .then(({ data }: any) => setAvailableProjects(data || []));
  }, [open, instanceId, projectsEnabled]);

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
      setColumnId(editingItem.column_id || columns[0]?.id || '');
      const fromDate = editingItem.item_date ? parseISO(editingItem.item_date) : new Date();
      const toDate = editingItem.end_date ? parseISO(editingItem.end_date) : fromDate;
      const isMulti = editingItem.end_date && !isSameDay(fromDate, toDate);
      setReservationType(isMulti ? 'multi' : 'single');
      setDateRange(editingItem.item_date ? { from: fromDate, to: toDate } : undefined);
      setStartTime(editingItem.start_time || '08:00');
      setEndTime(editingItem.end_time || '09:00');
      setAdminNotes(editingItem.admin_notes || '');
      setPrice(editingItem.price?.toString() || '');
      setPriority(editingItem.priority ?? DEFAULT_PRIORITY);
      setAssignedEmployeeIds(editingItem.assigned_employee_ids || []);
      // Load project_id in edit mode
      const loadProjectId = async () => {
        const { data } = await (supabase.from('calendar_items') as any)
          .select('project_id')
          .eq('id', editingItem.id)
          .single();
        setProjectId(data?.project_id || null);
      };
      loadProjectId();

      // Load saved services from calendar_item_services
      const loadServices = async () => {
        const { data: savedServices } = await supabase
          .from('calendar_item_services' as any)
          .select('service_id, custom_price, quantity')
          .eq('calendar_item_id', editingItem.id);

        if (savedServices && savedServices.length > 0) {
          const svcIds = savedServices.map((s: any) => s.service_id);
          const { data: svcData } = await supabase
            .from('unified_services')
            .select('id, name, short_name, price, duration_minutes, category_id, notification_template_id, unit')
            .in('id', svcIds);

          if (svcData) {
            setAllServices(svcData as ServiceWithCategory[]);
            setSelectedServiceIds(svcIds);
            setServiceItems(savedServices.map((ss: any) => {
              const svc = svcData.find((s: any) => s.id === ss.service_id);
              return {
                service_id: ss.service_id,
                custom_price: ss.custom_price,
                quantity: ss.quantity ?? 1,
                name: svc?.name,
                short_name: svc?.short_name,
                price: svc?.price,
                unit: svc?.unit || 'szt.',
              };
            }));
          }
        } else {
          setSelectedServiceIds([]);
          setAllServices([]);
          setServiceItems([]);
        }
      };
      loadServices();
    } else {
      setTitle('');
      setCustomerName(initialCustomerName || '');
      setCustomerPhone(initialCustomerPhone || '');
      setCustomerEmail(initialCustomerEmail || '');
      setCustomerId(initialCustomerId || null);
      setCustomerAddressId(initialCustomerAddressId || null);
      setColumnId(initialColumnId || columns[0]?.id || '');
      const initDate = initialDate ? parseISO(initialDate) : new Date();
      setDateRange({ from: initDate, to: initDate });
      setReservationType('single');
      const initStart = initialTime || '08:00';
      setStartTime(initStart);
      // Default to "Pół dnia" (4.5h)
      setDurationPreset('half');
      const [sh, sm] = initStart.split(':').map(Number);
      const halfDayEnd = sh * 60 + sm + Math.round(WORK_DAY_MINUTES * 0.5);
      const halfEndStr = `${String(Math.floor(halfDayEnd / 60)).padStart(2, '0')}:${String(halfDayEnd % 60).padStart(2, '0')}`;
      const halfClosest = TIME_OPTIONS.find(t => t >= halfEndStr) || TIME_OPTIONS[TIME_OPTIONS.length - 1];
      setEndTime(halfClosest);
      setAdminNotes('');
      setPrice('');
      setPriority(DEFAULT_PRIORITY);
      setAssignedEmployeeIds([]);

      // Handle initial project
      if (initialProjectId) {
        setProjectId(initialProjectId);
        // Force no dates when adding from project view
        setDateRange(undefined);
        // Auto-fill customer/address from project - fetch directly to avoid race condition
        const fillFromProject = async () => {
          const { data: proj } = await (supabase.from('projects' as any) as any)
            .select('customer_id, customer_address_id')
            .eq('id', initialProjectId)
            .single();
          if (proj) {
            if (proj.customer_address_id) {
              setCustomerAddressId(proj.customer_address_id);
            }
            if (proj.customer_id) {
              const { data: cust } = await supabase.from('customers').select('id, name, phone, email').eq('id', proj.customer_id).single();
              if (cust) {
                setCustomerId(cust.id);
                setCustomerName(cust.name);
                setCustomerPhone(cust.phone || '');
                setCustomerEmail(cust.email || '');
              }
            }
          }
        };
        fillFromProject();
      } else {
        setProjectId(null);
      }

      // Pre-fill services if provided
      if (initialServiceIds && initialServiceIds.length > 0) {
        const loadInitialServices = async () => {
          const { data: svcData } = await supabase
            .from('unified_services')
            .select('id, name, short_name, price, duration_minutes, category_id, notification_template_id, unit')
            .in('id', initialServiceIds);
          if (svcData && svcData.length > 0) {
            setAllServices(svcData as ServiceWithCategory[]);
            setSelectedServiceIds(initialServiceIds);
            setServiceItems(initialServiceIds.map(id => {
              const svc = svcData.find(s => s.id === id);
              return {
                service_id: id,
                custom_price: null,
                quantity: 1,
                name: svc?.name,
                short_name: svc?.short_name,
                price: svc?.price,
                unit: (svc as any)?.unit || 'szt.',
              };
            }));
            // Auto-generate title
            const names = initialServiceIds.map(id => {
              const s = svcData.find(sv => sv.id === id);
              return s?.short_name || s?.name || '';
            }).filter(Boolean);
            if (names.length > 0) {
              setTitle(names.join(', '));
            }
          }
        };
        loadInitialServices();
      } else {
        setSelectedServiceIds([]);
        setAllServices([]);
        setServiceItems([]);
      }
    }
    setSendImmediateSms(false);
    setImmediateSmsTemplate(null);
    setImmediateSmsTemplateId(null);
  }, [open, isEditMode, editingItem, initialDate, initialTime, initialColumnId, columns, initialCustomerId, initialCustomerName, initialCustomerPhone, initialCustomerEmail, initialCustomerAddressId, initialServiceIds, initialProjectId, availableProjects]);

  const handleSelectProject = async (selectedProjectId: string | null) => {
    setProjectId(selectedProjectId);
    if (!selectedProjectId) return;
    const proj = availableProjects.find(p => p.id === selectedProjectId);
    if (!proj) return;
    if (proj.customer_id) {
      const { data } = await supabase.from('customers').select('id, name, phone, email').eq('id', proj.customer_id).single();
      if (data) {
        setCustomerId(data.id);
        setCustomerName(data.name);
        setCustomerPhone(data.phone);
        setCustomerEmail(data.email || '');
      }
    }
    if (proj.customer_address_id) {
      setCustomerAddressId(proj.customer_address_id);
    }
  };

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

  const handleCustomerClick = async (clickedCustomerId: string) => {
    if (onCustomerClick) {
      onCustomerClick(clickedCustomerId);
      return;
    }
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', clickedCustomerId)
      .single();
    if (data) {
      setCustomerDetailData(data as Customer);
      setCustomerDetailOpen(true);
    }
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
          quantity: 1,
          name: svc?.name,
          short_name: svc?.short_name,
          price: svc?.price,
          unit: svc?.unit || 'szt.',
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

  const handleQuantityChange = (serviceId: string, qty: number) => {
    setServiceItems(prev => prev.map(si =>
      si.service_id === serviceId ? { ...si, quantity: qty } : si
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
    // Auto-fill title from first service if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      if (serviceItems.length > 0) {
        const firstSvc = serviceItems[0];
        finalTitle = firstSvc.short_name || firstSvc.name || '';
      }
      if (!finalTitle) {
        toast.error('Podaj tytuł zlecenia lub dodaj usługę');
        return;
      }
    }

    const hasDate = !!dateRange?.from;
    // If dates are provided, validate them
    if (hasDate) {
      if (!columnId) {
        toast.error('Wybierz kolumnę');
        return;
      }
      if (startTime >= endTime) {
        toast.error('Godzina końca musi być późniejsza niż początku');
        return;
      }
    }

    setLoading(true);
    try {
      // Auto-calculate stage_number for project items
      let stageNumber: number | null = null;
      if (projectId && !isEditMode) {
        const { count } = await supabase
          .from('calendar_items')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .neq('status', 'cancelled');
        stageNumber = (count || 0) + 1;
      }

      const data: any = {
        instance_id: instanceId,
        column_id: columnId || null,
        title: finalTitle,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_id: customerId || null,
        customer_address_id: customerAddressId || null,
        item_date: hasDate ? format(dateRange!.from!, 'yyyy-MM-dd') : null,
        end_date: hasDate && dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        start_time: startTime || null,
        end_time: endTime || null,
        admin_notes: adminNotes.trim() || null,
        price: price ? parseFloat(price) : null,
        priority: priority,
        assigned_employee_ids: assignedEmployeeIds.length > 0 ? assignedEmployeeIds : null,
        project_id: projectId || null,
        ...(stageNumber ? { stage_number: stageNumber } : {}),
      };

      let calendarItemId: string;

      if (isEditMode) {
        calendarItemId = editingItem!.id;
        const { error } = await supabase
          .from('calendar_items')
          .update(data)
          .eq('id', calendarItemId);
        if (error) throw error;

        // Send immediate SMS in edit mode if checkbox checked and no existing notification
        if (sendImmediateSms && immediateSmsTemplateId && customerPhone.trim() && !existingSmsNotification) {
          await createAndSendSms(calendarItemId);
        }

        toast.success('Zlecenie zaktualizowane');
      } else {
        const { data: inserted, error } = await supabase
          .from('calendar_items')
          .insert({ ...data, status: 'confirmed' })
          .select('id')
          .single();
        if (error) throw error;
        calendarItemId = inserted!.id;

        // Send immediate SMS if checkbox checked
        if (sendImmediateSms && immediateSmsTemplateId && customerPhone.trim() && inserted) {
          await createAndSendSms(calendarItemId);
        }

        toast.success('Zlecenie dodane');
      }

      // Save services to calendar_item_services
      // Delete existing services first
      await supabase
        .from('calendar_item_services' as any)
        .delete()
        .eq('calendar_item_id', calendarItemId);

      // Insert new services
      if (selectedServiceIds.length > 0) {
        const serviceRows = selectedServiceIds.map(svcId => {
          const si = serviceItems.find(s => s.service_id === svcId);
          return {
            calendar_item_id: calendarItemId,
            service_id: svcId,
            custom_price: si?.custom_price ?? null,
            quantity: si?.quantity ?? 1,
            instance_id: instanceId,
          };
        });
        await supabase
          .from('calendar_item_services' as any)
          .insert(serviceRows);
      }

      // Notify assigned employees about new/updated assignment
      if (activitiesEnabled && assignedEmployeeIds.length > 0 && hasDate) {
        const { data: emps } = await supabase
          .from('employees')
          .select('linked_user_id')
          .in('id', assignedEmployeeIds)
          .not('linked_user_id', 'is', null);
        const itemTitle = finalTitle || customerName.trim() || 'Zlecenie';
        const itemDate = format(dateRange!.from!, 'dd.MM.yyyy');
        for (const emp of emps || []) {
          if (emp.linked_user_id) {
            await createNotification({
              instanceId,
              userId: emp.linked_user_id,
              type: isEditMode ? 'item_rescheduled' : 'item_assigned',
              title: itemTitle,
              description: `${itemDate}, ${startTime}–${endTime}`,
              calendarItemId,
            });
          }
        }
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
        <SheetContent
          side="right"
          hideCloseButton
          hideOverlay
          className="flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {isEditMode ? 'Edytuj zlecenie' : 'Nowe zlecenie'}
              </SheetTitle>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Project selector */}
            {projectsEnabled && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5" />
                  Projekt
                </Label>
                <Select value={projectId || '_none'} onValueChange={(v) => handleSelectProject(v === '_none' ? null : v)}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Bez projektu" /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    <SelectItem value="_none">Bez projektu</SelectItem>
                    {availableProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Column (Typ) selector */}
            {columns.length > 0 && (
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select value={columnId} onValueChange={setColumnId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Wybierz typ" /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tytuł zlecenia</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white" />
            </div>

            {/* Customer Search */}
            <div className="space-y-2">
              <Label>Klient</Label>
              <CustomerSearchInput
                instanceId={instanceId}
                selectedCustomer={customerId ? { id: customerId, name: customerName, phone: customerPhone, email: customerEmail || null, company: null } : null}
                onSelect={handleSelectCustomer}
                onClear={handleClearCustomer}
                onCustomerClick={handleCustomerClick}
                onAddNew={(q) => { setAddCustomerPrefilledName(q); setAddCustomerOpen(true); }}
              />
            </div>

            {/* Customer Address */}
            <CustomerAddressSelect
              instanceId={instanceId}
              customerId={customerId}
              value={customerAddressId}
              onChange={setCustomerAddressId}
              onCustomerResolved={(customer, addressId) => {
                setCustomerId(customer.id);
                setCustomerName(customer.name);
                setCustomerPhone(customer.phone);
                setCustomerEmail(customer.email || '');
                setCustomerAddressId(addressId);
              }}
            />

            {/* Services Selection */}
            <div className="space-y-2">
              <Label>Usługi i produkty</Label>
              <SelectedServicesList
                services={allServices}
                selectedServiceIds={selectedServiceIds}
                serviceItems={serviceItems}
                onRemoveService={handleRemoveService}
                onPriceChange={handlePriceChange}
                onQuantityChange={handleQuantityChange}
                onAddMore={() => setServiceDrawerOpen(true)}
                onTotalPriceChange={handleTotalPriceChange}
              />
            </div>


            {/* Date - RadioGroup + Calendar */}
            <div className="space-y-2">
              <Label>Długość zlecenia</Label>
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
                  <Label htmlFor="type-single" className="cursor-pointer font-normal">Jednodniowe</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multi" id="type-multi" />
                  <Label htmlFor="type-multi" className="cursor-pointer font-normal">Wielodniowe</Label>
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
                      "w-full justify-start text-left font-normal bg-white",
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
                <PopoverContent className="w-auto p-0 z-[1200]" align="start">
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Od</Label>
                <Select value={startTime} onValueChange={(val) => { setStartTime(val); setDurationPreset(''); }}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Do</Label>
                <Select value={endTime} onValueChange={(val) => { setEndTime(val); setDurationPreset(''); }}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    {TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="invisible">Czas</Label>
                <Select value={durationPreset} onValueChange={handleDurationPreset}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Czas trwania" /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    <SelectItem value="full">Cały dzień</SelectItem>
                    <SelectItem value="half">Pół dnia</SelectItem>
                    <SelectItem value="third">1/3 dnia</SelectItem>
                    <SelectItem value="quarter">1/4 dnia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            {/* Assigned Employees */}
            {employeesEnabled && (
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
              <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => setEmployeeDrawerOpen(true)}>
                {assignedEmployeeIds.length > 0 ? 'Zmień pracowników' : 'Przypisz pracowników'}
              </Button>
            </div>
            )}

            {/* Price + Priority */}
            <div className="flex gap-3">
              <div className="space-y-2 w-1/3">
                <Label>Cena netto</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.01" className="bg-white" />
              </div>
              {prioritiesEnabled && (
                <div className="space-y-2 w-1/3">
                  <Label>Priorytet</Label>
                  <Select value={String(priority)} onValueChange={(v) => setPriority(Number(v))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[1200]">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3} className="bg-white" />
            </div>

            {/* SMS Notification */}
            {(() => {
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
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? 'Zapisz zmiany' : 'Dodaj zlecenie'}
            </Button>
          </div>
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
        instanceId={instanceId}
        orderDateFrom={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null}
        orderDateTo={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null}
      />

      {/* Customer Detail Drawer */}
      <CustomerEditDrawer
        customer={customerDetailData}
        instanceId={instanceId}
        open={customerDetailOpen}
        onClose={() => { setCustomerDetailOpen(false); setCustomerDetailData(null); }}
      />

      {/* Add New Customer Drawer */}
      <CustomerEditDrawer
        customer={null}
        instanceId={instanceId}
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        isAddMode
        prefilledName={addCustomerPrefilledName}
        onCustomerCreated={(newCustomer, firstAddressId) => {
          setCustomerId(newCustomer.id);
          setCustomerName(newCustomer.name);
          setCustomerPhone(newCustomer.phone);
          setCustomerEmail(newCustomer.email || '');
          if (firstAddressId) {
            setCustomerAddressId(firstAddressId);
          }
          setAddCustomerOpen(false);
        }}
      />
    </>
  );
};

export default AddCalendarItemDialog;
