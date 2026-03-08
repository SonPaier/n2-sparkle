

## Plan: Protokoły za flagą feature toggle

Dodanie flagi `protocols` do systemu feature toggles — analogicznie do istniejących `activities` i `employees`.

### Miejsca do zmiany

**1. `src/components/admin/SettingsView.tsx`** — toggle w Ustawienia → Aplikacja
- Dodać `useInstanceFeature(instanceId, 'protocols')` 
- Dodać Switch "Protokoły" pod istniejącymi toggleami

**2. `src/components/layout/DashboardLayout.tsx`** — nawigacja admin
- Dodać `useInstanceFeature(instanceId ?? null, 'protocols')`
- Filtrować `protokoly` z `navItems` gdy wyłączone

**3. `src/pages/Dashboard.tsx`** — widok admin
- Dodać `useInstanceFeature(instanceId, 'protocols')`
- Ukryć renderowanie `ProtocolsView` gdy wyłączone
- Ukryć przycisk `onAddProtocol` w `CalendarItemDetailsDrawer` — przekazywać `onAddProtocol={protocolsEnabled ? handler : undefined}`

**4. `src/pages/EmployeeCalendarPage.tsx`** — widok pracownika
- Dodać `useInstanceFeature(instanceId, 'protocols')`
- Filtrować `protokoly` z `navItems` pracownika
- Analogicznie `onAddProtocol={protocolsEnabled ? handler : undefined}`

**5. `src/components/admin/CalendarItemDetailsDrawer.tsx`** — przycisk "Protokół" w szczegółach zlecenia
- Przycisk już jest warunkowo renderowany (`onAddProtocol &&`) — wystarczy nie przekazywać propa z poziomu Dashboard/EmployeeCalendarPage gdy flaga wyłączona. Nie trzeba zmieniać tego komponentu.

### Zakres zmian

| Plik | Zmiana |
|---|---|
| `src/components/admin/SettingsView.tsx` | Dodać toggle "Protokoły" |
| `src/components/layout/DashboardLayout.tsx` | Filtrować nav item `protokoly` |
| `src/pages/Dashboard.tsx` | Warunkowo ukryć widok i przycisk protokołu |
| `src/pages/EmployeeCalendarPage.tsx` | Warunkowo ukryć nav i przycisk protokołu |

Brak zmian w bazie danych — system `instance_features` już obsługuje dowolne klucze, a brak rekordu = domyślnie włączone.

