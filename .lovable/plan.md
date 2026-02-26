

## Ujednolicenie stylu tabów

Przypomnienia używają własnych custom buttonów z `border-b-2` (lekkie taby z podkreśleniem). Drawer zlecenia i drawer klienta używają komponentów Radix Tabs z różnym stylem.

### Zmiany:

**1. `CalendarItemDetailsDrawer.tsx` — zamiana na lekkie taby (styl jak przypomnienia)**
- Zamiana `TabsList`/`TabsTrigger` na `AdminTabsList`/`AdminTabsTrigger` (lub lepiej: custom border-bottom tabs jak w przypomnieniach)
- Zmiana "Media" → "Pliki"

**2. `CustomerEditDrawer.tsx` — zamiana AdminTabsList na lekkie taby**
- Zamiana `AdminTabsList`/`AdminTabsTrigger` na taki sam styl border-bottom jak w przypomnieniach
- Zachowanie `Tabs`/`TabsContent` z Radix, tylko zmiana wizualnego triggera

**3. Podejście implementacyjne**
- Stworzyć reużywalny komponent `LightTabs` / `LightTabsTrigger` z border-bottom style (flex, border-b, active = border-primary + text-primary)
- Użyć go w: CalendarItemDetailsDrawer, CustomerEditDrawer, RemindersView
- RemindersView: zamienić custom buttony na ten sam komponent (opcjonalnie z badge/count)

### Komponent `LightTabs`:
```
<div className="flex border-b border-border/50">
  <button className="flex-1 px-4 py-2.5 text-sm font-medium border-b-2 
    active: border-primary text-primary
    inactive: border-transparent text-muted-foreground hover:text-foreground">
    Tab name
  </button>
</div>
```

### Pliki do edycji:
- `src/components/admin/CalendarItemDetailsDrawer.tsx` — użycie lekkich tabów, "Media" → "Pliki"
- `src/components/admin/CustomerEditDrawer.tsx` — zamiana AdminTabsList na lekkie taby
- Opcjonalnie: nowy komponent `LightTabTrigger` lub inline style

