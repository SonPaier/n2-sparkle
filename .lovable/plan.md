

# N2Serwis - Pelny system logowania, rol i subdomain detection z N2Wash

## Co zrobimy

Skopiujemy kompletny system autentykacji, rol, subdomain detection i edge functions z N2Wash, dostosowujac go do domeny `n2service.com`.

## Struktura subdomen

```text
instance_name.admin.n2service.com  -> Panel admina instancji (login + dashboard)
instance_name.n2service.com        -> Widok publiczny instancji (na przyszlosc)
super.admin.n2service.com          -> Panel super admina
localhost / *.lovable.app           -> Tryb deweloperski (pelny dostep)
```

## Plan implementacji

### 1. Wlaczenie Lovable Cloud (Supabase)
- Podlaczenie backendu Supabase do projektu (wymagane przed migracjami)

### 2. Migracja bazy danych (1 migracja zbiorcza)

Wszystko w jednej migracji, w kolejnosci:

**Typy enum:**
- `app_role`: `super_admin`, `admin`, `user`, `employee`, `hall`, `sales`

**Tabele:**
- `instances` - firmy/instancje (name, slug, phone, address, email, logo_url, primary_color, active, working_hours JSONB)
- `profiles` - profile uzytkownikow (email, full_name, phone, username, instance_id, is_blocked)
- `user_roles` - role uzytkownikow (user_id, role, instance_id, hall_id)
- `employee_permissions` - uprawnienia pracownikow (instance_id, user_id, feature_key, enabled)

**Funkcje security definer:**
- `has_role(user_id, role)` - czy user ma dana role
- `has_instance_role(user_id, role, instance_id)` - czy user ma role w instancji
- `is_user_blocked(user_id)` - czy user jest zablokowany
- `has_employee_permission(user_id, instance_id, feature_key)` - uprawnienia pracownika

**Triggery:**
- `handle_new_user()` - auto-tworzenie profilu po rejestracji
- `update_updated_at_column()` - auto-update `updated_at`

**RLS Policies (identyczne jak N2Wash):**
- instances: publiczne do odczytu, super_admin zarzadza
- profiles: user widzi swoj, admin widzi swoich, anyone moze lookup po username
- user_roles: user widzi swoje, super_admin zarzadza
- employee_permissions: admin zarzadza, user widzi swoje

**Indeksy:**
- `profiles(instance_id, username)` - unique per instancja
- `profiles(username)` - szybki lookup

### 3. Edge Functions (3 funkcje, identyczne jak N2Wash)

**`create-user`** (verify_jwt: true)
- Super admin tworzy uzytkownikow globalnie
- Walidacja: caller musi byc super_admin
- Tworzy auth user + profil + rola

**`init-admin`** (verify_jwt: false)
- Bootstrap pierwszego admina instancji
- Dziala tylko jesli instancja nie ma jeszcze admina
- Tworzy auth user + profil + rola admin
- (Bez kopiowania global scopes - to N2Wash-specific)

**`manage-instance-users`** (verify_jwt: false)
- Zarzadzanie uzytkownikami instancji przez admina
- Akcje: list, create, update, delete, block, unblock, reset-password
- Walidacja: caller musi byc admin instancji lub super_admin
- Create generuje email wewnetrzny: `username_instanceid@internal.local`
- Role dozwolone: admin, employee, hall

### 4. Frontend - Auth System

**`src/hooks/useAuth.tsx`** (skopiowany z N2Wash, bez Sentry):
- AuthProvider context
- user, session, roles, username, loading
- signIn, signOut, signUp
- hasRole, hasInstanceRole
- fetchUserRoles - pobiera role + username rownolegle
- forceClearAuthStorage - fallback na wypadek bledu signOut
- onAuthStateChange + getSession pattern
- Pomijanie re-fetcha rol na TOKEN_REFRESHED (previousUserIdRef)

**`src/components/ProtectedRoute.tsx`** (identyczny z N2Wash):
- Sprawdzanie user zalogowany
- Sprawdzanie wymaganej roli (admin pozwala tez employee, hall, sales)
- Redirect do /login z returnTo param
- Loading spinner

**`src/components/RoleBasedRedirect.tsx`** (dostosowany do N2Serwis):
- hall -> /halls/:hallId (na przyszlosc)
- super_admin -> /super-admin (na przyszlosc)
- admin/employee -> / (dashboard)
- sales -> /sales (na przyszlosc)
- Domyslnie: admin/employee -> dashboard glowny

### 5. Frontend - Login Page z logika instancji

**Aktualizacja `src/pages/Login.tsx`**:
- Props: `subdomainSlug?: string` (jak InstanceAuth w N2Wash)
- Pobieranie instancji po slug z Supabase
- Login przez username: lookup email w profiles -> signIn
- Walidacja formularza z bledami (username/password/general)
- Sprawdzanie is_blocked
- Redirect jesli juz zalogowany z odpowiednia rola
- Loading states (instance loading, auth loading, submit loading)
- Error states (brak instancji, nieaktywna, bledne dane)
- Zachowanie obecnego designu (N2Serwis branding)

### 6. Frontend - Subdomain Detection + Routing

**Aktualizacja `index.html`**:
- Tytul: "N2Serwis"
- Meta tags dostosowane
- Skrypt do dynamic manifest (n2service.com zamiast n2wash.com)

**Aktualizacja `src/App.tsx`**:
- `getSubdomainInfo()` z domena `n2service.com`:
  - `super.admin.n2service.com` -> super_admin
  - `instance.admin.n2service.com` -> instance_admin
  - `instance.n2service.com` -> instance_public
  - localhost / lovable.app -> dev
- Oddzielne route components:
  - `InstanceAdminRoutes` - login + protected dashboard
  - `InstancePublicRoutes` - placeholder na przyszlosc
  - `SuperAdminRoutes` - placeholder na przyszlosc
  - `DevRoutes` - pelny dostep do testowania
- Opakowanie w `AuthProvider`

**Aktualizacja `src/components/layout/DashboardLayout.tsx`**:
- signOut z useAuth zamiast navigate('/login')

## Szczegoly techniczne

### Nowe pliki:
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/RoleBasedRedirect.tsx`
- `supabase/functions/create-user/index.ts`
- `supabase/functions/init-admin/index.ts`
- `supabase/functions/manage-instance-users/index.ts`
- 1 migracja SQL

### Modyfikowane pliki:
- `index.html` - tytul, meta, subdomain script
- `src/App.tsx` - subdomain detection, AuthProvider, route components
- `src/pages/Login.tsx` - pelna logika auth z Supabase
- `src/components/layout/DashboardLayout.tsx` - signOut z useAuth

### Roznice vs N2Wash:
- Domena: `n2service.com` zamiast `n2wash.com`
- Branding: N2Serwis zamiast N2Wash
- Bez Sentry (na razie)
- Bez react-helmet-async
- Bez CarModelsProvider
- Bez copy_global_scopes w init-admin (N2Wash-specific)
- Bez tabel N2Wash-specific (stations, services, reservations, customers itd.)
- Bez _shared/sentry.ts w edge functions
- hall_id w user_roles bez FK do halls (tabela halls nie istnieje jeszcze)

