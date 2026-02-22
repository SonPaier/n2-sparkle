
# Wyodrebnienie sekcji adresow serwisowych + integracja z wyszukiwarka

## Zakres

1. Nowy komponent `CustomerAddressesSection` - wyodrebniony z `CustomerEditDrawer`
2. Integracja z `AddressSearchInput` - wyszukiwarka na gorze, przycisk "Dodaj" po prawej
3. Zmiana flow: wyszukiwarka wypelnia adres (street, city, postal_code, lat, lng), uzytkownik uzupelnia reszte (nazwa, kontakt, notatki)
4. Biale tlo inputa w `AddressSearchInput`

## Nowy komponent: `CustomerAddressesSection.tsx`

Props:
- `addresses: CustomerAddress[]`
- `onAddressesChange: (addresses: CustomerAddress[]) => void`
- `isEditing: boolean`

Zawiera:
- **Naglowek**: ikona MapPin + "Adresy serwisowe"
- **Wiersz wyszukiwarki** (tryb edycji): `AddressSearchInput` (flex-1) + przycisk "Dodaj" (po prawej)
  - Wybranie adresu z wyszukiwarki: dodaje nowy adres z wypelnionymi street, city, postal_code, lat, lng
  - Klikniecie "Dodaj": dodaje pusty adres (jak teraz)
- **Lista adresow**: karty z polami - nazwa lokalizacji, osoba kontaktowa, telefon kontaktowy, notatki
  - Ulica, miasto, kod pocztowy sa wyswietlane ale readonly (wypelniane z wyszukiwarki) - uzytkownik moze je recznie edytowac jesli doda pusty adres
- **Tryb podgladu**: adresy read-only jak teraz

## Zmiany w `CustomerAddress` interface

Dodanie `lat?: number` i `lng?: number` do interface. Zapis do bazy (kolumny juz istnieja w tabeli `customer_addresses`).

## Zmiany w `AddressSearchInput`

Input musi miec biale tlo - dodanie `bg-white` do triggera.

## Zmiany w `CustomerEditDrawer`

- Usuniecie sekcji adresow z renderowania - zastapienie komponentem `CustomerAddressesSection`
- Przeniesienie funkcji `addAddress`, `removeAddress`, `updateAddress` do nowego komponentu
- Dodanie `lat`/`lng` do `syncAddresses` przy zapisie

## Pliki

| Plik | Zmiana |
|------|--------|
| `src/components/admin/CustomerAddressesSection.tsx` | Nowy komponent - sekcja adresow z wyszukiwarka |
| `src/components/admin/CustomerEditDrawer.tsx` | Zastapienie sekcji adresow nowym komponentem, dodanie lat/lng do synca |
| `src/components/admin/AddressSearchInput.tsx` | Biale tlo triggera |
