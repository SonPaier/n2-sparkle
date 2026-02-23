

## Modul "Rozliczenia" -- dokladna kopia UI "Zamowienia" z N2Wash

Nowy widok "Rozliczenia" w panelu admina, bedacy 1:1 kopia layoutu `SalesOrdersView.tsx` z N2Wash, z danymi z tabeli `calendar_items`.

---

### Nowy plik

**`src/components/admin/SettlementsView.tsx`**

Dokladna kopia struktury UI z `SalesOrdersView.tsx`:
- Header: tytul "Rozliczenia"
- Toolbar: pole wyszukiwania (placeholder "Szukaj klienta lub nr zlecenia...")
- Tabela z identyczna struktura:
  - Kolumna "Nr" z chevron expand (numer zlecenia = sformatowana data `item_date`)
  - Kolumna "Klient" (`customer_name`)
  - Kolumna dwuliniowa "Data utw. / Data zakon." (`created_at` / data ukonczenia jesli status=completed)
  - Kolumna "Status" z Badge + DropdownMenu do zmiany statusu (confirmed/in_progress/completed/cancelled)
  - Kolumna "Status platnosci" z `InvoiceStatusBadge`
  - Kolumna "Kwota" z prawym wyrownaniem (`price`)
  - Kolumna akcji z MoreHorizontal DropdownMenu (Szczegoly, Wystaw FV)
- Rozwijany wiersz: lista uslug z `calendar_item_services` + `unified_services` (nazwa, ilosc, cena) -- identyczny layout jak `order.products` w N2Wash
- Paginacja: dokladnie ta sama co w N2Wash (10 elementow na strone, przyciski "Poprzednia"/"Nastepna" + numery stron)

Dane pobierane z Supabase:
- `calendar_items` filtrowane po `instance_id`, sortowane po `item_date DESC`
- Uslugi lazy-loaded przy rozwinieciu wiersza z `calendar_item_services` JOIN `unified_services`

Props: `instanceId: string`

---

### Modyfikowane pliki

**`src/components/layout/DashboardLayout.tsx`**
- Dodanie `'rozliczenia'` do typu `ViewType`
- Import ikony `Receipt` z lucide-react
- Nowa pozycja w `navItems` miedzy "Protokoly" a "Uslugi":
  `{ id: 'rozliczenia', label: 'Rozliczenia', icon: Receipt }`

**`src/pages/Dashboard.tsx`**
- Dodanie `'rozliczenia'` do tablicy `validViews`
- Dodanie wpisu w `viewConfig`
- Import `SettlementsView`
- Dodanie warunku w `renderContent()`:
  ```
  if (currentView === 'rozliczenia' && instanceId) {
    return <SettlementsView instanceId={instanceId} />;
  }
  ```

---

### Szczegoly techniczne

- Formatowanie kwot: identyczna funkcja `formatCurrency` jak w N2Wash
- Status zlecenia badge: kolory mapowane (confirmed=amber, in_progress=blue, completed=emerald, cancelled=red)
- Status platnosci: reuzywany istniejacy komponent `InvoiceStatusBadge`
- Paginacja: client-side, `ITEMS_PER_PAGE = 10`, identyczna jak w N2Wash (bez komponentu Pagination z shadcn -- uzyta ta sama custom implementacja z przyciskami)
- Brak przycisku "Dodaj zamowienie" (bo zlecenia tworzy sie z kalendarza)

