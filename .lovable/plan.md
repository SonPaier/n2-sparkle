

## Updated Plan: Add "Wypłata" row below monthly totals

The existing plan for the TimeEntriesView redesign (monthly grid by weeks) is extended with one addition:

### Additional row: Wypłata

Below the "SUMA MIESIĄCA" row, add a "Wypłata" row that calculates `(total_minutes / 60) * employee.hourly_rate` per employee. Show as e.g. `1 620 zł`. If employee has no `hourly_rate`, show `-`.

```text
 SUMA MIESIĄCA    |  180h      |  160h      |  148h      |
 WYPŁATA          | 1 620 zł   | 1 280 zł   |     -      |
```

This row is only visible when `settlement_type` is `'hourly'` (from `useWorkersSettings`). When `'per_order'`, hide it (consistent with existing logic from the settlement feature).

### Files to change
- `src/components/admin/employees/TimeEntriesView.tsx` — full rewrite as per the existing plan, plus the Wypłata row at the bottom using `useWorkersSettings` to check settlement type.

