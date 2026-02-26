

## Plan: Dopracowanie Dashboard — drawery, checkboxy, styl list-item

### Zmiany w `DashboardOverview.tsx`

**1. Kliknięcie otwiera drawery**
- Dodać props: `onItemClick: (itemId: string) => void`, `onReminderClick: (reminderId: string) => void`, `onPaymentClick: (itemId: string) => void`
- OrderCard/ReminderCard/PaymentCard — `onClick` → wywołuje odpowiedni callback
- Kursor `cursor-pointer` na kartach

**2. Usunięcie statusów z kart zleceń**
- Wyrzucić Badge statusu z OrderCard, usunąć `statusLabels`

**3. Przypomnienia — realne dane, bez mocków**
- Usunąć `mockReminders` i `useMemo` z mockami
- Używać tylko danych z bazy (`todayReminders`, `upcomingReminders`)

**4. Checkbox "wykonane" na przypomnieniach**
- Dodać prop `onReminderDone: (reminderId: string) => void` do DashboardOverview
- ReminderCard — Checkbox po lewej, klik → `supabase.update('reminders', { status: 'done' })` + odświeżenie
- Przekazać `fetchData` jako refresh po zmianie statusu

**5. Pełny adres na kartach zleceń**
- Rozszerzyć fetch adresów o `street, city` (nie tylko `name`)
- Dodać `address_street`, `address_city` do interfejsu
- Wyświetlać pełny adres: `name, street, city`

**6. Styl list-item (border góra-dół zamiast Card)**
- Zamienić wewnętrzne `<Card>` na `<div>` z `border-b` (border tylko góra-dół)
- Pierwszy element dostaje `border-t`
- Usunąć shadow-sm z elementów listy

### Zmiany w `Dashboard.tsx`

**7. Obsługa callbacków z DashboardOverview**
- `onItemClick` → fetch pełnego CalendarItem z bazy → otwórz `CalendarItemDetailsDrawer`
- `onReminderClick` → otwórz drawer przypomnienia (AddEditReminderDrawer)
- `onPaymentClick` → fetch invoice dla calendar_item_id → otwórz `CreateInvoiceDrawer` lub `CalendarItemDetailsDrawer`
- Dodać state: `selectedItem`, `detailsOpen` (reużycie istniejącego CalendarItemDetailsDrawer)
- Dodać import i renderowanie CalendarItemDetailsDrawer w dashboard view
- Fetch columns na potrzeby drawera

### Szczegóły techniczne

**Fetch pełnego itemu po kliknięciu (Dashboard.tsx):**
```typescript
const handleDashboardItemClick = async (itemId: string) => {
  const { data } = await supabase.from('calendar_items').select('*').eq('id', itemId).single();
  // + fetch address, employees jak w fetchItems
  setSelectedItem(data as CalendarItem);
  setDetailsOpen(true);
};
```

**Checkbox przypomnienia (DashboardOverview.tsx):**
```typescript
const handleReminderDone = async (id: string) => {
  await supabase.from('reminders').update({ status: 'done' }).eq('id', id);
  fetchData(); // odśwież
};
```

**Adres — rozszerzony fetch:**
```typescript
// zmienić select z 'id, name' na:
.select('id, name, street, city')
```

