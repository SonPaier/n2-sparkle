

## Plan: Nadpisanie ceny zlecenia kwotą netto z faktury

### Problem
Po wystawieniu faktury, cena w zleceniu (`calendar_items.price`) nie jest aktualizowana. Powinna zostać nadpisana wartością netto z faktury.

### Rozwiązanie
Po pomyślnym wystawieniu faktury, w `handleSubmit` w `useInvoiceForm.ts`, zaktualizować `calendar_items.price` wartością `totalNetto` (obliczaną już w hooku). Następnie wywołać `onSuccess` aby odświeżyć listę.

### Zmiany

**`src/components/invoicing/useInvoiceForm.ts`** — w `handleSubmit`, po pomyślnym utworzeniu faktury (linia ~227), dodać update:

```typescript
// Po: if (data?.error) throw new Error(data.error);
// Nadpisz cenę zlecenia kwotą netto
if (calendarItemId) {
  await supabase
    .from('calendar_items')
    .update({ price: totalNetto })
    .eq('id', calendarItemId);
}
```

Wykorzystujemy `totalNetto` już obliczane w hooku (linia 151-166). Callback `onSuccess` (już wywoływany w linii 232) odświeża listę zleceń w komponencie nadrzędnym.

### Pliki do zmiany
- `src/components/invoicing/useInvoiceForm.ts` — 1 zmiana (dodanie update po create_invoice)

