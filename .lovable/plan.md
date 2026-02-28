
# Przebudowa Drawera Klienta -- zaktualizowany plan

## Zmiana wzgledem poprzedniego planu

Wyszukiwarka NIP z pobieraniem danych z GUS zostanie wydzielona jako **osobny, reużywalny komponent** `NipLookupForm`, gotowy do użycia w różnych miejscach aplikacji (drawer klienta, fakturowanie, oferty itp.).

## Nowy komponent: `src/components/admin/NipLookupForm.tsx`

Samodzielny komponent zawierający:
- Pole NIP (input)
- Przycisk "Pobierz z GUS" (obok inputa, w jednym wierszu)
- Po pobraniu: pola Nazwa firmy, Ulica, Kod pocztowy, Miasto
- Logika fetcha z White List API MF (`https://wl-api.mf.gov.pl/api/search/nip/{nip}?date={today}`)
- Parsowanie adresu z formatu "ULICA NR, KOD MIASTO"

**Props:**
```text
nip, company, billingStreet, billingPostalCode, billingCity
+ onChange callback zwracajacy wszystkie pola po zmianie
+ readOnly (opcjonalnie, dla trybu podgladu)
```

Komponent sam zarzadza stanem ladowania i bledami. Wywoluje `onChange` przy kazdej zmianie dowolnego pola lub po pobraniu danych z GUS.

## Zmiany w `CustomerEditDrawer.tsx`

1. **Label "Nazwa"** zmieniony na **"Imie i nazwisko"**
2. **Reorganizacja w 3 sekcje** z naglowkami i dividerami:
   - **Informacje podstawowe**: imie i nazwisko, telefon, email, adresy serwisowe, kategorie, notatki
   - **Osoby kontaktowe**: dynamiczna lista (imie, telefon, email) + przycisk "Dodaj osobe"
   - **Dane firmy**: `Collapsible`, domyslnie zwinieta, rozwijana jesli dane istnieja; uzywa `NipLookupForm`
3. Usunięcie starych pol firma/NIP/billing -- zastapione przez `NipLookupForm`
4. Osoby kontaktowe: pierwsza mapuje sie na `contact_person/contact_phone/contact_email`, dodatkowe w nowym polu JSONB

## Zmiana w `CustomerAddressesSection.tsx`

Usunięcie ikony MapPin z labela "Adresy serwisowe"

## Migracja bazy danych

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS additional_contacts jsonb DEFAULT '[]';
```

## Zmiana w `CustomersView.tsx`

Dodanie `additional_contacts` do typu `Customer` i query SELECT.

## Podsumowanie plikow do zmiany

| Plik | Akcja |
|------|-------|
| `src/components/admin/NipLookupForm.tsx` | **Nowy** -- reużywalny komponent NIP + GUS |
| `src/components/admin/CustomerEditDrawer.tsx` | Przebudowa formularza na 3 sekcje, użycie NipLookupForm |
| `src/components/admin/CustomerAddressesSection.tsx` | Usunięcie ikony MapPin |
| `src/components/admin/CustomersView.tsx` | Dodanie additional_contacts do typu i query |
| Migracja SQL | Nowa kolumna additional_contacts |
