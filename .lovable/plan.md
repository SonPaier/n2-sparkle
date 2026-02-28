

## Plan: Zmiana formatu adresu na kartach zleceń

### Zmiana w `src/components/employee/EmployeeDashboard.tsx`

**1. Zmienić `buildFullAddress`** (linia 181-184):
- Obecny format: `nazwa, ulica, miasto`
- Nowy format: `miasto, ulica` (bez nazwy adresu)
- Kolejność: `address_city`, `address_street`

**2. Uprościć blok adresu** (linie 245-272):
- Połączyć tekst adresu i pinezke w jeden klikalny `<a>` link do Google Maps
- Usunąć oddzielną ikonę pinezki — pinezka będzie częścią tekstu linku
- Format wyświetlany: `Miasto, ulica 📍` — całość jako jeden klikalny link
- Jeśli brak `mapsUrl`, wyświetlić jako zwykły tekst

Struktura:
```tsx
{addr && mapsUrl ? (
  <a href={mapsUrl} target="_blank" className="text-sm text-primary hover:underline flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
    {addr}
    <svg ...pinezka... />
  </a>
) : addr ? (
  <span className="text-sm text-foreground">{addr}</span>
) : null}
```

**Uwaga**: `buildGoogleMapsUrl` nadal używa pełnego adresu z nazwą do lepszego geokodowania — zmiana dotyczy tylko wyświetlania.

