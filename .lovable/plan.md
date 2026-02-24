

## Plan: Replace expandable rows with details drawer + add title column

### Changes to `src/components/admin/SettlementsView.tsx`

**1. Remove expandable row functionality:**
- Remove `expandedRows`, `servicesCache`, `addressCache`, `loadingRows` states and the `toggleExpand` function
- Remove `ChevronDown`, `ChevronRight` icon imports
- Remove the expanded row `<TableRow>` block entirely
- Remove `onClick={() => toggleExpand(order.id)}` from table rows

**2. Add details drawer state:**
- Add `detailsItem` state (`CalendarItem | null`) to track which item's drawer is open
- Add `detailsDrawerOpen` boolean state

**3. Add "Tytuł" column (2nd position, max-w 200px):**
- Add `title` to the query's select and `CalendarItemRow` interface
- Add `<TableHead className="w-[200px] max-w-[200px]">Tytuł</TableHead>` after "Nr"
- Add `<TableCell className="max-w-[200px] truncate">{order.title}</TableCell>` in the row
- Update all `colSpan` values from 7 to 8

**4. Wire "Szczegóły" menu item to open the drawer:**
- On "Szczegóły" click: map the `CalendarItemRow` to a `CalendarItem` shape (adding `title`, `start_time`, `end_time` with defaults), set `detailsItem` and open the drawer

**5. Render `CalendarItemDetailsDrawer`:**
- Import `CalendarItemDetailsDrawer` and `CalendarItem` type
- Render at the bottom with `item={detailsItem}`, `open={detailsDrawerOpen}`, `onClose`, `columns={[]}`, `instanceId`
- Wire `onStatusChange` to call `changeStatus` and refresh

### Technical notes
- The `CalendarItemDetailsDrawer` expects a `CalendarItem` which has `title`, `start_time`, `end_time` -- the current `CalendarItemRow` doesn't have these. We need to add `title`, `start_time`, `end_time` to the query select and interface.
- The drawer's `columns` prop can be `[]` since we don't need column info in this context.
- The row click will no longer expand -- rows become non-interactive (no cursor-pointer).

