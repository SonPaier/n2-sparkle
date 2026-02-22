
# Rozszerzenie planu: "Kalendarze pracownikow" w Ustawieniach

Kopiujemy caly widok "Hale" z N2Wash do ustawien, z rename kontekstu na "Kalendarze pracownikow".

---

## Nowe pliki (kopia z N2Wash halls/)

### 1. `src/components/admin/employee-calendars/EmployeeCalendarsListView.tsx`
Kopia `HallsListView.tsx`:
- Tabela: `employee_calendar_configs` zamiast `halls`
- "Stacje" -> `calendar_columns` (kolumny kalendarza)
- Tlumaczenia inline (bez i18n): "Kalendarze pracownikow", "Dodaj kalendarz", "Brak kalendarzy" itd.
- URL preview: `/employee-calendars/{number}` zamiast `/halls/{number}`

### 2. `src/components/admin/employee-calendars/EmployeeCalendarCard.tsx`
Kopia `HallCard.tsx`:
- Interface `EmployeeCalendarConfig` zamiast `Hall`:
  - `column_ids` zamiast `station_ids`
  - `visible_fields`: customer_name, customer_phone, admin_notes, price, address (kontekst serwisowy zamiast myjni)
  - `allowed_actions`: add_item, edit_item, delete_item, change_time, change_column
  - `user_id` (uuid) -- powiazanie z pracownikiem
- URL: `employee-calendars/{number}` zamiast `halls/{number}`
- Etykiety po polsku inline

### 3. `src/components/admin/employee-calendars/AddEditEmployeeCalendarDrawer.tsx`
Kopia `AddEditHallDrawer.tsx`:
- Drawer/Sheet z formularzem:
  - Nazwa kalendarza
  - Wybor kolumn kalendarza (checkboxy z `calendar_columns`)
  - Powiazanie z pracownikiem (select z `user_roles` WHERE role='employee')
  - Visible fields (checkboxy) -- dostosowane do kontekstu serwisowego
  - Allowed actions (checkboxy) -- dostosowane do kontekstu serwisowego
- Zapis do `employee_calendar_configs`

---

## Modyfikacja istniejacych plikow

### 4. `src/components/admin/SettingsView.tsx`
- Nowy tab: `{ key: 'employee-calendars', label: 'Kalendarze pracownikow', icon: <Monitor className="w-4 h-4" /> }`
- Import `EmployeeCalendarsListView`
- Case w renderTabContent: `case 'employee-calendars': return <EmployeeCalendarsListView instanceId={instanceId} />`
- Dodac typ do `SettingsTab`: `'company' | 'calendar' | 'employee-calendars'`

---

## Bez zmian (z glownego planu)

Tabela `employee_calendar_configs`, routing, strona `EmployeeCalendarView.tsx`, `RoleBasedRedirect` -- to wszystko zostaje jak w zatwierdzonym planie. Ten dodatek dotyczy TYLKO widoku zarzadzania w ustawieniach admina.

---

## Podsumowanie nowych plikow

| Plik | Akcja |
|------|-------|
| `src/components/admin/employee-calendars/EmployeeCalendarsListView.tsx` | Nowy -- kopia HallsListView |
| `src/components/admin/employee-calendars/EmployeeCalendarCard.tsx` | Nowy -- kopia HallCard |
| `src/components/admin/employee-calendars/AddEditEmployeeCalendarDrawer.tsx` | Nowy -- kopia AddEditHallDrawer |
| `src/components/admin/SettingsView.tsx` | Modyfikacja -- nowy tab "Kalendarze pracownikow" |
