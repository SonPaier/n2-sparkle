

## Plan: Dashboard zlecenia — pokaż dzisiejszy + następny dzień roboczy (z kalendarza)

### Problem
- `DashboardOverview` hardcodes "dziś + jutro" (today + tomorrow)
- `EmployeeDashboard` hardcodes "3 kolejne dni robocze" pomijając sobotę/niedzielę, ale nie sprawdza czy sobota/niedziela są otwarte w `working_hours`

### Rozwiązanie

Stworzyć wspólną funkcję `getNextWorkingDays(count, workingHours)` która:
1. Zaczyna od dziś
2. Sprawdza `working_hours` — jeśli dzień ma wpis (np. `{ open: "08:00", close: "17:00" }`), jest dniem roboczym; jeśli `null`, jest zamknięty
3. Jeśli `working_hours` jest pusty/null — fallback na pon-pt (obecne zachowanie)
4. Zwraca `count` kolejnych dni roboczych (włącznie z dziś jeśli jest roboczy)

### Zmiany w plikach

**1. Nowy plik: `src/lib/workingDaysUtils.ts`**
- Eksportuje `getNextWorkingDays(count: number, workingHours: WorkingHours): string[]`
- Logika: iteruj od dziś, sprawdź czy dzień jest otwarty w working_hours, zbierz `count` dat

**2. `DashboardOverview.tsx`**
- Dodać prop `workingHours` (typ z `useWorkingHours`)
- Zamiast `today + tomorrow` → użyć `getNextWorkingDays(2, workingHours)`
- Filtrowanie `dashboardItems` zmieni się z `item_date === today || item_date === tomorrow` na `workingDays.includes(item_date)`
- Zakres fetch: zamiast `weekStart/weekEnd` → `workingDays[0]` do `workingDays[workingDays.length - 1]` (optymalizacja, max 4-5 dni do przodu)

**3. `EmployeeDashboard.tsx`**
- Dodać prop `workingHours` (lub pobrać wewnętrznie via `useWorkingHours`)
- Zamienić `getNextBusinessDays(3)` na `getNextWorkingDays(3, workingHours)`

**4. Wywołania w `Dashboard.tsx` i `EmployeeCalendarPage.tsx`**
- Pobrać `workingHours` via `useWorkingHours(instanceId)` i przekazać do `DashboardOverview` / `EmployeeDashboard`

### Logika `getNextWorkingDays`

```text
function getNextWorkingDays(count, workingHours):
  dates = []
  d = today
  while dates.length < count:
    dayKey = WEEKDAY_MAP[d.getDay()]  // 'monday', 'tuesday', etc.
    if workingHours == null:
      // fallback: skip sat/sun
      if d.getDay() != 0 && d.getDay() != 6: dates.push(d)
    else:
      if workingHours[dayKey] != null: dates.push(d)
    d = d + 1 day
  return dates
```

### Podsumowanie plików

| Plik | Zmiana |
|------|--------|
| `src/lib/workingDaysUtils.ts` | Nowy — wspólna funkcja `getNextWorkingDays` |
| `src/components/admin/DashboardOverview.tsx` | Przyjmij `workingHours`, użyj `getNextWorkingDays(2)` zamiast today+tomorrow |
| `src/components/employee/EmployeeDashboard.tsx` | Przyjmij `workingHours`, zamień `getNextBusinessDays(3)` na `getNextWorkingDays(3)` |
| `src/pages/Dashboard.tsx` | Pobierz `workingHours`, przekaż do `DashboardOverview` |
| `src/pages/EmployeeCalendarPage.tsx` | Pobierz `workingHours`, przekaż do `EmployeeDashboard` |

