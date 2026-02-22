

# Wyszukiwarka adresow - komponent i serwis

## Zakres
Tworzymy dwa pliki - serwis do komunikacji z Nominatim API i reuzywalny komponent UI. Nie podlaczamy nigdzie.

## Nowe pliki

### 1. `src/lib/addressSearch.ts` - serwis

Funkcja `searchAddress(query, abortSignal?)` ktora:
- Odpytuje Nominatim: `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&countrycodes=pl&limit=5`
- Ustawia header `User-Agent: LovableApp`
- Parsuje wyniki do ustandaryzowanego interfejsu:

```text
AddressSearchResult {
  display_name: string
  street: string       // road + house_number
  city: string         // city || town || village
  postal_code: string  // postcode
  lat: number
  lng: number
}
```

### 2. `src/components/admin/AddressSearchInput.tsx` - komponent

Reuzywalny komponent autocomplete oparty na istniejacych Popover + Command:
- Props: `onSelect(result)`, `placeholder?`, `defaultValue?`, `className?`
- Debounce 300ms + AbortController (anuluje poprzednie zapytanie)
- Min. 3 znaki do rozpoczecia szukania
- Dropdown z wynikami (ulica, miasto, kod pocztowy)
- Po wybraniu wyniku: wywoluje `onSelect`, zamyka dropdown, wstawia adres w input
- Stany: loading spinner, brak wynikow, za malo znakow

Wzorowany na istniejacym `CustomerSearchInput.tsx` (ten sam pattern: Popover + Command + debounce).

