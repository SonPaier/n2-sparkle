

## Plan: Import 232 klientów z CSV do instancji Water Grass

### Podejście
Stworzę edge function `import-customers` która przyjmie surowy tekst CSV i zaimportuje klientów do bazy.

### Kroki implementacji

1. **Utworzenie edge function `supabase/functions/import-customers/index.ts`**
   - Przyjmuje POST z body zawierającym CSV jako tekst
   - Parsuje CSV — kolumny B-F (indeksy 1-5 po split na `,`)
   - Dla każdego wiersza (od wiersza 2):
     - **Kolumna B** (adres): dzieli na pierwsze słowo = `billing_city`, reszta = `billing_street`
     - **Kolumna C** (imię i nazwisko): jeśli pusta → użyj wartości z kolumny B jako `name`
     - **Kolumna D** (telefon): wstawia do `phone`
     - **Kolumna E** (email): wstawia do `email`
     - **Kolumna F** (firma/nip): wstawia do `nip`
   - Pomija wiersze nagłówkowe (np. "GDAŃSK", "SOPOT" — wiersze bez telefonu)
   - `instance_id` = `c6300bdc-5070-4599-8143-06926578a424`
   - Insertuje batchem do tabeli `customers`
   - Zwraca liczbę zaimportowanych klientów

2. **Deploy i wywołanie**
   - Zdeployuję edge function
   - Wywołam ją curl'em z zawartością CSV
   - Zweryfikuję liczbę wstawionych rekordów (cel: 232)

### Ważne szczegóły
- Wiersze z samą nazwą miasta (np. "GDAŃSK" w kolumnie A bez danych w C-D) to nagłówki sekcji — pomijamy je
- CSV ma dodatkowe kolumny po F (ceny, usługi) — ignorujemy je
- Telefon jest wymagany w schemacie `customers` — jeśli brak telefonu, pomijamy wiersz
- Istniejący klienci nie będą zduplikowani — sprawdzę po telefonie

### Potencjalny problem
- CSV zawiera polskie znaki i cudzysłowy w wartościach — parser musi to obsłużyć
- Niektóre wartości NIP mają spacje/myślniki — zapiszę jak jest

