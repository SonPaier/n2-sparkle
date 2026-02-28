

## Optymalizacja wyszukiwarek: skip search when already no results

### Logika

Jeśli fraza "ABC" zwróciła 0 wyników, to fraza "ABCD" (rozszerzenie) też nie zwróci — nie ma sensu ponownie odpytywać bazy. Dopiero gdy użytkownik skróci frazę (backspace) lub wpisze coś zupełnie innego, szukamy od nowa.

### Zmiany w `CustomerSearchInput.tsx`

1. Dodać ref `noResultsForQueryRef` przechowujący frazę, dla której ostatnio zwrócono 0 wyników
2. W funkcji `search`: jeśli nowa fraza zaczyna się od `noResultsForQueryRef.current` → pomiń zapytanie, od razu zwróć pustą listę (bez loadera)
3. Gdy wyniki > 0 lub fraza się skróciła/zmieniła prefix → wyczyść ref i szukaj normalnie
4. Dropdown "Brak klienta w bazie" + przycisk "Dodaj" pozostaje widoczny bez migania loaderem

### Zmiany w `CustomerAddressSelect.tsx`

1. Identyczna logika z `noResultsForQueryRef`
2. Zmiana komunikatu "Brak wyników" na **"Nie ma klienta z takim adresem serwisowym"**
3. Dodanie dużego przycisku **"Dodaj klienta"** pod komunikatem (wymaga dodania propa `onAddNew?: (query: string) => void` do komponentu)

### Podsumowanie plików

| Plik | Zmiana |
|------|--------|
| `CustomerSearchInput.tsx` | Dodanie logiki skip-search przy rozszerzaniu frazy bez wyników |
| `CustomerAddressSelect.tsx` | Logika skip-search + nowy komunikat + przycisk "Dodaj klienta" z propem `onAddNew` |

