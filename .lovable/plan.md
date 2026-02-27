

## Plan: Fix Customers Map Drawer layout

### Problem
1. Map drawer (`z-50`) sits behind the sidebar (`z-[70]`) — needs higher z-index
2. Desktop layout has "Mapa klientów" title next to map, but should be above filters panel as a full-width header
3. X button should be a round button in the top-right corner above the map (like CalendarMapPanel style)
4. CustomerSearchInput placeholder "Szukaj klienta w bazie..." should be removed

### Changes

**1. `CustomersMapDrawer.tsx` — z-index + layout restructure**
- Add `z-[80]` to `DrawerContent` so it covers the sidebar (`z-[70]`)
- Restructure desktop layout: full-width header row with "Mapa klientów" title + round X button, then below that: filters sidebar + map side by side
- Remove the separate "Filtry" header from the sidebar — the main header covers everything
- X button: `h-9 w-9 rounded-full` matching CalendarMapPanel style

**2. `CustomerSearchInput.tsx` — remove placeholder**
- Change placeholder from `"Szukaj klienta w bazie..."` to empty string `""`

### Layout (desktop, after change):
```text
┌──────────────────────────────────────────────┐
│ Mapa klientów                            (X) │  ← full-width header, z-[80]
├──────────┬───────────────────────────────────┤
│ Klient   │                                   │
│ [search] │         MAP (100% height)          │
│ Usługi   │                                   │
│ [button] │                                   │
└──────────┴───────────────────────────────────┘
```

