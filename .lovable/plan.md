

## Problem

Multi-day orders (with `end_date`) are only matched by `item_date`, so an order starting Sunday (March 1) with `end_date` Wednesday (March 3) doesn't appear on Tuesday's "Mój dzień" or calendar map because the query filters `item_date >= today`.

The fix is needed in 3 places:

## Changes

### 1. `DashboardOverview.tsx` — Admin "Mój dzień" query (line ~82-91)

Current query: `.gte('item_date', fetchDateStart).lte('item_date', fetchDateEnd)`

Change to: fetch items where the date range overlaps the display range. Use `.or()` filter:
- `item_date` falls within range (existing behavior), OR  
- `end_date` is not null AND `item_date <= fetchDateEnd` AND `end_date >= fetchDateStart`

Simplest approach: `.lte('item_date', fetchDateEnd)` and add `.or('end_date.gte.{fetchDateStart},item_date.gte.{fetchDateStart}')` — i.e., include item if `item_date >= start` OR `end_date >= start`.

Also update the `dashboardItems` filter (line 220) to check if the item's date range overlaps any working day, not just `workingDays.includes(i.item_date)`.

### 2. `EmployeeDashboard.tsx` — Employee "Mój dzień" query (line ~102-110)

Same pattern: change `.gte('item_date', dateStart).lte('item_date', dateEnd)` to include multi-day items whose range overlaps the display window. Also add `end_date` to the select fields.

### 3. `CalendarMapPanel.tsx` — Calendar map filter (line ~31-53)

The `filteredItems` memo checks only `item.item_date`. Update to consider `item.end_date`: an item is visible on a given day if `item_date <= day <= end_date` (or `end_date` is null and `item_date == day`).

### Query Strategy

For all three, the overlap condition for date range `[displayStart, displayEnd]` with item range `[item_date, end_date ?? item_date]` is:

```sql
item_date <= displayEnd AND (end_date >= displayStart OR item_date >= displayStart)
```

In Supabase JS:
```ts
.lte('item_date', fetchDateEnd)
.or(`end_date.gte.${fetchDateStart},item_date.gte.${fetchDateStart}`)
```

For the client-side filters (dashboardItems, CalendarMapPanel), check overlap with each target day similarly.

