

# Odleglosc z bazy na tooltipach mapy

## Zmiana

Dodanie orientacyjnej odleglosci drogowej (~km) z siedziby firmy do kazdego punktu na mapie, wyswietlanej w tooltipie obok nazwy miejscowosci.

## Szczegoly techniczne

### `src/components/admin/CalendarMap.tsx`

1. Dodanie funkcji `haversineKm(lat1, lng1, lat2, lng2)` obliczajacej odleglosc w linii prostej miedzy dwoma punktami (formula haversine, R=6371 km)
2. Mnozenie wyniku przez 1.35 (przyblizenie odleglosci drogowej vs linia prosta)
3. W petli tworzenia markerow: jesli `hqLocation` jest dostepne, obliczenie odleglosci i wstawienie do pierwszej linii tooltipa

Tooltip zmieni sie z:
```text
Warszawa · 24 lut
Montaz basenu
```
na:
```text
Warszawa · ~120 km · 24 lut
Montaz basenu
```

Jesli baza firmy nie jest skonfigurowana - tooltip bez km, bez zmian.

