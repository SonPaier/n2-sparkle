

## Plan: Flat layout usług w szczegółach zlecenia

### Plik: `src/components/admin/CalendarItemDetailsDrawer.tsx`

#### 1. Przepisać `ServicesSummary` (linie 116-135) — flat layout bez tła i paddingu

- Usunąć `bg-muted/30 rounded-lg p-3` z wrappera
- Każda linia usługi: nazwa (flex-1, left), ilość + jednostka, cena jednostkowa (text-right), suma (text-right, bold)
- Bez żadnych borders między wierszami, czyste wyrównanie kolumnowe
- Separator na dole tylko przed "Razem netto"

#### 2. Zmienić "Razem" → "Razem netto" (linia 130)

#### 3. Usunąć osobne pole "Cena netto" (linie 842-848)

Blok z `item.price` zostanie usunięty, bo ta informacja jest już w "Razem netto".

