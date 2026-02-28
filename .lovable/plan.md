

## Plan: 3 poprawki kalendarza

### 1. Kafelek wielodniowy — godziny na kalendarzu

**Problem**: Linia 590 w `AdminCalendar.tsx` — dla zleceń wielodniowych (`isMultiDay`) wyświetla `displayStart/displayEnd` zamiast rzeczywistych godzin `start_time/end_time`. `displayEnd` na dni nieostatnie to 19:00 (bo tak działa pozycjonowanie kafelka), ale tekst powinien zawsze pokazywać prawdziwe godziny zlecenia.

**Zmiana w `AdminCalendar.tsx`** (linia ~590):
- Zmienić tekst godzin: zawsze pokazywać `item.start_time - item.end_time`, a nie `displayStart - displayEnd`
- Dodać zakres dni dla wielodniowych, np. `06:30 - 17:00, PN - PT` (skrócone nazwy dni tygodnia z `item_date` i `end_date`)

### 2. Przełączanie na „Wielodniowe" — auto-ustawienie daty

**Problem**: W `AddCalendarItemDialog.tsx` (linia ~680), przy przełączeniu na 'multi' nic się nie dzieje z `dateRange.to` — zostaje ta sama data co `from`. Użytkownik oczekuje, że po przełączeniu na wielodniowe, `to` nie będzie identyczne jak `from`.

**Zmiana**: Przy przełączaniu z `single` na `multi` — nie zmieniać dat automatycznie (zostawić jak jest), ale upewnić się, że kalendarz otwiera się w trybie range. Aktualny kod wygląda poprawnie — `to === from` to normalne zachowanie. Problem raczej leży gdzie indziej — sprawdzę czy `dateRange.to` nie jest nadpisywane przez efekt inicjalizujący.

Po dokładnej analizie: linia 247 `setDateRange({ from: initDate, to: initDate })` + linia 683 (single→multi nic nie zmienia) = poprawne. Użytkownik prawdopodobnie myli ten problem z problemem #2 (widzą 19:00 na kafelku). Zostawiam bez zmian chyba że potwierdzi.

### 3. Nowe zlecenie niewidoczne w zakładce Zlecenia

**Problem**: `handleItemSuccess` w `Dashboard.tsx` (linia 330) wywołuje tylko `fetchItems()` (odświeża dane kalendarza). Zakładka „Zlecenia" (`SettlementsView`) używa react-query z `queryKey: ['settlements', instanceId]` — ten cache nie jest inwalidowany po dodaniu zlecenia.

**Zmiana w `Dashboard.tsx`**:
- W `handleItemSuccess` dodać `queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] })` aby zakładka zleceń odświeżyła dane

### Podsumowanie plików

| Plik | Zmiana |
|------|--------|
| `AdminCalendar.tsx` | Kafelek wielodniowy: zawsze pokazuj rzeczywiste godziny + zakres dni (PN-PT) |
| `Dashboard.tsx` | Inwalidacja cache settlements po dodaniu/edycji zlecenia |

