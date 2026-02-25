

## Plan: Poprawki UI drawera przypomnień i listy

### Drawer "Nowe przypomnienie" — zmiany

1. **Białe tło, ciemne bordery inputów** — SheetContent/DrawerContent gets `bg-card`, all Input/Textarea/SelectTrigger get `bg-white` class (matching AddCalendarItemDialog pattern)

2. **Usuń placeholder z Nazwa** — remove `placeholder="np. Badania lekarskie — Bartek"`

3. **Label "Przypomnij ile dni przed *"** — rename from "Przypomnij X dni przed", update helper text accordingly

4. **Rename "Typ przypomnienia" → "Kategoria przypomnienia"** — also rename "Typy" button in RemindersView header to "Kategorie", and ReminderTypesDialog title to "Kategorie przypomnień", placeholder "Nowa kategoria..."

5. **"Deadline" → "Do kiedy"** — label rename

6. **Datepicker** — replace `<Input type="date">` with Popover+Calendar (same pattern as AddCalendarItemDialog), with `bg-white` button, `pointer-events-auto`

7. **Usuń placeholder z Notatki** — remove `placeholder="Dodatkowe informacje..."`

8. **Powiadomienia — przebudowa**:
   - Remove the `bg-muted/30` box and `border` wrapper — render checkboxes as regular form fields
   - Remove emoji icons (📧, 📱)
   - Remove "(adres biura)" and "(numer usera)" hints
   - 4 checkboxes:
     - "Wyślij mi e-mail"
     - "Wyślij mi SMS"
     - "Wyślij e-mail do klienta" (shown only when `customerId` is set)
     - "Wyślij SMS do klienta" (shown only when `customerId` is set)
   - Add two new state fields: `notifyCustomerEmail`, `notifyCustomerSms`
   - Save these new fields to DB (requires adding columns — but since notifications aren't implemented yet in v1, we can store them in the existing `notify_email`/`notify_sms` for owner + add `notify_customer_email`/`notify_customer_sms` columns)

9. **Fixed header + footer**:
   - Header: sticky/fixed top with X button (same pattern as AddCalendarItemDialog — `shrink-0`, border-b, X button with `p-2 rounded-full hover:bg-muted`)
   - Footer: sticky/fixed bottom with "Anuluj" (white/outline) + "Utwórz"/"Zapisz" buttons, plus "Usuń" when editing
   - Content area: `flex-1 overflow-y-auto`
   - Anuluj button: `variant="outline"` with `bg-white`

10. **Recurring box** — remove `bg-muted/30` wrapper styling, keep as regular fields

### RemindersView (lista) — zmiany

11. **Usuń ikonki 📧 i 📱** z listy przypomnień

12. **Zamień ikonkę cykliczności** — instead of `<RefreshCw>` icon, show a text Badge like `"Cykliczne: 20 dnia miesiąca"` or `"Cykliczne: co piątek"`. Build a helper function `getRecurringLabel(recurringType, recurringValue)` that returns human-readable text.

13. **Usuń ikonkę 👤** z customer badge

### Database migration

14. Add two new columns to `reminders` table:
   - `notify_customer_email boolean DEFAULT false`
   - `notify_customer_sms boolean DEFAULT false`

### Technical details

**AddEditReminderDrawer.tsx** — full restructure:
- Change outer SheetContent to `className="flex flex-col p-0 gap-0 bg-card"` with `hideCloseButton`
- Fixed header div with title + X button (matching AddCalendarItemDialog lines 598-608)
- Scrollable content: `<div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">`
- Fixed footer: `<div className="px-6 py-4 border-t border-border shrink-0 bg-card flex items-center justify-between">`
- Deadline datepicker: Popover with Calendar `mode="single"`, locale `pl`, `pointer-events-auto`
- New state: `notifyCustomerEmail`, `notifyCustomerSms`
- Notification checkboxes rendered as simple labeled checkboxes without wrapper box

**RemindersView.tsx** — list item changes:
- Remove `{r.notify_email && <span>📧</span>}` and SMS equivalent
- Replace `<RefreshCw>` icon with `<Badge>` containing recurring label text
- Helper: `getRecurringLabel(type, value)` → e.g. "Cykliczne: 20 dnia miesiąca" / "Cykliczne: co poniedziałek"

**ReminderTypesDialog.tsx** — rename:
- DialogTitle → "Kategorie przypomnień"
- Placeholder → "Nowa kategoria..."
- Empty state text update

**RemindersView.tsx header** — rename button "Typy" → "Kategorie"

