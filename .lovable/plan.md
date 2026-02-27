

## Plan: Modyfikacja drawera zlecenia

### 1. Adres serwisowy zawsze widoczny + dwustronna synchronizacja

Modyfikuję istniejący `CustomerAddressSelect.tsx` — nie tworzę nowego komponentu.

**Zmiany w `CustomerAddressSelect.tsx`**:
- Usunąć `if (!customerId || addresses.length === 0) return null` — komponent renderuje się ZAWSZE
- Gdy brak `customerId`: pokazać pole wyszukiwania adresów po ulicy/mieście we WSZYSTKICH adresach instancji (dropdown jak w `CustomerSearchInput`)
- Gdy jest `customerId`: pokazać Select z adresami tego klienta (obecne zachowanie)
- Dodać callback `onCustomerResolved?: (customerId: string, customerData: SelectedCustomer) => void` — wywoływany gdy użytkownik wybierze adres z wyszukiwarki globalnej, aby automatycznie ustawić klienta
- Wyszukiwanie: query do `customer_addresses` JOIN `customers` — zwraca adres + dane klienta

**Zmiany w `AddCalendarItemDialog.tsx`**:
- `CustomerAddressSelect` dostaje nowy prop `onCustomerResolved` — ustawia `customerId`, `customerName`, `customerPhone`, `customerEmail`
- Gdy `handleSelectCustomer` (wybór klienta) → adresy się ładują automatycznie (obecna logika auto-select default)
- Gdy `handleClearCustomer` → czyści też adres (już działa)
- **Ważne**: w trybie edycji (`isEditMode`) NIE otwierać dropdownów autocomplete automatycznie — pola wyświetlają wartość, dropdown otwiera się dopiero po interakcji użytkownika

### 2. Rename "Typ zlecenia" → "Długość zlecenia"

W `AddCalendarItemDialog.tsx` linia 655:
- `Typ zlecenia` → `Długość zlecenia`
- `Jednodniowa` → `Jednodniowe`
- `Wielodniowa` → `Wielodniowe`

### 3. Pills pracowników — fioletowe, białe, bez avatara

W `AssignedEmployeesChips.tsx`:
- Usunąć `Avatar` komponent z chipa
- Chip: `bg-primary text-white rounded-full px-3 py-1`
- X button: `text-white/80 hover:text-white`

### 4. Bug: drawer pracowników pod drawerem zlecenia (mobile)

W `EmployeeSelectionDrawer.tsx`:
- Mobile `DrawerContent`: dodać `z-[1100]` (drawer zlecenia ma `z-[1000]`)
- Desktop `SheetContent` już ma `z-[1000]` — zmienić na `z-[1100]`

### 5. Bug: synchronizacja pills ↔ drawer pracowników

W `EmployeeSelectionDrawer.tsx`:
- Dodać `useEffect` synchronizujący `localSelected` z `selectedIds` gdy `open` zmieni się na `true`:
```typescript
useEffect(() => {
  if (open) setLocalSelected(selectedIds);
}, [open, selectedIds]);
```

### 6. Cena netto — 1/3 szerokości

W `AddCalendarItemDialog.tsx` linia 774: Input ceny dostaje `className="bg-white w-1/3"`

### Pliki do edycji:
1. `src/components/admin/CustomerAddressSelect.tsx` — przerobić na zawsze widoczny z wyszukiwarką globalną
2. `src/components/admin/AddCalendarItemDialog.tsx` — synchro, rename, cena 1/3
3. `src/components/admin/AssignedEmployeesChips.tsx` — fioletowe pills
4. `src/components/admin/EmployeeSelectionDrawer.tsx` — z-index + sync fix

