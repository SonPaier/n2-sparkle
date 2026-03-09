

## Plan: Widok miesięczny kalendarza (z obsługą zleceń wielodniowych)

### Opis
Nowy tryb "Miesiąc" w kalendarzu. Siatka 7 kolumn (pon-niedz) x tygodnie. Każdy dzień zawiera kompaktowe kafelki zleceń. Zlecenia wielodniowe (item_date → end_date) pojawiają się w każdym dniu zakresu.

### Zmiany

**1. Nowy komponent `src/components/admin/MonthCalendarView.tsx`**
- Props: `items`, `columns`, `currentDate`, `onMonthChange(date)`, `onDayClick(date)`, `onItemClick(item)`
- Nawigacja: ◀ ▶ strzałki zmieniają miesiąc, przycisk "Dziś" wraca do bieżącego
- Siatka CSS grid 7 kolumn, nagłówek: Pon-Niedz
- Komórki obejmują cały miesiąc + padding (dni z poprzedniego/następnego miesiąca wyszarzone)
- **Zlecenia wielodniowe**: iteracja po każdym dniu w zakresie `item_date` do `end_date` — kafelek pojawia się w każdym dniu (reużycie logiki `getDateRange` z Dashboard.tsx)
- Kafelek: kropka koloru kolumny + godzina (HH:MM) + tytuł (truncated) + adres (city/street) mniejszym fontem
- Sortowanie kafelków wg `start_time`
- Max 4 kafelki na dzień, potem link "jeszcze X" → klik = `onDayClick`
- Klik na numer dnia = `onDayClick(date)`
- Klik na kafelek = `onItemClick(item)`
- Anulowane (`cancelled`) pomijane
- Responsywność: mniejsze komórki na mobile, max 2-3 kafelki

**2. Edycja `src/components/admin/AdminCalendar.tsx`**
- Rozszerzenie `type ViewMode = 'day' | 'two-days' | 'week' | 'month'`
- Przycisk "Miesiąc" w sekcji "Pokaż" (obok Dzień/2 dni/Tydzień)
- `handlePrev`/`handleNext`: jeśli `month` → ±1 miesiąc (`addMonths`/`subMonths`)
- `handleToday`: nie zmienia viewMode na 'day' jeśli jest 'month'
- Render `MonthCalendarView` gdy `viewMode === 'month'` (zamiast siatki godzinowej)
- `onDayClick` callback: `setCurrentDate(date); setViewMode('day')`

**3. Edycja `src/pages/Dashboard.tsx`**
- `fetchItems`: rozszerzenie zakresu dat na cały miesiąc gdy widok to 'month'
  - Obecny zakres: -7 do +14/30 dni — za mały
  - Nowy: gdy month → od 1-go dnia miesiąca -7 dni do ostatniego dnia +7 dni
- Przekazanie aktualnego `viewMode` z AdminCalendar do Dashboard (callback lub state lift)

### Obsługa wielodniowych zleceń
Komponent MonthCalendarView buduje mapę `dateStr → CalendarItem[]` iterując po wszystkich itemach. Dla każdego itema generuje zakres dat od `item_date` do `end_date` (lub sam `item_date` jeśli brak `end_date`). Każdy dzień w zakresie otrzymuje referencję do tego itema. To identyczna logika jak `getDateRange` w Dashboard.tsx (linie 61-73).

### Pliki
1. **Nowy**: `src/components/admin/MonthCalendarView.tsx`
2. **Edycja**: `src/components/admin/AdminCalendar.tsx` — ViewMode, nawigacja, render
3. **Edycja**: `src/pages/Dashboard.tsx` — zakres dat fetchItems

