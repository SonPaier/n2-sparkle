

# Dodanie usług dla instancji Water Grass

Instancja Water Grass (`c6300bdc-5070-4599-8143-06926578a424`) nie ma jeszcze żadnych kategorii ani usług. Trzeba utworzyć 2 kategorie i 24 usługi.

## Plan

### 1. Utworzenie kategorii
Wstawienie dwóch rekordów do `unified_categories`:

| Kategoria | sort_order |
|---|---|
| System Nawadniania | 0 |
| Roboty koszące | 1 |

### 2. Utworzenie usług

**System Nawadniania** (19 usług, sort_order 0-18):

1. Diagnoza awarii
2. Wymiana zraszacza rotacyjnego
3. Wymiana dyszy rotacyjnej
4. Wymiana zraszacza statycznego
5. Wymiana elektrozaworu
6. Wymiana cewki elektromagnetycznej
7. Wymiana membrany elektrozaworowej
8. Montaż studzienki elektrozaworowej
9. Wymiana studzienki elektrozaworowej
10. Uszczelnienie systemu
11. Uszczelnienie linii kroplującej
12. Wymiana sterownika systemu nawadniania
13. Wymiana zasilacza sterownika
14. Serwis jesienny
15. Serwis wiosenny
16. Kalibracja dysz i zraszaczy
17. Montaż linii kroplującej (metry)
18. Czyszczenie filtrów
19. Montaż pompy głębinowej

**Roboty koszące** (5 usług, sort_order 0-4):

1. Diagnoza awarii
2. Naprawa przerwanego przewodu
3. Wymiana noży
4. Czyszczenie robota
5. Kalibracja stacji dokującej

### Szczegóły techniczne

- Dane wstawiane przez SQL INSERT do tabel `unified_categories` i `unified_services`
- Ceny i czasy trwania ustawione na NULL (do uzupełnienia później przez admina)
- Jednostka domyślna: `szt` (dla "Montaż linii kroplującej (metry)" można zmienić na `mb` jeśli potrzeba)
- Wszystkie usługi z `active = true`

