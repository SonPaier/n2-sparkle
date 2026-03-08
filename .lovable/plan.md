

## Plan: Moduł Projektów (zaktualizowany)

### Kluczowe zmiany vs poprzedni plan

1. **Projekt nie ma dat** — tylko tytuł, opis, klient, adres, status, notatki
2. **Zlecenie (calendar_item) ma opcjonalne daty** — `item_date`, `start_time`, `end_time` stają się nullable, żeby można było utworzyć zlecenie w ramach projektu bez ustalonych dat
3. **Brak paska postępu** — zamiast tego proste "etapy: 2/5". Gdy wszystkie etapy zakończone (5/5) = projekt zakończony

### 1. Migracja bazy danych

**Nowa tabela `projects`:**
- `id` UUID PK, `instance_id` UUID NOT NULL, `title` text NOT NULL, `description` text nullable, `customer_id` UUID nullable, `customer_address_id` UUID nullable, `status` text NOT NULL DEFAULT 'active' (active/completed/cancelled), `notes` text nullable, `created_at`/`updated_at` timestamptz

RLS: admin/super_admin manage, employee select.

**Zmiany w `calendar_items`:**
- Dodać `project_id` UUID nullable, `stage_number` integer nullable
- Zmienić `item_date` na nullable (obecnie NOT NULL text)
- Zmienić `start_time` na nullable
- Zmienić `end_time` na nullable

Uwaga: `generate_order_number()` trigger korzysta z `item_date` — trzeba dodać `IF NEW.item_date IS NOT NULL` guard.

### 2. Feature toggle
`SettingsView.tsx` — nowy Switch "Projekty" z kluczem `projects`.

### 3. Routing i nawigacja
`DashboardLayout.tsx` — nowy `ViewType = 'projekty'`, ikona `FolderKanban`, widoczny gdy flaga `projects` włączona. Pozycja: po "Zlecenia".

### 4. Nowe pliki

**`src/components/admin/projects/ProjectsView.tsx`**
- Tabela: Nr, Tytuł, Klient, Data utworzenia, Status, Etapy (np. "2/5"), akcje (more → usuń, zobacz)
- Przycisk "Dodaj projekt"
- Etapy = count completed / count all (bez cancelled). Tekst "3/3" = zakończony.

**`src/components/admin/projects/AddEditProjectDrawer.tsx`**
- Sheet (styl jak drawer zlecenia): Tytuł, Opis, Klient (CustomerSearchInput), Adres serwisowy (CustomerAddressSelect), Status, Notatki

**`src/components/admin/projects/ProjectDetailsDrawer.tsx`**
- Lista zleceń w projekcie z etapami i statusami
- Etapy: "2/5" (completed/total bez cancelled)
- Przycisk "Dodaj zlecenie" → otwiera AddCalendarItemDialog z prefill projekt+klient+adres

### 5. Zmiany w istniejących plikach

**`AddCalendarItemDialog.tsx`**
- Nowe pole "Projekt" nad tytułem (dropdown/search po projektach instancji)
- Po wybraniu projektu: auto-fill customer_id, customer_address_id (readonly), stage_number = max+1
- Daty (item_date, start_time, end_time) stają się opcjonalne — walidacja: albo wszystkie 3 wypełnione, albo żadne
- Kolumna (`column_id`) też opcjonalna gdy brak dat

**`AdminCalendar.tsx`**
- Kafelki z `project_id`: kolorowy tag "Projekt: [nazwa]"

**`Dashboard.tsx`**
- Widok `projekty` → render ProjectsView
- Fetch project names dla tagów w kalendarzu

**`DashboardLayout.tsx`**
- Dodanie `projekty` do navItems (za flagą)

**`SettingsView.tsx`**
- Toggle "Projekty"

**Trigger `generate_order_number`** — migracja z guardem na null `item_date`

### 6. Reguły biznesowe
- Zlecenie z projektem dziedziczy klienta i adres (pola readonly)
- Zlecenie bez dat nie pojawia się w kalendarzu (brak item_date = niewidoczne na siatce)
- Zlecenie bez dat widoczne w: liście zleceń (SettlementsView), szczegółach projektu
- Status projektu zmienia się ręcznie
- Usunięcie projektu = status cancelled (zlecenia zostają)

### Pliki do zmiany/utworzenia

| Plik | Akcja |
|---|---|
| Migracja SQL | Tabela `projects`, kolumny w `calendar_items`, update trigger |
| `src/components/admin/projects/ProjectsView.tsx` | Nowy |
| `src/components/admin/projects/AddEditProjectDrawer.tsx` | Nowy |
| `src/components/admin/projects/ProjectDetailsDrawer.tsx` | Nowy |
| `src/components/admin/AddCalendarItemDialog.tsx` | Pole Projekt, opcjonalne daty |
| `src/components/admin/AdminCalendar.tsx` | Tag projektu |
| `src/pages/Dashboard.tsx` | Widok projekty |
| `src/components/layout/DashboardLayout.tsx` | Nav item |
| `src/components/admin/SettingsView.tsx` | Toggle |
| `src/components/admin/SettlementsView.tsx` | Obsługa zleceń bez dat |

