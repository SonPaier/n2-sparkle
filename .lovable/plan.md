
# Wielodniowe zlecenia - DateRange picker jak w N2Wash

## Podsumowanie

Zamieniamy pole daty (prosty `<input type="date">`) na komponent z radio "Jednodniowa / Wielodniowa" i kalendarzem (Popover + Calendar), identycznie jak w `ReservationDateTimeSection` z N2Wash. Baza danych juz posiada kolumne `end_date` w `calendar_items`, wiec nie potrzeba migracji.

---

## Zmiany w `AddCalendarItemDialog.tsx`

### Nowe stany
- `reservationType`: `'single' | 'multi'` (domyslnie `'single'`)
- `dateRange`: `DateRange | undefined` (obiekt `{ from: Date, to: Date }` z `react-day-picker`)
- `dateRangeOpen`: `boolean` (kontroluje popover kalendarza)

### Usuwamy
- Stan `itemDate` (string) -- zastapiony przez `dateRange`

### Inicjalizacja formularza (useEffect)
- Tryb edycji: jesli `editingItem.end_date` istnieje i rozni sie od `item_date`, ustawiamy `reservationType = 'multi'`, `dateRange = { from, to }`; inaczej `'single'` z `{ from, to: from }`
- Nowe zlecenie: `dateRange = { from: initialDate || today, to: initialDate || today }`, `reservationType = 'single'`

### UI - sekcja daty
Zamieniamy `<Input type="date">` na:

1. **RadioGroup** z dwoma opcjami:
   - "Jednodniowa" (`single`)
   - "Wielodniowa" (`multi`)
   - Przelaczenie na `single` synchronizuje `to = from`

2. **Popover z Calendar**:
   - Tryb `single`: `<Calendar mode="single">` -- klikniecie ustawia date i zamyka popover
   - Tryb `multi`: `<Calendar mode="range">` -- wybor zakresu dat, 2 miesiace na desktopie, 1 na mobile
   - Przycisk wyswietla sformatowana date: "Poniedzialek, 24 lut 2026" lub "24 lut - 28 lut 2026"
   - Locale: `pl`

### Submit
- `item_date` = `format(dateRange.from, 'yyyy-MM-dd')`
- `end_date` = `dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null`

### Walidacja
- Sprawdzamy czy `dateRange?.from` istnieje przed zapisem

---

## Nowe importy
- `DateRange` z `react-day-picker`
- `Calendar` z `@/components/ui/calendar`
- `RadioGroup, RadioGroupItem` z `@/components/ui/radio-group`
- `CalendarIcon` z `lucide-react`
- `isSameDay, isBefore, startOfDay` z `date-fns`
- `cn` z `@/lib/utils`

---

## Brak migracji

Kolumna `end_date` juz istnieje w tabeli `calendar_items`. Kalendarz (`AdminCalendar.tsx`) juz obsluguje wielodniowe zlecenia (filtrowanie po zakresie dat, rozne godziny wyswietlania dla pierwszego/ostatniego dnia).

---

## Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| `AddCalendarItemDialog.tsx` | Modyfikacja -- zamiana input date na RadioGroup + Calendar popover z obsluga DateRange |

Zaden inny plik nie wymaga zmian.
