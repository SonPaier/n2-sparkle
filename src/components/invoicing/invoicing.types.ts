// Invoicing module types - fully isolated for portability

export type InvoicingProvider = 'fakturownia' | 'ifirma';

export type PaymentStatus = 'not_invoiced' | 'invoice_sent' | 'paid' | 'overdue' | 'collective' | 'non_payable' | 'sms_blik_sent' | 'sms_bank_sent';

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
  { value: 0, label: '0%' },
];

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'vat', label: 'Faktura VAT' },
  { value: 'proforma', label: 'Proforma' },
  { value: 'receipt', label: 'Paragon' },
];

export const CURRENCIES = ['PLN', 'EUR', 'USD'];

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  not_invoiced: { label: 'Do rozliczenia', color: 'bg-gray-900 text-white' },
  invoice_sent: { label: 'Wysłano FV', color: 'bg-yellow-400 text-gray-900' },
  paid: { label: 'Opłacony', color: 'bg-emerald-600 text-white' },
  overdue: { label: 'Przeterminowana', color: 'bg-red-600 text-white' },
  collective: { label: 'Zbiorczy', color: 'bg-blue-600 text-white' },
  non_payable: { label: 'Niepłatny', color: 'bg-gray-400 text-white' },
  sms_blik_sent: { label: 'Wysłano SMS BLIK', color: 'bg-orange-500 text-white' },
  sms_bank_sent: { label: 'Wysłano SMS konto', color: 'bg-purple-600 text-white' },
};
