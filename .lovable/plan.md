

## Plan: Przebudowa layoutu Dashboard — 3 kolumny, styl jak na screenie

### Zmiany w `DashboardOverview.tsx`

**Layout**: Zamiast 2 kolumn z sekcjami "Dziś/Nadchodzące" wewnątrz, przejście na:

```text
┌─────────────────────────────────────────────────────┐
│  Dashboard                                          │
├─────────────────────────────────────────────────────┤
│              ● DZIŚ (wycentrowane)                  │
│  ┌──────────────┬──────────────┬──────────────┐     │
│  │  Zlecenia    │ Przypomn.   │  Płatności   │     │
│  │  (nagłówek)  │ (nagłówek)  │  (nagłówek)  │     │
│  │  karty...    │  karty...   │  karty...    │     │
│  └──────────────┴──────────────┴──────────────┘     │
│                                                     │
│           ● NADCHODZĄCE (wycentrowane)              │
│  ┌──────────────┬──────────────┬──────────────┐     │
│  │  Zlecenia    │ Przypomn.   │  Płatności   │     │
│  │  max 3       │  max 3      │  max 3       │     │
│  └──────────────┴──────────────┴──────────────┘     │
└─────────────────────────────────────────────────────┘
```

Styl inspirowany screenem: karty w białych `Card` z borderami, nagłówki kolumn pogrubione, sekcje "Dziś"/"Nadchodzące" jako wycentrowane nagłówki nad gridami.

**Konkretne zmiany:**

1. **Usunąć status `confirmed`** z `statusLabels`
2. **Dodać `payment_status` i `price`** do interfejsu `CalendarItemRow` i query
3. **Dodać kolumnę Płatności** — filtrować zlecenia z `payment_status` IN (`invoice_sent`, `overdue`) lub `not_invoiced` z ceną > 0
4. **Nowy layout**:
   - Nagłówek "Dziś" — `text-center text-lg font-semibold`
   - Grid `grid-cols-1 md:grid-cols-3 gap-6` z trzema kolumnami, każda ma własny nagłówek (Zlecenia/Przypomnienia/Płatności) z ikoną i counterem
   - Nagłówek "Nadchodzące" — analogicznie, wycentrowany
   - Drugi grid 3-kolumnowy z `.slice(0, 3)` na danych
5. **Mockowanie danych** — dodać `useMemo` z mockowanymi fakturami/płatnościami na podstawie istniejących zleceń (tymczasowo, żeby widać dane)
6. **Karta płatności**: tytuł zlecenia, klient, kwota (`price`), badge statusu płatności (żółty "Wysłano FV", czerwony "Zaległa", czarny "Do rozliczenia")
7. **Mobile**: `grid-cols-1` — kolumny stackują się pionowo

### Szczegóły techniczne

- Query `calendar_items` rozszerzone o `payment_status, price`
- Płatności = zlecenia z tego tygodnia gdzie `payment_status != 'paid'` i `price > 0`
- Podział dziś/nadchodzące identyczny jak dla zleceń
- Skeleton loader: 3 kolumny zamiast 2
- Każda kolumna w sekcji jest osobnym `Card` (biały bg, border) — jak na screenie — zawierającym nagłówek i listę elementów

