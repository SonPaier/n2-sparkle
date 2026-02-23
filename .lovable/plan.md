
# Filtry mapy klientow

## Co robimy

Dodajemy filtry do widoku mapy klientow. Filtry pozwalaja zawezic pinezki na mapie wg:
1. **Klient** -- wyszukiwarka klienta (istniejacy `CustomerSearchInput`), pokazuje tylko jego lokalizacje
2. **Uslugi** -- wybor uslug (istniejacy `ServiceSelectionDrawer`), pokazuje adresy klientow ktorzy mieli te uslugi w rezerwacjach

Nad mapa wyswietlamy aktywne filtry jako chipy. Tooltip na markerach bez zmian.

## Uklad UI

### Desktop
- Drawer mapy: **100% width** (zmiana z 80vw), h-full, direction right
- Wewnatrz: **flex-row** -- lewy panel filtrow (min-w-[250px], w-[20%]) + prawa czesc z mapa (flex-1)
- Nad mapa: pasek z aktywnymi filtrami (chipy z X do usuwania)

### Mobile
- Drawer mapy: 100dvh jak dotychczas
- W headerze mapy: przycisk "Filtry" otwierajacy **osobny drawer** (direction right, 100% height)
- Drawer filtrow: header "Filtry" z X, zawartosc filtrow, footer z przyciskiem "Zapisz" (fixed bottom)
- Po kliknieciu "Zapisz" drawer filtrow sie zamyka, mapa jest przefiltrowana
- Nad mapa: pasek z aktywnymi filtrami (chipy)

## Plan techniczny

### 1. Nowy komponent `CustomerMapFilters.tsx`

Komponent z filtrami -- uzyty zarowno w panelu bocznym (desktop) jak i w drawerze (mobile).

Props:
- `instanceId: string`
- `selectedCustomer: SelectedCustomer | null`
- `onCustomerSelect: (customer: SelectedCustomer) => void`
- `onCustomerClear: () => void`
- `selectedServiceIds: string[]`
- `onServicesConfirm: (ids: string[], duration: number, services: ServiceWithCategory[]) => void`
- `selectedServiceNames: string[]` -- nazwy wybranych uslug do wyswietlenia

Zawartosc:
- Sekcja "Klient": `CustomerSearchInput`
- Sekcja "Uslugi": przycisk otwierajacy `ServiceSelectionDrawer`, pod spodem chipy wybranych uslug z X

### 2. Nowy komponent `CustomerMapFiltersDrawer.tsx` (mobile)

Drawer (vaul, direction right, h-full) z:
- Header: "Filtry" + X
- Content: `CustomerMapFilters` (ze stanem tymczasowym)
- Footer: przycisk "Zapisz" (fixed bottom)

Stan filtrow jest tymczasowy -- kopia aktualnych filtrow, dopiero po "Zapisz" aplikuje sie do mapy.

### 3. Zmiana w `CustomersMapDrawer.tsx`

- Desktop: drawer width zmiana na `w-full` (z `w-[80vw]`)
- Desktop: layout flex-row -- lewy panel `CustomerMapFilters` (min-w-[250px] w-[20%] border-r) + prawa czesc (flex-1 flex-col) z headerem, paskiem filtrow i mapa
- Mobile: przycisk "Filtry" w headerze otwiera `CustomerMapFiltersDrawer`
- Nad mapa: pasek z aktywnymi filtrami (chipy -- nazwa klienta, nazwy uslug)
- Nowe props: filtrowane `addresses` (juz przefiltrowane z CustomersView), plus stan filtrow i callbacki

### 4. Zmiana w `CustomersView.tsx`

- Nowy stan: `mapFilterCustomer: SelectedCustomer | null`, `mapFilterServiceIds: string[]`, `mapFilterServiceNames: string[]`
- Nowa logika: gdy `mapFilterServiceIds` niepuste -- fetch `calendar_item_services` + `calendar_items` aby znalezc `customer_id` powiazanych z tymi uslugami
- Filtrowanie `mapAddresses` przed przekazaniem do `CustomersMapDrawer`:
  - Jesli wybrany klient -- tylko jego adresy
  - Jesli wybrane uslugi -- tylko adresy klientow z tymi uslugami
  - Oba filtry laczone AND
- Przekazanie filtrow i callbackow do `CustomersMapDrawer`

### Pliki

- **Nowy**: `src/components/admin/CustomerMapFilters.tsx`
- **Nowy**: `src/components/admin/CustomerMapFiltersDrawer.tsx`
- **Edycja**: `src/components/admin/CustomersMapDrawer.tsx`
- **Edycja**: `src/components/admin/CustomersView.tsx`
