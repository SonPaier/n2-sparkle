
# Kopiowanie listy klientow i drawera edycji z N2Wash

## Podsumowanie

Kopiujemy `CustomersView` i `CustomerEditDrawer` z N2Wash. Usuwamy: vehicles, SMS dialog, tabs myjnia/oferty, visit history, reminders tab, `useCombinedFeatures`, `useTranslation`, `discount_percent`. Dodajemy: sekcje zarzadzania wieloma adresami serwisowymi (`customer_addresses`).

---

## 1. Baza danych (migracja SQL)

Tworzymy dwie tabele:

**`customers`**:
- id (uuid PK), instance_id (uuid NOT NULL), name (text NOT NULL), short_name (text), phone (text NOT NULL), email (text), notes (text), company (text), nip (text), address (text), contact_person (text), contact_phone (text), contact_email (text), source (text DEFAULT 'manual'), billing_street (text), billing_street_line2 (text), billing_city (text), billing_postal_code (text), billing_region (text), billing_country_code (text), country_code (text), default_currency (text DEFAULT 'PLN'), vat_eu_number (text), sales_notes (text), created_at (timestamptz), updated_at (timestamptz)
- UNIQUE(instance_id, phone)

**`customer_addresses`**:
- id (uuid PK), customer_id (uuid NOT NULL FK -> customers ON DELETE CASCADE), instance_id (uuid NOT NULL), name (text NOT NULL), street (text), street_line2 (text), city (text), postal_code (text), region (text), country_code (text), lat (double precision), lng (double precision), contact_person (text), contact_phone (text), notes (text), is_default (boolean DEFAULT false), sort_order (integer DEFAULT 0), created_at (timestamptz), updated_at (timestamptz)

RLS: SELECT dla admin/employee/super_admin, ALL dla admin/super_admin. Triggery `update_updated_at_column` na obu.

---

## 2. Nowe pliki pomocnicze

### `src/lib/phoneUtils.ts`
Kopia z N2Wash -- `normalizePhone`, `stripPhone`, `isValidPhone`, `formatPhoneDisplay`.

### `src/lib/textUtils.ts`
Tylko `normalizeSearchQuery` z N2Wash.

---

## 3. Modyfikacja `src/components/ui/sheet.tsx`
Dodajemy prop `hideCloseButton` do `SheetContent` -- N2Wash uzywa tego w `CustomerEditDrawer` zeby miec wlasny przycisk X w headerze.

---

## 4. Nowe komponenty

### `src/components/admin/CustomersView.tsx` (~250 linii)
Adaptacja z N2Wash:
- **Usuwamy**: tabs myjnia/oferty, vehicles fetch i chips, `useCombinedFeatures`, `useTranslation`, `SendSmsDialog`, `AdminTabsList`, SMS button, `CustomersList` (inline rendering)
- **Zostawiamy**: lista klientow z wyszukiwaniem (name, phone, email, company, nip), paginacja, przycisk dodaj, delete dialog (uzyje `ConfirmDialog`), przycisk telefon, drawer edycji
- Pod nazwa klienta: firma (zamiast vehicles)
- Polskie stringi hardcoded
- Source nie jest uzywane do filtrowania (brak tabow)

### `src/components/admin/CustomerEditDrawer.tsx` (~500 linii)
Adaptacja z N2Wash:
- **Usuwamy**: vehicles editor (`CustomerVehiclesEditor`), visit history tab, reminders tab, `AdminTabsList`, `SendSmsDialog`, `discount_percent`, `useTranslation`, `normalizePhone` w sync vehicles
- **Zostawiamy**: Sheet drawer, tryb view/edit/add, formularz (name, phone, email, company, nip, notes), przyciski SMS/telefon w headerze (SMS otwiera natywne sms:), sticky footer (zapisz/anuluj/edytuj)
- **Dodajemy nowa sekcje w trybie edycji**: "Adresy serwisowe"
  - Lista `customer_addresses` z CRUD
  - Kazdy adres: nazwa lokalizacji, ulica, miasto, kod pocztowy, osoba kontaktowa, telefon, notatki
  - Lat/lng na razie opcjonalne (reczne pola)
  - Przycisk "Dodaj adres" / "Usun" per adres
  - Fetch adresow przy otwarciu drawera, zapis razem z klientem
- **Dodajemy sekcje w trybie view**: lista adresow (read-only) zamiast vehicles
- **Dane fakturowe**: dodatkowe pola billing_street, billing_city, billing_postal_code w sekcji "Dane do faktury" (collapsible)

---

## 5. Modyfikacja `src/pages/Dashboard.tsx`
- Import `CustomersView`
- W `renderContent()`: jesli `currentView === 'klienci'` i `instanceId`, renderuj `<CustomersView instanceId={instanceId} />`

---

## 6. Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowy -- customers + customer_addresses + RLS + triggery |
| `src/lib/phoneUtils.ts` | Nowy -- kopia z N2Wash |
| `src/lib/textUtils.ts` | Nowy -- normalizeSearchQuery |
| `src/components/ui/sheet.tsx` | Modyfikacja -- hideCloseButton prop |
| `src/components/admin/CustomersView.tsx` | Nowy -- lista klientow |
| `src/components/admin/CustomerEditDrawer.tsx` | Nowy -- drawer edycji + adresy serwisowe |
| `src/pages/Dashboard.tsx` | Modyfikacja -- podpiecie CustomersView |

---

## Detale techniczne

- `customer_addresses` ma FK do `customers` z ON DELETE CASCADE
- `customer_addresses` ma `instance_id` dla RLS (nie trzeba joinowac z customers)
- Adresy sa fetchowane i zapisywane w ramach `CustomerEditDrawer` (nie jako osobny dialog)
- Przy dodawaniu nowego klienta sprawdzamy duplikat po telefonie (jak w N2Wash)
- `ConfirmDialog` (juz istnieje) uzywany do potwierdzenia usuwania klienta
- Brak SMS dialog na desktopie -- na mobile otwiera natywne `sms:`, na desktop przycisk SMS jest ukryty lub otwiera `sms:` tez
