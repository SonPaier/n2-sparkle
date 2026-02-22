

# Rozszerzenie szablonow SMS: tryb natychmiastowy, edycja tresci, checkbox w zleceniu, edge function

## 1. Migracja bazy danych

### 1a. Dodanie kolumn do `instances`
- `short_name text` -- krotka nazwa firmy uzywana w SMS (hardcoded na backendzie, readonly na UI)
- `reservation_phone text` -- telefon kontaktowy wyswietlany w SMS

### 1b. Dodanie kolumny do `customer_sms_notifications`
- `calendar_item_id uuid` -- powiazanie SMS z konkretnym zleceniem

---

## 2. Zmiany w `SmsNotificationTemplateEditPage.tsx`

### 2a. Nowy interfejs `NotificationItem`
```text
interface NotificationItem {
  months: number;
  service_type: string;
  trigger_type: 'scheduled' | 'immediate';  // nowe pole
}
```

### 2b. Dropdown typu wyzwalacza per pozycja
- Opcje: "Po X miesiacach" / "Natychmiast"
- Gdy "Natychmiast" -- ukrycie pola miesiecy (months ustawiane na 0)
- Gdy "Po X miesiacach" -- obecne zachowanie z inputem miesiecy

### 2c. Edytowalny szablon SMS (textarea)
- Zastapienie readonly podgladu edytowalnym `textarea`
- Wartosc domyslna: auto-generowany template z `{short_name}` na poczatku (hardcoded, nieedytowalny prefix)
- **`{short_name}` jest zawsze na poczatku kazdego SMS** -- backend podmieni na wartosc z `instances.short_name`. Uzytkownik NIE moze tego edytowac ani usunac -- jest to wyswietlane jako staly prefix w UI
- Walidacja: max 160 znakow, brak polskich znakow (regex `/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/`)
- Licznik znakow pod textarea: "X / 160"
- Komunikat bledu jesli naruszono walidacje
- Przykladowy podglad: "{short_name}" zamieniane na aktualna nazwe firmy z `instances.short_name`

### 2d. Fetch `short_name` z instancji
- Pobranie `instances.short_name` i `instances.phone` dla podgladu szablonu
- Uzycie w `getSmsExample()` -- np. "MojaFirma: Zapraszamy na serwis. Kontakt: 123456789"

---

## 3. Checkbox "Wyslij powiadomienie SMS" w `AddCalendarItemDialog.tsx`

### Logika:
- Po wybraniu uslug (`handleServicesConfirmed`), sprawdzenie czy ktoras usluga ma `notification_template_id`
- Fetch szablonu i sprawdzenie czy ma pozycje z `trigger_type = 'immediate'`
- Jesli tak -- checkbox: "Wyslij powiadomienie SMS: [tresc szablonu z podstawionym short_name]"
- Checkbox domyslnie zaznaczony
- Checkbox wyszarzony jesli brak `customer_phone` -- z informacja "Wymagany numer telefonu"
- Przy zapisie, jesli checkbox zaznaczony:
  - Utworzenie rekordu w `customer_sms_notifications` ze statusem `'pending'` i `calendar_item_id`
  - Wywolanie edge function `send-sms` do natychmiastowego wyslania

### W trybie edycji (`isEditMode`):
- Sprawdzenie czy istnieje rekord w `customer_sms_notifications` z tym `calendar_item_id`
- Jesli `sent_at` nie jest null -- labelka: "Wyslano SMS: [data]"
- Jesli `sent_at` jest null i status = 'pending' -- labelka: "SMS oczekuje na wyslanie"
- Jesli brak rekordu i usluga ma natychmiastowy szablon -- checkbox jak w tworzeniu

---

## 4. Status SMS w `CalendarItemDetailsDrawer.tsx`

- Fetch `customer_sms_notifications` po `calendar_item_id`
- Jesli wyslano -- labelka z data wyslania
- Jesli oczekuje -- labelka "Oczekuje na wyslanie"
- Brak -- nic nie wyswietlamy

---

## 5. Edge function `send-sms` (nowa)

Kopia uproszczona z N2Wash `send-sms-message/index.ts`:
- Przyjmuje: `phone`, `message`, `instanceId`
- Uzywa SMSAPI (`https://api.smsapi.pl/sms.do`) z tokenem `SMSAPI_TOKEN`
- Dev mode: jesli brak tokena, loguje SMS i zwraca success
- Po wyslaniu: aktualizacja `customer_sms_notifications` -- `sent_at = now()`, `status = 'sent'`
- Bez `sms_logs` (ten projekt nie ma tej tabeli), bez `check_sms_available` RPC
- Bez Sentry (ten projekt nie ma `_shared/sentry.ts`)

### Secret `SMSAPI_TOKEN`
- Musi byc dodany do projektu -- ten sam klucz co w N2Wash

---

## 6. Konfiguracja `supabase/config.toml`

Dodanie sekcji:
```text
[functions.send-sms]
verify_jwt = false
```

---

## 7. Podsumowanie plikow

| Plik | Zmiana |
|------|--------|
| Migracja DB | `short_name` + `reservation_phone` w `instances`, `calendar_item_id` w `customer_sms_notifications` |
| `SmsNotificationTemplateEditPage.tsx` | Dropdown trigger_type, textarea sms_template z walidacja, fetch short_name |
| `AddCalendarItemDialog.tsx` | Fetch szablonow natychmiastowych, checkbox SMS, wyslanie przez edge function |
| `CalendarItemDetailsDrawer.tsx` | Wyswietlanie statusu SMS |
| `supabase/functions/send-sms/index.ts` | Nowa edge function (kopia z N2Wash, uproszczona) |

---

## 8. Szczegoly techniczne

- `{short_name}` jest hardcoded na poczatku kazdego SMS i nie moze byc edytowany przez usera -- zapobiega podszywaniu sie pod inna firme
- Na UI w textarea szablon wyswietla sie jako: `[NazwaFirmy]: ` (readonly prefix) + edytowalna reszta
- Backend przy wysylaniu zawsze uzywa `instances.short_name` -- nawet jesli ktos zmanipuluje dane, `short_name` pochodzi z bazy
- Walidacja polskich znakow: `/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/`
- `trigger_type` domyslnie `'scheduled'` dla kompatybilnosci wstecznej
- Operacje na tabelach z `as any` cast (typy nie zregenerowane)

