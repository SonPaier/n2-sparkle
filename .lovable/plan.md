

## Plan

### 1. Filter dashboard items by linked employee (backend-side)

**Problem**: EmployeeDashboard shows all calendar_items for configured columns. Roman (linked to user Robert) should only see items where his employee ID is in `assigned_employee_ids`.

**Solution**:
- In `EmployeeDashboard.tsx`, accept a new prop `linkedEmployeeId?: string`
- After fetching calendar_items, filter client-side by `assigned_employee_ids` containing the linked employee ID
- Better approach: look up `linked_user_id` in `employees` table from the current `auth.uid()`, then filter items
- In `EmployeeCalendarPage.tsx`, fetch the linked employee ID from `employees` table where `linked_user_id = auth.uid()` and pass it to `EmployeeDashboard`
- Filter the query: after fetching items, filter to only those where `assigned_employee_ids` contains the linked employee ID (Supabase JS doesn't support `@>` array contains easily, so filter client-side after fetch, or use `.contains('assigned_employee_ids', [employeeId])`)

**Implementation**: Use `.contains('assigned_employee_ids', [linkedEmployeeId])` on the Supabase query in `EmployeeDashboard.fetchData` to filter server-side.

### 2. Mobile bottom bar + sidebar redesign for EmployeeCalendarPage

**Current**: Mobile has a top header with hamburger menu that opens a slide-out sidebar.

**New design** (matching N2Wash pattern):
- Remove the mobile top header bar entirely
- Add a fixed bottom navigation bar (visible only on mobile) with 4 items:
  - Dashboard (LayoutDashboard icon)
  - Protokoły (ClipboardCheck icon)  
  - Kalendarz (Calendar icon)
  - Więcej (MoreHorizontal icon) — opens the sidebar overlay
- The sidebar (opened by "Więcej") contains all nav items + logout button
- Desktop sidebar remains unchanged

**Files to modify**:
- `src/pages/EmployeeCalendarPage.tsx` — add bottom bar, remove mobile header, restructure layout
- `src/components/employee/EmployeeDashboard.tsx` — add `linkedEmployeeId` prop and filter query
- `src/pages/EmployeeCalendarPage.tsx` — fetch linked employee ID on mount

### 3. Fetch linked employee ID

In `EmployeeCalendarPage.tsx`, after getting `instanceId`, query:
```sql
SELECT id FROM employees WHERE linked_user_id = auth.uid() AND instance_id = ?
```
Store as state, pass to `EmployeeDashboard` as prop.

### Summary of changes

| File | Change |
|------|--------|
| `EmployeeCalendarPage.tsx` | Fetch linked employee ID; remove mobile header; add bottom bar with 4 tabs; "Więcej" opens sidebar; pass linkedEmployeeId to dashboard |
| `EmployeeDashboard.tsx` | Add `linkedEmployeeId` prop; add `.contains()` filter to calendar_items query |

