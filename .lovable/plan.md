

## Plan: Badge priorytetu na kafelkach kalendarza

Problem: `AdminCalendar` nie otrzymuje propa `prioritiesEnabled` i nie renderuje badge'a priorytetu na kafelkach.

### Zmiany

**1. `src/components/admin/AdminCalendar.tsx`**
- Dodać prop `prioritiesEnabled?: boolean` do `AdminCalendarProps`
- Zaimportować `getPriorityConfig` z `@/lib/priorityUtils`
- W renderowaniu kafelka (linia ~654, obok tytułu) dodać badge priorytetu gdy `prioritiesEnabled && item.priority != null && item.priority !== 3`:
  ```tsx
  {prioritiesEnabled && item.priority != null && item.priority !== 3 && (
    <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold shrink-0", getPriorityConfig(item.priority).badgeCls)}>
      {getPriorityConfig(item.priority).label}
    </span>
  )}
  ```

**2. `src/pages/Dashboard.tsx`**
- Przekazać `prioritiesEnabled={prioritiesEnabled}` do `<AdminCalendar>`

**3. `src/pages/EmployeeCalendarPage.tsx`**
- Przekazać `prioritiesEnabled={prioritiesEnabled}` do `<AdminCalendar>`

| Plik | Zmiana |
|---|---|
| `AdminCalendar.tsx` | Nowy prop + badge na kafelku |
| `Dashboard.tsx` | Przekazanie propa |
| `EmployeeCalendarPage.tsx` | Przekazanie propa |

