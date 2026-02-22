import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

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

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [columnId, setColumnId] = useState('');
  const [itemDate, setItemDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [adminNotes, setAdminNotes] = useState('');
  const [price, setPrice] = useState('');

  // Initialize form
  useEffect(() => {
    if (!open) return;

    if (isEditMode && editingItem) {
      setTitle(editingItem.title || '');
      setCustomerName(editingItem.customer_name || '');
      setCustomerPhone(editingItem.customer_phone || '');
      setCustomerEmail(editingItem.customer_email || '');
      setColumnId(editingItem.column_id || '');
      setItemDate(editingItem.item_date || '');
      setStartTime(editingItem.start_time || '08:00');
      setEndTime(editingItem.end_time || '09:00');
      setAdminNotes(editingItem.admin_notes || '');
      setPrice(editingItem.price?.toString() || '');
    } else {
      setTitle('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setColumnId(initialColumnId || columns[0]?.id || '');
      setItemDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
      setStartTime(initialTime || '08:00');
      // Auto-set end time 1h after start
      const startIdx = TIME_OPTIONS.indexOf(initialTime || '08:00');
      setEndTime(TIME_OPTIONS[Math.min(startIdx + 4, TIME_OPTIONS.length - 1)] || '09:00');
      setAdminNotes('');
      setPrice('');
    }
  }, [open, isEditMode, editingItem, initialDate, initialTime, initialColumnId, columns]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Podaj tytuł zlecenia');
      return;
    }
    if (!columnId) {
      toast.error('Wybierz kolumnę');
      return;
    }
    if (startTime >= endTime) {
      toast.error('Godzina końca musi być późniejsza niż początku');
      return;
    }

    setLoading(true);
    try {
      const data = {
        instance_id: instanceId,
        column_id: columnId,
        title: title.trim(),
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        item_date: itemDate,
        start_time: startTime,
        end_time: endTime,
        admin_notes: adminNotes.trim() || null,
        price: price ? parseFloat(price) : null,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('calendar_items')
          .update(data)
          .eq('id', editingItem!.id);
        if (error) throw error;
        toast.success('Zlecenie zaktualizowane');
      } else {
        const { error } = await supabase
          .from('calendar_items')
          .insert({ ...data, status: 'confirmed' });
        if (error) throw error;
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
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[90vh] overflow-y-auto' : 'sm:max-w-lg overflow-y-auto'}>
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edytuj zlecenie' : 'Nowe zlecenie'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Tytuł zlecenia *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Np. Wymiana oleju, Przegląd..." />
          </div>

          {/* Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Imię klienta</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jan Kowalski" />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+48 ..." type="tel" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="jan@example.com" type="email" />
          </div>

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

          {/* Date */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={itemDate} onChange={(e) => setItemDate(e.target.value)} />
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
  );
};

export default AddCalendarItemDialog;
