
# Zbiorcze poprawki UI: kontener stron, formularz ustawien, mapa zlecen, z-index

## 1. Kontener dla stron Protokoly i Uslugi

Strony `ProtocolsView` i `ServicesView` renderuja sie na pelna szerokosc (brak `max-w`). Inne podstrony jak `CustomersView` maja ograniczenie. Dodamy wrapper z `max-w-4xl` (lub analogicznym) w `Dashboard.tsx` dla tych widokow, aby zachowac spojnosc z innymi podstronami.

**Plik:** `src/pages/Dashboard.tsx`
- Owinac `ProtocolsView` i `ServicesView` w `<div className="max-w-4xl">` (analogicznie do tego jak inne widoki maja ograniczenia)

## 2. Ustawienia -> Dane firmy: biala karta + biale inputy

Formularz "Dane firmy" w `SettingsView` nie ma karty ani bialego tla. Dodamy:
- Caly formularz owiniety w biala karte (`bg-card rounded-lg border shadow-sm p-6`)
- Wszystkie `Input` dostana klase `bg-white` (juz sa domyslnie jasne, ale wymusimy bialy kolor)
- `AddressSearchInput` tez dostanie `bg-white`

**Plik:** `src/components/admin/SettingsView.tsx`
- Owinac renderTabContent dla `company` w karte `bg-card`
- Dodac `className="bg-white"` do kazdego `Input` i `AddressSearchInput`

## 3. Mapa zlecen - usunac wlasne filtry, uzyc filtrow kalendarza

Obecnie mapa ma swoj wlasny pasek filtrow (Dzis/Tydzien/Miesiac, Data, Kolumna). Zamiast tego:
- Wywalic caly header "Mapa zlecen" i pasek filtrow z `CalendarMapPanel`
- Mapa korzysta z tych samych danych co kalendarz (items juz sa filtrowane przez date w `Dashboard.tsx`)
- Mapa zaczyna sie od gornej krawedzi naglowkow kolumn kalendarza (ponizej filtrow kalendarza)
- Filtry kalendarza sa na calej szerokosci (nad kalendarzem i mapa)

**Pliki:**
- `src/components/admin/CalendarMapPanel.tsx` - usunac header i filtry, zostawic tylko mape + przycisk zamkniecia (maly X w rogu mapy)
- `src/pages/Dashboard.tsx` - zmienic layout: filtry kalendarza na calej szerokosci, pod nimi 50/50 kalendarz + mapa
- `src/components/admin/AdminCalendar.tsx` - wydzielic header do osobnego renderowania albo zmienic structure tak, aby header byl nad calym layoutem

### Architektura layoutu z mapa:
```text
+--------------------------------------------------+
| Filtry kalendarza (< > Dzis Data [widoki] Mapa)  |  <- pelna szerokosc
+-------------------------+------------------------+
| Kalendarz (kolumny)     | Mapa (bez filtrow)     |  <- 50/50
| naglowki kolumn         | (X w rogu)             |
| siatka godzin           |                        |
+-------------------------+------------------------+
```

To wymaga istotnego refactoringu `AdminCalendar` - header musi byc wyekstrahowany lub calendar musi eksportowac header osobno.

**Podejscie:** Wydzielic header kalendarza do renderowania przez `Dashboard.tsx` (poprzez ref/callback albo eksport komponentu header). Alternatywnie - prostsze podejscie: w `AdminCalendar` przekazac prop `renderAbove` tak, aby header renderowl sie nad calym flex containerem w Dashboard.

Najprostsze podejscie: `AdminCalendar` eksportuje swoj header jako renderowany element przez callback prop `onRenderHeader`, lub `AdminCalendar` renderuje header na zewnatrz scroll-area i Dashboard umiescza go nad calym layoutem.

**Realistyczne podejscie:** Zmienic `AdminCalendar` aby header (nawigacja, filtry) renderowl sie poza komponentem - przez nowy prop `externalHeader?: boolean` ktory pomija renderowanie headera, a header jest osobnym komponentem `CalendarHeader` importowanym w `Dashboard.tsx`.

## 4. Drawer (CalendarItemDetailsDrawer) nad mapa - z-index

Drawer szczegolow zlecenia (Sheet) otwiera sie pod mapa. Trzeba dodac wyzszy z-index.

**Plik:** `src/components/admin/CalendarItemDetailsDrawer.tsx`
- Dodac `className="z-[60]"` do `SheetContent` (mapa ma z-index domyslny, sheet powinien byc wyzej)

## 5. Dropdowny z filtrow nad mapa - z-index

`SelectContent`, `PopoverContent` i `DropdownMenuContent` w filtrach kalendarza otwieraja sie pod mapa.

**Plik:** `src/components/admin/AdminCalendar.tsx`
- Dodac `className="z-[60]"` do `SelectContent`, `PopoverContent` w headerze kalendarza

## 6. Usunac pasek "Mapa zlecen" z CalendarMapPanel

Jak opisano w punkcie 3 - header i filtry mapy zostaja usuniete. Zostaje tylko mapa z malym X w rogu.

---

## Podsumowanie plikow do edycji

1. **`src/pages/Dashboard.tsx`** - kontener dla protokolow/uslug, nowy layout kalendarz+mapa (header na calej szerokosci)
2. **`src/components/admin/SettingsView.tsx`** - biala karta formularza, biale inputy
3. **`src/components/admin/CalendarMapPanel.tsx`** - usunac header i filtry, zostawic mape + X
4. **`src/components/admin/AdminCalendar.tsx`** - wydzielic header, z-index na dropdowny/popovery
5. **`src/components/admin/CalendarItemDetailsDrawer.tsx`** - z-index na Sheet
