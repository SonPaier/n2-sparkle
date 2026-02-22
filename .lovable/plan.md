
# Modul mapy OpenStreetMap - zaktualizowany plan

## Podejscie do danych (bez dodatkowego fetch)

Zamiast osobnego fetch, mapa korzysta z tych samych `calendarItems` co kalendarz. Zmiany:

1. **Rozszerzenie zakresu fetch** - gdy mapa jest otwarta, `rangeEnd` zmieni sie z `+14 dni` na `+30 dni` (dla filtra "Miesiac")
2. **Rozszerzenie fetch adresow** - obecnie pobierane jest tylko `id, name` z `customer_addresses`. Dodamy `lat, lng, city` do tego samego zapytania i dopisze te pola do obiektow `CalendarItem`
3. **Filtrowanie client-side** - mapa dostaje cala tablice `calendarItems` i filtruje ja lokalnie (dzis/tydzien/miesiac/kolumna)
4. **Reaktywnosc** - drag&drop w kalendarzu aktualizuje `calendarItems` (optimistic update), wiec mapa od razu dostaje nowe dane przez props

## Zmiany w typach CalendarItem

Dodanie pol do interfejsu `CalendarItem`:
- `address_lat?: number | null`
- `address_lng?: number | null`  
- `address_city?: string | null`

## Zmiany w fetch adresow (Dashboard.tsx + EmployeeCalendarPage.tsx)

```text
Obecny fetch:
  customer_addresses.select('id, name')

Nowy fetch:
  customer_addresses.select('id, name, lat, lng, city')
  
+ mapowanie na item:
  item.address_lat = addressMap.get(id)?.lat
  item.address_lng = addressMap.get(id)?.lng
  item.address_city = addressMap.get(id)?.city
```

## Rozszerzenie zakresu dat

```text
Obecne:  rangeEnd = currentCalendarDate + 14 dni
Nowe:    rangeEnd = mapOpen ? currentCalendarDate + 30 dni : currentCalendarDate + 14 dni
```

`mapOpen` jako zaleznosc `fetchItems` - zmiana stanu mapy automatycznie przeladuje dane z szerszym zakresem.

## Nowe pliki

### `src/components/admin/CalendarMap.tsx` - komponent mapy Leaflet

- `react-leaflet` MapContainer + TileLayer (OpenStreetMap)
- Markery: `L.divIcon` z SVG w kolorze kolumny
- Staly Tooltip: `{city} | {data_sformatowana}` (permanent: true)
- `fitBounds` z padding 50px (desktop) / 8px (mobile), maxZoom: 15
- Klikniecie markera wywoluje `onItemClick`

### `src/components/admin/CalendarMapPanel.tsx` - panel z filtrami + mapa

Props:
- `items: CalendarItem[]` (te same co kalendarz)
- `columns: CalendarColumn[]`
- `onItemClick: (item: CalendarItem) => void`
- `onClose: () => void`

Filtry (client-side na przekazanych items):
- Przyciski: Dzis / Tydzien / Miesiac + DatePicker
- Select kolumny (Wszystkie + lista kolumn)
- Filtruje tylko dzis i przyszlosc (bez przeszlych dat)
- Odrzuca items bez wspolrzednych (lat/lng null)

## Zmiany w istniejacych plikach

### `src/components/admin/AdminCalendar.tsx`

- Nowy prop: `onToggleMap?: () => void`, `mapOpen?: boolean`
- Przycisk w headerze obok daty: na desktop tekst "Mapa", na mobile ikona MapPin
- Przycisk toggle (aktywny stan gdy mapa otwarta)

### `src/pages/Dashboard.tsx`

- Stan `mapOpen` (boolean)
- `mapOpen` wplywa na `rangeEnd` w `fetchItems` (+30 dni zamiast +14)
- Fetch adresow rozszerzony o `lat, lng, city`
- Layout renderContent dla kalendarz:
  - Desktop + mapa otwarta: `flex` row, kalendarz 50% + CalendarMapPanel 50%
  - Mobile + mapa otwarta: Drawer (vaul) na 100% width z CalendarMapPanel
  - Mapa zamknieta: kalendarz 100% (bez zmian)
- Przekazanie `onToggleMap` i `mapOpen` do AdminCalendar

### `src/pages/EmployeeCalendarPage.tsx`

- Identyczne zmiany jak Dashboard (stan mapOpen, rozszerzony fetch, layout 50/50)

## Layout desktop z mapa

```text
+----------+------------------------+------------------------+
| Sidebar  |  Kalendarz (50%)       |  Mapa (50%)            |
|          |  kolumny sie zwezaja   |  [filtry]              |
|          |  drag&drop dziala      |  [mapa leaflet]        |
|          |  akcje blokowe ukryte  |  [X zamknij]           |
+----------+------------------------+------------------------+
```

Kalendarz i mapa sa w jednym uzyciu - przeniesienie zlecenia drag&drop natychmiast aktualizuje pinezke na mapie (ten sam stan `calendarItems`).

## Zaleznosci

- `leaflet`
- `react-leaflet`  
- `@types/leaflet`

## Pliki do zmiany/utworzenia

| Plik | Akcja |
|------|-------|
| `src/components/admin/CalendarMap.tsx` | Nowy |
| `src/components/admin/CalendarMapPanel.tsx` | Nowy |
| `src/components/admin/AdminCalendar.tsx` | Edycja - przycisk mapy w headerze |
| `src/pages/Dashboard.tsx` | Edycja - stan mapy, rozszerzony fetch, layout 50/50 |
| `src/pages/EmployeeCalendarPage.tsx` | Edycja - to samo co Dashboard |
