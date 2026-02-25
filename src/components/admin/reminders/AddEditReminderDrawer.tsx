import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trash2, RefreshCw } from 'lucide-react';
import type { Reminder, ReminderType } from '@/hooks/useReminders';
import CustomerSearchInput from '@/components/admin/CustomerSearchInput';

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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState('monthly');
  const [recurringValue, setRecurringValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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
        setIsRecurring(editingReminder.is_recurring);
        setRecurringType(editingReminder.recurring_type || 'monthly');
        setRecurringValue(editingReminder.recurring_value);
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
        setIsRecurring(false);
        setRecurringType('monthly');
        setRecurringValue(null);
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
      is_recurring: isRecurring,
      recurring_type: isRecurring ? recurringType : null,
      recurring_value: isRecurring ? recurringValue : null,
    };

    const success = await onSave(data, editingReminder?.id);
    setSaving(false);
    if (success) onClose();
  };

  const formContent = (
    <div className="space-y-4 p-4">
      <div>
        <Label className="mb-1.5 block">Nazwa <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Badania lekarskie — Bartek" />
      </div>

      <div>
        <Label className="mb-1.5 block">Typ przypomnienia <span className="text-destructive">*</span></Label>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Wybierz typ..." />
          </SelectTrigger>
          <SelectContent>
            {reminderTypes.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recurring toggle */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">Przypomnienie cykliczne</Label>
          </div>
        </div>

        {isRecurring && (
          <div className="pt-3 border-t border-border/50 space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={recurringType === 'monthly' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setRecurringType('monthly')}
              >
                Dzień miesiąca
              </Button>
              <Button
                type="button"
                variant={recurringType === 'weekly' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setRecurringType('weekly')}
              >
                Dzień tygodnia
              </Button>
            </div>
            {recurringType === 'monthly' ? (
              <div>
                <Label className="mb-1.5 block text-sm">Dzień miesiąca (1–31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={recurringValue ?? ''}
                  onChange={e => setRecurringValue(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-24"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block text-sm">Dzień tygodnia</Label>
                <Select value={recurringValue?.toString() ?? ''} onValueChange={v => setRecurringValue(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz dzień..." /></SelectTrigger>
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
          <Label className="mb-1.5 block">Deadline <span className="text-destructive">*</span></Label>
          <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Przypomnij X dni przed <span className="text-destructive">*</span></Label>
        <Input
          type="number"
          min={1}
          value={daysBefore}
          onChange={e => setDaysBefore(parseInt(e.target.value) || 1)}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground mt-1">Na ile dni przed deadline'em wysłać powiadomienie</p>
      </div>

      <div>
        <Label className="mb-1.5 block">Klient <span className="text-muted-foreground text-xs">(opcjonalne)</span></Label>
        <CustomerSearchInput
          instanceId={instanceId}
          selectedCustomer={customerId ? { id: customerId, name: customerName, phone: '', email: null, company: null } : null}
          onSelect={(customer) => { setCustomerId(customer.id); setCustomerName(customer.name); }}
          onClear={() => { setCustomerId(null); setCustomerName(''); }}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">Notatki</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Dodatkowe informacje..." rows={3} />
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
        <Label className="font-semibold block">Powiadomienia</Label>
        <div className="flex items-center gap-3">
          <Checkbox id="notifyEmail" checked={notifyEmail} onCheckedChange={v => setNotifyEmail(!!v)} />
          <label htmlFor="notifyEmail" className="text-sm cursor-pointer">📧 Wyślij e-mail <span className="text-muted-foreground text-xs">(adres biura)</span></label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="notifySms" checked={notifySms} onCheckedChange={v => setNotifySms(!!v)} />
          <label htmlFor="notifySms" className="text-sm cursor-pointer">📱 Wyślij SMS <span className="text-muted-foreground text-xs">(numer usera)</span></label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        {isEditing && onDelete ? (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { onDelete(editingReminder!.id); onClose(); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Usuń
          </Button>
        ) : <div />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !typeId || (!isRecurring && !deadline)}>
            {saving ? 'Zapisywanie...' : isEditing ? 'Zapisz' : 'Utwórz'}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={v => !v && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-lg font-semibold">{isEditing ? 'Edytuj przypomnienie' : 'Nowe przypomnienie'}</h2>
          </div>
          <div className="overflow-auto">{formContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 overflow-auto">
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <SheetTitle>{isEditing ? 'Edytuj przypomnienie' : 'Nowe przypomnienie'}</SheetTitle>
        </SheetHeader>
        {formContent}
      </SheetContent>
    </Sheet>
  );
}

function computeNextRecurringDeadline(type: string, value: number | null): string {
  const now = new Date();
  if (type === 'monthly' && value) {
    const next = new Date(now.getFullYear(), now.getMonth(), value);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toISOString().split('T')[0];
  }
  if (type === 'weekly' && value !== null) {
    const current = now.getDay();
    // JS: 0=Sun, our 0=Mon
    const target = (value + 1) % 7; // convert our 0-6 Mon-Sun to JS 0-6 Sun-Sat
    let diff = target - current;
    if (diff <= 0) diff += 7;
    const next = new Date(now);
    next.setDate(next.getDate() + diff);
    return next.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}
