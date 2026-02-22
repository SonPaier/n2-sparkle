

# Trzy poprawki: kolejnosc adresow, link lokalizacji, przyciski po zakonczeniu

## 1. Nowe adresy na gorze listy (CustomerAddressesSection.tsx)

W funkcjach `addEmpty()` i `addFromSearch()` nowy adres bedzie wstawiany na poczatek tablicy zamiast na koniec:
- `[newAddress, ...addresses]` zamiast `[...addresses, newAddress]`

## 2. Link "Lokalizacja" w szczegolach zlecenia (CalendarItemDetailsDrawer.tsx)

- Rozszerzyc fetch adresu (linia 108-118) o pobieranie `lat` i `lng` z `customer_addresses`
- Nowy stan `addressCoords: { lat: number; lng: number } | null`
- Obok `addressLabel` (linia 505-510) dodac link "Lokalizacja" ktory otwiera Google Maps: `https://www.google.com/maps?q={lat},{lng}` w nowej karcie
- Link wyswietlany tylko gdy `addressCoords` nie jest null

## 3. Przyciski "Wyslij FV" i "SMS o rozliczeniu" dla statusu completed

### 3a. Migracja bazy danych

Dodac kolumne `calendar_item_id` do tabeli `protocols`:

```text
ALTER TABLE public.protocols 
  ADD COLUMN calendar_item_id uuid REFERENCES public.calendar_items(id) ON DELETE SET NULL;
```

### 3b. Przekazywanie calendar_item_id przy tworzeniu protokolu

- `CreateProtocolForm` - dodac prop `prefillCalendarItemId?: string | null`
- Przy zapisie protokolu wstawiac `calendar_item_id`
- `Dashboard.tsx` - w `onAddProtocol` przekazac `item.id` jako `calendarItemId`

### 3c. Sekcja przyciskow w CalendarItemDetailsDrawer

Gdy status === `completed`, w sekcji content (pod notatkami) dodac dwa przyciski:

**"Wyslij FV"** - mock button z toast "Wkrotce dostepne"

**"Wyslij SMS o rozliczeniu"** - otwiera natywna aplikacje SMS (`sms:` URI):
- Fetch protokolu po `calendar_item_id` z tabeli `protocols` (jesli istnieje, pobrac `public_token`)
- Tresc SMS: `Prosba o rozliczenie "{item.title}" w kwocie {item.price} PLN. Link do protokolu: {origin}/protocols/{public_token}`
- Jesli brak protokolu, SMS bez linku
- Jesli brak `customer_phone` - przycisk disabled
- URI format: `sms:{phone}?body={encodeURIComponent(message)}`

## Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `CustomerAddressesSection.tsx` | Nowe adresy na poczatku tablicy |
| `CalendarItemDetailsDrawer.tsx` | Fetch lat/lng adresu + link Google Maps; fetch protokolu po calendar_item_id; sekcja z przyciskami FV/SMS dla completed |
| `CreateProtocolForm.tsx` | Nowy prop `prefillCalendarItemId`, zapis `calendar_item_id` |
| `Dashboard.tsx` | Przekazanie `item.id` jako `calendarItemId` do prefill protokolu |
| Migracja SQL | Dodanie kolumny `calendar_item_id` do `protocols` |

