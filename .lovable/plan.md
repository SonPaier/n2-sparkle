

## Plan: Remove Realtime, fix flickering, apply pending fixes

### Changes

**`useReminders.ts`**:
1. **Remove the entire realtime subscription** `useEffect` block (the one with `supabase.channel('reminders-realtime')`) — not needed for a single-user module
2. **Keep manual `fetch()` calls** after mutations — this is the standard REST pattern used across the app
3. **Remove `setLoading(true)` from `fetch()`** when called after mutations (or debounce) to prevent the flash. Better approach: only set loading on initial load, not on refetches. Add a `isInitialLoad` ref.
4. **Fix date formatting** in `getNextRecurringDeadline` — replace `toISOString().split('T')[0]` with local date formatting to fix UTC timezone shift bug
5. **Limit monthly recurring day to 1-28**

**`AddEditReminderDrawer.tsx`**:
6. Monthly day input: change `max={31}` → `max={28}`, update label `(1–31)` → `(1–28)`
7. Remove `bg-muted/30` from recurring section if present

**`RemindersView.tsx`**:
8. Remove tab icons (`ListTodo`, `Archive`)
9. Unify counter badge styles — always same class regardless of count being 0 or not
10. Recurring badge — change from `<Badge variant="outline">` to plain `<span className="text-xs text-muted-foreground">`

### Technical details

**Flickering root cause**: `fetch()` sets `setLoading(true)` → list unmounts → data arrives → `setLoading(false)` → list remounts. On top of that, realtime fires a second fetch. Fix: remove realtime entirely, and only show loading spinner on first load (use a `useRef(true)` for `isFirstLoad`).

**Date bug**: `new Date(2026, 2, 2)` at midnight CET = `2026-03-01T23:00:00Z` in UTC. `toISOString().split('T')[0]` = `2026-03-01` instead of `2026-03-02`. Fix:
```typescript
const fmt = (d: Date) => 
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

