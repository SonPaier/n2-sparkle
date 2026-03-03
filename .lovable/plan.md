

## Plan: Dodanie sekcji "Godziny w kalendarzu" i podpięcie do kalendarza

### 1. Nowy komponent `WorkingHoursSettings.tsx`

Skopiowany 1:1 z N2Wash, bez i18n — hardcoded polskie stringi. Komponent:
- Wyświetla 7 dni tygodnia z switchami on/off
- Dla włączonych dni — dwa inputy `type="time"` (od–do)
- Domyślne: Pon–Pt 06:00–19:00, Sob 06:00–14:00, Nd zamknięte
- Zapis bezpośrednio do `instances.working_hours` (bez RPC — zwykły `update`)
- Po zapisie invaliduje query `['working_hours', instanceId]`

Plik: `src/components/admin/WorkingHoursSettings.tsx`

### 2. Dodanie sekcji do zakładki "Kalendarz" w `SettingsView.tsx`

W `renderTabContent()` case `'calendar'` — dodać `WorkingHoursSettings` **nad** istniejącym `CalendarColumnsSettings`, oddzielone separatorem. Wynik:

```
[Godziny w kalendarzu]     ← nowa sekcja
──────────────────────
[Kolumny kalendarza]       ← istniejąca sekcja
```

### 3. Podpięcie godzin pracy do kalendarza

W `AdminCalendar.tsx`:
- Dodać prop `workingHours` do interfejsu
- Obliczyć `startHour` i `endHour` z min/max otwartych godzin (fallback na 6–19)
- Zamienić `DEFAULT_START_HOUR`/`DEFAULT_END_HOUR` na dynamiczne wartości w obliczeniach `HOURS`, `totalHeight`, pozycji elementów, etc.

W `Dashboard.tsx`:
- Przekazać `workingHours={workingHours}` do `<AdminCalendar>`

### Pliki do zmiany
- **Nowy**: `src/components/admin/WorkingHoursSettings.tsx`
- **Edycja**: `src/components/admin/SettingsView.tsx` (import + render)
- **Edycja**: `src/components/admin/AdminCalendar.tsx` (prop + dynamiczne godziny)
- **Edycja**: `src/pages/Dashboard.tsx` (przekazanie prop)

