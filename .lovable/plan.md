
# Modul fakturowania z wieloma providerami (Fakturownia + iFirma)

## Koncepcja

Zamiast jednej tabeli `invoicing_settings` z polami specyficznymi dla Fakturowni, tworzymy architekture opartą na wzorcu Strategy -- uniwersalna tabela integracji z polem `provider` i `config` (JSONB) przechowujacym ustawienia specyficzne dla danego providera. Edge function rozpoznaje providera i uzywa odpowiedniej strategii API.

## 1. Nowa zakladka "Integracje" w Ustawieniach

W `SettingsView.tsx` dodajemy nowa zakladke "Integracje" (ikona Plug/Zap). Widok tej zakladki to `IntegrationsSettingsView.tsx` -- lista kart integracji (na razie: Fakturownia, iFirma). Kazda karta ma switch wlacz/wylacz i po wlaczeniu rozwija formularz z polami konfiguracyjnymi.

## 2. Baza danych

### Tabela `invoicing_settings`
```
- instance_id (uuid, PK)
- provider (text) -- 'fakturownia' | 'ifirma' | null
- provider_config (jsonb) -- config specyficzny dla providera
- default_vat_rate (integer, default 23)
- default_payment_days (integer, default 14)
- default_document_kind (text, default 'vat')
- default_currency (text, default 'PLN')
- auto_send_email (boolean, default false)
- active (boolean, default false)
- created_at, updated_at
```

`provider_config` dla Fakturowni:
```json
{ "domain": "twojafirma" }
```

`provider_config` dla iFirma:
```json
{ "invoice_api_user": "email@firma.pl" }
```

Tokeny API (sekrety) nie sa w bazie -- sa przechowywane jako Supabase secrets per instancja, zapisywane do osobnej tabeli `invoicing_secrets` (szyfrowane) lub przekazywane przez edge function.

Alternatywnie -- prostsze podejscie: tokeny API trzymamy w tabeli `invoicing_settings` w `provider_config` (zaszyfrowane w JSONB), poniewaz kazda instancja ma swoj token. Supabase secrets sa globalne, a tu potrzebujemy per-instance. Wiec trzymamy w bazie, chronione przez RLS (tylko admin danej instancji).

### Tabela `invoices` (bez zmian wzgledem planu)
```
- id, instance_id, calendar_item_id, customer_id
- provider (text) -- 'fakturownia' | 'ifirma'
- external_invoice_id (text) -- ID z API providera
- external_client_id (text, nullable) -- client_id z providera
- invoice_number (text, nullable)
- kind (text) -- vat / proforma / receipt
- status (text) -- draft / issued / sent / paid / overdue
- issue_date, sell_date, payment_to
- buyer_name, buyer_tax_no, buyer_email
- positions (jsonb)
- total_gross (numeric)
- currency (text)
- pdf_url (text, nullable)
- oid (text, nullable)
- notes (text, nullable)
- created_at, updated_at
```

### Kolumna `payment_status` w `calendar_items`
- `payment_status` (text, default 'not_invoiced')
- Wartosci: `not_invoiced` | `invoice_sent` | `paid` | `overdue`

## 3. Edge Function: `invoicing-api`

Jedna edge function z logiką strategy pattern:

```text
Request: { action, instanceId, ... }

1. Pobierz invoicing_settings dla instanceId
2. Sprawdz provider
3. Przekieruj do odpowiedniej strategii:
   - fakturownia_strategy.ts (inline w index.ts)
   - ifirma_strategy.ts (inline w index.ts)
```

### Fakturownia API:
- POST `https://{domain}.fakturownia.pl/invoices.json` (tworzenie)
- POST `https://{domain}.fakturownia.pl/invoices/{id}/send_by_email.json` (wysylanie)
- GET `https://{domain}.fakturownia.pl/invoices/{id}.pdf` (PDF)
- Auth: `api_token` w body/query

### iFirma API:
- POST `https://www.ifirma.pl/iapi/fakturakraj.json` (tworzenie FV krajowej)
- Auth: HMAC-SHA1 z kluczem API faktur + user email w headerze
- Inna struktura body -- edge function mapuje z uniwersalnego formatu

### Akcje edge function:
- `create_invoice` -- tworzy fakture u providera, zapisuje do `invoices`, aktualizuje `payment_status`
- `send_invoice` -- wysyla mailem (Fakturownia: endpoint; iFirma: parametr w tworzeniu)
- `get_pdf_url` -- pobiera PDF
- `test_connection` -- testuje polaczenie z providerem (walidacja tokenu/domeny)

## 4. Struktura plikow modulu

```text
src/components/invoicing/
  invoicing.types.ts          -- typy: provider, config, invoice, positions
  useInvoicingSettings.ts     -- hook CRUD ustawien
  useInvoices.ts              -- hook pobierania faktur
  IntegrationsSettingsView.tsx -- widok zakladki Integracje
  FakturowniaConfigForm.tsx   -- formularz konfiguracji Fakturowni
  IfirmaConfigForm.tsx        -- formularz konfiguracji iFirma
  CreateInvoiceDrawer.tsx     -- drawer wystawiania faktury
  InvoiceStatusBadge.tsx      -- badge statusu platnosci

supabase/functions/invoicing-api/index.ts
```

## 5. UI zakladki "Integracje"

Widok zawiera karty integracji:

### Karta "Fakturownia"
- Switch wlacz/wylacz
- Po wlaczeniu: pola:
  - Domena konta (text, np. "twojafirma")
  - Token API (password input)
  - Przycisk "Testuj polaczenie"
- Wspolne ustawienia fakturowania (widoczne gdy aktywna):
  - Domyslna stawka VAT (select: 23%, 8%, 5%, 0%, zw.)
  - Termin platnosci (number, dni)
  - Typ dokumentu (select: FV VAT, Proforma, Paragon)
  - Waluta (select: PLN, EUR, USD)
  - Auto-wyslij mailem (switch)

### Karta "iFirma"
- Switch wlacz/wylacz
- Po wlaczeniu: pola:
  - Email uzytkownika API (text)
  - Klucz API faktur (password input)
  - Przycisk "Testuj polaczenie"
- Te same wspolne ustawienia fakturowania

Tylko jeden provider moze byc aktywny na raz -- wlaczenie jednego wylacza drugi.

## 6. Integracja z istniejacym kodem

### `SettingsView.tsx`
- Dodanie zakladki `integrations` z ikona Plug
- Renderowanie `IntegrationsSettingsView` dla tej zakladki

### `CalendarItemDetailsDrawer.tsx`
- Przycisk "Wystaw FV" w akcjach (gdy provider skonfigurowany i aktywny)
- Badge statusu platnosci w headerze

### `AdminCalendar.tsx`
- Maly badge statusu platnosci na kartach

## 7. Kolejnosc implementacji

1. Migracja bazy (invoicing_settings, invoices, payment_status kolumna)
2. Edge function invoicing-api z obsluga obu providerow
3. Typy i hooki (invoicing.types.ts, useInvoicingSettings.ts, useInvoices.ts)
4. IntegrationsSettingsView + formularze providerow
5. Zakladka Integracje w SettingsView
6. CreateInvoiceDrawer
7. InvoiceStatusBadge + integracja z CalendarItemDetailsDrawer
8. Badge na kartach kalendarza

## Szczegoly techniczne

### Migracja SQL

```sql
CREATE TABLE invoicing_settings (
  instance_id uuid PRIMARY KEY REFERENCES instances(id),
  provider text, -- 'fakturownia' | 'ifirma'
  provider_config jsonb DEFAULT '{}'::jsonb,
  default_vat_rate integer DEFAULT 23,
  default_payment_days integer DEFAULT 14,
  default_document_kind text DEFAULT 'vat',
  default_currency text DEFAULT 'PLN',
  auto_send_email boolean DEFAULT false,
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  calendar_item_id uuid,
  customer_id uuid,
  provider text NOT NULL,
  external_invoice_id text,
  external_client_id text,
  invoice_number text,
  kind text DEFAULT 'vat',
  status text DEFAULT 'draft',
  issue_date text,
  sell_date text,
  payment_to text,
  buyer_name text,
  buyer_tax_no text,
  buyer_email text,
  positions jsonb DEFAULT '[]'::jsonb,
  total_gross numeric,
  currency text DEFAULT 'PLN',
  pdf_url text,
  oid text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_items 
  ADD COLUMN payment_status text DEFAULT 'not_invoiced';

-- RLS dla obu tabel: admin/super_admin ALL, employee SELECT
-- Analogicznie do istniejacych polityk w projekcie
```

### Edge function -- strategy pattern (pseudokod)

```text
switch (settings.provider) {
  case 'fakturownia':
    url = `https://${config.domain}.fakturownia.pl/invoices.json`
    body = { api_token: config.api_token, invoice: { ... } }
    
  case 'ifirma':
    url = `https://www.ifirma.pl/iapi/fakturakraj.json`
    headers = { Authentication: hmac_sha1(key, url+body), ...  }
    body = { /* ifirma format */ }
}
```

### Mapowanie pozycji (uniwersalne -> provider)

Wewnetrznie pozycje maja format:
```json
{ "name": "...", "quantity": 1, "unit_price_gross": 350, "vat_rate": 23 }
```

Fakturownia oczekuje: `total_price_gross`, `tax`, `quantity`, `name`
iFirma oczekuje: `StawkaVat`, `Ilosc`, `CenaJednostkowa`, `NazwaPelna`, `Jednostka`

Mapowanie odbywa sie w edge function.
