

## Plan: Moduł powiadomień (Aktywności)

### Koncepcja

Dwa oddzielne strumienie powiadomień:
- **Pracownik** widzi: nowe zlecenie przypisane, zlecenie usunięte, zlecenie przełożone (zmiana daty/godziny), przypomnienie bliskie deadline
- **Admin** widzi: pracownik rozpoczął zlecenie (`item_started`), pracownik zakończył zlecenie (`item_completed`)

Każdy widzi **tylko swoje** powiadomienia (`user_id = auth.uid()`). Admin NIE widzi powiadomień pracowników i odwrotnie.

Każde powiadomienie zawiera `calendar_item_id` — klik otwiera drawer szczegółów zlecenia.

---

### 1. Migracja — tabela `notifications`

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL,
  user_id UUID NOT NULL,              -- odbiorca (auth.uid admina LUB pracownika)
  type TEXT NOT NULL,                  -- 'item_assigned', 'item_deleted', 'item_rescheduled', 'item_started', 'item_completed', 'reminder_due'
  title TEXT NOT NULL,
  description TEXT,
  calendar_item_id UUID,              -- link do zlecenia (otwiera drawer)
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_instance ON public.notifications(instance_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Każdy widzi tylko swoje
CREATE POLICY "Users can select own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Insert: admin/employee w instancji
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    has_instance_role(auth.uid(), 'admin', instance_id)
    OR has_instance_role(auth.uid(), 'employee', instance_id)
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### 2. Hook `useNotifications.ts`

- Pobiera `notifications` WHERE `user_id = auth.uid()` ORDER BY `created_at DESC` LIMIT 50
- Realtime subscription na INSERT/UPDATE
- Zwraca: `notifications`, `unreadCount`, `markAsRead(id)`, `markAllAsRead()`, `deleteAll()`, `refetch()`

### 3. Komponent `NotificationBell.tsx`

- Ikona dzwonka z czerwonym counterkiem nieodczytanych
- Klik → Popover z listą ostatnich 10 powiadomień
- Klik na powiadomienie → `markAsRead` + callback `onItemClick(calendar_item_id)` który otwiera drawer szczegółów

### 4. Widok `NotificationsView.tsx` (Aktywności)

- Pełna lista powiadomień z paginacją
- Ikony wg typu: `item_assigned` (nowe), `item_deleted` (usunięte), `item_rescheduled` (przełożone), `item_started`/`item_completed`
- Klik na wiersz → otwiera drawer zlecenia
- Przyciski "Oznacz wszystkie jako przeczytane", "Usuń wszystkie"

### 5. Zmiany w UI

**`DashboardLayout.tsx`** (admin):
- Nowy `ViewType`: `'aktywnosci'`
- Bottom bar mobile: dodać "Aktywności" (Bell) z counterkiem przed "Więcej"
- `navItems`: dodać pozycję Aktywności

**`EmployeeCalendarPage.tsx`** (pracownik):
- Bottom bar: dodać "Aktywności" (Bell) z counterkiem
- Nowy widok `aktywnosci` renderujący `NotificationsView`

**`EmployeeDashboard.tsx`** — nagłówek:
- Dodać `NotificationBell` na prawo od Settings2

**`DashboardOverview.tsx`** — nagłówek:
- Dodać `NotificationBell` na prawo od Settings2

**`Dashboard.tsx`**:
- Renderowanie `NotificationsView` dla widoku `aktywnosci`

### 6. Tworzenie powiadomień (inserty)

**Dla pracowników** (wyzwalane przez admina):
- `handleItemSuccess` w `Dashboard.tsx` (po dodaniu/edycji zlecenia) — jeśli są `assigned_employee_ids`, insert powiadomień `item_assigned` dla `linked_user_id` każdego przypisanego pracownika
- `handleDeleteItem` — insert `item_deleted` dla przypisanych pracowników
- `handleItemMove` / edycja ze zmianą daty → insert `item_rescheduled`

**Dla admina** (wyzwalane przez pracownika):
- `handleStatusChange` w `EmployeeCalendarPage.tsx` — przy zmianie na `in_progress` → insert `item_started` dla admin `user_id`; przy `completed` → insert `item_completed`

Lookup `linked_user_id` z tabeli `employees` (dla pracowników) i admin `user_id` z `user_roles` (dla admina).

### 7. Pliki do zmiany/utworzenia

| Plik | Akcja |
|---|---|
| Migracja SQL | Nowa tabela `notifications` + RLS + realtime |
| `src/hooks/useNotifications.ts` | Nowy |
| `src/components/admin/NotificationBell.tsx` | Nowy |
| `src/components/admin/NotificationsView.tsx` | Nowy |
| `src/components/layout/DashboardLayout.tsx` | Edycja — ViewType + bottom bar + navItems |
| `src/pages/Dashboard.tsx` | Edycja — widok aktywnosci + inserty powiadomień |
| `src/pages/EmployeeCalendarPage.tsx` | Edycja — bottom bar + widok + inserty |
| `src/components/employee/EmployeeDashboard.tsx` | Edycja — bell w nagłówku |
| `src/components/admin/DashboardOverview.tsx` | Edycja — bell w nagłówku |

