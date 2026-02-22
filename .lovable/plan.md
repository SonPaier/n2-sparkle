

# Adresy klienta w drawerze zlecen

## Podsumowanie

Dodajemy mozliwosc wyboru klienta z bazy i jego adresu serwisowego w drawerze zlecen (`AddCalendarItemDialog`). Po wyborze klienta, jego dane (imie, telefon, email) uzupelnia sie automatycznie, a lista adresow pojawia sie jako dropdown.

---

## 1. Migracja bazy danych

Dodajemy dwie nowe kolumny do tabeli `calendar_items`:
- `customer_id` (uuid, nullable, FK -> customers ON DELETE SET NULL)
- `customer_address_id` (uuid, nullable, FK -> customer_addresses ON DELETE SET NULL)

Uzycie SET NULL zamiast CASCADE -- jesli klient/adres zostanie usuniety, zlecenie pozostaje ale traci referencje.

---

## 2. Modyfikacja `AddCalendarItemDialog.tsx`

Dodajemy nastepujace elementy:

### Wyszukiwanie klienta
- Pole tekstowe z autocomplete/combobox -- wpisujemy imie/telefon/firme, lista podpowiada klientow z bazy (`customers` table, filtrowane po `instance_id`)
- Po wyborze klienta: auto-wypelnienie `customerName`, `customerPhone`, `customerEmail`, ustawienie `customerId`
- Mozliwosc recznego wpisania danych klienta (bez wyboru z bazy)

### Wybor adresu
- Po wyborze klienta: fetch adresow z `customer_addresses` dla tego klienta
- Dropdown/Select z listą adresow (wyswietlanie: nazwa + ulica + miasto)
- Wybrany adres zapisuje sie jako `customer_address_id` w zleceniu
- Jesli klient nie ma adresow, sekcja jest ukryta

### Zapis
- Przy zapisie zlecenia dodajemy `customer_id` i `customer_address_id` do danych

---

## 3. Aktualizacja `EditingCalendarItem` interface

Dodajemy pola `customer_id` i `customer_address_id` do interfejsu, zeby edycja tez odczytywala te dane.

---

## 4. Aktualizacja `CalendarItemDetailsDrawer.tsx`

Jesli zlecenie ma `customer_address_id`, wyswietlamy adres serwisowy w sekcji klienta (nazwa lokalizacji, ulica, miasto).

---

## Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowy -- customer_id + customer_address_id na calendar_items |
| `AddCalendarItemDialog.tsx` | Modyfikacja -- combobox klienta, dropdown adresow |
| `CalendarItemDetailsDrawer.tsx` | Modyfikacja -- wyswietlanie adresu |

---

## Detale techniczne

- Wyszukiwanie klientow: query do `customers` z `ilike` na name, phone, company, ograniczone do 10 wynikow, debounced (300ms)
- Adresy fetchowane jednorazowo po wyborze klienta (nie przy kazdym renderze)
- `customer_id` i `customer_address_id` sa nullable -- mozna tworzyc zlecenia bez klienta z bazy (reczne dane)
- Komponent combobox uzyje `cmdk` (juz zainstalowany) przez shadcn Command component
- FK z ON DELETE SET NULL -- bezpieczne usuwanie klientow/adresow bez utraty zlecen

