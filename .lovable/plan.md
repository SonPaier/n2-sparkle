

## Plan: Etap 1 — Dashboard admina w stylu pracownika + Szablony SMS w ustawieniach

### Część 1: Karty zleceń w admin Dashboard (`DashboardOverview.tsx`)

**OrderCard** — przepisać w stylu EmployeeDashboard:
- Tytuł 18px bold, pill dnia (Dziś/Jutro/nazwa dnia), adres jako klikalny link Google Maps z pinezką, klient, telefon klikalny + SMS ikona, chevron-right po prawej (40px)
- Usunąć ikony Clock, User, MapPin, HardHat z wierszy
- Hover `bg-primary/5`
- **Dodatkowo vs pracownik**: admin widzi cenę (`item.price`) pod telefonem jeśli jest przypisana
- Potrzebne dodatkowe dane: `address_street`, `address_city` — już pobierane w Dashboard.tsx i przekazywane do DashboardOverview, ale trzeba je dodać do selectu i address resolution w `DashboardOverview.tsx`
- Import: `ChevronRight`, `MessageSquare` z lucide, `formatPhoneDisplay`, `normalizePhone` z phoneUtils, `Badge` z ui, `isToday`, `isTomorrow` z date-fns

**Logika `getDayPill`** — ta sama co w EmployeeDashboard:
```
isToday → zielony "Dziś"
isTomorrow → fioletowy "Jutro"  
else → fioletowy, nazwa dnia
```

**`buildDisplayAddress`** — `address_city, address_street` (bez nazwy adresu)
**`buildGoogleMapsUrl`** — pełny adres jako destination

**Fetch addresses** — rozszerzyć select o `street, city` (linia 160, już pobiera `name, street, city`)  
Dodać `address_street`, `address_city` do `CalendarItemRow` interface i mapping

### Część 2: Nowa zakładka "Szablony SMS" w Ustawieniach (`SettingsView.tsx`)

- Dodać nową zakładkę `sms-templates` z ikoną `MessageSquare` między "Użytkownicy" a "Integracje"
- Label: "Szablony SMS"
- Nowy komponent `SmsPaymentTemplatesView` w `src/components/admin/settings/SmsPaymentTemplatesView.tsx`

### Część 3: Komponent `SmsPaymentTemplatesView`

Dwa szablony SMS do edycji:

**Szablon 1: SMS z BLIK**
- Toggle włącz/wyłącz
- Textarea z szablonem SMS
- Zmienne dostępne: `{firma}`, `{osoba_kontaktowa}`, `{usluga}`, `{cena}`, `{blik_phone}`
- Podgląd zmiennych (chipy z nazwami)

**Szablon 2: SMS z numerem konta**
- Toggle włącz/wyłącz
- Textarea z szablonem SMS  
- Zmienne: `{firma}`, `{osoba_kontaktowa}`, `{usluga}`, `{cena}`, `{numer_konta}`, `{nazwa_banku}`
- Podgląd zmiennych

Szablony odczytują `blik_phone`, `bank_account_number`, `bank_name` z danych instancji (te pola pozostają w "Dane firmy").

### Część 4: Tabela w bazie danych

Nowa tabela `sms_payment_templates`:
- `id` uuid PK
- `instance_id` uuid NOT NULL
- `template_type` text NOT NULL (`blik` | `bank_transfer`)
- `enabled` boolean DEFAULT false
- `sms_body` text DEFAULT ''
- `created_at`, `updated_at` timestamps
- UNIQUE constraint na (`instance_id`, `template_type`)
- RLS: admin/super_admin ALL, employee SELECT

### Podsumowanie pliku zmian:
| Plik | Zmiana |
|------|--------|
| `DashboardOverview.tsx` | Redesign OrderCard w stylu pracownika + cena |
| `SettingsView.tsx` | Nowa zakładka "Szablony SMS" |
| `src/components/admin/settings/SmsPaymentTemplatesView.tsx` | Nowy komponent |
| Migracja SQL | Tabela `sms_payment_templates` z RLS |

