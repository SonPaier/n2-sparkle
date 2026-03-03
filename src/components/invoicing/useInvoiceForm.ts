import { useState, useEffect, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useInvoicingSettings } from './useInvoicingSettings';
import type { InvoicePosition, DocumentKind } from './invoicing.types';

export type PriceMode = 'netto' | 'brutto';

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
  const [priceMode, setPriceMode] = useState<PriceMode>('netto');
  const [buyerName, setBuyerName] = useState('');
  const [buyerTaxNo, setBuyerTaxNo] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerStreet, setBuyerStreet] = useState('');
  const [buyerPostCode, setBuyerPostCode] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [positions, setPositions] = useState<InvoicePosition[]>([
    { name: '', quantity: 1, unit_price_gross: 0, vat_rate: 23 },
  ]);

  // Initialize from props/settings
  useEffect(() => {
    if (!open) return;
    if (settings) {
      setKind(settings.default_document_kind as DocumentKind || 'vat');
      setPaymentDays(settings.default_payment_days || 14);
    }
    setBuyerName(customerName || '');
    setBuyerEmail(customerEmail || '');
    setBuyerTaxNo(customerNip || '');
    setBuyerStreet('');
    setBuyerPostCode('');
    setBuyerCity('');
    setAutoSendEmail(settings?.auto_send_email ?? false);
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
      .select('nip, email, company, billing_city, billing_postal_code, billing_street')
      .eq('id', customerId)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.nip && !buyerTaxNo) setBuyerTaxNo(data.nip);
          if (data.email && !buyerEmail) setBuyerEmail(data.email);
          if (data.billing_street) setBuyerStreet(data.billing_street);
          if (data.billing_postal_code) setBuyerPostCode(data.billing_postal_code);
          if (data.billing_city) setBuyerCity(data.billing_city);
        }
      });
  }, [open, customerId]);

  // Fetch service address from calendar item as fallback for buyer address
  useEffect(() => {
    if (!open || !calendarItemId) return;
    const fetchAddress = async () => {
      // Only fetch if no billing address was set
      if (buyerCity || buyerPostCode || buyerStreet) return;
      const { data: item } = await supabase
        .from('calendar_items')
        .select('customer_address_id')
        .eq('id', calendarItemId)
        .single();
      if (item?.customer_address_id) {
        const { data: addr } = await supabase
          .from('customer_addresses')
          .select('city, postal_code, street')
          .eq('id', item.customer_address_id)
          .single();
        if (addr) {
          if (addr.street && !buyerStreet) setBuyerStreet(addr.street);
          if (addr.postal_code && !buyerPostCode) setBuyerPostCode(addr.postal_code);
          if (addr.city && !buyerCity) setBuyerCity(addr.city);
        }
      }
    };
    fetchAddress();
  }, [open, calendarItemId, buyerCity, buyerPostCode, buyerStreet]);

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

  // Calculate totals based on price mode
  const { totalNetto, totalVat, totalGross } = useMemo(() => {
    let netto = 0;
    let brutto = 0;
    for (const p of positions) {
      const lineTotal = p.unit_price_gross * p.quantity;
      const rate = p.vat_rate / 100;
      if (priceMode === 'netto') {
        netto += lineTotal;
        brutto += lineTotal * (1 + rate);
      } else {
        brutto += lineTotal;
        netto += lineTotal / (1 + rate);
      }
    }
    return { totalNetto: netto, totalVat: brutto - netto, totalGross: brutto };
  }, [positions, priceMode]);

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

  const [autoSendEmail, setAutoSendEmail] = useState(false);

  const handleSubmit = async () => {
    if (!buyerName.trim()) { toast.error('Podaj nazwę nabywcy'); return; }
    if (positions.some(p => !p.name.trim())) { toast.error('Uzupełnij nazwy pozycji'); return; }

    // Always convert positions to brutto for the API
    const grossPositions = positions.map(p => {
      if (priceMode === 'netto') {
        const rate = p.vat_rate / 100;
        return { ...p, unit_price_gross: p.unit_price_gross * (1 + rate) };
      }
      return p;
    });

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invoicing-api', {
        body: {
          action: 'create_invoice',
          instanceId,
          calendarItemId,
          customerId,
          autoSendEmail,
          invoiceData: {
            kind,
            issue_date: issueDate,
            sell_date: sellDate,
            payment_to: paymentTo,
            buyer_name: buyerName,
            buyer_tax_no: buyerTaxNo,
            buyer_email: buyerEmail,
            buyer_street: buyerStreet,
            buyer_post_code: buyerPostCode,
            buyer_city: buyerCity,
            currency: 'PLN',
            positions: grossPositions,
            oid: calendarItemId,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Nadpisz cenę zlecenia kwotą netto z faktury
      if (calendarItemId) {
        await supabase
          .from('calendar_items')
          .update({ price: totalNetto })
          .eq('id', calendarItemId);
      }

      // Zapisz dane fakturowe do klienta (NIP, adres rozliczeniowy)
      if (customerId && buyerTaxNo) {
        const updateData: Record<string, string> = {
          nip: buyerTaxNo,
        };
        if (buyerName) updateData.company = buyerName;
        if (buyerStreet) updateData.billing_street = buyerStreet;
        if (buyerPostCode) updateData.billing_postal_code = buyerPostCode;
        if (buyerCity) updateData.billing_city = buyerCity;
        await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customerId);
      }

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
    priceMode, setPriceMode,
    buyerName, setBuyerName,
    buyerTaxNo, setBuyerTaxNo,
    buyerEmail, setBuyerEmail,
    buyerStreet, setBuyerStreet,
    buyerPostCode, setBuyerPostCode,
    buyerCity, setBuyerCity,
    positions,
    paymentTo,
    totalNetto,
    totalVat,
    totalGross,
    autoSendEmail, setAutoSendEmail,
    addPosition,
    removePosition,
    updatePosition,
    handleSubmit,
  };
}
