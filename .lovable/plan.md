

## Plan: Dodanie pól adresowych nabywcy do formularza faktury

Formularz faktury nie wysyła `buyer_city`, `buyer_post_code`, `buyer_street` do API. Backend (edge function) już obsługuje te pola zarówno dla Fakturownia.pl jak i iFirma. Trzeba dodać logikę pobierania i UI do edycji.

### Logika pobierania adresu (priorytet)
1. Dane billingowe klienta (gdy ma NIP): `billing_city`, `billing_postal_code`, `billing_street` z tabeli `customers`
2. Adres serwisowy ze zlecenia: `customer_address_id` z `calendar_items` → `customer_addresses` (city, postal_code, street)
3. Puste (edytowalne ręcznie)

### Zmiany w plikach

**1. `src/components/invoicing/useInvoiceForm.ts`**
- Dodać state: `buyerStreet`, `buyerPostCode`, `buyerCity` + settery
- Rozszerzyć fetch klienta (linia 73): dodać `billing_city, billing_postal_code, billing_street` do selecta i ustawić pola
- Dodać nowy effect: gdy `calendarItemId` → pobrać `customer_address_id` z `calendar_items`, potem adres z `customer_addresses` (jako fallback gdy brak danych billingowych)
- W `handleSubmit` (linia 171-182): dodać `buyer_city`, `buyer_post_code`, `buyer_street` do `invoiceData`
- Wyeksportować nowe pola z returna

**2. `src/components/invoicing/InvoiceForm.tsx`**
- Dodać propsy: `buyerStreet`, `buyerPostCode`, `buyerCity` + onChange handlery
- W sekcji "Nabywca" dodać wiersz z polami: Ulica (pełna szerokość), Kod pocztowy + Miasto (grid 1/3 + 2/3)

**3. `src/components/invoicing/CreateInvoiceDrawer.tsx`**
- Przekazać nowe propsy z `form` do `InvoiceForm`

**Edge function** — bez zmian, już obsługuje te pola.

