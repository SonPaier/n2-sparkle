

## Plan

### 1. Database migration: Add fields to `reminders` table

```sql
ALTER TABLE public.reminders ADD COLUMN assigned_employee_id uuid;
ALTER TABLE public.reminders ADD COLUMN visible_for_employee boolean NOT NULL DEFAULT false;
```

No FK to employees table (consistent with `assigned_employee_ids` on calendar_items being plain UUIDs). RLS already allows employees to SELECT reminders for their instance.

### 2. Update `AddEditReminderDrawer.tsx` — add employee selector + visibility checkbox

- Add an employee dropdown (fetch from `employees` table for the instance)
- When an employee is selected, show a checkbox: "Przypomnienie widoczne dla pracownika"
- Save `assigned_employee_id` and `visible_for_employee` to the reminder
- Load these fields when editing

### 3. Update `useReminders.ts` — include new fields

- Add `assigned_employee_id` and `visible_for_employee` to `Reminder` interface
- Include them in save/recurring-copy logic
- Fetch employee names for display (join employee name)

### 4. Update `RemindersView.tsx` — show assigned employee badge

- Display assigned employee name as a badge on reminder cards

### 5. Create `EmployeeDashboard.tsx` component

A simplified dashboard with 2 columns: Zlecenia and Przypomnienia.

**Date range**: Next 3 business days from today (skip weekends). E.g., Wednesday → Wed, Thu, Fri, Mon, Tue.

**Zlecenia column**:
- Fetch `calendar_items` for the config's `column_ids` within the date range
- Filter only items where the current user's employee ID is in `assigned_employee_ids`
- Need to resolve which employee ID belongs to this user — use the employees assigned to items in the config columns, or find by matching. Simpler: fetch all items for the columns, then filter client-side by `assigned_employee_ids` containing any employee that this user manages.
- Actually, since we don't have a direct user→employee mapping, we'll fetch ALL items for the configured columns within date range, and show them all (same as the calendar view shows). The user sees only their columns' items.
- Clicking opens the same `CalendarItemDetailsDrawer`.

**Przypomnienia column**:
- Fetch reminders where `assigned_employee_id` is in the list of employee IDs from the config's items AND `visible_for_employee = true`
- Actually simpler: fetch reminders for the instance where `visible_for_employee = true` and the employee is assigned. But we need to know which employee ID maps to this user.
- Best approach: fetch ALL reminders for the instance where `visible_for_employee = true`, then on the employee page, filter by `assigned_employee_id` matching employees that appear in items assigned to the user's columns. 
- Even simpler: just show all reminders with `visible_for_employee = true` for the instance. The admin controls visibility per employee.
- No drawer on click, but show checkbox to mark as done.

Same card styles as admin dashboard (`OrderCard`, `ReminderCard`).

### 6. Update `EmployeeCalendarPage.tsx`

- Add `'dashboard'` to `EmployeeView` type, place it first in sidebar nav (above Kalendarz)
- Import and render `EmployeeDashboard` when `currentView === 'dashboard'`
- Pass `instanceId`, `config`, `hidePrices`, column IDs, and item click handler

### Files to modify:
- **New migration** — add columns to reminders
- **`src/hooks/useReminders.ts`** — add new fields to interface and save logic
- **`src/components/admin/reminders/AddEditReminderDrawer.tsx`** — employee selector + visibility checkbox
- **`src/components/admin/reminders/RemindersView.tsx`** — show employee badge
- **New: `src/components/employee/EmployeeDashboard.tsx`** — simplified 2-column dashboard
- **`src/pages/EmployeeCalendarPage.tsx`** — add dashboard view to sidebar and routing

