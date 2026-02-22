

# Generowanie zleceń kalendarza dla Pool Prestige

## Zakres

Wygenerowanie realistycznych zleceń (calendar_items + calendar_item_services) na okres **23.02 - 10.04.2026** (46 dni) z zachowaniem zasad:

- **Dostawy**: 1-3 dziennie, zawsze 1 pracownik
- **Montaże**: 1-2 dziennie, 1-3 pracowników, niektóre wielodniowe (2-4 dni)
- **Serwisy**: ~3 dziennie, 1-3 pracowników
- Pracownik nie powtarza sie miedzy kolumnami w danym dniu
- Naturalny rozkład z "dziurami" -- nie kazdy dzien w pelni oblozony
- Losowi klienci z ich adresami (lat/lng) i usługami z odpowiednich kategorii
- ~50% zleceń z notatkami (100-300 znaków)
- 1-3 przypisanych usług na zlecenie

## Dane wejsciowe

- **3 kolumny**: Dostawy, Montaż, Serwis
- **6 pracowników**: Michał, Janek, Stiwen, Roman, Wacek, Janusz
- **21 klientów** z ~100 adresami (z koordynatami)
- **24 usługi** w 4 kategoriach (montaż, serwis, czyszczenie, dostawa)

## Plan techniczny

### Krok 1: Edge function `generate-calendar-data`

Stworze edge function ktora wygeneruje wszystkie dane i wstawi je do bazy. Logika:

1. Iteracja po kazdym dniu (23.02 - 10.04)
2. Losowy przydział pracownikow do kolumn (6 pracownikow / 3 kolumny = 2 na kolumne -- z losowymi wariacjami)
3. Dla kazdego dnia:
   - Losowanie 1-3 dostaw (godziny w zakresie 06:00-17:00, duration z uslugi)
   - Losowanie 1-2 montazy (czesc z end_date na +1/+2/+3 dni)
   - Losowanie 2-3 serwisow
4. Kazde zlecenie:
   - Losowy klient + jego losowy adres
   - 1-3 uslugi z odpowiedniej kategorii (dostawa -> uslugi dostawowe, montaz -> montazowe, serwis -> serwisowe + czyszczenie)
   - Cena = suma cen uslug
   - 50% szans na notatke admina
   - Status: wiekszosc "confirmed", starsze moze "completed"
5. INSERT do `calendar_items` i `calendar_item_services`

### Krok 2: Wywolanie i weryfikacja

- Deploy edge function
- Wywolanie jej raz
- Weryfikacja danych w bazie
- Usuniecie edge function po uzyciu

### Szacowana ilosc danych

- ~280-320 zleceń (calendar_items)
- ~500-700 przypisań usług (calendar_item_services)

