

## Etap 2: Wysyłka SMS z listy zleceń, nowe statusy płatności, historia SMS

### 1. Nowe statusy płatności

Rozszerzenie `PaymentStatus` w `invoicing.types.ts` o dwa nowe statusy:
- `sms_blik_sent` — "Wysłano SMS BLIK" (pomarańczowy)
- `sms_bank_sent` — "Wysłano SMS konto" (fioletowy)

### 2. Tabela `sms_logs` w bazie danych

Nowa tabela do historii wysłanych SMS:
- `id` uuid PK
- `instance_id` uuid NOT NULL
- `calendar_item_id` uuid (nullable, powiązanie ze zleceniem)
- `phone` text NOT NULL
- `message` text NOT NULL
- `message_type` text NOT NULL (`payment_blik` | `payment_bank_transfer` | inne)
- `status` text NOT NULL DEFAULT `sent`
- `sent_by` uuid (user ID zalogowanego usera)
- `created_at` timestamp

RLS: admin/super_admin ALL, employee SELECT.

### 3. Nowe przyciski w menu dropdown zleceń (`SettlementsView.tsx`)

W obu widokach (mobile karty + desktop tabela), w DropdownMenu "More" pod "Wystaw FV":
- "Wyślij SMS BLIK" — widoczny tylko gdy szablon `blik` jest `enabled`
- "Wyślij SMS z nr konta" — widoczny tylko gdy szablon `bank_transfer` jest `enabled`

Wymaga pobrania szablonów `sms_payment_templates` dla instancji (jeden query w komponencie).

### 4. Dialog wysyłki SMS — `SendPaymentSmsDialog.tsx`

Nowy komponent:
- Props: `open`, `onClose`, `templateType` (`blik` | `bank_transfer`), `calendarItem` (dane zlecenia), `instanceId`
- Przy otwarciu: pobiera szablon SMS i dane instancji (firma, osoba kontaktowa, blik_phone, numer_konta, bank_name), podmienia zmienne `{firma}`, `{osoba_kontaktowa}`, `{usluga}`, `{cena}`, `{blik_phone}`, `{numer_konta}`, `{nazwa_banku}` i wstawia gotowy tekst do `Textarea` (rows=10)
- Użytkownik może edytować treść
- Przyciski: "Anuluj" / "Wyślij"
- Na mobile: drawer (vaul), na desktop: dialog

### 5. Logika wysyłki

**Desktop (bramka SMS):**
- Wywołanie edge function `send-sms` z parametrami: `phone`, `message`, `instanceId`
- Dodatkowo: zapis do `sms_logs` z `message_type`, `calendar_item_id`, `sent_by` (user ID)
- Po sukcesie: update `payment_status` zlecenia na `sms_blik_sent` lub `sms_bank_sent`

**Mobile (natywny SMS):**
- Otwarcie `sms:{phone}?body={encodedMessage}` — natywna aplikacja SMS
- Zapis do `sms_logs` (zakładamy wysłane)
- Update `payment_status`

Detekcja mobile: istniejący hook `useIsMobile()`.

### 6. Historia SMS w ustawieniach

Nowa sekcja w zakładce "Szablony SMS" (`SmsPaymentTemplatesView.tsx`) lub osobna pod-sekcja:
- Przycisk "Historia SMS" — rozwija listę ostatnich 50 logów z `sms_logs`
- Wyświetla: data, telefon, typ, status, treść (jak w N2Wash — `<pre>` z JSON lub prostsza lista)

### 7. Rozszerzenie edge function `send-sms`

Dodanie zapisu do `sms_logs` bezpośrednio w edge function po wysłaniu — z parametrami `calendarItemId`, `messageType`, `sentBy` przesłanymi z frontendu.

### Podsumowanie plików do zmiany:

| Plik | Zmiana |
|------|--------|
| Migracja SQL | Tabela `sms_logs` + RLS |
| `invoicing.types.ts` | Nowe statusy `sms_blik_sent`, `sms_bank_sent` |
| `SettlementsView.tsx` | Query na szablony, nowe przyciski w menu, otwarcie dialogu |
| `SendPaymentSmsDialog.tsx` | Nowy komponent — dialog/drawer z textarea |
| `send-sms/index.ts` | Zapis do `sms_logs` |
| `SmsPaymentTemplatesView.tsx` | Sekcja historii SMS |

