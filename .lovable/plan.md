

## Plan: Skopiowanie logiki wersjonowania z N2Wash

### Co robimy

Przenosimy cały system wersjonowania aplikacji z N2Wash: sprawdzanie wersji z serwera, banner aktualizacji, wyświetlanie numeru wersji w ustawieniach i mobile menu.

### Nowe pliki do utworzenia

1. **`src/lib/version.ts`** — stała `VERSION_STORAGE_KEY = 'n2s_app_version'`

2. **`src/hooks/useAppUpdate.ts`** — hook z N2Wash (fetch `/version.json`, porównanie z localStorage, SW update detection, `applyUpdate` z czyszczeniem cache)

3. **`src/components/pwa/UpdateBanner.tsx`** — banner "Dostępna nowa wersja aplikacji" z przyciskiem "Aktualizuj", fixed top z `z-[100]`

4. **`public/version.json`** — plik wersji: `{"version": "01.00.01", "buildTime": "2026-03-06T..."}`

### Zmiany w istniejących plikach

5. **`src/components/layout/DashboardLayout.tsx`** — dodać `<UpdateBanner />` na górze layoutu + wyświetlanie `currentVersion` w sidebar (pod sekcją użytkownika), analogicznie do N2Wash SettingsView: `Panel Admina v{currentVersion}`

6. **`src/components/admin/SettingsView.tsx`** — dodać `useAppUpdate()` i wyświetlić wersję na dole listy tabów: `Panel Admina v{currentVersion}`

### Jak to działa

- Przy starcie apki hook pobiera `/version.json?t=timestamp` (cache-busting)
- Porównuje z wersją w `localStorage`
- Pierwszy raz: zapisuje wersję, brak bannera
- Gdy wersja się zmieni: pojawia się banner na górze ekranu
- Klik "Aktualizuj": czyści cache, wysyła `SKIP_WAITING` do SW, przeładowuje stronę
- Numer wersji widoczny w sidebar i w ustawieniach

