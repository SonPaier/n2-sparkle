

## Plan: Priorytet zleceń (4 poziomy)

### 1. Migracja bazy danych

```sql
ALTER TABLE public.calendar_items
ADD COLUMN priority integer NOT NULL DEFAULT 3;
```

Wartości: 1 = Krytyczny, 2 = Wysoki, 3 = Normalny (domyślny), 4 = Niski.

### 2. Feature toggle

**`src/components/admin/SettingsView.tsx`** — dodać `useInstanceFeature(instanceId, 'priorities')` + Switch "Priorytety" w sekcji "Moduły aplikacji".

### 3. Stała mapa priorytetów

Nowy plik **`src/lib/priorityUtils.ts`**:

```typescript
export const PRIORITY_CONFIG: Record<number, { label: string; badgeCls: string }> = {
  1: { label: 'Krytyczny', badgeCls: 'bg-red-100 text-red-700 border-red-300' },
  2: { label: 'Wysoki',    badgeCls: 'bg-orange-100 text-orange-700 border-orange-300' },
  3: { label: 'Normalny',  badgeCls: 'bg-blue-100 text-blue-700 border-blue-300' },
  4: { label: 'Niski',     badgeCls: 'bg-gray-100 text-gray-500 border-gray-300' },
};
```

### 4. Formularz tworzenia/edycji zlecenia

**`src/components/admin/AddCalendarItemDialog.tsx`**:
- State `priority` (domyślnie 3)
- Dropdown z 4 opcjami, widoczny tylko gdy flaga `priorities` włączona
- Zapis/odczyt `priority` w obiekcie danych

### 5. Kalendarz — badge na kafelku

**`src/components/admin/AdminCalendar.tsx`**:
- Dodać `priority` do interfejsu `CalendarItem` i selecta
- Badge priorytetu na kafelku (gdy != 3 i flaga włączona)

### 6. Szczegóły zlecenia — badge

**`src/components/admin/CalendarItemDetailsDrawer.tsx`**:
- Badge priorytetu (gdy != 3 i flaga włączona)

### 7. Dashboard admina — sortowanie + badge

**`src/components/admin/DashboardOverview.tsx`**:
- `priority` w interfejsie i select
- Sortowanie: data (dziś wyżej) → priorytet (1 wyżej)
- Badge przy zleceniu (gdy != 3 i flaga włączona)

### 8. Dashboard pracownika — sortowanie + badge

**`src/components/employee/EmployeeDashboard.tsx`**:
- Analogicznie jak admin dashboard

### 9. Przekazanie flagi

**`src/pages/Dashboard.tsx`** + **`src/pages/EmployeeCalendarPage.tsx`**:
- `useInstanceFeature(instanceId, 'priorities')` → prop `prioritiesEnabled` do komponentów

### Pliki do zmiany

| Plik | Zmiana |
|---|---|
| Migracja SQL | `ADD COLUMN priority integer NOT NULL DEFAULT 3` |
| `src/lib/priorityUtils.ts` | **Nowy** — mapa 4 priorytetów |
| `src/components/admin/SettingsView.tsx` | Toggle "Priorytety" |
| `src/components/admin/AddCalendarItemDialog.tsx` | Dropdown priorytet |
| `src/components/admin/AdminCalendar.tsx` | Badge na kafelku |
| `src/components/admin/CalendarItemDetailsDrawer.tsx` | Badge w szczegółach |
| `src/components/admin/DashboardOverview.tsx` | Sortowanie + badge |
| `src/components/employee/EmployeeDashboard.tsx` | Sortowanie + badge |
| `src/pages/Dashboard.tsx` | Przekazanie flagi |
| `src/pages/EmployeeCalendarPage.tsx` | Przekazanie flagi |

