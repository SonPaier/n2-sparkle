

# N2Serwis - Skeleton z Sidebarem i Placeholderami

## Co zrobimy

Skopiujemy design system (kolory, fonty, style) z N2Wash i stworzymy layout z sidebarem oraz 4 widokami-placeholderami: Kalendarz, Klienci, Uslugi, Ustawienia. Dodamy tez prosty ekran logowania (placeholder, bez Supabase na razie).

## Struktura widokow

```text
/login          -> Ekran logowania (placeholder)
/               -> Dashboard z sidebarem
  - Kalendarz   (domyslny widok)
  - Klienci
  - Uslugi
  - Ustawienia
```

## Plan implementacji

1. **Skopiowac design system z N2Wash** - kolory (CSS variables), font Outfit, klasy glass-card/gradient-text do `index.css`

2. **Stworzyc layout z sidebarem** (`src/components/layout/DashboardLayout.tsx`)
   - Sidebar wzorowany na N2Wash AdminDashboard (custom aside, nie shadcn SidebarProvider)
   - Logo/nazwa "N2Serwis" na gorze
   - 4 pozycje nawigacji: Kalendarz, Klienci, Uslugi, Ustawienia
   - Collapse/expand na desktopie
   - Mobile: overlay sidebar z hamburger menu
   - User menu na dole z wylogowaniem

3. **Stworzyc 4 strony-placeholdery**
   - `src/pages/Dashboard.tsx` - glowna strona z layoutem i routing wewnetrzny (view state)
   - Kazdy widok to prosty placeholder z ikona i nazwa

4. **Stworzyc strone logowania** (`src/pages/Login.tsx`)
   - Prosty formularz login/haslo wzorowany na N2Wash InstanceAuth
   - Na razie bez backendu - przycisk przekierowuje do dashboardu

5. **Zaktualizowac routing** w `App.tsx`
   - `/login` -> Login
   - `/` -> Dashboard (domyslny widok: Kalendarz)
   - `/:view` -> Dashboard z wybranym widokiem

## Szczegoly techniczne

### Nowe pliki:
- `src/pages/Login.tsx` - ekran logowania
- `src/pages/Dashboard.tsx` - dashboard z sidebarem i widokami
- `src/components/layout/DashboardLayout.tsx` - komponent sidebar + layout

### Modyfikowane pliki:
- `src/index.css` - kolory, fonty, style z N2Wash
- `src/App.tsx` - nowe routy

### Design:
- Font: Outfit (jak N2Wash)
- Kolorystyka: ta sama paleta co N2Wash (fioletowy primary, ciemny sidebar)
- Sidebar: ciemny bg-card, border-r, collapsible
- Ikony: Calendar, Users, BadgeDollarSign, Settings (z lucide-react)

