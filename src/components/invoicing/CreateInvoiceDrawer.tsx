import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInvoicingSettings } from './useInvoicingSettings';
import { DOCUMENT_KINDS, VAT_RATES, CURRENCIES, type InvoicePosition, type DocumentKind } from './invoicing.types';

interface CreateInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  calendarItemId?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerNip?: string | null;
  positions?: InvoicePosition[];
  onSuccess?: () => void;
}

export function CreateInvoiceDrawer({
  open,
  onClose,
  instanceId,
  calendarItemId,
  customerId,
  customerName,
  customerEmail,
  customerNip,
  positions: initialPositions,
  onSuccess,
}: CreateInvoiceDrawerProps) {
  const isMobile = useIsMobile();
  const { settings } = useInvoicingSettings(instanceId);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [kind, setKind] = useState<DocumentKind>('vat');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sellDate, setSellDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentDays, setPaymentDays] = useState(14);
  const [currency, setCurrency] = useState('PLN');
  const [buyerName, setBuyerName] = useState('');
  const [buyerTaxNo, setBuyerTaxNo] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [positions, setPositions] = useState<InvoicePosition[]>([
    { name: '', quantity: 1, unit_price_gross: 0, vat_rate: 23 },
  ]);

  // Initialize from props/settings
  useEffect(() => {
    if (!open) return;
    if (settings) {
      setKind(settings.default_document_kind as DocumentKind || 'vat');
      setPaymentDays(settings.default_payment_days || 14);
      setCurrency(settings.default_currency || 'PLN');
    }
    setBuyerName(customerName || '');
    setBuyerEmail(customerEmail || '');
    setBuyerTaxNo(customerNip || '');
    if (initialPositions?.length) {
      setPositions(initialPositions);
    }
    setIssueDate(format(new Date(), 'yyyy-MM-dd'));
    setSellDate(format(new Date(), 'yyyy-MM-dd'));
  }, [open]);

  // Fetch customer NIP if not provided
  useEffect(() => {
    if (!open || !customerId || customerNip) return;
    supabase
      .from('customers')
      .select('nip, email, company')
      .eq('id', customerId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.nip && !buyerTaxNo) setBuyerTaxNo(data.nip);
          if (data.email && !buyerEmail) setBuyerEmail(data.email);
        }
      });
  }, [open, customerId]);

  // Fetch services for calendar item if no initial positions
  useEffect(() => {
    if (!open || !calendarItemId || initialPositions?.length) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('calendar_item_services')
        .select('custom_price, service_id, unified_services(name, price, unit)')
        .eq('calendar_item_id', calendarItemId);
      if (data?.length) {
        const pos: InvoicePosition[] = data.map((s: any) => ({
          name: s.unified_services?.name || 'Usługa',
          quantity: 1,
          unit_price_gross: s.custom_price ?? s.unified_services?.price ?? 0,
          vat_rate: settings?.default_vat_rate ?? 23,
          unit: s.unified_services?.unit || 'szt',
        }));
        setPositions(pos);
      }
    };
    fetch();
  }, [open, calendarItemId]);

  const paymentTo = useMemo(() => {
    try {
      return format(addDays(new Date(issueDate), paymentDays), 'yyyy-MM-dd');
    } catch {
      return issueDate;
    }
  }, [issueDate, paymentDays]);

  const totalGross = positions.reduce((sum, p) => sum + p.unit_price_gross * p.quantity, 0);

  const addPosition = () => {
    setPositions([...positions, { name: '', quantity: 1, unit_price_gross: 0, vat_rate: settings?.default_vat_rate ?? 23 }]);
  };

  const removePosition = (idx: number) => {
    if (positions.length <= 1) return;
    setPositions(positions.filter((_, i) => i !== idx));
  };

  const updatePosition = (idx: number, field: keyof InvoicePosition, value: any) => {
    const updated = [...positions];
    updated[idx] = { ...updated[idx], [field]: value };
    setPositions(updated);
  };

  const handleSubmit = async () => {
    if (!buyerName.trim()) { toast.error('Podaj nazwę nabywcy'); return; }
    if (positions.some(p => !p.name.trim())) { toast.error('Uzupełnij nazwy pozycji'); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoicing-api', {
        body: {
          action: 'create_invoice',
          instanceId,
          calendarItemId,
          customerId,
          invoiceData: {
            kind,
            issue_date: issueDate,
            sell_date: sellDate,
            payment_to: paymentTo,
            buyer_name: buyerName,
            buyer_tax_no: buyerTaxNo,
            buyer_email: buyerEmail,
            currency,
            positions,
            oid: calendarItemId,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.invoice?.invoice_number
        ? `Faktura ${data.invoice.invoice_number} wystawiona`
        : 'Faktura wystawiona'
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      toast.error(err.message || 'Błąd wystawiania faktury');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        hideCloseButton
        className={`flex flex-col p-0 gap-0 z-[1000] ${isMobile ? 'h-[95vh]' : 'sm:max-w-lg'}`}
      >
        <SheetTitle className="sr-only">Wystaw fakturę</SheetTitle>
        <SheetDescription className="sr-only">Formularz wystawiania faktury</SheetDescription>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Wystaw fakturę</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {!settings?.active && (
            <p className="text-sm text-destructive mt-2">
              Skonfiguruj integrację fakturowania w Ustawieniach → Integracje
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Document type & dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Typ dokumentu</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
                <SelectTrigger className="bg-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_KINDS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Waluta</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data wystawienia</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="bg-white h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data sprzedaży</Label>
              <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} className="bg-white h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Termin (dni)</Label>
              <Input type="number" min={1} value={paymentDays} onChange={(e) => setPaymentDays(Number(e.target.value))} className="bg-white h-9 text-sm" />
            </div>
          </div>

          <Separator />

          {/* Buyer */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Nabywca</h3>
            <div className="space-y-2">
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nazwa nabywcy *" className="bg-white h-9" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={buyerTaxNo} onChange={(e) => setBuyerTaxNo(e.target.value)} placeholder="NIP" className="bg-white h-9" />
                <Input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Email" className="bg-white h-9" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Positions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pozycje</h3>
              <Button type="button" variant="ghost" size="sm" onClick={addPosition}>
                <Plus className="w-4 h-4 mr-1" /> Dodaj
              </Button>
            </div>
            {positions.map((pos, idx) => (
              <div key={idx} className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Input
                    value={pos.name}
                    onChange={(e) => updatePosition(idx, 'name', e.target.value)}
                    placeholder="Nazwa usługi / produktu"
                    className="bg-white h-8 text-sm flex-1"
                  />
                  {positions.length > 1 && (
                    <button onClick={() => removePosition(idx)} className="p-1 rounded hover:bg-muted">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Ilość</Label>
                    <Input
                      type="number"
                      min={1}
                      value={pos.quantity}
                      onChange={(e) => updatePosition(idx, 'quantity', Number(e.target.value))}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Cena brutto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={pos.unit_price_gross}
                      onChange={(e) => updatePosition(idx, 'unit_price_gross', Number(e.target.value))}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">VAT</Label>
                    <Select value={String(pos.vat_rate)} onValueChange={(v) => updatePosition(idx, 'vat_rate', Number(v))}>
                      <SelectTrigger className="bg-white h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_RATES.map(r => (
                          <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  = {(pos.unit_price_gross * pos.quantity).toFixed(2)} {currency}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Razem brutto</span>
              <span className="text-lg font-bold">{totalGross.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Termin płatności</span>
              <span>{paymentTo}</span>
            </div>
            {settings?.auto_send_email && (
              <p className="text-xs text-muted-foreground">
                ✉ Faktura zostanie automatycznie wysłana na email nabywcy
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !settings?.active}
            className="flex-1"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Wystaw fakturę
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
