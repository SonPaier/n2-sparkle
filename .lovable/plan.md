

# Mapa lokalizacji klientow

## Co robimy

Dodajemy przycisk "Mapa" w widoku Klienci, ktory otwiera drawer z mapa Leaflet pokazujaca wszystkie adresy klientow (z tabeli `customer_addresses` ktore maja lat/lng).

## UI

- Przycisk "Mapa" obok przycisku "Dodaj" w headerze
- Drawer: na mobile 100% width, na desktop 80% width z pelnym overlay
- Tooltip na markerze: linia 1 = nazwa klienta, linia 2 = nazwa obiektu + miasto
- Klikniecie markera otwiera drawer edycji klienta (ten sam co teraz)

## Plan techniczny

### 1. Nowy komponent `CustomersMapDrawer.tsx`

- Drawer (vaul) z props: `open`, `onClose`, `addresses` (tablica z lat, lng, customerName, addressName, city, customerId), `onCustomerClick(customerId)`
- Wewnatrz: mapa Leaflet (ten sam wzorzec co CalendarMap -- init map, markery, fitBounds)
- Markery z jednym kolorem (np. indigo `#6366f1`)
- Tooltip: linia 1 = nazwa klienta, linia 2 = nazwa obiektu + miasto
- Na mobile: drawer direction="bottom" z h-[100dvh], na desktop: direction="right" z w-[80vw]
- Reuse tych samych CSS klas tooltipow co CalendarMap

### 2. Zmiana w `CustomersView.tsx`

- Dodanie przycisku "Mapa" (ikona MapPin) w headerze obok "Dodaj"
- Stan `mapOpen` do kontroli drawera
- Przygotowanie danych adresow: join `addressMap` + `customers` aby miec nazwe klienta przy kazdym adresie
- Fetch adresow rozszerzony o `lat, lng` (obecnie pobieramy tylko `name, city`)
- `onCustomerClick` -> zamkniecie mapy + otwarcie CustomerEditDrawer

### Pliki do zmiany/utworzenia

- **Nowy**: `src/components/admin/CustomersMapDrawer.tsx`
- **Edycja**: `src/components/admin/CustomersView.tsx` (przycisk, stan, dane adresow z lat/lng)

