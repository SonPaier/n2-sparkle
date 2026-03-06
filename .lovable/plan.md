

## Bug: Drawer edycji nie otwiera się z widoku Dashboard

### Przyczyna

`AddCalendarItemDialog` jest renderowany **wyłącznie wewnątrz bloku `currentView === 'kalendarz'`** (linia 543, wewnątrz `renderContent()`). 

Kiedy użytkownik jest na widoku **Dashboard** ("Mój dzień"/"Mój tydzień") i klika "Edytuj" w szczegółach zlecenia, `handleEditItem` ustawia:
1. `editingItem` → dane zlecenia
2. `addItemOpen` → `true`
3. `detailsOpen` / `dashboardDetailsOpen` → `false`

Ale komponent `AddCalendarItemDialog` **nie istnieje w DOM**, bo Dashboard nie renderuje tego komponentu. Dialog pojawia się dopiero po przejściu na widok "Kalendarz", bo wtedy komponent się montuje i odczytuje `addItemOpen === true`.

### Rozwiązanie

Przenieść `AddCalendarItemDialog` z wnętrza bloku `kalendarz` na **poziom globalny** (obok innych globalnych drawerów jak `CreateProtocolForm`, `CalendarItemDetailsDrawer` dla dashboardu, `AddEditReminderDrawer`), tak aby był dostępny niezależnie od aktywnego widoku.

### Zmiana

**Plik: `src/pages/Dashboard.tsx`**

1. **Usunąć** `<AddCalendarItemDialog ... />` z bloku `renderContent()` → `kalendarz` (linie 543-558)
2. **Dodać** go na poziomie globalnym w `return`, obok `CreateProtocolForm` i dashboardowych drawerów (po linii 654), z warunkiem `instanceId`:

```tsx
{instanceId && (
  <AddCalendarItemDialog
    open={addItemOpen}
    onClose={() => { setAddItemOpen(false); setEditingItem(null); setMapOrderPrefill({}); }}
    instanceId={instanceId}
    columns={calendarColumns}
    onSuccess={handleItemSuccess}
    editingItem={editingItem}
    initialDate={newItemData.date}
    initialTime={newItemData.time}
    initialColumnId={newItemData.columnId}
    initialCustomerId={mapOrderPrefill.customerId}
    initialCustomerName={mapOrderPrefill.customerName}
    initialCustomerPhone={mapOrderPrefill.customerPhone}
    initialCustomerEmail={mapOrderPrefill.customerEmail}
    initialCustomerAddressId={mapOrderPrefill.customerAddressId}
  />
)}
```

Jedna zmiana w jednym pliku. Żadne inne komponenty nie wymagają modyfikacji.

