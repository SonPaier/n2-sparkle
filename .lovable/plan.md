

# Checkbox "Stworz konto w aplikacji" w dialogu dodawania pracownika

## Co sie zmieni

W dialogu "Dodaj pracownika" (`AddEditEmployeeDialog.tsx`) pojawi sie:

1. **Checkbox** "Stworz konto w aplikacji dla pracownika" -- widoczny tylko w trybie dodawania (nie edycji), tylko dla admina
2. **Pola username i haslo** -- pokazuja sie tylko gdy checkbox jest zaznaczony
3. **Przycisk "Dodaj" jest zablokowany** jesli checkbox zaznaczony ale username lub haslo sa puste (haslo min 6 znakow, username min 3 znaki)
4. **Automatyczne tworzenie kalendarza** -- juz jest zaimplementowane w edge function `manage-instance-users` (linie 196-223), wiec nie trzeba nic zmieniac na backendzie

## Przeplyw

1. Admin otwiera "Dodaj pracownika"
2. Wpisuje imie, stawke, opcjonalnie zdjecie
3. Zaznacza checkbox "Stworz konto w aplikacji"
4. Pojawiaja sie pola: "Nazwa uzytkownika" i "Haslo"
5. Wpisuje dane logowania
6. Klika "Dodaj"
7. System:
   - Tworzy rekord `employees` (jak dotychczas)
   - Wywoluje `manage-instance-users` z akcja `create`, rola `employee`
   - Edge function automatycznie tworzy: auth user, profil, role, employee_calendar_config

## Zmiany techniczne

### Plik: `src/components/admin/employees/AddEditEmployeeDialog.tsx`

- Nowe stany: `createAccount` (boolean), `username` (string), `password` (string)
- Reset stanow przy zamknieciu/otwarciu dialogu
- Checkbox widoczny tylko gdy `!isEditing && isAdmin`
- Pola username/haslo widoczne tylko gdy `createAccount === true`
- Walidacja: username min 3 znaki, haslo min 6 znakow
- Przycisk "Dodaj" disabled jesli `createAccount && (!username.trim() || username.length < 3 || password.length < 6)`
- W `handleSubmit`: po utworzeniu pracownika, jesli `createAccount`, wywolanie `supabase.functions.invoke('manage-instance-users', { body: { action: 'create', instanceId, username, password, role: 'employee' } })`
- Obsluga bledow (np. username juz istnieje) -- toast z bledem, ale pracownik i tak zostaje dodany

### Brak zmian w backendzie

Edge function `manage-instance-users` juz obsluguje tworzenie usera z rola `employee` i automatycznie tworzy `employee_calendar_config` z wszystkimi aktywnymi kolumnami kalendarza.

