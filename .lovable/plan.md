

## Plan: Zmiana stylu map na Streets (bez klucza API)

Użyjemy **CARTO Voyager** — darmowy styl bez klucza API, wygląda jak klasyczna mapa streets (czytelne ulice, ładne kolory, nowoczesny design).

URL: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`

### Zmiany w 2 plikach

| Plik | Linia | Co |
|------|-------|----|
| `CalendarMap.tsx` | 134-136 | Zamiana OSM → CARTO Voyager |
| `CustomersMapDrawer.tsx` | 145-147 | Zamiana HOT → CARTO Voyager |

Oba pliki dostaną ten sam tile layer:
```typescript
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  maxZoom: 19,
})
```

