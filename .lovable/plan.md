

## Plan: Widok kalendarza per pracownik

### Opis
Nowy tryb kalendarza, gdzie kolumnami są aktywni pracownicy. Zlecenia wyświetlane per pracownik (na podstawie `assigned_employee_ids`). Detekcja konfliktów godzinowych. Przełączany przyciskiem obok "Mapa", za flagą `employee_calendar_view`.

### Zmiany

#### 1. Feature toggle
**`src/components/admin/SettingsView.tsx`** — nowy Switch "Widok kalendarza pracowników" z kluczem `employee_calendar_view` w sekcji "Moduły aplikacji".

#### 2. `Dashboard.tsx` — logika widoku

- `useInstanceFeature(instanceId, 'employee_calendar_view')` 
- State `employeeViewMode` zsynchronizowany z query param `?view=employees`
- Pobranie aktywnych pracowników (`employees` table, `active=true`, `order by sort_order`) → przekształcenie na `CalendarColumn[]` (id=employee.id, name=employee.name)
- Zmapowanie `calendarItems`: dla każdego itema z `assigned_employee_ids`, sklonowanie z `column_id = employeeId`
- Itemy bez przypisanych pracowników niewidoczne w tym widoku
- Przekazanie do `AdminCalendar`: przerobione `columns`, `items`, `breaks=[]`
- Wszystkie istniejące kontrolki (strzałki, dziś, data, widok dzień/2dni/tydzień) działają bez zmian

#### 3. `AdminCalendar.tsx` — nowe props + UI

Nowe props:
```typescript
employeeViewActive?: boolean;
onToggleEmployeeView?: () => void;
```

- Przycisk "Pracownicy" (ikona `Users`) obok "Mapa", widoczny gdy `onToggleEmployeeView` jest podany i flaga włączona
- W trybie employee view:
  - Ukryć przycisk "Mapa"
  - Ukryć ustawienia kolumn w popoverze Settings
  - Ukryć "Dodaj przerwę" (context menu / long press)
  - Wyłączyć drag-and-drop
  - Wyłączyć klikanie slotów (nie tworzymy zleceń z tego widoku)
- **Detekcja konfliktów**: czerwona ramka (`ring-2 ring-red-500`) na kafelku gdy 2 zlecenia tego samego pracownika nachodzą się czasowo w tym samym dniu

#### 4. Pliki do zmiany

| Plik | Zmiana |
|---|---|
| `src/components/admin/SettingsView.tsx` | Toggle `employee_calendar_view` |
| `src/pages/Dashboard.tsx` | Query param, fetch employees, mapowanie danych, przekazanie props |
| `src/components/admin/AdminCalendar.tsx` | Nowe props, przycisk toggle, ukrycie kontrolek w trybie employee, detekcja konfliktów |

