

## Plan: Fullscreen mapa kalendarza z panelem zleceń

### Layout

```text
┌────────────┬──────────────────────────────────────────────────┐
│            │ [Dziś|Tydzień|Miesiąc] [Kolumna▼] [W okolicy] [X]│  ← floating, transparent
│  Lista     │                                                   │
│  zleceń    │                                                   │
│  250px     │              MAPA 100%                            │
│  h-full    │                                                   │
│  scroll    │                                                   │
│            │                                                   │
│  (styl     │                                                   │
│  Mój dzień)│                                                   │
└────────────┴──────────────────────────────────────────────────┘
```

### Zmiany w plikach

**1. `CalendarMapPanel.tsx` — pełna przebudowa**

- Kontener: `fixed inset-0 z-[200]` (powyżej sidebara z-[120], poniżej drawerów z-[1000])
- Mapa jako warstwa tła — 100% width i height
- **Panel listy zleceń po lewej**: `absolute left-0 top-0 w-[250px] h-full bg-card border-r`, wewnątrz scroll (`overflow-y-auto`), lista filtrowanych zleceń w stylu "Mój dzień" (CustomerOrderCard lub uproszczone karty)
- **Filtry po prawej od panelu listy**: `absolute top-4 left-[266px]`, tło transparent, przyciski białe (`bg-white shadow-sm`)
- **Przycisk X**: czarny na szarym kółku (`bg-muted rounded-full`), `absolute top-4 right-4`
- Domyślny filtr: `today`
- Usunięcie Popover z kalendarzem (data) — zostają: Dziś, Tydzień, Miesiąc, Kolumna, W okolicy
- Na mobile: panel listy ukryty, filtry od lewej krawędzi

**2. `Dashboard.tsx` — uproszczenie renderowania**

- Usunięcie 50/50 layoutu na desktop i Drawer na mobile
- `mapPanel` renderowany jako portal/fixed overlay bezpośrednio (kalendarz zostaje pod spodem, nie jest ukrywany ani dzielony)

**3. `EmployeeCalendarPage.tsx` — analogiczna zmiana**

- Analogiczne uproszczenie renderowania mapy — fixed overlay zamiast Drawer

