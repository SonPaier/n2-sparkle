// Invoicing module types - fully isolated for portability

export type InvoicingProvider = 'fakturownia' | 'ifirma';

export type PaymentStatus = 'not_invoiced' | 'invoice_sent' | 'paid' | 'overdue';

export type DocumentKind = 'vat' | 'proforma' | 'receipt';

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'overdue';

export interface FakturowniaConfig {
  domain: string;
  api_token: string;
}

export interface IfirmaConfig {
  invoice_api_user: string;
  invoice_api_key: string;
}

export type ProviderConfig = FakturowniaConfig | IfirmaConfig;

export interface InvoicingSettings {
  instance_id: string;
  provider: InvoicingProvider | null;
  provider_config: ProviderConfig | Record<string, never>;
  default_vat_rate: number;
  default_payment_days: number;
  default_document_kind: DocumentKind;
  default_currency: string;
  auto_send_email: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoicePosition {
  name: string;
  quantity: number;
  unit_price_gross: number;
  vat_rate: number;
  unit?: string;
}

export interface Invoice {
  id: string;
  instance_id: string;
  calendar_item_id: string | null;
  customer_id: string | null;
  provider: InvoicingProvider;
  external_invoice_id: string | null;
  external_client_id: string | null;
  invoice_number: string | null;
  kind: DocumentKind;
  status: InvoiceStatus;
  issue_date: string | null;
  sell_date: string | null;
  payment_to: string | null;
  buyer_name: string | null;
  buyer_tax_no: string | null;
  buyer_email: string | null;
  positions: InvoicePosition[];
  total_gross: number | null;
  currency: string;
  pdf_url: string | null;
  oid: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const VAT_RATES = [
  { value: 23, label: '23%' },
  { value: 8, label: '8%' },
  { value: 5, label: '5%' },
  { value: 0, label: '0%' },
  { value: -1, label: 'zw.' },
];

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'vat', label: 'Faktura VAT' },
  { value: 'proforma', label: 'Proforma' },
  { value: 'receipt', label: 'Paragon' },
];

export const CURRENCIES = ['PLN', 'EUR', 'USD'];

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  not_invoiced: { label: 'Brak FV', color: 'bg-muted text-muted-foreground' },
  invoice_sent: { label: 'Wysłano FV', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Opłacony', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Przeterminowana', color: 'bg-red-100 text-red-700' },
};
