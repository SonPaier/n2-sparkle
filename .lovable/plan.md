

## Plan: Dashboard "Co do zrobienia" — osobna zakładka

### Opis

Nowa zakładka **"Dashboard"** (ikona `LayoutDashboard`) jako **pierwsza** pozycja w nawigacji (przed Kalendarz). Pokazuje dwie kolumny: **Zlecenia** i **Przypomnienia** na bieżący tydzień, z podziałem na "Dziś" i "Nadchodzące".

### Struktura UI

```text
┌─────────────────────────────────────────────┐
│  Dashboard                                  │
├─────────────────┬───────────────────────────┤
│  Zlecenia       │  Przypomnienia            │
│  (ten tydzień)  │  (ten tydzień)            │
├─────────────────┼───────────────────────────┤
│  ● Dziś (3)     │  ● Dziś (1)              │
│  ┌────────────┐ │  ┌────────────┐           │
│  │ Tytuł      │ │  │ Nazwa      │           │
│  │ 10:00-11:00│ │  │ Deadline   │           │
│  │ Klient     │ │  │ Klient     │           │
│  │ Adres      │ │  │ Kategoria  │           │
│  │ Status ●   │ │  └────────────┘           │
│  └────────────┘ │                           │
│                 │  ● Nadchodzące (2)        │
│  ● Nadchodzące  │  ┌────────────┐           │
│  ...            │  │ ...        │           │
│                 │  └────────────┘           │
└─────────────────┴───────────────────────────┘
Mobile: kolumny stackują się pionowo
```

### Zmiany w plikach

**Nowy plik: `src/components/admin/DashboardOverview.tsx`**
- Props: `instanceId: string`
- Pobiera dane:
  - `calendar_items` z `item_date` w zakresie poniedziałek–niedziela bieżącego tygodnia (status != 'cancelled')
  - `reminders` z `deadline` w zakresie tego tygodnia, `status = 'todo'`
- Dzieli na "Dziś" i "Nadchodzące" (porównanie z dzisiejszą datą)
- Karta zlecenia: tytuł, godzina (start_time–end_time), customer_name, address_name (jeśli jest customer_address_id — dodatkowy fetch), status badge
- Karta przypomnienia: nazwa, deadline (sformatowany), customer_name (join), kategoria (reminder_type_name)
- Layout: `grid grid-cols-1 md:grid-cols-2 gap-6`
- Sekcje "Dziś" / "Nadchodzące" z nagłówkami i counterami
- Puste stany: "Brak zleceń na dziś" / "Brak przypomnień na ten tydzień"

**`src/components/layout/DashboardLayout.tsx`**
- Dodać `'dashboard'` do `ViewType`
- Dodać na pierwszą pozycję w `navItems`: `{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }`
- Import `LayoutDashboard` z lucide-react

**`src/pages/Dashboard.tsx`**
- Dodać `'dashboard'` do `validViews` — jako pierwszy element
- Dodać do `viewConfig`
- Domyślny widok zmienić z `'kalendarz'` na `'dashboard'`
- W `renderContent()` dodać case dla `'dashboard'` renderujący `<DashboardOverview instanceId={instanceId} />`
- Import nowego komponentu

### Szczegóły techniczne

**Pobieranie danych w DashboardOverview:**
- Tydzień: `startOfWeek(new Date(), { weekStartsOn: 1 })` do `endOfWeek(...)` — formatowane jako `yyyy-MM-dd`
- Zlecenia: `supabase.from('calendar_items').select('id, title, customer_name, customer_phone, item_date, start_time, end_time, status, column_id, customer_address_id').eq('instance_id', instanceId).gte('item_date', weekStart).lte('item_date', weekEnd).neq('status', 'cancelled').order('item_date').order('start_time')`
- Adresy: dodatkowy fetch `customer_addresses` dla itemów z `customer_address_id` (ten sam wzorzec co w Dashboard.tsx fetchItems)
- Przypomnienia: `supabase.from('reminders').select('id, name, deadline, customer_id, reminder_type_id, status').eq('instance_id', instanceId).eq('status', 'todo').gte('deadline', weekStart).lte('deadline', weekEnd).order('deadline')`
- Joiny klientów i typów: dodatkowe fetche po ID (wzorzec z useReminders)

**Podział "Dziś" / "Nadchodzące":**
```typescript
const today = format(new Date(), 'yyyy-MM-dd');
const todayItems = items.filter(i => i.item_date === today);
const upcomingItems = items.filter(i => i.item_date > today);
```

**Routing:**
- `/admin` → dashboard (domyślny)
- `/admin/kalendarz` → kalendarz
- Zachowanie: `handleViewChange` już obsługuje routing

