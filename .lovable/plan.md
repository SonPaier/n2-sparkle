

# Refaktoryzacja drawer szczegolow i edycji zlecen (styl N2Wash)

## 1. CalendarItemDetailsDrawer - nowy layout jak N2Wash ReservationDetailsDrawer

### Struktura SheetContent
- `flex flex-col` layout z `hideCloseButton hideOverlay`
- Header: czas + data po lewej, custom X button (p-2 rounded-full hover:bg-muted, X w-5 h-5) po prawej
- Srodek: `flex-1 overflow-y-auto` scrollable content
- Footer: `flex-shrink-0 border-t pt-4` z przyciskami akcji

### Header (jak N2Wash)
- Czas: `{start_time} - {end_time}` jako bold + data obok (separator kropka)
- Status badge + kolumna pod spodem
- Custom X button zamiast domyslnego SheetClose

### Content (te same sekcje z ikonkami jak N2Wash)
- Klient: ikona User, imie klikalne, przyciski Phone/SMS obok
- Telefon: ikona Phone, numer
- Adres: ikona MapPin
- Przypisani pracownicy: **styl N2Wash** - pills `bg-primary text-primary-foreground rounded-full` z X do usuniecia + przycisk "Dodaj" rounded-full (zamiast obecnych small avatar chips)
- Cena: ikona Receipt, kwota bold
- Notatki: inline edytowalne (click to edit -> textarea -> auto-save on blur)
- SMS status: jak jest

### Footer - przyciski statusowe (jak N2Wash)
- **confirmed**: "Edytuj" (outline, bg-white) + "..." DropdownMenu (MoreVertical, z opcjami: Dodaj protokol, Usun) + "Rozpocznij prace" (emerald-600, z dropdown ChevronDown do zmiany na inne statusy)
- **in_progress**: "Edytuj" + "..." + "Zakoncz prace" (sky-500, z dropdown)
- **completed**: "Edytuj" + "..." + status disabled + dropdown do cofniecia
- **cancelled**: "Edytuj" + "..."

### Nowe props
- `onStartWork?: (itemId: string) => void`
- `onEndWork?: (itemId: string) => void`
- `onAddProtocol?: (item: CalendarItem) => void`
- `instanceId: string` (do employee assignment)

### Nowa funkcjonalnosc
- Inline edycja notatek (click -> textarea -> blur saves)
- Quick add/remove pracownikow (pills + EmployeeSelectionDrawer)
- Przycisk "Dodaj protokol" w menu "..."

---

## 2. AddCalendarItemDialog - refaktoryzacja formularza edycji

### Zmiany w layoucie SheetContent
- Ten sam styl co N2Wash: `flex flex-col h-full p-0 gap-0`, `hideOverlay hideCloseButton`
- Header: `px-6 pt-6 pb-4 border-b shrink-0` z tytulem + X button (w-6 h-6)
- Content: `flex-1 overflow-y-auto px-6 py-4`
- Footer: `px-6 py-4 border-t shrink-0` z jednym pelnym przyciskiem "Dodaj zlecenie" / "Zapisz zmiany"

### Usuwane pola
- Imie klienta (Input) -- dane beda z CustomerSearchInput
- Email (Input)
- Telefon (Input)
- Kolumna (Select)

### Nowa kolejnosc pol
1. Tytul zlecenia
2. Klient (CustomerSearchInput - reusable autocomplete)
3. Adres serwisowy (CustomerAddressSelect - widoczny gdy wybrany klient)
4. Uslugi (SelectedServicesList + ServiceSelectionDrawer)
5. Typ zlecenia (single/multi radio)
6. Data (Calendar popover)
7. Od / Do (time selects)
8. Przypisani pracownicy
9. Cena
10. Notatki
11. SMS checkbox (jesli dotyczy)

### Biale tlo kontrolek
- Wszystkie Input, Select, Textarea, Popover trigger Button dostaną `bg-white` class

---

## 3. Dashboard.tsx - nowe handlery

- `handleStartWork(itemId)` - zmiana statusu na `in_progress`
- `handleEndWork(itemId)` - zmiana statusu na `completed`
- `handleAddProtocol(item)` - nawigacja do `/admin` z tab protocols + parametry
- Przekazanie `instanceId` do CalendarItemDetailsDrawer

---

## 4. Zmiany techniczne

### Pliki do edycji:
| Plik | Zmiana |
|------|--------|
| `CalendarItemDetailsDrawer.tsx` | Pelna przebudowa na styl N2Wash: flex layout, custom X, footer z przyciskami statusowymi, inline notes, employee pills |
| `AddCalendarItemDialog.tsx` | Nowy layout (flex, p-0, custom X, footer), usuniecie pol (name/email/phone/column), nowa kolejnosc, bg-white na kontrolkach |
| `Dashboard.tsx` | Nowe handlery startWork/endWork/addProtocol, nowe props |
| `EmployeeCalendarPage.tsx` | Te same nowe props |

### Zachowane:
- `CustomerSearchInput` jako reusable component do wyszukiwania klientow
- `CustomerAddressSelect` do wyboru adresu
- `ServiceSelectionDrawer` + `SelectedServicesList` do uslug
- `EmployeeSelectionDrawer` + pills do pracownikow
- SMS checkbox logika bez zmian

