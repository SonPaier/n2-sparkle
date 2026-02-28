

## Plan: Redesign karty zlecenia w widoku "Twój dzień" pracownika

### Zmiany w `src/components/employee/EmployeeDashboard.tsx`

**1. Usunięcie elementów:**
- Usunąć subtitle z zakresem dat pod "Twój dzień" (linia 201-203)
- Usunąć wszystkie ikony z wierszy karty (Clock, User, MapPin, HardHat) — zostawić tylko Calendar i Bell przy nagłówkach sekcji

**2. Nowa struktura karty zlecenia:**
Każda karta to klikalny wiersz z chevron-right po prawej (fixed 40px kolumna):

```text
┌─────────────────────────────────────────────┬──────┐
│ Tytuł zlecenia (18px, bold)                 │  >   │
│ [Dziś] lub [Jutro] lub [Poniedziałek] pill  │      │
│ 📍 Lokalizacja (link do Google Maps)   🗺️   │      │
│ Jan Kowalski                                │      │
│ 123 456 789  📱                             │      │
└─────────────────────────────────────────────┴──────┘
```

- **Tytuł**: `text-lg font-bold` (18px)
- **Pill dnia**: zielony dla "Dziś", fioletowy dla "Jutro" / nazwy dnia roboczego. Logika: porównanie `item_date` z dzisiejszą datą — 0 dni = Dziś, 1 dzień roboczy = Jutro, dalej = nazwa dnia tygodnia (np. "Poniedziałek")
- **Lokalizacja**: cały wiersz to klikalny link `<a>` do Google Maps (directions mode: `https://www.google.com/maps/dir/?api=1&destination=...`). Po prawej ikona Google Maps SVG (ta sama co w CalendarItemDetailsDrawer). Adres budowany z `buildFullAddress(item)`. Jeśli brak koordynatów, użyć adresu tekstowego jako destination
- **Klient**: imię i nazwisko bez ikony
- **Telefon**: `formatPhoneDisplay(phone)` jako klikalny `<a href="tel:...">`, obok ikona SMS `<a href="sms:...">` (ikona MessageSquare z lucide)
- **Chevron**: `ChevronRight` w stałej kolumnie 40px po prawej, wycentrowany pionowo. Cała karta klikalna → `onItemClick`

**3. Importy do dodania:**
- `ChevronRight, MessageSquare` z lucide-react
- `formatPhoneDisplay, normalizePhone` z `@/lib/phoneUtils`
- Usunąć nieużywane: `Clock, User, MapPin, HardHat`

**4. Przypomnienia — usunąć ikony z wierszy:**
- Usunąć ikony Clock, User, Tag z wierszy przypomnień (zostawić Bell przy nagłówku)

### Dane potrzebne
- Lokalizacja: już pobierana (`address_street`, `address_city`, `address_name`)
- Telefon: `customer_phone` już w select query
- Brak koordynatów w obecnym fetchu — użyć adresu tekstowego jako `destination` parametru Google Maps (zadziała bez koordynatów)

