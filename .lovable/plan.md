

## Refaktor "Mój dzień" → konfigurowalny widok (dzień/tydzień)

### Kluczowe uwagi z Twojego feedbacku

1. **Zlecenia na tydzień do przodu, ale przypomnienia i płatności bez zmian** — tryb "tydzień" wpływa tylko na zakres dat zleceń
2. **RLS dla `employee_calendar_configs`** — pracownik ma tylko SELECT na swój własny config (`auth.uid() = user_id`), nie ma UPDATE. Admin ma pełne zarządzanie. To oznacza, że pracownik **nie może sam zapisywać** do `employee_calendar_configs` bez nowej polityki RLS.

### Rozwiązanie RLS

Dodać **ograniczoną politykę UPDATE** dla pracownika na `employee_calendar_configs`:
- Pracownik może aktualizować **tylko** pole `dashboard_settings` na swoim własnym configu
- Nie może zmienić `visible_fields`, `allowed_actions`, `column_ids` itd.
- Realizacja: trigger walidacyjny `BEFORE UPDATE` na `employee_calendar_configs`, który dla użytkowników z rolą employee blokuje zmianę pól innych niż `dashboard_settings` (przywraca OLD wartości). Plus prosta RLS policy `UPDATE WHERE user_id = auth.uid()` tylko na kolumnę.

Alternatywnie, prostsze podejście: **osobna tabela `dashboard_user_settings`** z kluczem `user_id + instance_id`, gdzie pracownik zapisuje tylko swoje preferencje widoku (dzień/tydzień). Admin zapisuje swoje do `instances.dashboard_settings`. To eliminuje problem RLS — każdy zapisuje do swojej tabeli.

**Rekomendacja**: Osobna mała tabela `dashboard_user_settings` (user_id, instance_id, view_mode, visible_sections JSONB). Powody:
- Czysta separacja: admin nie może nadpisać preferencji pracownika i odwrotnie
- Prosta RLS: user może CRUD tylko swoje wiersze
- Nie trzeba triggerów walidacyjnych
- Działa zarówno dla admina jak i pracownika

### Plan implementacji

**1. Migracja bazy**

Nowa tabela `dashboard_user_settings`:
```sql
CREATE TABLE public.dashboard_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  view_mode text NOT NULL DEFAULT 'day',  -- 'day' | 'week'
  visible_sections jsonb NOT NULL DEFAULT '{"orders": true, "reminders": true, "payments": true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_id)
);

ALTER TABLE public.dashboard_user_settings ENABLE ROW LEVEL SECURITY;

-- Użytkownik może zarządzać swoimi ustawieniami
CREATE POLICY "Users can manage own dashboard settings"
  ON public.dashboard_user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**2. Nowy komponent `DashboardSettingsDrawer.tsx`**
- Sheet z prawej, styl identyczny jak drawer zleceń (hideCloseButton + custom X)
- Na dole fixed: Anuluj (50%) + Zapisz (50%)
- Radio group: "Widok" → Dzień / Tydzień
- Checkboxy: "Widoczne sekcje" → Zlecenia, Przypomnienia, Płatności (domyślnie all true)
- Dla pracownika: ukryj checkboxy sekcji (ma tylko radio dzień/tydzień), bo pracownik nie ma kolumny płatności
- Props: `settings`, `onSave`, `isEmployee`

**3. Hook `useDashboardSettings.ts`**
- Pobiera i zapisuje ustawienia z `dashboard_user_settings` (upsert po user_id + instance_id)
- Zwraca `{ viewMode, visibleSections, loading, save }`

**4. Zmiany w `DashboardOverview.tsx` (admin)**
- Ikona Settings2 obok "Mój dzień"
- Tytuł dynamiczny: "Mój dzień" vs "Mój tydzień"
- Tryb tydzień: `getNextWorkingDays(7, ...)` tylko dla zleceń; przypomnienia i płatności bez zmian
- Ukrywanie sekcji wg `visible_sections`
- Grid dynamiczny: `md:grid-cols-{n}` wg liczby widocznych sekcji

**5. Zmiany w `EmployeeDashboard.tsx` (pracownik)**
- Ikona Settings2 obok "Mój dzień" i "Mapa"
- Tytuł dynamiczny
- Tryb tydzień: `getNextWorkingDays(7, ...)` dla zleceń
- Przypomnienia bez zmian (nie mają zakresu dat zleceń)

**6. Zmiany w `EmployeeCalendarPage.tsx`**
- Nawigacja: label dynamiczny "Mój dzień" / "Mój tydzień"

### Pliki do utworzenia/edycji
- **Nowy**: `src/hooks/useDashboardSettings.ts`
- **Nowy**: `src/components/admin/DashboardSettingsDrawer.tsx`
- **Edycja**: `src/components/admin/DashboardOverview.tsx`
- **Edycja**: `src/components/employee/EmployeeDashboard.tsx`
- **Edycja**: `src/pages/EmployeeCalendarPage.tsx`
- **Migracja**: nowa tabela `dashboard_user_settings`

