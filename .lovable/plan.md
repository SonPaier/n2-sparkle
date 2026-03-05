

## Plan: Drawer ustawien powiadomien push w widoku Aktywnosci

### Co zostanie zrobione

Dodanie ikony ustawien (Settings2) w naglowku widoku Aktywnosci, ktora otwiera boczna szuflade (Sheet) z ustawieniami powiadomien push. Drawer bedzie dostetpny zarowno dla admina jak i pracownika.

### Zmiany

**1. `src/hooks/usePushSubscription.ts`** -- nowy hook (skopiowany z N2Wash, bez i18n)
- `checkSubscription()` -- sprawdza czy jest aktywna subskrypcja
- `subscribe()` -- prosi o pozwolenie, subskrybuje i zapisuje do `push_subscriptions` w bazie
- `unsubscribe()` -- usuwa subskrypcje z bazy i przegladarki
- `isSubscribed`, `isLoading`, `isSupported`
- Wymaga VAPID_PUBLIC_KEY (klucz publiczny, bezpiecznie w kodzie)

**2. `src/components/admin/NotificationsView.tsx`** -- zmiany:
- Import Settings2 icon + useState do kontroli drawera
- Dodanie przycisku Settings2 obok istniejacych ikon w naglowku
- Dodanie komponentu Sheet (drawer z prawej, 400px desktop, 100% mobile -- zgodnie ze standardem projektu)

**3. `src/components/admin/NotificationSettingsDrawer.tsx`** -- nowy komponent:
- Sheet z prawej strony
- Sekcja "Powiadomienia push" z ikona Smartphone
- Gdy nie wspierane: info o wymaganiach (iPhone Safari + dodaj do ekranu, Android Chrome)
- Gdy wspierane i nie wlaczone: przycisk "Wlacz powiadomienia push" + opis
- Gdy wlaczone: zielony checkmark + "Powiadomienia wlaczone" + przycisk "Wylacz"
- Styl zgodny z innymi drawerami (bialy bg, rounded-lg, standardowy Sheet)

### Uwaga
Ten plan dotyczy TYLKO UI i hooka. Tabela `push_subscriptions`, edge function `send-push-notification`, service worker i integracja z `createNotification` to osobne kroki (juz zaplanowane wczesniej).

