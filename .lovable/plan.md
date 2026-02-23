

# Karta zlecenia klikalna - otwiera drawer szczegolow

## Co robimy
- Cala karta zlecenia (`CustomerOrderCard`) staje sie klikalna i otwiera `CalendarItemDetailsDrawer`
- Usuwamy olowek (Pencil) - edycja dostepna z poziomu drawera szczegolow
- Usuwamy `AddCalendarItemDialog` z `CustomerOrdersTab` - niepotrzebny

## Zmiany

### 1. CustomerOrderCard.tsx
- Dodac prop `onClick?: () => void`
- Usunac prop `onEdit` i przycisk olowka
- Caly div karty: `cursor-pointer`, `hover:border-primary/30`, `onClick`

### 2. CustomerOrdersTab.tsx
- Usunac import i uzycie `AddCalendarItemDialog`, `editingItem`, `editOpen`, `handleEditClick`
- Dodac state: `detailItem: CalendarItem | null`, `detailOpen: boolean`
- Po kliknieciu karty: fetch pelnych danych z `calendar_items` (id, title, item_date, end_date, start_time, end_time, column_id, status, admin_notes, price, customer_id, customer_address_id, assigned_employee_ids, customer_name, customer_phone, customer_email, photo_urls), zmapowac na `CalendarItem`, otworzyc drawer
- Dodac renderowanie `CalendarItemDetailsDrawer` z odpowiednimi propsami
- Po zamknieciu drawera odswiezyc liste zlecen (`fetchOrders`)

### 3. CalendarItemDetailsDrawer.tsx
- Zmiana stylu `addressStreet`: z `text-xs text-muted-foreground` na `text-sm text-foreground`

## Pliki do edycji
1. `src/components/admin/CustomerOrderCard.tsx`
2. `src/components/admin/CustomerOrdersTab.tsx`
3. `src/components/admin/CalendarItemDetailsDrawer.tsx`

