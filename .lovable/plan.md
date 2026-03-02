

## Plan: Poprawki drawer zleceń, usługi i widok pracownika

### 1. Auto-odświeżanie usług w drawer po zapisie zlecenia
**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx` (ServicesSummary, linia ~83)
- Dodać `refetchInterval` lub invalidację query `calendar-item-services-summary` po zamknięciu `AddCalendarItemDialog`
- Rozwiązanie: w `CalendarItemDetailsDrawer` dodać callback `onSuccess` z `AddCalendarItemDialog`, który wywołuje `queryClient.invalidateQueries(['calendar-item-services-summary', itemId])`
- Alternatywnie: zmienić `staleTime: 30_000` na `staleTime: 0` dla ServicesSummary, lub dodać key refresh po edycji

**Plik:** `src/pages/EmployeeCalendarPage.tsx` + inne miejsca gdzie drawer + edit dialog współistnieją
- Po `onSuccess` z AddCalendarItemDialog, invalidować query services summary

### 2. Usunięcie "Czas trwania" z formularza usług
**Plik:** `src/components/admin/ServiceFormDialog.tsx` (linie ~460-479)
- Usunąć sekcję "Czas trwania" z Collapsible/Advanced — pole duration_minutes
- Zostawić w bazie i w `formData`, ale nie renderować UI
- Zaktualizować `hasAdvancedValues` aby nie sprawdzał `duration_minutes`

### 3. Naprawienie edycji zlecenia z widoku pracownika "Mój dzień"
**Plik:** `src/pages/EmployeeCalendarPage.tsx` (linia ~422-455)
- W `CalendarItemDetailsDrawer` dla dashboard view brakuje prop `onEdit={handleEditItem}`
- Dodać `onEdit={allowedActions.edit_item ? handleEditItem : undefined}` do drawer w sekcji dashboard
- Upewnić się, że `AddCalendarItemDialog` jest renderowany z `editingItem` w kontekście dashboard

### 4. Usunięcie czasu trwania z drawer szczegółów zlecenia
**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx`
- W ServicesSummary (linia ~82-138) nie ma duration — OK
- Sprawdzić czy gdzieś w drawer jest wyświetlany czas trwania pod ceną — prawdopodobnie w starszym kodzie
- Usunąć wszelkie referencje do duration_minutes w widoku szczegółów

### 5. Usunięcie logiki aplikowania czasu zlecenia z wyboru usług
**Plik:** `src/components/admin/AddCalendarItemDialog.tsx` (linie 392-401)
- Usunąć blok `if (totalDuration > 0) { ... setEndTime(...) }` z `handleServicesConfirmed`
- End time nie powinien się zmieniać automatycznie na podstawie duration usług

### 6. Większy font pełnej nazwy usługi gdy jest skrót
**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx` (ServicesSummary, linia ~103-125)
- W ServicesSummary: gdy usługa ma short_name, nazwa pełna (po short_name) powinna mieć +2px font
- Zmienić rendering nazwy: jeśli jest short_name, renderuj `<span className="font-bold text-primary">{short_name}</span> <span className="text-[15px]">{name}</span>` zamiast połączonego stringa

**Plik:** `src/components/admin/SelectedServicesList.tsx` (linia ~164-169)
- Analogicznie: gdy `service.short_name` istnieje, `service.name` powinno mieć `text-[15px]` zamiast domyślnego `text-sm` (14px → 15px, czyli +1-2px)

### Podsumowanie plików

| Plik | Zmiany |
|------|--------|
| CalendarItemDetailsDrawer.tsx | Auto-refresh services, font nazwy, usunięcie duration |
| ServiceFormDialog.tsx | Usunięcie pola Czas trwania z UI |
| EmployeeCalendarPage.tsx | Dodanie onEdit do drawer dashboard |
| AddCalendarItemDialog.tsx | Usunięcie logiki end time z duration |
| SelectedServicesList.tsx | Większy font nazwy gdy jest skrót |

