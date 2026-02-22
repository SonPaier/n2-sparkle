

# Implementacja widoku Uslug - kopiowanie z N2Wash

## Podsumowanie

Kopiujemy UI uslug z N2Wash (PriceListSettings, ServiceFormDialog, CategoryManagementDialog) i tworzymy wspoldzielony komponent ConfirmDialog. Usuwamy: reminder templates, searchParams/navigate logic, service_type/visibility, size-based prices/durations, useTranslation, metadata (trwalosc, lakiery), AI description generation. Zostawiamy: DnD sortowanie, inline editable price, wyszukiwanie, kategorie.

## 1. Baza danych (migracja SQL)

Tworzymy dwie tabele:

**`unified_categories`**: name, slug, description, sort_order, prices_are_net, active, instance_id, created_at, updated_at

**`unified_services`**: name, short_name, description, price (numeric), duration_minutes (integer), category_id (FK), is_popular, prices_are_net, active, unit (default 'szt'), sort_order, instance_id, metadata (jsonb), created_at, updated_at

RLS: SELECT dla admin/employee/super_admin, ALL dla admin/super_admin. Triggery update_updated_at_column na obu.

## 2. Nowe komponenty

### `src/components/ui/confirm-dialog.tsx`
Kopia z N2Wash -- wspoldzielony komponent. AlertDialog na desktop, Drawer na mobile. Props: open, onOpenChange, title, description, confirmLabel, cancelLabel, onConfirm, variant, loading.

### `src/components/admin/ServicesView.tsx` (~600 linii)
Adaptacja PriceListSettings z N2Wash:
- **Usuwamy**: useTranslation, useNavigate/useSearchParams/useLocation, reminder template logic (forceAdvancedOpen, searchParams effects), service_type, category_type filtering (w N2Wash jest `.eq('category_type', 'both')` i `.eq('service_type', 'both')` -- u nas tych kolumn nie ma), visibility
- **Usuwamy z InlineEditablePrice**: logike size prices (hasSizePrices) -- zawsze edytujemy jedno pole `price`
- **Zmieniamy**: `price_from` -> `price` (nowe pole w naszej tabeli)
- **Zostawiamy**: DnD sortowanie (desktop), ServiceRow (mobile), InlineEditablePrice (uproszczone do jednego pola), wyszukiwanie, filtrowanie po kategoriach, przycisk kategorie, przycisk dodaj, ConfirmDialog do delete/deactivate
- **Usuwamy przycisk "Przypomnienia"** z headera
- Polskie stringi hardcoded zamiast t()
- Przy delete sprawdzamy `calendar_items` zamiast `reservations`

### `src/components/admin/ServiceFormDialog.tsx` (~400 linii)
Uproszczona kopia z N2Wash:
- **Usuwamy**: size prices (price_small/medium/large), size durations (duration_small/medium/large), showSizePrices/showSizeDurations toggle, visibility select, service_type, reminder_template_id (cala sekcja fetch + select + navigate), AI description generation (handleGenerateDescription + Sparkles button), metadata (trwalosc_produktu_w_mesiacach, produkt_do_lakierow), forceAdvancedOpen, useNavigate/useLocation
- **Zostawiamy**: nazwa, short_name, kategoria (select), cena (jedno pole), opis (textarea bez AI), sekcja zaawansowana z: duration_minutes, is_popular, unit
- **Zmieniamy**: price_from -> price, net/gross radio zostawiamy
- Dialog na desktop, Drawer na mobile (jak w N2Wash)
- Polskie stringi hardcoded

### `src/components/admin/CategoryManagementDialog.tsx` (~400 linii)
Kopia z N2Wash, minimalne zmiany:
- **Usuwamy**: `.eq('category_type', 'both')` z queries, `category_type: 'both'` z insert, useTranslation
- **Zostawiamy**: DnD sortowanie, inline edit, add/delete, service counts
- Polskie stringi hardcoded (juz prawie sa w N2Wash)

## 3. Modyfikacja istniejacych plikow

### `src/pages/Dashboard.tsx`
- Import ServicesView
- W `renderContent()`: jesli `currentView === 'uslugi'` i `instanceId`, renderuj `<ServicesView instanceId={instanceId} />`

## 4. Podsumowanie plikow

| Plik | Akcja | Zrodlo N2Wash |
|------|-------|---------------|
| Migracja SQL | Nowy | -- |
| `src/components/ui/confirm-dialog.tsx` | Nowy | `confirm-dialog.tsx` (kopia 1:1) |
| `src/components/admin/ServicesView.tsx` | Nowy | `PriceListSettings.tsx` (uproszczony) |
| `src/components/admin/ServiceFormDialog.tsx` | Nowy | `ServiceFormDialog.tsx` (uproszczony) |
| `src/components/admin/CategoryManagementDialog.tsx` | Nowy | `CategoryManagementDialog.tsx` (bez category_type) |
| `src/pages/Dashboard.tsx` | Modyfikacja | -- |

## Detale techniczne

- ConfirmDialog jest shared komponentem w `src/components/ui/` -- bedzie uzyty takze w przyszlych widokach (klienci, kalendarz)
- `unified_services.price` to jedno pole numeric zamiast price_from/price_small/price_medium/price_large
- `unified_services.duration_minutes` to jedno pole integer zamiast duration_minutes/small/medium/large
- Brak kolumn `service_type`, `visibility`, `requires_size`, `reminder_template_id`, `default_validity_days`, `default_service_info` w naszej tabeli
- `unified_categories` nie ma kolumny `category_type` -- wszystkie kategorie sa uniwersalne
- Przy usuwaniu uslugi sprawdzamy czy ma powiazane `calendar_items` (zamiast `reservations` z N2Wash) -- jesli tak, deaktywujemy zamiast usuwac

