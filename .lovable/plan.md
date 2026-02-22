

# Protokoly serwisowe - zaktualizowany plan

## Zmiana vs. poprzedni plan

Zamiast tworzyc nowy `ClientSearchInput` od zera, wyodrebniamy istniejacy kod wyszukiwania klientow z `AddCalendarItemDialog.tsx` do wspoldzielonego komponentu. Analogicznie z selectem adresu klienta.

---

## 1. Migracja bazy danych

Nowa tabela `protocols` + storage bucket `protocol-photos` + kolumna `protocol_email_template` w `instances`.

Tabela `protocols`:
- id, instance_id, customer_id, customer_name, customer_email, customer_phone, customer_nip
- customer_address_id, protocol_date, protocol_time, protocol_type (default 'completion')
- status (default 'completed'), prepared_by, notes, customer_signature (base64)
- photo_urls (jsonb, default '[]'), public_token (text, unique)
- created_at, updated_at

RLS: Admin/super_admin ALL, Employee SELECT, publiczny SELECT po public_token.

Storage bucket: `protocol-photos` (public).

Nowa kolumna w `instances`: `protocol_email_template text nullable`.

---

## 2. Wspoldzielone komponenty (wyodrebnienie z AddCalendarItemDialog)

### `src/components/admin/CustomerSearchInput.tsx` (NOWY - wyodrebniony)
Wyodrebniamy cala logike wyszukiwania klientow:
- Popover + Command + debounced search po name/phone/company
- Wyswietlanie wybranego klienta z przyciskiem "X" do czyszczenia
- Props: `instanceId`, `selectedCustomer` (id/name/phone/email | null), `onSelect(customer)`, `onClear()`
- Uzywany zarowno w `AddCalendarItemDialog` jak i `CreateProtocolForm`

### `src/components/admin/CustomerAddressSelect.tsx` (NOWY - wyodrebniony)
Wyodrebniamy logike wyboru adresu (juz istnieje inline w AddCalendarItemDialog):
- Fetchuje adresy po `customerId`, select z nazwami
- Props: `instanceId`, `customerId`, `value`, `onChange(addressId)`
- Automatycznie wybiera domyslny adres (is_default lub pierwszy)

### `src/components/admin/AddCalendarItemDialog.tsx` (MODYFIKACJA)
- Usuwamy inline customer search (Popover/Command/debounce) -- zastepujemy `<CustomerSearchInput>`
- Usuwamy inline address fetch/select -- zastepujemy `<CustomerAddressSelect>`
- Logika formularza bez zmian, tylko UI refaktor

---

## 3. Nowe komponenty protokolow

### `src/components/protocols/ProtocolsView.tsx`
Lista protokolow z wyszukiwaniem, paginacja, menu kontekstowe (edytuj, kopiuj link, usun). Bez kolumn pojazdu.

### `src/components/protocols/CreateProtocolForm.tsx`
Formularz z sekcjami:
1. Typ protokolu (select: "Protokol zakonczenia prac")
2. Klient (`<CustomerSearchInput>`) + pola reczne (imie, telefon, email, NIP)
3. Adres klienta (`<CustomerAddressSelect>`)
4. Zdjecia (`<ProtocolPhotosUploader>`)
5. Uwagi (textarea)
6. Data protokolu
7. "Sporzadzil" (input)
8. "Podpis osoby upowaznionej do odbioru" (`<SignatureDialog>`)

### `src/components/protocols/ProtocolPhotosUploader.tsx`
Upload zdjec do bucketu `protocol-photos`. Carousel z miniaturami.

### `src/components/protocols/PhotoFullscreenDialog.tsx`
Fullscreen viewer zdjec z nawigacja.

### `src/components/protocols/SignatureDialog.tsx`
Dialog z canvas do podpisu. Tytul: "Podpis osoby upowaznionej do odbioru". Wymaga `react-signature-canvas`.

### `src/components/protocols/SendProtocolEmailDialog.tsx`
Dialog wysylki emaila z linkiem do publicznego protokolu.

### `src/components/protocols/PublicProtocolCustomerView.tsx`
Widok publiczny protokolu (bez danych pojazdu, z adresem klienta).

### `src/components/protocols/ProtocolHeader.tsx`
Naglowek z logo firmy i tytulem "Protokol".

### `src/components/protocols/ProtocolSettingsDialog.tsx`
Ustawienia szablonu emaila (bez zmiennych pojazdu).

---

## 4. Edge function

### `supabase/functions/send-protocol-email/index.ts`
Wysylka emaila z linkiem do publicznego widoku protokolu.

---

## 5. Integracja z Dashboard

### `DashboardLayout.tsx` -- dodajemy 'protokoly' do ViewType i nawigacji (ikona ClipboardCheck)
### `Dashboard.tsx` -- renderujemy `<ProtocolsView>` dla widoku protokoly

---

## 6. Routing publiczny

### `src/App.tsx` -- nowa route `/protocols/:token`
### `src/pages/PublicProtocolView.tsx` -- strona fetchujaca protokol po tokenie

---

## 7. Nowa zaleznosc

- `react-signature-canvas` -- do rysowania podpisu

---

## Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowy -- tabela protocols, bucket protocol-photos, kolumna w instances |
| `src/components/admin/CustomerSearchInput.tsx` | Nowy -- wyodrebniony z AddCalendarItemDialog |
| `src/components/admin/CustomerAddressSelect.tsx` | Nowy -- wyodrebniony z AddCalendarItemDialog |
| `src/components/admin/AddCalendarItemDialog.tsx` | Modyfikacja -- refaktor na shared components |
| `src/components/protocols/ProtocolsView.tsx` | Nowy |
| `src/components/protocols/CreateProtocolForm.tsx` | Nowy |
| `src/components/protocols/ProtocolPhotosUploader.tsx` | Nowy |
| `src/components/protocols/PhotoFullscreenDialog.tsx` | Nowy |
| `src/components/protocols/SignatureDialog.tsx` | Nowy |
| `src/components/protocols/SendProtocolEmailDialog.tsx` | Nowy |
| `src/components/protocols/PublicProtocolCustomerView.tsx` | Nowy |
| `src/components/protocols/ProtocolHeader.tsx` | Nowy |
| `src/components/protocols/ProtocolSettingsDialog.tsx` | Nowy |
| `supabase/functions/send-protocol-email/index.ts` | Nowy |
| `src/pages/PublicProtocolView.tsx` | Nowy |
| `src/components/layout/DashboardLayout.tsx` | Modyfikacja -- 'protokoly' |
| `src/pages/Dashboard.tsx` | Modyfikacja -- widok protokoly |
| `src/App.tsx` | Modyfikacja -- route /protocols/:token |
| `package.json` | Modyfikacja -- react-signature-canvas |

