

# Wyslij SMS z poziomu szczgolow zlecenia

## Co jest juz zrobione
Wiekszosc logiki SMS jest juz zaimplementowana:
- Checkbox "Wyslij SMS" w drawer tworzenia zlecenia -- dziala
- Zapis powiadomien SMS do `customer_sms_notifications` -- dziala
- Wyswietlanie statusu SMS w drawer szczgolow -- dziala (ale niekompletnie)

## Co trzeba dodac

### 1. Przycisk "Wyslij SMS" w drawer szczgolow zlecenia (CalendarItemDetailsDrawer)
Gdy zlecenie nie ma jeszcze wyslanego SMS, ale jego uslugi maja szablon SMS (immediate), pokaz przycisk "Wyslij SMS" z podgladem tresci. Klikniecie:
- Tworzy rekord w `customer_sms_notifications`
- Wywoluje edge function `send-sms`
- Aktualizuje widok

### 2. Lepsza informacja o wyslanych SMS
Pokazac nazwe szablonu/uslugi i pelna date wyslania w sekcji SMS.

---

## Zmiany techniczne

### CalendarItemDetailsDrawer.tsx

**Nowy stan i logika:**
- Dodac stan na dostepne szablony SMS (`availableSmsTemplates`) - pobierane z `calendar_item_services` -> `unified_services` -> `sms_notification_templates`
- Dodac stan `sendingSms` na loading
- Dodac funkcje `handleSendSms` ktora:
  1. Tworzy rekord `customer_sms_notifications` (status: pending, calendar_item_id, itp.)
  2. Wywoluje `send-sms` edge function
  3. Odswiezy liste `smsNotifications`

**Nowy useEffect** - po otwarciu drawer pobierz uslugi zlecenia z `calendar_item_services` JOIN `unified_services` i sprawdz ktore maja `notification_template_id`. Jesli tak, pobierz szablon z `sms_notification_templates` i sprawdz czy ma `trigger_type: 'immediate'`. Zapisz dostepne szablony.

**Nowy UI** - pod sekcja "Notatki":
- Jesli sa powiadomienia SMS: pokaz status jak teraz, ale z nazwa uslugi
- Jesli nie ma SMS ale sa dostepne szablony: pokaz przycisk "Wyslij SMS" z podgladem tresci i nazwa szablonu

**Pobieranie `instance short_name`** - potrzebne do podmiany placeholderu `{short_name}` w podgladzie SMS. Pobrac z tabeli `instances`.

| Plik | Zmiana |
|------|--------|
| `CalendarItemDetailsDrawer.tsx` | Nowy useEffect do pobierania szablonow SMS z uslug zlecenia, przycisk "Wyslij SMS", funkcja handleSendSms |
