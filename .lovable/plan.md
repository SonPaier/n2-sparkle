

## Plan: "Brak klienta" empty state + auto-fill after adding new customer + white background for selected customer

### Changes overview

1. **CustomerSearchInput: "Brak klienta w bazie" empty state with "Dodaj" button**
   - When search returns 0 results and query >= 2 chars and not searching, show a dropdown item with "Brak klienta w bazie" text and a large "Dodaj" button
   - Add a new prop `onAddNew?: () => void` to trigger opening the new customer drawer
   - Update `showDropdown` logic to also show when results are empty (not just when results > 0 or searching)

2. **CustomerSearchInput: White background for selected customer**
   - Change `bg-muted/30` to `bg-white` on the selected customer display (line 109)

3. **AddCalendarItemDialog: Wire up "Dodaj" flow**
   - Add state for a "new customer" drawer (`addCustomerOpen`)
   - Pass `onAddNew` to `CustomerSearchInput` that opens `CustomerEditDrawer` in `isAddMode`
   - Add a new callback prop `onCustomerCreated` to `CustomerEditDrawer` that returns the created customer's ID
   - After save in `CustomerEditDrawer`, fetch the created customer + their first address, call `onCustomerCreated` with the data
   - In `AddCalendarItemDialog`, when `onCustomerCreated` fires, set `customerId`, `customerName`, `customerPhone`, `customerEmail`, and `customerAddressId`

4. **CustomerEditDrawer: Add `onCustomerCreated` callback**
   - New optional prop: `onCustomerCreated?: (customer: { id, name, phone, email, company, nip }, firstAddressId?: string) => void`
   - In `handleSaveCustomer`, after successful save in add mode, call `onCustomerCreated` with the saved customer data and the first address ID from `syncAddresses`
   - Modify `syncAddresses` to return the first inserted address ID

### Technical details

**CustomerSearchInput.tsx** changes:
- Add prop `onAddNew?: () => void`
- Change `showDropdown` to: `open && query.length >= 2 && (results.length > 0 || searching || (!searching && results.length === 0))`
  - Simplifies to: `open && query.length >= 2`
- When `results.length === 0 && !searching`, render empty state with "Brak klienta w bazie" + "Dodaj" button
- Change selected customer background from `bg-muted/30` to `bg-white`

**CustomerEditDrawer.tsx** changes:
- Add optional prop `onCustomerCreated?: (customer: SelectedCustomer, firstAddressId?: string) => void`
- In `handleSaveCustomer` (add mode branch), after insert/update + syncAddresses, call `onCustomerCreated` with the customer data and first address ID
- Modify `syncAddresses` to return the ID of the first active address

**AddCalendarItemDialog.tsx** changes:
- Add `addCustomerOpen` state
- Render a second `CustomerEditDrawer` in add mode, with `onCustomerCreated` callback
- Pass `onAddNew={() => setAddCustomerOpen(true)}` to `CustomerSearchInput`
- In `onCustomerCreated` handler: set customer fields + address ID, close the add drawer

