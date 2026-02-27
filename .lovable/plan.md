

## Plan: Rozszerzenie modelu usług o ilość + nowy layout pozycji

### 1. Migracja DB — dodać kolumnę `quantity` do `calendar_item_services`

```sql
ALTER TABLE public.calendar_item_services ADD COLUMN quantity numeric NOT NULL DEFAULT 1;
```

### 2. Renaming labelek

**`AddCalendarItemDialog.tsx`**:
- Linia 648: `Usługi` → `Usługi i produkty`

**`SelectedServicesList.tsx`**:
- Linia 108: `Dodaj usługi` → `Dodaj usługi lub produkty`

**`ServiceSelectionDrawer.tsx`**:
- Linia 328: `Wybierz usługi` → `Wybierz usługi i produkty`

### 3. Rozszerzyć `ServiceItem` i `ServiceWithCategory` o `unit` i `quantity`

**`SelectedServicesList.tsx`** — rozszerzyć interfejsy:
- `ServiceWithCategory`: dodać `unit?: string`
- `ServiceItem`: dodać `quantity: number` (domyślnie 1)

**`SelectedServicesListProps`**: dodać callback `onQuantityChange: (serviceId: string, qty: number) => void`

### 4. Nowy layout pozycji w `SelectedServicesList`

Każda pozycja usługi/produktu — dwie linie:
- **Linia 1**: Nazwa (short_name + name), czas (jeśli jest duration), przycisk delete
- **Linia 2**: Ilość (inline edit input, np. w-16) + jednostka (szt./m²/mb.) + `×` + cena (inline edit, istniejący) + `=` + suma (ilość × cena, read-only, bold)

Totalny rachunek na dole: suma wszystkich pozycji (ilość × cena).

### 5. Obsługa `quantity` w `AddCalendarItemDialog.tsx`

- Dodać `handleQuantityChange` analogicznie do `handlePriceChange`
- Przy zapisie do `calendar_item_services` — dodać `quantity` do insert rows
- Przy ładowaniu edycji — pobierać `quantity` z bazy i ustawiać w `serviceItems`
- `handleServicesConfirmed` — inicjalizować nowe pozycje z `quantity: 1`

### 6. Rozszerzyć `ServiceSelectionDrawer` — przekazywać `unit`

W `ServiceWithCategory` (w `ServiceSelectionDrawer.tsx`) dodać `unit?: string`, pobierać z bazy i przekazywać w `onConfirm`.

### 7. Podsumowanie usług w `CalendarItemDetailsDrawer` — styl rachunku

W zakładce "Ogólne" dodać sekcję "Usługi i produkty" pobierającą `calendar_item_services` (z `quantity`) + nazwy z `unified_services` (z `unit`). Wyświetlić jak rachunek:
- Każda linia: nazwa, ilość × cena = suma
- Na dole: **Razem: X zł**

### Pliki do edycji:
1. **Migracja SQL** — `calendar_item_services.quantity`
2. `src/components/admin/SelectedServicesList.tsx` — nowy layout 2-liniowy z ilością
3. `src/components/admin/AddCalendarItemDialog.tsx` — obsługa quantity, rename label
4. `src/components/admin/ServiceSelectionDrawer.tsx` — unit w interfejsie, rename title
5. `src/components/admin/CalendarItemDetailsDrawer.tsx` — sekcja rachunku usług

