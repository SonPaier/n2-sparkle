import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trash2, X, CalendarIcon, User } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Reminder, ReminderType } from '@/hooks/useReminders';
import CustomerSearchInput from '@/components/admin/CustomerSearchInput';
import { useEmployees } from '@/hooks/useEmployees';
import EmployeeSelectionDrawer from '@/components/admin/EmployeeSelectionDrawer';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Poniedziałek' },
  { value: 1, label: 'Wtorek' },
  { value: 2, label: 'Środa' },
  { value: 3, label: 'Czwartek' },
  { value: 4, label: 'Piątek' },
  { value: 5, label: 'Sobota' },
  { value: 6, label: 'Niedziela' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  reminderTypes: ReminderType[];
  onSave: (data: any, id?: string) => Promise<boolean>;
  onDelete?: (id: string) => void;
  editingReminder?: Reminder | null;
}

export default function AddEditReminderDrawer({ open, onClose, instanceId, reminderTypes, onSave, onDelete, editingReminder }: Props) {
  const isMobile = useIsMobile();
  const isEditing = !!editingReminder;

  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [daysBefore, setDaysBefore] = useState(7);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyCustomerEmail, setNotifyCustomerEmail] = useState(false);
  const [notifyCustomerSms, setNotifyCustomerSms] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('monthly');
  const [recurringValue, setRecurringValue] = useState<number | null>(null);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string | null>(null);
  const [visibleForEmployee, setVisibleForEmployee] = useState(false);
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useEmployees(instanceId);
  const activeEmployees = employees.filter(e => e.active);

  useEffect(() => {
    if (open) {
      if (editingReminder) {
        setName(editingReminder.name);
        setTypeId(editingReminder.reminder_type_id || '');
        setDeadline(editingReminder.deadline);
        setDaysBefore(editingReminder.days_before);
        setCustomerId(editingReminder.customer_id);
        setCustomerName(editingReminder.customer_name || '');
        setNotes(editingReminder.notes || '');
        setNotifyEmail(editingReminder.notify_email);
        setNotifySms(editingReminder.notify_sms);
        setNotifyCustomerEmail((editingReminder as any).notify_customer_email ?? false);
        setNotifyCustomerSms((editingReminder as any).notify_customer_sms ?? false);
        setIsRecurring(editingReminder.is_recurring);
        setRecurringType(editingReminder.recurring_type || 'monthly');
        setRecurringValue(editingReminder.recurring_value);
        setAssignedEmployeeId(editingReminder.assigned_employee_id || null);
        setVisibleForEmployee(editingReminder.visible_for_employee ?? false);
      } else {
        setName('');
        setTypeId('');
        setDeadline('');
        setDaysBefore(7);
        setCustomerId(null);
        setCustomerName('');
        setNotes('');
        setNotifyEmail(true);
        setNotifySms(false);
        setNotifyCustomerEmail(false);
        setNotifyCustomerSms(false);
        setIsRecurring(false);
        setRecurringType('monthly');
        setRecurringValue(null);
        setAssignedEmployeeId(null);
        setVisibleForEmployee(false);
      }
    }
  }, [open, editingReminder]);

  const handleSave = async () => {
    if (!name.trim() || !typeId) return;
    if (!isRecurring && !deadline) return;

    setSaving(true);
    const data: any = {
      instance_id: instanceId,
      name: name.trim(),
      reminder_type_id: typeId,
      deadline: isRecurring ? computeNextRecurringDeadline(recurringType, recurringValue) : deadline,
      days_before: daysBefore,
      customer_id: customerId || null,
      notes: notes || null,
      notify_email: notifyEmail,
      notify_sms: notifySms,
      notify_customer_email: customerId ? notifyCustomerEmail : false,
      notify_customer_sms: customerId ? notifyCustomerSms : false,
      is_recurring: isRecurring,
      recurring_type: isRecurring ? recurringType : null,
      recurring_value: isRecurring ? recurringValue : null,
      assigned_employee_id: assignedEmployeeId || null,
      visible_for_employee: assignedEmployeeId ? visibleForEmployee : false,
    };

    const success = await onSave(data, editingReminder?.id);
    setSaving(false);
    if (success) onClose();
  };

  const deadlineDate = deadline ? new Date(deadline + 'T00:00:00') : undefined;

  const header = (
    <div className="px-6 py-4 border-b border-border shrink-0 bg-card flex items-center justify-between">
      <h2 className="text-lg font-semibold">{isEditing ? 'Edytuj przypomnienie' : 'Nowe przypomnienie'}</h2>
      <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  const footer = (
    <div className="px-6 py-4 border-t border-border shrink-0 bg-card flex items-center justify-between">
      {isEditing && onDelete ? (
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { onDelete(editingReminder!.id); onClose(); }}>
          <Trash2 className="w-4 h-4 mr-1" /> Usuń
        </Button>
      ) : <div />}
      <div className="flex gap-2">
        <Button variant="outline" className="bg-white" onClick={onClose}>Anuluj</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim() || !typeId || (!isRecurring && !deadline)}>
          {saving ? 'Zapisywanie...' : isEditing ? 'Zapisz' : 'Utwórz'}
        </Button>
      </div>
    </div>
  );

  const formContent = (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <div>
        <Label className="mb-1.5 block">Nazwa <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} className="bg-white" />
      </div>

      <div>
        <Label className="mb-1.5 block">Kategoria przypomnienia <span className="text-destructive">*</span></Label>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Wybierz kategorię..." />
          </SelectTrigger>
          <SelectContent>
            {reminderTypes.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recurring toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          <Label className="font-semibold">Przypomnienie cykliczne</Label>
        </div>

        {isRecurring && (
          <div className="space-y-3 pl-1">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={recurringType === 'monthly' ? 'default' : 'outline'}
                size="sm"
                className={cn("flex-1", recurringType !== 'monthly' && "bg-white")}
                onClick={() => setRecurringType('monthly')}
              >
                Dzień miesiąca
              </Button>
              <Button
                type="button"
                variant={recurringType === 'weekly' ? 'default' : 'outline'}
                size="sm"
                className={cn("flex-1", recurringType !== 'weekly' && "bg-white")}
                onClick={() => setRecurringType('weekly')}
              >
                Dzień tygodnia
              </Button>
            </div>
            {recurringType === 'monthly' ? (
              <div>
                <Label className="mb-1.5 block text-sm">Dzień miesiąca (1–28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={recurringValue ?? ''}
                  onChange={e => setRecurringValue(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-24 bg-white"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block text-sm">Dzień tygodnia</Label>
                <Select value={recurringValue?.toString() ?? ''} onValueChange={v => setRecurringValue(parseInt(v))}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Wybierz dzień..." /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {!isRecurring && (
        <div>
          <Label className="mb-1.5 block">Do kiedy <span className="text-destructive">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-white",
                  !deadline && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadlineDate!, 'dd.MM.yyyy', { locale: pl }) : 'Wybierz datę...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={deadlineDate}
                onSelect={(date) => setDeadline(date ? format(date, 'yyyy-MM-dd') : '')}
                locale={pl}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Przypomnij ile dni przed <span className="text-destructive">*</span></Label>
        <Input
          type="number"
          min={1}
          value={daysBefore}
          onChange={e => setDaysBefore(parseInt(e.target.value) || 1)}
          className="w-24 bg-white"
        />
        <p className="text-xs text-muted-foreground mt-1">Na ile dni przed terminem wysłać powiadomienie</p>
      </div>

      <div>
        <Label className="mb-1.5 block">Powiąż klienta <span className="text-muted-foreground text-xs">(opcjonalne)</span></Label>
        <CustomerSearchInput
          instanceId={instanceId}
          selectedCustomer={customerId ? { id: customerId, name: customerName, phone: '', email: null, company: null } : null}
          onSelect={(customer) => { setCustomerId(customer.id); setCustomerName(customer.name); }}
          onClear={() => { setCustomerId(null); setCustomerName(''); setNotifyCustomerEmail(false); setNotifyCustomerSms(false); }}
        />
      </div>

      {/* Employee assignment */}
      <div>
        <Label className="mb-1.5 block">Powiąż pracownika <span className="text-muted-foreground text-xs">(opcjonalne)</span></Label>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal bg-white"
          onClick={() => setEmployeeDrawerOpen(true)}
        >
          <User className="w-4 h-4 mr-2 shrink-0" />
          {assignedEmployeeId
            ? activeEmployees.find(e => e.id === assignedEmployeeId)?.name || 'Wybrany pracownik'
            : <span className="text-muted-foreground">Wybierz pracownika...</span>
          }
        </Button>
      </div>

      {assignedEmployeeId && (
        <div className="flex items-center gap-3">
          <Checkbox id="visibleForEmployee" checked={visibleForEmployee} onCheckedChange={v => setVisibleForEmployee(!!v)} />
          <label htmlFor="visibleForEmployee" className="text-sm cursor-pointer">Przypomnienie widoczne dla pracownika</label>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Notatki</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="bg-white" />
      </div>

      {/* Notifications */}
      <div className="space-y-3">
        <Label className="font-semibold block">Powiadomienia</Label>
        <div className="flex items-center gap-3">
          <Checkbox id="notifyEmail" checked={notifyEmail} onCheckedChange={v => setNotifyEmail(!!v)} />
          <label htmlFor="notifyEmail" className="text-sm cursor-pointer">Wyślij mi e-mail</label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="notifySms" checked={notifySms} onCheckedChange={v => setNotifySms(!!v)} />
          <label htmlFor="notifySms" className="text-sm cursor-pointer">Wyślij mi SMS</label>
        </div>
        {customerId && (
          <>
            <div className="flex items-center gap-3">
              <Checkbox id="notifyCustomerEmail" checked={notifyCustomerEmail} onCheckedChange={v => setNotifyCustomerEmail(!!v)} />
              <label htmlFor="notifyCustomerEmail" className="text-sm cursor-pointer">Wyślij e-mail do klienta</label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="notifyCustomerSms" checked={notifyCustomerSms} onCheckedChange={v => setNotifyCustomerSms(!!v)} />
              <label htmlFor="notifyCustomerSms" className="text-sm cursor-pointer">Wyślij SMS do klienta</label>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const employeeDrawer = (
    <EmployeeSelectionDrawer
      open={employeeDrawerOpen}
      onClose={() => setEmployeeDrawerOpen(false)}
      employees={employees}
      selectedIds={assignedEmployeeId ? [assignedEmployeeId] : []}
      singleSelect
      onConfirm={(ids) => {
        const newId = ids[0] || null;
        setAssignedEmployeeId(newId);
        if (!newId) setVisibleForEmployee(false);
      }}
    />
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
          <SheetContent side="right" className="w-full h-full flex flex-col p-0 gap-0 bg-card" hideCloseButton hideOverlay>
            {header}
            {formContent}
            {footer}
          </SheetContent>
        </Sheet>
        {employeeDrawer}
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full flex flex-col p-0 gap-0 bg-card" hideCloseButton hideOverlay onInteractOutside={(e) => e.preventDefault()}>
          {header}
          {formContent}
          {footer}
        </SheetContent>
      </Sheet>
      {employeeDrawer}
    </>
  );
}

function computeNextRecurringDeadline(type: string, value: number | null): string {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (type === 'monthly' && value) {
    const cappedValue = Math.min(value, 28);
    const next = new Date(now.getFullYear(), now.getMonth(), cappedValue);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return fmt(next);
  }
  if (type === 'weekly' && value !== null) {
    const current = now.getDay();
    const target = (value + 1) % 7;
    let diff = target - current;
    if (diff <= 0) diff += 7;
    const next = new Date(now);
    next.setDate(next.getDate() + diff);
    return fmt(next);
  }
  return fmt(now);
}