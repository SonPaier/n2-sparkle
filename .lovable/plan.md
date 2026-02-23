
# Tworzenie zlecenia z pinezki na mapie

## Co robimy

1. Klikniecie pinezki na mapie **nie zamyka mapy** -- otwiera drawer klienta nad mapa
2. W headerze drawera klienta dodajemy ikone **nowego zlecenia** (CalendarPlus) obok SMS i telefon
3. Klikniecie ikony otwiera drawer `AddCalendarItemDialog` nad drawerem klienta z pre-wypelnionymi danymi:
   - Klient (id, name, phone, email) -- z kliknietej pinezki
   - Adres serwisowy (customer_address_id) -- z kliknietej pinezki
   - Uslugi -- z aktywnego filtra mapy (jesli sa)
4. Po dodaniu zlecenia: toast, zamkniecie drawera zlecenia, zamkniecie drawera klienta

## Plan techniczny

### 1. `CustomerMapAddress` -- dodanie `addressId`

Rozszerzamy interface w `CustomersMapDrawer.tsx` o `addressId: string`. Aktualizujemy builder `allMapAddresses` w `CustomersView.tsx` aby przekazywac `addr.id`.

### 2. `CustomersMapDrawer` -- zmiana sygnatury `onCustomerClick`

Z `(customerId: string)` na `(customerId: string, addressId: string)`. Marker click i tooltip click przekazuja oba parametry.

### 3. `CustomersView` -- nie zamykamy mapy, zapamietujemy addressId

- Zmiana handlera `onCustomerClick`: **nie** wywolujemy `setMapOpen(false)`, otwieramy drawer klienta, zapamietujemy `clickedAddressId` w nowym stanie
- Przekazujemy do `CustomerEditDrawer` nowe propsy: `prefilledAddressId`, `prefilledServiceIds`, `prefilledServiceNames`, `onNewOrderCreated`
- `onNewOrderCreated`: zamyka drawer klienta (i opcjonalnie refreshuje dane)

### 4. `CustomerEditDrawer` -- ikona nowego zlecenia + AddCalendarItemDialog

Nowe propsy:
- `prefilledAddressId?: string`
- `prefilledServiceIds?: string[]`
- `prefilledServiceNames?: string[]`
- `onNewOrderCreated?: () => void`

Zmiany:
- Import `CalendarPlus` z lucide-react
- W headerze (obok SMS i Phone, wiersz 298-306): nowa ikona `CalendarPlus` -- otwiera `newOrderOpen` state
- Nowy state: `newOrderOpen: boolean`, `columns: CalendarColumn[]`
- Fetch `calendar_columns` (active, ordered) po otwarciu drawera klienta
- Renderowanie `AddCalendarItemDialog` z:
  - `open={newOrderOpen}`
  - `instanceId`, `columns`
  - Nowe optional propsy do pre-fill (patrz punkt 5)
  - `onSuccess`: toast "Zlecenie dodane", `setNewOrderOpen(false)`, `onNewOrderCreated?.()`
- Ikona widoczna tylko gdy `!isAddMode && !isEditing`

### 5. `AddCalendarItemDialog` -- nowe optional propsy do pre-fill

Nowe propsy w interfejsie:
- `initialCustomerId?: string`
- `initialCustomerName?: string`
- `initialCustomerPhone?: string`
- `initialCustomerEmail?: string`
- `initialCustomerAddressId?: string`
- `initialServiceIds?: string[]`

W bloku inicjalizacji (linie 212-232, `else` branch gdy `!isEditMode`):
- Jesli `initialCustomerId` -- ustawiamy `customerId`, `customerName`, `customerPhone`, `customerEmail`
- Jesli `initialCustomerAddressId` -- ustawiamy `customerAddressId`
- Jesli `initialServiceIds?.length > 0` -- fetch `unified_services` po tych ID, ustawiamy `allServices`, `selectedServiceIds`, `serviceItems`, auto-generujemy `title`

Dodajemy te propsy do dependency array `useEffect`.

### Pliki do zmiany

- **Edycja**: `src/components/admin/CustomersMapDrawer.tsx` -- `addressId` w interface, zmiana callback
- **Edycja**: `src/components/admin/CustomersView.tsx` -- `addressId` w builderze, nie zamykaj mapy, nowe propsy
- **Edycja**: `src/components/admin/CustomerEditDrawer.tsx` -- ikona CalendarPlus, fetch columns, AddCalendarItemDialog
- **Edycja**: `src/components/admin/AddCalendarItemDialog.tsx` -- nowe optional propsy do pre-fill
