

## Plan: Warning background when edit date differs from entry date

When an audit log entry shows a change made on a **different day** than the original entry date (the day header), highlight it with a warning/amber background instead of the standard purple.

### Logic

Compare `created_at` date of each update/delete entry against the `entry_date` (the day header). If they differ → use amber/warning background (`bg-amber-50 dark:bg-amber-900/10`) instead of `bg-primary/5`.

### Change in `TimeEntryAuditDrawer.tsx`

In the `AuditEntry` component, extract the date portion from `entry.created_at` and compare it to the parent group's `entry_date`. If different and entry is update/delete → apply warning background class.

Pass `groupDate` (the `entry_date` string) as a prop to `AuditEntry`, then:

```typescript
const changeDate = entry.created_at.slice(0, 10); // YYYY-MM-DD
const isDifferentDay = changeDate !== groupDate;

let bgClass = '';
if (isUpdate) bgClass = isDifferentDay ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-primary/5';
if (isDelete) bgClass = 'bg-destructive/5';
```

Single file change: `src/components/admin/employees/TimeEntryAuditDrawer.tsx`.

