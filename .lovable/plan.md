

## Plan: Zmiany w widoku pracownika (employee role)

### 1. Hover na karcie zlecenia w EmployeeDashboard
**Plik**: `src/components/employee/EmployeeDashboard.tsx`, linia 241
- Zmienić `hover:bg-muted/50` na `hover:bg-primary/5` (jasnofioletowy, zgodny z resztą aplikacji)

### 2. Dodać prop `isEmployee` do CalendarItemDetailsDrawer
**Plik**: `src/components/admin/CalendarItemDetailsDrawer.tsx`
- Dodać `isEmployee?: boolean` do interfejsu props (linia 46-61)
- Drawer na mobile: gdy `isEmployee`, ustawić `className` na `w-full` / pełną szerokość (linia 671-675 — usunąć `sm:max-w-md` dla mobile gdy `isEmployee`)

### 3. Ukryć elementy dla roli employee w CalendarItemDetailsDrawer

**Footer (renderFooter, linie 481-654)**:
- Ukryć `moreMenu` (przycisk "..." z "Usuń") gdy `isEmployee`
- Ukryć `editBtn` (przycisk "Edytuj") gdy `isEmployee`
- Ukryć dropdown statusów (ChevronDown) — pracownik widzi tylko prosty przycisk "Rozpocznij pracę" i "Zakończ pracę" (bez dropdown z innymi statusami)
- Usunąć "Prośba o zmianę" z UI całkowicie (zarówno dropdown jak i status `change_requested` w stopce)

**Status badge (linia 704-709)**:
- Ukryć `InvoiceStatusBadge` (status płatności "Do rozliczenia" itp.) gdy `isEmployee`

**Przypisani pracownicy (linie 807-834)**:
- Ukryć przycisk "Dodaj" gdy `isEmployee` (linia 824-832)
- Ukryć przycisk X (usuwania) z chipów pracowników gdy `isEmployee` (linia 816-821)
- Pracownik widzi readonly listę przypisanych pracowników
- **BUG FIX**: Pracownik nie widzi przypisanych pracowników, bo `item.assigned_employees` nie jest ustawione — w EmployeeCalendarPage dashboard view, dane z EmployeeDashboard nie mają `assigned_employees`. Trzeba użyć `allEmployees` i `item.assigned_employee_ids` do wyświetlenia chipów readonly

### 4. Przekazać `isEmployee` z EmployeeCalendarPage
**Plik**: `src/pages/EmployeeCalendarPage.tsx`
- Dodać `isEmployee` prop do obu instancji `CalendarItemDetailsDrawer` (linie 405, 467)
- Na dashboard view (linia 405): Nie przekazywać `onDelete`, `onEdit` (i tak kontrolowane przez `allowedActions`, ale lepiej nie przekazywać)
- Nie przekazywać `onStatusChange` — zamiast tego kontrolować w drawer

### 5. Usunąć "Prośba o zmianę" z UI
- Usunąć `change_requested` z opcji dropdown we wszystkich sekcjach stopki (linie 552, 563, 588-591, 617-620, 625-652)
- Zostawić w `statusLabels` i `statusColors` na wypadek istniejących danych, ale usunąć z opcji zmiany statusu

### Podsumowanie zmian:
| Element | Admin | Employee |
|---------|-------|----------|
| Przycisk "..." (Usuń) | ✅ | ❌ |
| Przycisk "Edytuj" | ✅ | ❌ |
| Status płatności badge | ✅ | ❌ |
| Dropdown statusów | ✅ | ❌ (tylko prosty przycisk Rozpocznij/Zakończ) |
| "Prośba o zmianę" | ❌ (usunięte) | ❌ (usunięte) |
| Dodaj pracownika | ✅ | ❌ |
| Usuń pracownika (X) | ✅ | ❌ |
| Lista pracowników | ✅ | ✅ (readonly) |
| Drawer width mobile | sm:max-w-md | 100% |
| Hover karty | bg-primary/5 | bg-primary/5 |

