

## Audyt zmian czasu pracy — co warto śledzić i jak to zaimplementować

### Co zapisywać w logu audytowym

Rekomendacja — pełny zestaw danych do skutecznego śledzenia:

1. **Kto zmienił** (`changed_by_user_id`) — admin czy sam pracownik
2. **Kiedy zmienił** (`changed_at`) — timestamp zmiany
3. **Co zmienił** (`change_type`) — `create`, `update`, `delete`
4. **Poprzednie wartości** (`old_start_time`, `old_end_time`, `old_total_minutes`)
5. **Nowe wartości** (`new_start_time`, `new_end_time`, `new_total_minutes`)
6. **Którego wpisu dotyczy** (`time_entry_id`, `employee_id`, `entry_date`)

Dodatkowe wartości warte rozważenia:
- **IP / źródło** — trudne do realizacji bez edge function, pomijam
- **Opóźnienie edycji** — ile dni po dacie wpisu nastąpiła zmiana (obliczane z `changed_at - entry_date`), nie trzeba osobnej kolumny

### Implementacja

**1. Nowa tabela `time_entry_audit_log`**

```text
id              uuid PK
time_entry_id   uuid (nullable - bo wpis mógł być usunięty)
employee_id     uuid
instance_id     uuid
entry_date      text
change_type     text  ('create' | 'update' | 'delete')
changed_by      uuid  (auth.uid())
old_start_time  timestamptz nullable
old_end_time    timestamptz nullable
old_total_minutes integer nullable
new_start_time  timestamptz nullable
new_end_time    timestamptz nullable
new_total_minutes integer nullable
created_at      timestamptz default now()
```

**2. Trigger bazodanowy na `time_entries`** (AFTER INSERT/UPDATE/DELETE)

Trigger automatycznie loguje każdą zmianę — nie wymaga zmian w kodzie frontendowym. Używa `auth.uid()` do identyfikacji kto wykonał operację.

**3. RLS na `time_entry_audit_log`**
- Admin/super_admin: SELECT (podgląd logów) + automatyczny INSERT przez trigger (SECURITY DEFINER)
- Pracownik: SELECT własnych logów (opcjonalnie — żeby widział historię swoich zmian)

**4. Widok audytu (opcjonalnie, w przyszłości)**
- Tabela w panelu admina pokazująca historię zmian z filtrami po pracowniku i dacie
- Podświetlenie podejrzanych zmian (np. edycja wpisu >3 dni wstecz, duża różnica godzin)

### Dlaczego trigger a nie kod frontendowy

- Nie da się go ominąć — każda zmiana (z UI, z API, z edge function) jest logowana
- Nie wymaga zmian w istniejących hookach (`useCreateTimeEntry`, `useUpdateTimeEntry`, `useDeleteTimeEntry`)
- `auth.uid()` jest dostępny w triggerze dzięki Supabase RLS context

### Pliki do utworzenia/edycji

- **Migracja**: tabela `time_entry_audit_log` + trigger na `time_entries`
- Brak zmian w kodzie frontendowym — trigger działa automatycznie

