

## Plan: Zmiana siatki kalendarza z 15-minutowej na 30-minutową

### Zakres zmian

Trzy pliki wymagają modyfikacji:

### 1. `src/components/admin/AdminCalendar.tsx`
- Zmiana stałej `SLOT_MINUTES` z `15` na `30`
- `SLOTS_PER_HOUR` automatycznie przeliczy się z 4 na 2
- `SLOT_HEIGHT` pozostaje `32` (każdy slot 30-min będzie miał 32px, godzina = 64px zamiast 128px)
- Alternatywnie: zwiększyć `SLOT_HEIGHT` do `48` lub `64`, żeby kalendarz nie był zbyt ściśnięty — do rozważenia
- Cała reszta logiki (pozycjonowanie itemów, drag & drop, formatowanie czasu) korzysta z tych stałych i przeliczy się automatycznie

### 2. `src/components/admin/AddCalendarItemDialog.tsx`
- Zmiana kroku w `generateTimeOptions()` z `minute += 15` na `minute += 30`
- Opcje czasu będą: 06:00, 06:30, 07:00, 07:30, ..., 19:00
- Domyślny `endTime` po otwarciu (obecnie `startIdx + 4` co dawało +1h przy 15min) → zmienić na `startIdx + 2` (nadal +1h przy 30min)

### 3. `src/components/admin/AddBreakDialog.tsx`
- Analogiczna zmiana kroku w `generateTimeOptions()` z `15` na `30`

### Uwaga dot. wysokości slotów
Przy `SLOT_HEIGHT = 32` i 2 slotach/h, godzina będzie miała 64px (obecnie 128px). Kalendarz będzie dwa razy bardziej kompaktowy. Jeśli to zbyt ściśnięte, zwiększę `SLOT_HEIGHT` do np. `48` (96px/h) — dobry kompromis.

