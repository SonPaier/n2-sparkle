

## Plan: Typ rozliczenia + drawer wykonanych zleceń pracownika

### 1. Migracja bazy danych

```sql
ALTER TABLE public.workers_settings 
ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'hourly';
```

### 2. `src/hooks/useWorkersSettings.ts`
Dodać `settlement_type: 'hourly' | 'per_order'` do interfejsu `WorkersSettings`.

### 3. `src/components/admin/employees/WorkersSettingsDrawer.tsx`
Dodać RadioGroup "Typ rozliczenia" z opcjami "Godzinowe" i "Per zlecenie". Zapisywać w `handleSave`.

### 4. `src/components/admin/employees/EmployeesView.tsx`

**Tabela — warunkowo na `settlement_type`:**
- `hourly` (domyślne): bez zmian — kolumny "Przepracowano" (godziny) + "Wypłata"
- `per_order`: kolumna "Przepracowano" → "Wykonano zleceń" (ilość `calendar_items` gdzie `status = 'completed'` i `assigned_employee_ids` zawiera employee ID w danym okresie). Ukryć kolumnę "Wypłata" i stopkę z sumą.

Fetch zleceń: dodatkowy query `calendar_items` z filtrem `instance_id`, `item_date` w zakresie okresu, `status = 'completed'`. Client-side zliczanie po `assigned_employee_ids.includes(employee.id)`.

**Ostatnia kolumna — DropdownMenu zamiast FileText:**
- `MoreVertical` z opcjami:
  - "Historia zmian" → otwiera istniejący `TimeEntryAuditDrawer`
  - "Wykonane zlecenia" → otwiera nowy `EmployeeOrdersDrawer`

### 5. Nowy `src/components/admin/employees/EmployeeOrdersDrawer.tsx`

Sheet z prawej, styl jak inne drawery (białe tło, 400px).
- Nagłówek: "{imię} — zlecenia"
- Fetch: `calendar_items` gdzie `assigned_employee_ids @> [employeeId]` + `status = 'completed'`, sortowane malejąco po `item_date`
- Renderuje `CustomerOrderCard` (ten sam komponent co w Customer Orders tab)
- Kliknięcie → `CalendarItemDetailsDrawer` (ten sam flow co `CustomerOrdersTab`)
- Dostępny zawsze, niezależnie od `settlement_type`

### Pliki do zmiany

| Plik | Zmiana |
|---|---|
| Migracja SQL | ADD COLUMN `settlement_type` |
| `useWorkersSettings.ts` | Typ interfejsu |
| `WorkersSettingsDrawer.tsx` | RadioGroup typ rozliczenia |
| `EmployeesView.tsx` | Warunkowa kolumna, fetch zleceń, DropdownMenu |
| `EmployeeOrdersDrawer.tsx` | **Nowy** |

