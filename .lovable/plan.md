

## Plan

### 1. Scroll to top on view change (EmployeeCalendarPage)
Add a `useEffect` in `EmployeeCalendarPage.tsx` that scrolls the main content container to the top whenever `currentView` changes. Use a ref on the `<main>` element.

### 2. Add `created_by_user_id` to protocols table
- Database migration: add `created_by_user_id uuid` column to `protocols` table.
- In `CreateProtocolForm.tsx`, pass the current user's ID when creating a protocol. Also, resolve the employee name from the `employees` table (via `linked_user_id`) and auto-fill `prepared_by` with the employee's name.

### 3. Fix video upload stuck at 0%
The `compressVideo` function uses `MediaRecorder` + `captureStream` which often hangs on mobile (autoplay restrictions, unsupported codecs). Fix by adding a timeout to `compressVideo` -- if it doesn't resolve within 10 seconds, fall back to uploading the original file. Also skip compression entirely for files under 50MB to simplify.

### 4. Fix "Protokół" button closing drawer without opening protocol form (employee dashboard view)
The `CreateProtocolForm` component is only rendered inside the `kalendarz` view branch but `onAddProtocol` is also used from the `dashboard` view. Move the `CreateProtocolForm` rendering outside the view-specific blocks so it's always available. Also needs to be done for the protocol form open/close state.

### 5. Fix protocol form layout -- fixed header and fixed bottom bar
Update `CreateProtocolForm.tsx` to use a flex column layout with:
- Fixed header (sticky top with title + close button)
- Scrollable content area (flex-1 overflow-y-auto)
- Fixed bottom bar with action buttons at 50% width each
Model this after `CalendarItemDetailsDrawer`'s layout pattern.

### 6. If protocol already exists for calendar item, open existing protocol
In the `onAddProtocol` handler (in `EmployeeCalendarPage.tsx` and `Dashboard.tsx`), before opening the create form, query the `protocols` table for an existing protocol linked to the `calendar_item_id`. If found, open it in edit mode instead of create mode.

### 7. Fix intermittent data disappearing on employee dashboard
The `EmployeeDashboard` component recalculates `businessDays` from `workingHours`. When navigating away and back, if `workingHours` is briefly `undefined` during re-fetch, the component may render with empty dates. Add a guard to preserve the previous data while loading, or use `useMemo` with stable defaults.

### 8. Rename "Twój dzień" to "Mój dzień" in employee view
Update the nav items in `EmployeeCalendarPage.tsx` (lines 338, 575) and the heading in `EmployeeDashboard.tsx` (line 216).

### Technical details

**Database migration:**
```sql
ALTER TABLE protocols ADD COLUMN created_by_user_id uuid;
```

**Video compression timeout** in `mediaUtils.ts`:
Wrap the `compressVideo` promise with a `Promise.race` against a 10-second timeout that resolves with the original file.

**Protocol existence check** -- query `protocols` table by `calendar_item_id` before deciding create vs edit mode. Store found protocol ID in state for passing to `CreateProtocolForm` as `editingProtocolId`.

**Scroll reset** -- `useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [currentView])`.

**Files to modify:**
- `src/pages/EmployeeCalendarPage.tsx` -- scroll fix, protocol form placement, existing protocol check, rename label
- `src/components/employee/EmployeeDashboard.tsx` -- rename heading, fix data flash
- `src/components/media/mediaUtils.ts` -- video compression timeout
- `src/components/protocols/CreateProtocolForm.tsx` -- fixed header/footer layout, auto-fill employee name, save `created_by_user_id`
- `src/pages/Dashboard.tsx` -- existing protocol check
- Database migration for `created_by_user_id`

