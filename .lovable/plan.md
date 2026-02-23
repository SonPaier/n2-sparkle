
# Taby "Dane" i "Zlecenia" w drawerze klienta

## Co robimy

Dodajemy dwa taby w drawerze szczegulow klienta (`CustomerEditDrawer`):
- **Dane** -- obecna zawartosc (formularz edycji / podglad danych)
- **Zlecenia** -- lista wszystkich zlecen (calendar_items) powiazanych z tym klientem, od najnowszych

Taby widoczne tylko przy podgladzie/edycji istniejacego klienta (nie w trybie dodawania nowego).

## Karta zlecenia

Kazda karta zawiera:
- Data zlecenia
- Nazwa adresu (z customer_addresses)
- Adres (ulica, miasto)
- Lista uslug (z calendar_item_services + unified_services)
- Kwota (price)
- Status (badge kolorowy)
- Link do protokolu publicznego (jesli istnieje)

Sortowanie: od najnowszych (item_date DESC).

## Plan techniczny

### 1. Nowy komponent `CustomerOrderCard.tsx`

Osobny komponent karty zlecenia.

Props:
- `itemDate: string` -- data zlecenia
- `status: string` -- status zlecenia
- `addressName?: string` -- nazwa obiektu
- `addressStreet?: string` -- ulica
- `addressCity?: string` -- miasto
- `services: { name: string; price?: number }[]` -- lista uslug
- `price?: number` -- kwota calkowita
- `protocolPublicToken?: string` -- token do publicznego linku protokolu

Wyglad:
- Gora: data (sformatowana) + badge statusu (kolorowy wg statusu)
- Srodek: nazwa adresu, adres (ulica, miasto), lista uslug
- Dol: kwota + link "Protokol" (otwiera w nowej karcie)

### 2. Nowy komponent `CustomerOrdersTab.tsx`

Props: `customerId: string`, `instanceId: string`

Logika:
- Fetch `calendar_items` where `customer_id = customerId`, order by `item_date DESC`
- Fetch powiazane `calendar_item_services` + `unified_services` (nazwy uslug)
- Fetch `customer_addresses` po `customer_address_id` (nazwa, ulica, miasto)
- Fetch `protocols` po `calendar_item_id` (public_token)
- Renderowanie listy komponentow `CustomerOrderCard`

### 3. Zmiana w `CustomerEditDrawer.tsx`

- Gdy `!isAddMode`:
  - Header (nazwa klienta, przyciski sms/tel, X) zostaje nad tabami
  - Pod headerem: Tabs z dwoma tabami "Dane" i "Zlecenia" (uzycie `AdminTabsList` / `AdminTabsTrigger`)
  - Tab "Dane": obecna zawartosc (view mode + edit mode)
  - Tab "Zlecenia": komponent `CustomerOrdersTab`
  - Footer (Edytuj/Zapisz/Anuluj) widoczny tylko gdy aktywny tab "Dane"
- Gdy `isAddMode`: bez tabow, dzialanie jak dotychczas

### Pliki

- **Nowy**: `src/components/admin/CustomerOrderCard.tsx`
- **Nowy**: `src/components/admin/CustomerOrdersTab.tsx`
- **Edycja**: `src/components/admin/CustomerEditDrawer.tsx`
