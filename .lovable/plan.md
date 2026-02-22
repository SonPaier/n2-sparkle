

# Implementacja widoku "Powiadomienia SMS" -- pełna kopia z N2Wash

## Problem
Brakuje trzech kluczowych elementów:
1. Strona edycji szablonu (`SmsNotificationTemplateEditPage`) -- dlatego `/admin/powiadomienia-sms/new` zwraca 404
2. Widok listy szablonow (`SmsNotificationsView`) -- brak zakladki w dashboardzie
3. Brak routingu i pozycji w sidebarze

## Plan implementacji

### 1. Nowy plik: `src/components/admin/AdminTabsList.tsx`
Kopia 1:1 z N2Wash -- komponent `AdminTabsList` i `AdminTabsTrigger` uzywany w stronie edycji szablonu (zakladki "Szablon" / "Przypisani klienci").

### 2. Nowy plik: `src/components/admin/TemplateAssignedCustomers.tsx`
Uproszczona wersja z N2Wash -- wyswietla liste klientow przypisanych do szablonu z tabeli `customer_sms_notifications` (zamiast `customer_reminders`). Bez komponentu `CustomersList` z N2Wash (ten projekt ma inny `CustomersView`), wiec lista bedzie prosta -- nazwa + telefon klienta.

### 3. Nowy plik: `src/pages/SmsNotificationTemplateEditPage.tsx`
Kopia 1:1 z N2Wash `ReminderTemplateEditPage.tsx` z nastepujacymi zmianami:
- Zamiast `useTranslation()` -- polskie etykiety inline
- Zamiast `reminder_templates` -- `sms_notification_templates`
- Zamiast `customer_reminders` -- `customer_sms_notifications`
- Zamiast `reminder_template_id` -- `notification_template_id`
- Zamiast `/admin/reminders` -- `/admin/powiadomienia-sms`
- Zamiast `/admin/pricelist` -- `/admin/uslugi` (powrot po przypisaniu do uslugi)
- Tytuly: "Dodaj szablon SMS" / "Edytuj szablon SMS"
- Zakladki: "Szablon" / "Przypisani klienci"
- Typy uslug: serwis, kontrola, przeglad (zamiast serwis_gwarancyjny, odswiezenie_powloki)
- SMS templates dostosowane do kontekstu serwisowego (bez `vehicle_model`)
- Uzywa `AdminTabsList` skopiowanego w kroku 1
- Uzywa `TemplateAssignedCustomers` z kroku 2

### 4. Nowy plik: `src/components/admin/SmsNotificationsView.tsx`
Kopia 1:1 z N2Wash `RemindersView.tsx` z nastepujacymi zmianami:
- Polskie etykiety inline
- Tabela `sms_notification_templates` zamiast `reminder_templates`
- Tabela `customer_sms_notifications` zamiast `customer_reminders`
- Kolumna `notification_template_id` zamiast `reminder_template_id`
- Sciezka `/admin/powiadomienia-sms` zamiast `/admin/reminders`
- Tytul: "Powiadomienia SMS"
- Opis: "Szablony powiadomien SMS wysylanych do klientow"
- Przycisk: "Dodaj szablon"
- Puste: "Brak szablonow powiadomien SMS"

### 5. Modyfikacja `src/components/layout/DashboardLayout.tsx`
- Dodanie `MessageSquare` do importow z `lucide-react`
- Rozszerzenie `ViewType` o `'powiadomienia-sms'`
- Dodanie w `navItems`: `{ id: 'powiadomienia-sms', label: 'Powiadomienia SMS', icon: MessageSquare }`

### 6. Modyfikacja `src/pages/Dashboard.tsx`
- Import `SmsNotificationsView`
- Dodanie `'powiadomienia-sms'` do `validViews`
- Dodanie konfiguracji w `viewConfig`
- Dodanie renderowania `SmsNotificationsView` w `renderContent()`

### 7. Modyfikacja `src/App.tsx`
- Import `SmsNotificationTemplateEditPage`
- Dodanie trasy `/admin/powiadomienia-sms/:shortId` w `DevRoutes` (przed trasa `/admin/:view?`)
- Dodanie analogicznej trasy w `InstanceAdminRoutes`

---

## Szczegoly techniczne

- Operacje na tabelach `sms_notification_templates` i `customer_sms_notifications` uzywaja `as any` cast (typy jeszcze nie zregenerowane)
- `TemplateAssignedCustomers` -- prosta lista klientow (nazwa, telefon, typ uslugi, data) bez pelnego drawera edycji klienta (ten projekt nie ma `CustomersList` z N2Wash)
- Kolejnosc w routerze: trasa `/admin/powiadomienia-sms/:shortId` musi byc PRZED `/admin/:view?` zeby nie zostala przechwycona
