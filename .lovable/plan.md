
# Poprawki mapy kalendarza: z-index, styl mapy, format pinezek

## Problem z z-index
Leaflet uzywa wewnetrznie bardzo wysokich wartosci z-index (tooltip pane: 650, popup: 700, mapa: 400+). Obecne `z-[60]` na drawer i dropdownach to za malo - Leaflet je przeslania. Trzeba podniesc wartosci do `z-[1000]` lub wyzej.

## Styl mapy
Obecnie uzywamy standardowego OpenStreetMap tile layer. Zamienimy na czystszy styl "streets" - np. CartoDB Positron lub OpenStreetMap standardowy (ktory juz jest streets). Jesli uzytkownik chce konkretny styl "streets" bez terenu, CartoDB Positron bedzie czystszy.

## Format pinezek
Obecnie: linia 1 = miasto + km + data, linia 2 = tytul. Uzytkownik chce odwrotnie: linia 1 = tytul zlecenia (pogrubiony), linia 2 = miasto + km + data.

---

## Zmiany w plikach

### 1. `src/components/admin/CalendarItemDetailsDrawer.tsx` (linia 541)
- Zmienic `z-[60]` na `z-[1000]` w `SheetContent`

### 2. `src/components/admin/CalendarMapPanel.tsx`
- `SelectContent` linia 112: zmienic `z-[60]` na `z-[1000]`
- `PopoverContent` linia 96: zmienic `z-[60]` na `z-[1000]`

### 3. `src/components/admin/CalendarMap.tsx` (linie 121-133)
- Zamienic kolejnosc w tooltipie: linia 1 = `title` (pogrubiony, cmt-line1), linia 2 = `city + distPart + dateStr` (mniejszy, cmt-line2)
- Tile layer zostaje OpenStreetMap (to juz jest styl "streets"), ewentualnie mozna zamienic na CartoDB Positron dla czystszego wygladu

### 4. `src/components/admin/AdminCalendar.tsx`
- Sprawdzic i podniesc z-index na `PopoverContent` i `SelectContent` w headerze kalendarza do `z-[1000]`
