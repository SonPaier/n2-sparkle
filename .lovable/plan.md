

# Naprawa przekierowania pracownika i widoku kalendarza

## Problem

Gdy pracownik (rola `employee`) loguje sie, komponent `RoleBasedRedirect` ma blad synchronizacji (race condition):

1. Stan `checkingConfig` startuje jako `false`
2. `useEffect` ustawia go na `true` DOPIERO PO pierwszym renderze
3. Ale w pierwszym renderze: `loading=false`, `checkingConfig=false` - brak spinnera
4. `employeeConfigId` jest `null` (fetch jeszcze nie ruszyl) - pomija warunek pracownika
5. Wpada w `hasStudioAccess` (bo rola `employee` pasuje) i przekierowuje na `/admin`

Pracownik laduje na Dashboard z pelnym admin sidebar zamiast na swoj kalendarz.

## Rozwiazanie

**Plik: `src/components/RoleBasedRedirect.tsx`**

Zmienic inicjalizacje `checkingConfig` tak, aby od razu uwzglednial czy uzytkownik jest employee-only. Dwa podejscia mozliwe - najlepsze to:

- Ustawic `checkingConfig` na `true` wewnatrz warunku renderowania (nie jako stan poczatkowy)
- Dodac warunek: jesli `isEmployeeOnly` jest `true` a `employeeConfigId` jest `null` i `checkingConfig` jest `false` - traktowac to jako "jeszcze nie sprawdzono" i pokazac loader

Konkretnie: zmienic warunek loadingu z:
```
if (loading || checkingConfig)
```
na:
```
if (loading || checkingConfig || (isEmployeeOnly && employeeConfigId === null && !loading))
```

Ewentualnie prostsza wersja - uzyc osobnego flaga `configResolved`:

```typescript
const [configResolved, setConfigResolved] = useState(false);

useEffect(() => {
  if (!user || !isEmployeeOnly) {
    setConfigResolved(true); // nie dotyczy
    return;
  }
  supabase
    .from('employee_calendar_configs')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
    .then(({ data }) => {
      setEmployeeConfigId(data?.id || null);
      setConfigResolved(true);
    });
}, [user, isEmployeeOnly]);

if (loading || !configResolved) {
  return <Loader2 spinner />;
}
```

To gwarantuje ze komponent nie podejmie decyzji o przekierowaniu dopoki nie sprawdzi konfiguracji pracownika.

## Zmienione pliki

| Plik | Zmiana |
|------|--------|
| `src/components/RoleBasedRedirect.tsx` | Naprawa race condition - czekaj na wynik fetcha konfiguracji przed przekierowaniem |

