

## Refaktor drawera szczegółów zlecenia

### Zmiany w `CalendarItemDetailsDrawer.tsx`:

**1. Szerokość drawera**
- Zmiana z `sm:max-w-lg` na `sm:max-w-md` (taka sama jak drawer klienta)

**2. Nagłówek (fixed)**
- Linia 1: Nazwa usługi (item.title) jako główny nagłówek + przycisk X
- Linia 2: Data + godziny (np. "śr, 2 kwi 2026 · 08:00 - 16:00") + badge statusu + badge płatności
- Usunięcie 3. labelki (nazwa kolumny, np. "Serwis")

**3. Klient — ikony telefon/SMS przy imieniu**
- Przeniesienie ikon Phone i MessageSquare zaraz po imieniu klienta (nie `ml-auto` po prawej)

**4. Scrollowalny content z 3 tabami**
- Dodanie komponentu `Tabs` z zakładkami: **Ogólne / Media / Historia**
- **Ogólne**: Klient, Lokalizacja, Pracownicy, Notatki, Cena netto, FV/SMS sekcje
- **Media**: Zdjęcia (przeniesione z obecnego contentu)
- **Historia**: Lista zleceń z tej samej lokalizacji (customer_address_id) — wykorzystanie `CustomerOrderCard`

**5. Label "Cena" → "Cena netto"**

**6. Footer — przycisk "Dodaj protokół"**
- Przeniesienie z contentu do footera, obok przycisku "Edytuj", przed nim

**7. Historia tab — implementacja**
- Nowy query do `calendar_items` filtrujący po `customer_address_id` (z wykluczeniem bieżącego zlecenia)
- Pobranie powiązanych usług i protokołów
- Renderowanie jako lista `CustomerOrderCard`

