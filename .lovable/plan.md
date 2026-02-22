
# Adres na karcie kalendarza + Modul pracownikow z N2Wash

## Czesc 1: Wyswietlanie adresu na karcie kalendarza

Na kartach zlecen w kalendarzu (renderItemTile w AdminCalendar.tsx) dodajemy nowa linie z nazwa adresu klienta. Aktualnie karta pokazuje:
- Linia 1: Godziny + ikony
- Linia 2: Tytul
- Linia 3: Imie klienta

Dodajemy:
- Linia 4: Nazwa adresu (z ikona MapPin)

Wymaga to:
- Dodania pola `address_name` do interfejsu `CalendarItem` (fetchowanego z bazy JOIN)
- Lub fetch adresow osobno i mapowania ich po `customer_address_id`

Prostsze podejscie: w Dashboard.tsx przy fetchowaniu calendar_items, dolaczamy tez select na `customer_addresses(name)` jako relacje. Poniewaz FK juz istnieje (customer_address_id -> customer_addresses), mozna uzyc Supabase join.

Alternatywnie (bezpieczniej bez FK konfiguracji w Supabase): dodajemy pole `address_name` do CalendarItem interface i fetchujemy adresy osobno w Dashboard, mapujac je na itemy.

### Zmiany w plikach:
- **`src/components/admin/AdminCalendar.tsx`**: Dodajemy `address_name?: string | null` do CalendarItem. W `renderItemTile` dodajemy linie 4 z nazwa adresu (MapPin icon + tekst, styl jak customer_name).
- **`src/pages/Dashboard.tsx`**: Przy fetchowaniu calendar_items, po pobraniu danych fetchujemy unikalne customer_address_id, pobieramy adresy z `customer_addresses`, i mapujemy `address_name` na kazdy item.

---

## Czesc 2: Modul pracownikow

### 2a. Migracja bazy danych

Tworzymy 4 nowe tabele (identyczne jak w N2Wash, bez `deleted_at` na employees bo N2Wash uzywa soft delete przez active=false):

**Tabela `employees`:**
- id (uuid, PK, default gen_random_uuid())
- instance_id (uuid, NOT NULL, FK -> instances)
- name (text, NOT NULL)
- photo_url (text, nullable)
- hourly_rate (numeric, nullable)
- active (boolean, default true)
- sort_order (integer, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Tabela `time_entries`:**
- id (uuid, PK, default gen_random_uuid())
- instance_id (uuid, NOT NULL, FK -> instances)
- employee_id (uuid, NOT NULL, FK -> employees ON DELETE CASCADE)
- entry_date (text, NOT NULL)
- entry_number (integer, NOT NULL, default 1)
- entry_type (text, NOT NULL, default 'manual')
- start_time (timestamptz, nullable)
- end_time (timestamptz, nullable)
- total_minutes (integer, nullable -- computed by trigger)
- is_auto_closed (boolean, default false)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Tabela `employee_days_off`:**
- id (uuid, PK, default gen_random_uuid())
- instance_id (uuid, NOT NULL, FK -> instances)
- employee_id (uuid, NOT NULL, FK -> employees ON DELETE CASCADE)
- date_from (text, NOT NULL)
- date_to (text, NOT NULL)
- day_off_type (text, NOT NULL, default 'vacation')
- created_at (timestamptz, default now())

**Tabela `workers_settings`:**
- instance_id (uuid, PK, FK -> instances)
- start_stop_enabled (boolean, default true)
- overtime_enabled (boolean, default false)
- standard_hours_per_day (integer, default 8)
- report_frequency (text, default 'monthly')
- time_calculation_mode (text, default 'start_to_stop')

**RLS policies** na kazdej tabeli:
- Admin/super_admin: ALL
- Employee: SELECT

**Trigger** na time_entries: automatycznie oblicza `total_minutes` przy INSERT/UPDATE na podstawie start_time i end_time.

**Storage bucket**: `employee-photos` (public).

### 2b. Nowe pliki (hooks)

Kopiujemy z N2Wash i adaptujemy (usuwamy useTranslation, dostosowujemy typy):

- **`src/hooks/useEmployees.ts`** -- bez zmian wzgledem N2Wash
- **`src/hooks/useTimeEntries.ts`** -- bez zmian
- **`src/hooks/useEmployeeDaysOff.ts`** -- bez zmian
- **`src/hooks/useWorkersSettings.ts`** -- bez zmian
- **`src/hooks/useWorkingHours.ts`** -- bez zmian (czyta z instances.working_hours)
- **`src/lib/imageUtils.ts`** -- nowy plik, kopiujemy compressImage

### 2c. Nowe komponenty

Kopiujemy caly folder `src/components/admin/employees/` z N2Wash:

- **`EmployeesView.tsx`** -- glowny widok z tabela pracownikow i podsumowaniem czasu pracy. Bez zmian logicznych.
- **`EmployeesList.tsx`** -- lista pracownikow z kafelkami. Usuwamy funkcjonalnosc Start/Stop (isWorking, working status indicator, getWorkingFromTime). Kafelki bez zielonej/szarej kropki statusu. Klikniecie otwiera WorkerTimeDialog ale bez przycisku Start/Stop.
- **`AddEditEmployeeDialog.tsx`** -- dialog dodawania/edycji pracownika. Bez zmian (usuwamy import useTranslation jesli jest).
- **`WorkerTimeDialog.tsx`** -- dialog czasu pracy pracownika. Usuwamy przyciski Start/Stop, zostawiamy: avatar, zmiane zdjecia, grafik tygodniowy (WeeklySchedule), dzisiejsze wpisy.
- **`WeeklySchedule.tsx`** -- grafik tygodniowy. Bez zmian.
- **`AddEmployeeDayOffDialog.tsx`** -- dialog dodawania nieobecnosci. Bez zmian.
- **`WorkersSettingsDrawer.tsx`** -- ustawienia czasu pracy. Usuwamy opcje "Start/Stop enabled" i "time_calculation_mode" (bo Start/Stop nie bedzie w N2Serwis).
- **`TimeEntriesView.tsx`** -- widok wpisow czasu pracy. Bez zmian.
- **`EmployeeDaysOffView.tsx`** -- widok nieobecnosci. Bez zmian.
- **`index.ts`** -- eksporty

### 2d. Komponenty do przypisywania pracownikow do zlecen

- **`src/components/admin/EmployeeSelectionDrawer.tsx`** -- drawer wyboru pracownikow (multi-select z awatarami). Kopiujemy z N2Wash, usuwamy useTranslation.
- **`src/components/admin/AssignedEmployeesChips.tsx`** -- chipsy z przypisanymi pracownikami. Kopiujemy bez zmian.

### 2e. Integracja z Dashboard

- **`src/components/layout/DashboardLayout.tsx`**: Dodajemy `'pracownicy'` do ViewType, dodajemy nawigacje (ikona HardHat/Users).
- **`src/pages/Dashboard.tsx`**: Dodajemy `'pracownicy'` do validViews i viewConfig. Renderujemy `<EmployeesView instanceId={instanceId} />` dla widoku pracownicy.

### 2f. Przypisywanie pracownikow do zlecen (AddCalendarItemDialog)

- Dodajemy sekcje "Przypisani pracownicy" z AssignedEmployeesChips + EmployeeSelectionDrawer
- Zapisujemy `assigned_employee_ids` (juz istnieje w tabeli calendar_items jako ARRAY)

---

## Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowy -- employees, time_entries, employee_days_off, workers_settings + RLS + trigger |
| Storage bucket | Nowy -- employee-photos (public) |
| `src/lib/imageUtils.ts` | Nowy -- compressImage utility |
| `src/hooks/useEmployees.ts` | Nowy -- CRUD hooks dla pracownikow |
| `src/hooks/useTimeEntries.ts` | Nowy -- CRUD hooks dla wpisow czasu |
| `src/hooks/useEmployeeDaysOff.ts` | Nowy -- CRUD hooks dla nieobecnosci |
| `src/hooks/useWorkersSettings.ts` | Nowy -- hooks ustawien czasu pracy |
| `src/hooks/useWorkingHours.ts` | Nowy -- hook godzin otwarcia |
| `src/components/admin/employees/*` | Nowe -- 9 plikow skopiowanych z N2Wash |
| `src/components/admin/EmployeeSelectionDrawer.tsx` | Nowy |
| `src/components/admin/AssignedEmployeesChips.tsx` | Nowy |
| `src/components/admin/AdminCalendar.tsx` | Modyfikacja -- address_name w CalendarItem + renderItemTile |
| `src/components/layout/DashboardLayout.tsx` | Modyfikacja -- dodanie 'pracownicy' do ViewType i nawigacji |
| `src/pages/Dashboard.tsx` | Modyfikacja -- widok pracownikow + fetch address_name + assigned_employee_ids |
| `src/components/admin/AddCalendarItemDialog.tsx` | Modyfikacja -- sekcja przypisywania pracownikow |
