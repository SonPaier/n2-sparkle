
# Zlecenia tab - edycja, zwijanie przeszlych, biala karta

## Zmiany

### 1. CustomerOrderCard - biala karta + ikona edycji

- Zmiana tla karty z domyslnego `border rounded-lg p-3` na `bg-white border rounded-lg p-3 shadow-sm`
- Nowy prop `onEdit?: () => void` - jesli podany, wyswietla ikone olowka (Pencil) w prawym gornym rogu obok badge statusu
- Nowy prop `calendarItemId: string` - potrzebny do identyfikacji zlecenia

### 2. CustomerOrdersTab - podzial na przyszle/przeszle + edycja zlecenia

- Podzial `orders` na dwie listy: `futureOrders` (item_date >= dzis) i `pastOrders` (item_date < dzis)
- Przyszle zlecenia wyswietlane zawsze
- Przeszle zlecenia domyslnie zwiniete, pod przyszlymi przycisk "Zobacz przeszle (N)" z chevronem - klikniecie rozwija/zwija
- Nowy state `showPast: boolean` (domyslnie false)
- Nowy state `editingOrderId: string | null` - otwiera `AddCalendarItemDialog` w trybie edycji
- Fetch `calendar_columns` i danych zlecenia do edycji (editingItem) po kliknieciu olowka
- Po zapisie (`onSuccess`): odswiezenie listy zlecen (`fetchOrders()`)
- Nowe propsy potrzebne: `instanceId` (juz jest)

### 3. Integracja z AddCalendarItemDialog

- CustomerOrdersTab importuje `AddCalendarItemDialog` i `EditingCalendarItem`
- Po kliknieciu olowka na karcie: fetch pelnych danych zlecenia z `calendar_items` (title, item_date, start_time, end_time, column_id, admin_notes, price, customer_id, customer_address_id, assigned_employee_ids, status, customer_name, customer_phone, customer_email)
- Fetch `calendar_columns` (active, ordered)
- Otwarcie drawera edycji z pre-wypelnionym `editingItem`
- `onSuccess` -> `fetchOrders()` aby odswiezyc liste

## Pliki do edycji

- `src/components/admin/CustomerOrderCard.tsx` - biala karta, prop onEdit, ikona olowka
- `src/components/admin/CustomerOrdersTab.tsx` - podzial przyszle/przeszle, przycisk zwijania, integracja z AddCalendarItemDialog

## Szczegoly techniczne

### CustomerOrderCard
```
interface CustomerOrderCardProps {
  // ... istniejace
  onEdit?: () => void;  // nowy
}
```
- Klasa karty: `bg-white border rounded-lg p-3 space-y-2 shadow-sm`
- Ikona Pencil w wierszu z data i statusem (miedzy data a badge)

### CustomerOrdersTab
- `const today = format(new Date(), 'yyyy-MM-dd')`
- `futureOrders = orders.filter(o => o.itemDate >= today)`
- `pastOrders = orders.filter(o => o.itemDate < today)`
- Render: futureOrders karty -> (jesli pastOrders.length > 0) przycisk "Zobacz przeszle (count)" -> warunkowo pastOrders karty
- Po kliknieciu olowka: fetch danych zlecenia, otwarcie AddCalendarItemDialog z editingItem
- Columns fetchowane raz przy uzyciu useEffect
