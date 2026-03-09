

## Plan: Kolorowe kafelki, usunięcie duplikatu nawigacji, drag & drop w widoku miesięcznym

### Problemy
1. **Kafelki bez kolorów kolumn** — kafelki mają szare tło (`bg-muted/60`) zamiast koloru kolumny zlecenia
2. **Podwójna nawigacja** — AdminCalendar renderuje swoje strzałki ◀▶ + "Dziś", a MonthCalendarView ma własne — widoczny dubel na screenie
3. **Brak drag & drop** — nie można przeciągać zleceń między dniami w widoku miesięcznym

### Zmiany

**1. `MonthCalendarView.tsx` — usunięcie nawigacji, kolory kafelków, drag & drop**

- **Usunięcie nawigacji**: Usunąć cały blok nawigacyjny (strzałki + "Dziś" + tytuł miesiąca, linie 105-121). Nawigacja jest już w AdminCalendar (handlePrev/handleNext/handleToday obsługują tryb `month`).

- **Kolory kafelków**: Zamienić `bg-muted/60 border-border/50` na dynamiczny styl `backgroundColor` bazujący na kolorze kolumny. Użyć lekkiego tła (opacity ~15%) jak w widoku dziennym — np. `${colColor}22` dla tła i `${colColor}88` dla obramowania. Fallback do obecnego szarego.

- **Drag & drop między dniami**: Dodać natywne HTML drag & drop (ten sam wzorzec co w AdminCalendar):
  - Nowe props: `onItemMove?: (itemId: string, newDate: string) => void`
  - Kafelki: `draggable`, `onDragStart` — ustawiają `draggedItemId` w stanie
  - Komórki dnia: `onDragOver`, `onDragLeave`, `onDrop` — podświetlenie celu, wywołanie `onItemMove(itemId, dateStr)`
  - `onItemMove` aktualizuje `item_date` (i odpowiednio `end_date` zachowując duration)
  - Stan: `draggedItemId`, `dragOverDateStr` do podświetlenia komórki docelowej

**2. `AdminCalendar.tsx` — przekazanie onItemMove do MonthCalendarView**

- Dodać prop `onItemMove` do `<MonthCalendarView>` (linia 1339-1346)
- Callback: wywołać `onItemMove?.(itemId, item.column_id, newDate)` — zachowując kolumnę, zmieniając datę

**3. `Dashboard.tsx` — obsługa przesunięcia daty z widoku miesiąca**

- `handleItemMove` już obsługuje zmianę daty (aktualizuje `item_date`). Jeśli zlecenie wielodniowe, trzeba przesunąć też `end_date` o ten sam delta. Dodać logikę: `newEndDate = addDays(parse(end_date), daysDiff)`.

### Pliki do zmiany
1. `src/components/admin/MonthCalendarView.tsx` — usunięcie nawigacji, kolory, drag & drop
2. `src/components/admin/AdminCalendar.tsx` — przekazanie onItemMove
3. `src/pages/Dashboard.tsx` — obsługa przesunięcia end_date przy drag wielodniowego zlecenia

