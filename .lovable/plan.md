

# Kalendarz Admin - Kopiowanie z N2Wash

## Podsumowanie

Skopiujemy caly system kalendarza z N2Wash, adaptujac go do N2Serwis: zamiast `reservations` bedziemy miec `calendar_items`, zamiast `stations` mamy juz `calendar_columns`. Godziny stale 6:00-19:00, bez samochodow, bez SMS-ow, bez yard vehicles.

## 1. Baza danych

### Nowa tabela `calendar_items`
Model analogiczny do `reservations` w N2Wash, bez pol samochodowych:

```
id                uuid PK default gen_random_uuid()
instance_id       uuid NOT NULL FK -> instances
column_id         uuid FK -> calendar_columns (odpowiednik station_id)
title             text NOT NULL (odpowiednik customer_name - tytul zlecenia)
customer_name     text
customer_phone    text
customer_email    text
item_date         text NOT NULL (odpowiednik reservation_date, format YYYY-MM-DD)
end_date          text (dla wielodniowych)
start_time        text NOT NULL (HH:MM)
end_time          text NOT NULL (HH:MM)
status            text NOT NULL default 'confirmed'
                  (confirmed, in_progress, completed, cancelled, change_requested)
admin_notes       text
price             numeric
assigned_employee_ids text[] (na przyszlosc)
created_by        uuid
created_at        timestamptz default now()
updated_at        timestamptz default now()
```

### Nowa tabela `breaks`
```
id            uuid PK
instance_id   uuid NOT NULL FK -> instances
column_id     uuid NOT NULL FK -> calendar_columns
break_date    text NOT NULL
start_time    text NOT NULL
end_time      text NOT NULL
note          text
created_at    timestamptz default now()
```

### RLS
- `calendar_items`: SELECT/ALL dla admin instancji lub super_admin
- `breaks`: SELECT/ALL dla admin instancji lub super_admin

### Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_items;`

### Trigger
- `update_updated_at_column` na `calendar_items`

## 2. Nowe komponenty

### `src/components/admin/AdminCalendar.tsx` (~2500 linii)
Kopia z N2Wash z nastepujacymi zmianami:
- `Station` -> `CalendarColumn` (interface + nazwy zmiennych)
- `Reservation` -> `CalendarItem`
- `station_id` -> `column_id`
- `reservation_date` -> `item_date`
- `customer_name` -> `title` (wyswietlane na kafelku)
- Usuniecie: `vehicle_plate`, `car_size`, `service`/`services_data`, `confirmation_code`, `offer_number`, `hallMode`, `hallConfig`, `hallDataVisible`, `yardVehicleCount`, `slotPreview`, `trainings`, `employees` - wszystkie te feature'y N2Wash-specific
- Godziny stale: `DEFAULT_START_HOUR = 6`, `DEFAULT_END_HOUR = 19` (bez `workingHours` prop)
- Bez breaks prop na poczatku (uproszenie, dodamy pozniej)
- Bez `closedDays`
- Bez `useTranslation` - polskie stringi hardcoded
- Statusy: `confirmed`, `in_progress`, `completed`, `cancelled`, `change_requested`
- Kafelek wyswietla: `title`, `customer_name`, `customer_phone`, godziny
- Zachowane: drag-and-drop przenoszenie, widok day/two-days/week, nawigacja dat, filtrowanie kolumn, compact mode, fullscreen, mobile support

### `src/components/admin/AddCalendarItemDialog.tsx` (~500 linii)
Uproszczony odpowiednik `AddReservationDialogV2`:
- Formularz: tytul, klient (imie, telefon, email), kolumna, data, godzina start/end, notatki, cena
- Tryb dodawania i edycji
- Select kolumny kalendarza
- Bez: uslug, rozmiarow aut, yard mode, SMS, customer search

### `src/components/admin/CalendarItemDetailsDrawer.tsx` (~400 linii)
Uproszczony odpowiednik `ReservationDetailsDrawer`:
- Wyswietla szczegoly: tytul, klient, telefon, email, data, godziny, kolumna, status, notatki, cena
- Akcje: edytuj, zmien status (confirmed -> in_progress -> completed), anuluj, usun
- Bez: SMS, zdjec, historii, ofert, protokolow

### `src/components/admin/AddBreakDialog.tsx` (~150 linii)
Kopia z N2Wash dostosowana do naszych kolumn:
- Wybor kolumny, data, godzina start/end, notatka

## 3. Modyfikacja `src/pages/Dashboard.tsx`

Dashboard stanie sie glownym "orkiestratorem" kalendarza (analogicznie do `AdminDashboard` w N2Wash):
- Fetch `calendar_items` z Supabase (z date range filter)
- Fetch `calendar_columns` (juz mamy w ustawieniach)
- Fetch `breaks`
- Realtime subscription na `calendar_items` (INSERT/UPDATE/DELETE)
- Stan: `calendarItems`, `selectedItem`, `addItemOpen`, `editingItem`, `breaks`, `addBreakOpen`
- Handlery: `handleItemClick`, `handleAddItem`, `handleItemMove`, `handleDeleteItem`, `handleStatusChange`, itp.
- Renderowanie `AdminCalendar` gdy `currentView === 'kalendarz'`

## 4. Podsumowanie plikow

| Plik | Akcja | Opis |
|------|-------|------|
| Migracja SQL | Nowy | Tabele `calendar_items`, `breaks`, RLS, realtime, trigger |
| `src/components/admin/AdminCalendar.tsx` | Nowy | Glowny komponent kalendarza (~2500 linii) |
| `src/components/admin/AddCalendarItemDialog.tsx` | Nowy | Dialog dodawania/edycji elementu |
| `src/components/admin/CalendarItemDetailsDrawer.tsx` | Nowy | Drawer szczegolow elementu |
| `src/components/admin/AddBreakDialog.tsx` | Nowy | Dialog dodawania przerwy |
| `src/pages/Dashboard.tsx` | Modyfikacja | Cala logika fetchu, realtime, handlery |

## Uwagi techniczne

- Nie uzywamy `useTranslation` - polskie stringi inline (jak juz jest w projekcie)
- Godziny stale 6:00-19:00, nie pobierane z ustawien
- Brak SMS/push notifications (na razie)
- Brak employee assignment (na razie, kolumna jest w tabeli na przyszlosc)
- Zachowujemy pelny drag-and-drop z N2Wash (przenoszenie miedzy kolumnami i zmiana godziny)
- Zachowujemy wszystkie widoki: dzien, 2 dni, tydzien
- Zachowujemy mobile support z horizontal scrollem
- Zachowujemy overlap detection (nakladajace sie elementy obok siebie)

