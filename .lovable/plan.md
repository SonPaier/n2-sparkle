
# Naprawa widoku kalendarza pracownika

## Znalezione problemy

### 1. Route wymaga roli `admin` - pracownik nie moze wejsc
W `App.tsx` (linie 96 i 178), route `/employee-calendars/:configId` ma `requiredRole="admin"`. Mimo ze `ProtectedRoute` przepuszcza employee-only na sciezki `/employee-calendars/*`, to sam check roli (linia 48-50) traktuje `employee` jako uprawnienie do `admin` routes. To jest niepotrzebnie skomplikowane.

**Rozwiazanie:** Zmienic `requiredRole` na `"employee"` dla tych routes, lub usunac wymog roli i zostawic tylko autentykacje.

### 2. RLS na `calendar_columns` blokuje pracownikow
Polityka SELECT na tabeli `calendar_columns` pozwala TYLKO na `admin` i `super_admin` - **nie ma employee**! Dlatego pracownik nie widzi kolumn, a bez kolumn nie ma siatki kalendarza.

```
Policy: "Admin or super_admin can select calendar_columns"
USING: has_instance_role(uid, 'admin', instance_id) OR has_role(uid, 'super_admin')
```

Brakuje: `has_instance_role(uid, 'employee', instance_id)`

**Rozwiazanie:** Dodac polityke SELECT dla employee na `calendar_columns`, analogicznie jak jest na `calendar_items`, `breaks`, `employees` itd.

### 3. URL - UUID vs numer
URL `/employee-calendars/c5043075-...` uzywa UUID z bazy danych. Jesli chcesz numeryczny ID (np. `/employee-calendars/1`), trzeba by dodac kolumne `short_id` lub uzyc `sort_order`. Ale UUID jest bezpieczniejszy i standardowy - proponuje zostawic UUID.

---

## Plan zmian

### A. Migracja bazy danych (SQL)
Dodac polityke RLS SELECT na `calendar_columns` dla roli employee:

```sql
CREATE POLICY "Employee can select calendar_columns"
  ON public.calendar_columns
  FOR SELECT
  USING (
    has_instance_role(auth.uid(), 'admin'::app_role, instance_id)
    OR has_instance_role(auth.uid(), 'employee'::app_role, instance_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
```

### B. `src/App.tsx`
Zmienic `requiredRole="admin"` na `requiredRole="employee"` dla routes `/employee-calendars/:configId` w DevRoutes (linia 178) i InstanceAdminRoutes (linia 96).

### C. `src/components/ProtectedRoute.tsx`
Dodac obsluge `requiredRole === 'employee'` - przepuszczac uzytkownikow z rola `employee`, `admin` lub `super_admin`.

---

## Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| Migracja SQL | Dodac RLS SELECT policy na `calendar_columns` dla employee |
| `src/App.tsx` | Zmienic `requiredRole` na `"employee"` dla employee-calendar routes |
| `src/components/ProtectedRoute.tsx` | Dodac obsluge roli `employee` w logice dostepu |
