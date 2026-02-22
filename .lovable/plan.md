

# Widok Ustawien - Dane firmy + Kolumny kalendarza

## Co zrobimy

Stworzymy widok ustawien z dwoma zakladkami, wzorowany na N2Wash `SettingsView`:

1. **Dane firmy** - formularz edycji danych instancji (bez pola "telefon do obslugi rezerwacji")
2. **Kalendarz** - zarzadzanie kolumnami kalendarza (odpowiednik stanowisk w N2Wash, np. "Dostawy", "Montaz", "Serwis")

## Zmiany w bazie danych

### Nowe kolumny w tabeli `instances`:
- `website` (text, nullable)
- `contact_person` (text, nullable)

### Nowa tabela `calendar_columns`:
- `id` (uuid, PK)
- `instance_id` (uuid, NOT NULL, FK -> instances)
- `name` (text, NOT NULL) - np. "Dostawy", "Montaz", "Serwis"
- `color` (text, nullable) - kolor kolumny
- `active` (boolean, default true)
- `sort_order` (integer, default 0)
- `created_at`, `updated_at` (timestamptz)

### RLS na `calendar_columns`:
- SELECT: admin instancji lub super_admin
- ALL: admin instancji lub super_admin

## Nowe pliki

### `src/components/admin/SettingsView.tsx`
- Layout z bocznym menu (desktop) / dropdown (mobile) - skopiowany z N2Wash
- Dwie zakladki: "Dane firmy" (`company`) i "Kalendarz" (`calendar`)
- Formularz danych firmy: nazwa, telefon, email, adres, osoba kontaktowa, strona www, logo (upload/usun)
- Bez pola "telefon do obslugi rezerwacji" (N2Wash-specific)
- Bez pol: short_name, invoice_company_name, nip, social_facebook, social_instagram, google_maps_url (uproszczenie)
- Przycisk "Zapisz" z walidacja

### `src/components/admin/CalendarColumnsSettings.tsx`
- Odpowiednik N2Wash `StationsSettings`, ale dla kolumn kalendarza
- Lista kolumn z drag-and-drop (sortowanie) - uzyje `@dnd-kit`
- Dodawanie/edycja/usuwanie kolumn
- Wybor koloru z palety (identyczna paleta jak N2Wash)
- Dialog edycji z polem nazwy i kolorem
- Bez logiki employee assignment i subscription limits (uproszczenie)

## Modyfikowane pliki

### `src/pages/Dashboard.tsx`
- Importowanie `SettingsView`
- Gdy `currentView === 'ustawienia'`, renderowanie `<SettingsView>` zamiast placeholdera
- Przekazywanie `instanceId` (pobieranego z `useAuth().roles`)

## Nowe zaleznosci
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` - do drag-and-drop sortowania kolumn

## Szczegoly techniczne

### Storage bucket
- Potrzebny bucket `instance-logos` do uploadu logo
- Migracja utworzy bucket + polityki dostepu

### Schemat widoku ustawien (desktop)
```text
+------------------+----------------------------------------+
| [Dane firmy]     |  Formularz edycji danych firmy          |
| [Kalendarz]      |  (logo, nazwa, telefon, email, ...)     |
|                  |                                        |
|                  |  [Zapisz]                              |
+------------------+----------------------------------------+
```

### Schemat widoku "Kalendarz"
```text
+------------------+----------------------------------------+
| [Dane firmy]     |  Kolumny kalendarza                    |
| [Kalendarz]  <-- |                                        |
|                  |  [= Dostawy    ] [Edit] [Delete]       |
|                  |  [= Montaz     ] [Edit] [Delete]       |
|                  |  [= Serwis     ] [Edit] [Delete]       |
|                  |                                        |
|                  |  [+ Dodaj kolumne]                     |
+------------------+----------------------------------------+
```

### Pobieranie instanceId w Dashboard
- Z `useAuth().roles` - szukamy roli admin/employee z `instance_id`
- Identyczny pattern jak N2Wash `AdminDashboard`

