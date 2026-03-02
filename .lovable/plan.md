

## Plan: Implementacja zmian w module pracownika (12 zadań)

Ten plan obejmuje wszystkie zmiany z poprzedniego planu. Poniżej szczegóły implementacji.

---

### 1. Status pill na kartach zleceń w "Mój dzień"
**Plik:** `src/components/employee/EmployeeDashboard.tsx`
- Dodanie mapy statusów z kolorami (analogicznie do `STATUS_CONFIG` w SettlementsView): confirmed=amber, in_progress=blue, completed=emerald, cancelled=red
- Dodanie Badge ze statusem obok istniejącego pill dnia w każdej karcie zlecenia

### 2. Usunięcie toastu "Status zmieniony" przy zakończeniu pracy
**Plik:** `src/pages/EmployeeCalendarPage.tsx`
- W `handleStatusChange` (linia ~316): usunięcie `toast.success('Status zmieniony')`

### 3. Piąta opcja w MediaUploader — dowolny plik z dysku
**Plik:** `src/components/media/MediaUploader.tsx`
- Dodanie nowego hidden inputa `anyFileInputRef` z `accept="*"`
- Nowa opcja w dropdown: "Plik z dysku" (ikona FolderOpen)
- Handler `handleAnyFileSelect`: rozpoznaje MIME type i routuje:
  - `image/*` → kompresja + `imageBucket` jako typ `image`
  - `video/*` → kompresja + `storageBucket` jako typ `video`
  - reszta → `storageBucket` jako typ `file`

### 4. Historia drawer — otwieranie od prawej zamiast od dołu
**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx`
- W zagnieżdżonym `CalendarItemDetailsDrawer` (linia ~1099): dodanie `forceSideRight` prop, aby history drawer zawsze otwierał się od prawej

### 5. Ukrycie "do rozliczenia" dla employee w historii
**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx`
- W zagnieżdżonym history drawer: przekazanie `isEmployee={isEmployee}` — istniejący warunek `!isEmployee` przy `InvoiceStatusBadge` (linia ~703) automatycznie ukryje labelkę

### 6. Filtrowanie protokołów pracownika po `created_by_user_id`
**Plik:** `src/components/protocols/ProtocolsView.tsx`
- Dodanie opcjonalnego prop `filterByUserId?: string`
- W `fetchProtocols`: jeśli `filterByUserId` ustawiony, dodanie `.eq('created_by_user_id', filterByUserId)` do query

**Plik:** `src/pages/EmployeeCalendarPage.tsx`
- Przekazanie `filterByUserId={user?.id}` do `ProtocolsView` (linia ~452)

### 7. Ukrycie sekcji przypomnień gdy count = 0
**Plik:** `src/components/employee/EmployeeDashboard.tsx`
- Zamiast renderowania karty z "Brak przypomnień", warunkowo nie renderować całej karty Przypomnienia gdy `reminders.length === 0`

### 8. Przycisk "Mapa" na widoku "Mój dzień"
**Plik:** `src/components/employee/EmployeeDashboard.tsx`
- Dodanie nowego prop `onOpenMap?: () => void`
- Przycisk "Mapa" (ikona MapPin) w prawym rogu obok "Mój dzień"
- Rozszerzenie fetch o `lat, lng` z adresów

**Plik:** `src/pages/EmployeeCalendarPage.tsx`
- Stan `dashboardMapOpen`
- Przekazanie `onOpenMap` do `EmployeeDashboard`
- Renderowanie `CalendarMap` w Sheet/Drawer (bez filtrów daty)
- Przekazanie tylko itemów z dashboardu jako pinezki
- Potrzeba pobrania items z koordynatami — użycie danych z `EmployeeDashboard` (nowy callback `onItemsLoaded`)

### 9. Nowa akcja "Edycja usług w zleceniu"
**Plik:** `src/components/admin/employee-calendars/AddEditEmployeeCalendarDrawer.tsx`
- Dodanie `edit_services: 'Edycja usług w zleceniu'` do `ACTION_LABELS`
- Dodanie `edit_services: true` do `defaultAllowedActions`

**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx`
- Nowy opcjonalny prop `canEditServices?: boolean`
- Jeśli `isEmployee && canEditServices`, wyświetlenie przycisku dodawania/usuwania usług w sekcji "Usługi i produkty"
- Rozszerzenie `ServicesSummary` o tryb edycji z `ServiceSelectionDrawer`

**Plik:** `src/pages/EmployeeCalendarPage.tsx`
- Odczytanie `allowedActions.edit_services` i przekazanie do drawer

**Migracja RLS:** Dodanie polityk INSERT i DELETE na `calendar_item_services` dla employee:
```sql
CREATE POLICY "Employee can insert calendar_item_services"
ON public.calendar_item_services FOR INSERT TO authenticated
WITH CHECK (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));

CREATE POLICY "Employee can delete calendar_item_services"
ON public.calendar_item_services FOR DELETE TO authenticated
USING (has_instance_role(auth.uid(), 'employee'::app_role, instance_id));
```

### 10. Drawer protokołu — 100% height, od prawej
**Plik:** `src/components/protocols/CreateProtocolForm.tsx`
- Na mobile (linia ~351): zamiana `Drawer` na `Sheet side="right"` z `className="w-full h-full sm:max-w-lg p-0"`
- Usunięcie warunku `isMobile` — zawsze Sheet od prawej

### 11. Datepicker protokołu — białe tło
**Plik:** `src/components/protocols/CreateProtocolForm.tsx`
- Dodanie `className="w-auto p-0 bg-white"` do `PopoverContent` (linia ~289)

### 12. Ukrycie pola "Telefon" w trybie edycji
**Plik:** `src/components/protocols/CreateProtocolForm.tsx`
- Warunkowo ukrycie pola "Telefon" (linia ~237-240) gdy `isEditMode`

---

### Podsumowanie plików do modyfikacji

| Plik | Zmiany |
|------|--------|
| EmployeeDashboard.tsx | Status pill, ukrycie przypomnień, przycisk mapa |
| EmployeeCalendarPage.tsx | Usunięcie toastu, filtr protokołów, mapa dashboard |
| MediaUploader.tsx | 5. opcja upload |
| CalendarItemDetailsDrawer.tsx | Historia side, isEmployee, edycja usług |
| ProtocolsView.tsx | Filtr po userId |
| CreateProtocolForm.tsx | Sheet zamiast Drawer, białe tło, ukrycie telefonu |
| AddEditEmployeeCalendarDrawer.tsx | Nowa akcja edit_services |
| Migracja SQL | RLS na calendar_item_services |

