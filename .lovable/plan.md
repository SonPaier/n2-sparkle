

## Plan: Filtr "Klienci w okolicy" na mapie zleceń + usunięcie labelki

Dotyczy mapy zleceń w kalendarzu (`CalendarMapPanel.tsx` + `CalendarMap.tsx`).

### 1. Usunięcie labelki "X punktów"

W `CalendarMapPanel.tsx` (linia 127-129) — usunąć `<span>` z tekstem punktów.

### 2. Przycisk toggle w filtrach mapy zleceń

W `CalendarMapPanel.tsx` — dodać stan `showNearby` (domyślnie `false`) i przycisk z ikoną `Users` obok filtrów. Kliknięcie przełącza `showNearby`. Aktywny = `variant="secondary"`.

### 3. Przekazanie `showNearby` + `instanceId` do `CalendarMap`

Rozszerzyć props `CalendarMapProps` o `showNearby: boolean` i `instanceId: string`. `CalendarMapPanel` też musi otrzymać `instanceId` (z rodzica).

### 4. Logika szarych pinezek w `CalendarMap.tsx`

Gdy `showNearby === true`:
- Query do `customer_addresses` z `instance_id` — pobrać WSZYSTKIE adresy z `lat`/`lng` (nie null)
- Dla każdej kolorowej pinezki (zlecenie) znaleźć adresy klientów w promieniu **1 km** (Haversine, już mamy `haversineKm`)
- Odfiltrować adresy, które już są na mapie jako zlecenia (po `customer_address_id`)
- Wyrenderować szare pinezki (`#9ca3af`) z tooltipem: nazwa klienta + ulica/miasto
- Szare pinezki klikalne — tooltip informacyjny (nie otwierają drawera zlecenia)
- Osobna `nearbyMarkersRef` — czyszczona przy wyłączeniu `showNearby`

### 5. Przekazanie `instanceId` z rodzica

W `AdminCalendar.tsx` (lub tam gdzie renderowany jest `CalendarMapPanel`) — przekazać `instanceId` jako prop.

### Pliki do edycji:
1. `src/components/admin/CalendarMapPanel.tsx` — usunąć labelkę, dodać toggle `showNearby`, przekazać do `CalendarMap`
2. `src/components/admin/CalendarMap.tsx` — nowy prop `showNearby` + `instanceId`, useEffect pobierający adresy i renderujący szare pinezki
3. Rodzic renderujący `CalendarMapPanel` — przekazać `instanceId`

