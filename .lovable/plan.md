

## Plan: 3 zmiany

### 1. Ukrywanie godzin zleceń dla pracowników

**Nowe pole w konfiguracji kalendarza pracownika** (`AddEditEmployeeCalendarDrawer.tsx`):
- Dodać `hours` do `FIELD_LABELS` → `'Godziny zlecenia'`
- Dodać `hours: true` do `defaultVisibleFields`
- Pole działa identycznie jak `price` — checkbox w sekcji "Widoczne pola"

**Propagacja flagi `hideHours`** w `EmployeeCalendarPage.tsx`:
- Wyliczać `hideHours = config?.visible_fields?.hours === false`
- Przekazywać `hideHours` do `AdminCalendar`, `EmployeeDashboard`, `CalendarItemDetailsDrawer`

**Ukrywanie godzin w komponentach:**

| Komponent | Co ukryć |
|-----------|----------|
| `AdminCalendar.tsx` | Dodać prop `hideHours?: boolean`. Gdy true: ukryć tekst godzin na kafelku (linia ~589), ukryć oś godzin po lewej stronie kalendarza |
| `EmployeeDashboard.tsx` | Dodać prop `hideHours?: boolean`. Gdy true: ukryć `{item.start_time}–{item.end_time}` na karcie zlecenia (linia ~227) |
| `CalendarItemDetailsDrawer.tsx` | Dodać prop `hideHours?: boolean`. Gdy true: ukryć godziny w nagłówku szuflady szczegółów |

### 2. Zakres dni na kafelku wielodniowym (już częściowo zaimplementowane)

Obecny kod (linia 590-596 `AdminCalendar.tsx`) już dodaje `, PN-PT` do godzin. Trzeba upewnić się, że ten tekst jest widoczny nawet gdy `hideHours=true` — bo zakres dni to nie to samo co godziny. Gdy `hideHours=true`, kafelek powinien pokazywać tylko `PN - PT` (bez godzin).

### 3. Anulacja uploadu w MediaUploader

**`mediaUtils.ts`** — zmienić `uploadFileWithProgress` aby:
- Przyjmować opcjonalny `AbortSignal` jako parametr
- Podłączyć `signal.addEventListener('abort', () => xhr.abort())` do XHR
- Przy abort rzucić błąd `'Upload anulowany'`

**`MediaUploader.tsx`** — dodać mechanizm anulacji:
- Dodać `abortControllerRef = useRef<AbortController | null>(null)`
- W `doUpload`: tworzyć nowy `AbortController`, przekazywać `signal` do `uploadFileWithProgress`
- W `handleCancel`: wywołać `abortControllerRef.current?.abort()`, wyczyścić stan uploadu

**`MediaUploadProgress.tsx`** — dodać przycisk X:
- Dodać prop `onCancel?: () => void`
- Gdy `onCancel` jest podany i trwa upload (brak error), pokazać przycisk X obok progress bara

### Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `AddEditEmployeeCalendarDrawer.tsx` | Dodać `hours` do `FIELD_LABELS` i `defaultVisibleFields` |
| `EmployeeCalendarPage.tsx` | Wyliczać i przekazywać `hideHours` |
| `AdminCalendar.tsx` | Prop `hideHours`, warunkowe ukrycie godzin na kafelku i osi |
| `EmployeeDashboard.tsx` | Prop `hideHours`, ukrycie godzin na kartach |
| `CalendarItemDetailsDrawer.tsx` | Prop `hideHours`, ukrycie godzin w szczegółach |
| `mediaUtils.ts` | Parametr `AbortSignal` w `uploadFileWithProgress` |
| `MediaUploader.tsx` | `AbortController` ref + `handleCancel` |
| `MediaUploadProgress.tsx` | Przycisk X anulacji |

