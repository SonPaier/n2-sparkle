import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2, CalendarIcon, Pen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import CustomerSearchInput, { type SelectedCustomer } from '@/components/admin/CustomerSearchInput';
import CustomerAddressSelect from '@/components/admin/CustomerAddressSelect';
import { ProtocolPhotosUploader } from './ProtocolPhotosUploader';
import SignatureDialog from './SignatureDialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface CreateProtocolFormProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  onSuccess: () => void;
  editingProtocolId: string | null;
  prefillCustomerId?: string | null;
  prefillCustomerName?: string;
  prefillCustomerPhone?: string;
  prefillCustomerEmail?: string;
  prefillCustomerAddressId?: string | null;
  prefillCalendarItemId?: string | null;
}

const CreateProtocolForm = ({ open, onClose, instanceId, onSuccess, editingProtocolId, prefillCustomerId, prefillCustomerName, prefillCustomerPhone, prefillCustomerEmail, prefillCustomerAddressId, prefillCalendarItemId }: CreateProtocolFormProps) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isEditMode = !!editingProtocolId;
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Form state
  const [protocolType, setProtocolType] = useState('completion');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNip, setCustomerNip] = useState('');
  const [customerAddressId, setCustomerAddressId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [protocolDate, setProtocolDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState('');
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  // Load existing protocol for editing or reset form
  useEffect(() => {
    if (!open) return;
    if (isEditMode && editingProtocolId) {
      setLoadingData(true);
      supabase
        .from('protocols')
        .select('*')
        .eq('id', editingProtocolId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) { toast.error('Nie znaleziono protokołu'); onClose(); return; }
          setProtocolType(data.protocol_type);
          setCustomerId(data.customer_id);
          setCustomerName(data.customer_name);
          setCustomerPhone(data.customer_phone || '');
          setCustomerEmail(data.customer_email || '');
          setCustomerNip(data.customer_nip || '');
          setCustomerAddressId(data.customer_address_id);
          setPhotoUrls(Array.isArray(data.photo_urls) ? (data.photo_urls as string[]) : []);
          setNotes(data.notes || '');
          setProtocolDate(new Date(data.protocol_date));
          setPreparedBy(data.prepared_by || '');
          setCustomerSignature(data.customer_signature || null);
          setLoadingData(false);
        });
    } else {
      // Reset form with optional prefill
      setProtocolType('completion');
      setCustomerId(prefillCustomerId || null);
      setCustomerName(prefillCustomerName || '');
      setCustomerPhone(prefillCustomerPhone || '');
      setCustomerEmail(prefillCustomerEmail || '');
      setCustomerNip('');
      setCustomerAddressId(prefillCustomerAddressId || null);
      setPhotoUrls([]);
      setNotes('');
      setProtocolDate(new Date());
      setCustomerSignature(null);

      // Auto-fill prepared_by from linked employee name
      if (user?.id && instanceId) {
        supabase
          .from('employees')
          .select('name')
          .eq('instance_id', instanceId)
          .eq('linked_user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            setPreparedBy(data?.name || '');
          });
      } else {
        setPreparedBy('');
      }
    }
  }, [open, isEditMode, editingProtocolId, prefillCustomerId, prefillCustomerName, prefillCustomerPhone, prefillCustomerEmail, prefillCustomerAddressId, instanceId, user?.id]);

  const handleSelectCustomer = (customer: SelectedCustomer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerEmail(customer.email || '');
    setCustomerNip(customer.nip || '');
  };

  const handleClearCustomer = () => {
    setCustomerId(null);
    setCustomerAddressId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerNip('');
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('Podaj nazwę klienta');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        instance_id: instanceId,
        customer_id: customerId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_nip: customerNip.trim() || null,
        customer_address_id: customerAddressId,
        protocol_date: format(protocolDate, 'yyyy-MM-dd'),
        protocol_type: protocolType,
        prepared_by: preparedBy.trim() || null,
        notes: notes.trim() || null,
        customer_signature: customerSignature,
        photo_urls: photoUrls,
      };
      if (!isEditMode && prefillCalendarItemId) {
        payload.calendar_item_id = prefillCalendarItemId;
      }
      if (!isEditMode && user?.id) {
        payload.created_by_user_id = user.id;
      }

      if (isEditMode) {
        const { error } = await supabase.from('protocols').update(payload).eq('id', editingProtocolId!);
        if (error) throw error;
        toast.success('Protokół zaktualizowany');
      } else {
        const { error } = await supabase.from('protocols').insert(payload);
        if (error) throw error;
        toast.success('Protokół utworzony');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving protocol:', error);
      toast.error('Błąd podczas zapisywania protokołu');
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <div className="flex flex-col h-full">
      {/* Fixed header - matching drawer style */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold truncate pr-2">
            {isEditMode ? 'Edytuj protokół' : 'Protokół'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-primary/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      {loadingData ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Protocol Type */}
          <div className="space-y-2">
            <Label>Typ protokołu</Label>
            <Select value={protocolType} onValueChange={setProtocolType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completion">Protokół zakończenia prac</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Search */}
          <div className="space-y-2">
            <Label>Klient *</Label>
            <CustomerSearchInput
              instanceId={instanceId}
              selectedCustomer={customerId ? { id: customerId, name: customerName, phone: customerPhone, email: customerEmail || null, company: null } : null}
              onSelect={handleSelectCustomer}
              onClear={handleClearCustomer}
            />
          </div>

          {/* Customer details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Imię i nazwisko *</Label>
              <Input value={customerName} onChange={(e) => { setCustomerName(e.target.value); if (customerId) setCustomerId(null); }} placeholder="Jan Kowalski" />
            </div>
            {!isEditMode && (
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+48 ..." type="tel" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="jan@example.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>NIP</Label>
              <Input value={customerNip} onChange={(e) => setCustomerNip(e.target.value)} placeholder="123-456-78-90" />
            </div>
          </div>

          {/* Customer Address */}
          <CustomerAddressSelect
            instanceId={instanceId}
            customerId={customerId}
            value={customerAddressId}
            onChange={setCustomerAddressId}
            label="Adres klienta"
          />

          {/* Photos */}
          <div className="space-y-2">
            <Label>Zdjęcia</Label>
            <ProtocolPhotosUploader
              photos={photoUrls}
              onPhotosChange={setPhotoUrls}
              protocolId={editingProtocolId}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Uwagi</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dodatkowe uwagi..." rows={3} />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data protokołu</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(protocolDate, 'EEEE, d MMM yyyy', { locale: pl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={protocolDate}
                  onSelect={(date) => { if (date) { setProtocolDate(date); setDatePickerOpen(false); } }}
                  initialFocus
                  locale={pl}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Prepared By */}
          <div className="space-y-2">
            <Label>Sporządził</Label>
            <Input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Imię i nazwisko osoby sporządzającej" />
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label>Podpis osoby upoważnionej do odbioru</Label>
            <div className="border border-border rounded-md bg-white overflow-hidden relative">
              {customerSignature ? (
                <div className="relative">
                  <img src={customerSignature} alt="Podpis" className="w-full" style={{ height: '160px', objectFit: 'contain' }} />
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => { setCustomerSignature(null); setSignatureOpen(true); }}>Podpisz ponownie</Button>
                    <Button variant="ghost" size="sm" onClick={() => setCustomerSignature(null)}>Usuń</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors text-muted-foreground"
                  style={{ height: '160px' }}
                  onClick={() => setSignatureOpen(true)}
                >
                  <Pen className="w-8 h-8 mb-2" />
                  <span className="text-sm">Kliknij aby złożyć podpis</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom bar - matching drawer style */}
      <div className="flex-shrink-0 border-t border-border px-4 py-3 flex items-center gap-1.5">
        <Button variant="outline" className="bg-white flex-1" onClick={onClose}>
          Anuluj
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditMode ? 'Zapisz zmiany' : 'Utwórz protokół'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] p-0" hideOverlay hideCloseButton onInteractOutside={(e) => e.preventDefault()}>
          {formContent}
        </SheetContent>
      </Sheet>

      <SignatureDialog
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onSave={(dataUrl) => { setCustomerSignature(dataUrl); setSignatureOpen(false); }}
      />
    </>
  );
};

export default CreateProtocolForm;
