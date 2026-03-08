

## Plan: Feature toggle "Pracownicy" (employees module)

### Co robimy

Dodajemy nowy feature toggle `employees` w zakładce "Aplikacja" w ustawieniach. Gdy wyłączony, ukrywamy z UI:

1. **Sidebar** — pozycja "Pracownicy"
2. **Ustawienia** — zakładka "Kalendarze pracowników"
3. **Formularz zlecenia (AddCalendarItemDialog)** — sekcja "Przypisani pracownicy" (label + chips + drawer)
4. **Drawer zlecenia (CalendarItemDetailsDrawer)** — sekcja "Przypisani pracownicy" (chips + edycja + drawer)
5. **Kafelki kalendarza (AdminCalendar)** — chipy z imionami pracowników na kafelkach zleceń
6. **Dashboard karty (DashboardOverview)** — pomijamy fetch i wyświetlanie `employee_names`

### Seed danych

Wstawiamy wiersz `instance_features` z `feature_key = 'employees'`, `enabled = true` dla instancji Water Grass (`c6300bdc-5070-4599-8143-06926578a424`), żeby mieli włączone domyślnie. Inne instancje też domyślnie mają `true` (brak wiersza = włączone).

### Zmiany w plikach

**Baza danych (migracja)**
- INSERT `instance_features` dla Water Grass z `feature_key = 'employees'`, `enabled = true`

**`src/components/admin/SettingsView.tsx`**
- Dodać `useInstanceFeature(instanceId, 'employees')` 
- Dodać toggle "Pracownicy" w zakładce "Aplikacja"
- Warunkowo ukryć zakładkę "Kalendarze pracowników" gdy `employeesEnabled === false`

**`src/components/layout/DashboardLayout.tsx`**
- Dodać `useInstanceFeature(instanceId, 'employees')`
- Filtrować `navItems` — ukryć `'pracownicy'` gdy wyłączone

**`src/components/admin/AddCalendarItemDialog.tsx`**
- Przyjąć prop `employeesEnabled` lub pobrać z hooka
- Warunkowo ukryć sekcję "Przypisani pracownicy" (label, chips, button otwierający drawer)

**`src/components/admin/CalendarItemDetailsDrawer.tsx`**
- Pobrać feature z hooka lub prop
- Warunkowo ukryć sekcję "Przypisani pracownicy" i `EmployeeSelectionDrawer`

**`src/components/admin/AdminCalendar.tsx`**
- Prop `employeesEnabled` — warunkowo ukryć chipy pracowników na kafelkach zleceń

**`src/pages/Dashboard.tsx`**
- Przekazać `employeesEnabled` do komponentów

