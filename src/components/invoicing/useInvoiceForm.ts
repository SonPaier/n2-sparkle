import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInvoicingSettings } from './useInvoicingSettings';
import type { InvoicePosition, DocumentKind } from './invoicing.types';

export interface UseInvoiceFormOptions {
  instanceId: string;
  calendarItemId?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerNip?: string | null;
  positions?: InvoicePosition[];
  onSuccess?: () => void;
  onClose?: () => void;
}

export function useInvoiceForm(open: boolean, options: UseInvoiceFormOptions) {
  const {
    instanceId,
    calendarItemId,
    customerId,
    customerName,
    customerEmail,
    customerNip,
    positions: initialPositions,
    onSuccess,
    onClose,
  } = options;

  const { settings } = useInvoicingSettings(instanceId);
  const [submitting, setSubmitting] = useState(false);

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
      onClose?.();
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      toast.error(err.message || 'Błąd wystawiania faktury');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    settings,
    submitting,
    kind, setKind,
    issueDate, setIssueDate,
    sellDate, setSellDate,
    paymentDays, setPaymentDays,
    currency, setCurrency,
    buyerName, setBuyerName,
    buyerTaxNo, setBuyerTaxNo,
    buyerEmail, setBuyerEmail,
    positions,
    paymentTo,
    totalGross,
    addPosition,
    removePosition,
    updatePosition,
    handleSubmit,
  };
}
