

## Plan

### 1. Rename status "Potwierdzone" → "Do wykonania" everywhere

Files to update:
- **`CalendarItemDetailsDrawer.tsx`**: `statusLabels.confirmed` → `'Do wykonania'`, `statusColors.confirmed` stays same. All dropdown menu items showing "Potwierdzone" → "Do wykonania". Footer button labels referencing "Potwierdzone" → "Do wykonania".
- **`AdminCalendar.tsx`**: Legend label "Potwierdzone" → "Do wykonania" (line 1212).
- **`CustomerOrderCard.tsx`**: `statusConfig.confirmed.label` → `'Do wykonania'`.
- **`SettlementsView.tsx`**: `STATUS_CONFIG.confirmed.label` → `'Do wykonania'` (line 66).

### 2. Dashboard: all fonts black

In **`DashboardOverview.tsx`**, change all `text-muted-foreground` on card content text (time, customer, address, employee, reminder deadline, type, price) to `text-foreground` or remove the muted class. Keep column headers/empty text muted.

### 3. Dashboard: "Po terminie" as red pill with white font

In **`DashboardOverview.tsx`** `PaymentCard`, replace the current `<span className="text-xs text-destructive ...">` with a proper pill: `<span className="text-xs bg-red-600 text-white rounded-full px-2 py-0.5 font-medium whitespace-nowrap">`.

### 4. Drawer: unify "Dodaj protokół" and "Dodaj zdjęcie" buttons + hide "Zdjęcia" header when no photos

In **`CalendarItemDetailsDrawer.tsx`**:
- Remove the `<div className="text-sm font-medium">Zdjęcia</div>` header. Only show "Zdjęcia" label if `itemPhotos.length > 0`.
- Change both "Dodaj protokół" button and the photo uploader's add button to plain `variant="outline"` buttons with white bg, stacked vertically (they already are mostly, just ensure consistent styling).
- Both buttons: `variant="outline" className="w-full bg-white"`, placed one below the other.

### 5. Employee view: hide prices when `visible_fields.price === false`

The `employee_calendar_configs` table has a `visible_fields` JSON column with a `price` boolean. When `price: false`:

**`EmployeeCalendarPage.tsx`**:
- Read `config.visible_fields.price` (default true).
- Pass `hidePrices` prop to `CalendarItemDetailsDrawer`.

**`CalendarItemDetailsDrawer.tsx`**:
- Add optional `hidePrices?: boolean` prop.
- When `hidePrices === true`, hide:
  - Price section (line ~702-706)
  - Invoice "Wystaw FV" button and invoice list (lines ~755-779)
  - SMS rozliczenie button that includes price (lines ~782-801)
  - Price in SMS message text

**`CustomerOrderCard.tsx`**:
- Add optional `hidePrices?: boolean` prop.
- When true, hide service prices, total price row.

**`CustomerOrdersTab.tsx`**:
- Accept and pass `hidePrices` prop through to `CustomerOrderCard` and `CalendarItemDetailsDrawer`.

Places where prices appear that need conditional hiding:
1. `CalendarItemDetailsDrawer`: price field, invoice section, SMS rozliczenie
2. `CustomerOrderCard`: service prices, total price
3. `CustomerOrdersTab`: passes price to `CustomerOrderCard`

The admin Dashboard page is NOT affected (admin always sees prices). Only employee calendar flow uses `visible_fields`.

