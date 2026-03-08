

## Plan: Tryb offline PWA — zaktualizowany

Uwzględniam wszystkie Twoje uwagi.

### Decyzje

1. **Mutacje offline → natychmiastowy toast**, bez kolejkowania. `onlineManager` będzie ustawiony tak, żeby mutacje od razu failowały offline (nie czekały). Toast: "Brak połączenia — nie można zapisać".
2. **gcTime >= maxAge persistera** — ustawimy `gcTime: 1000 * 60 * 60 * 25` (25h) przy `maxAge: 24h` persistera, żeby dane nie były GC przed odczytem z IndexedDB.
3. **Auth denylist** — wykluczymy `/~oauth` i `/login` z cache SW.
4. **Theme-color offline** — dynamiczna zmiana `<meta name="theme-color">` na szary (`#6b7280`) gdy offline, powrót do `#1a1a2e` gdy online. Drobny ale widoczny sygnał w status barze PWA.

### Pliki do zmiany / utworzenia

| Plik | Zmiana |
|---|---|
| `package.json` | Dodać `idb-keyval`, `@tanstack/query-persist-client-core` |
| `src/hooks/useOnlineStatus.ts` | **Nowy** — hook `navigator.onLine` + eventy + theme-color update |
| `src/components/pwa/OfflineBanner.tsx` | **Nowy** — pasek "Brak połączenia" |
| `src/App.tsx` | `PersistQueryClientProvider`, `onlineManager` (mutacje = fail offline), `gcTime: 25h` |
| `src/components/layout/DashboardLayout.tsx` | Dodać `OfflineBanner` |
| `src/sw.ts` | Supabase cache → `StaleWhileRevalidate`, 24h, 500 wpisów. Denylist `/~oauth`, `/login` |
| `index.html` | Dodać `<meta name="theme-color" content="#1a1a2e">` (brakuje teraz) |
| `vite.config.ts` | `navigateFallbackDenylist: [/^\/~oauth/, /^\/login/]` w `injectManifest` |

### Szczegóły implementacji

**`useOnlineStatus.ts`**:
- `useState(navigator.onLine)` + `addEventListener('online'/'offline')`
- `useEffect` aktualizujący `document.querySelector('meta[name=theme-color]').content` — szary offline, `#1a1a2e` online

**`OfflineBanner.tsx`**:
- Sticky top, `bg-amber-500 text-white`, ikona `WifiOff`
- "Brak połączenia z internetem. Dane mogą być nieaktualne."

**`App.tsx`**:
```typescript
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from './lib/idbPersister';
import { onlineManager } from '@tanstack/react-query';

// Mutacje fail natychmiast offline
onlineManager.setEventListener(setOnline => {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
  return () => { /* cleanup */ };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 25, // 25h > persister maxAge
      retry: 1,
    },
    mutations: {
      networkMode: 'online', // fail immediately when offline
    },
  },
});

const persister = createIDBPersister();
// maxAge: 24h
```

**`src/lib/idbPersister.ts`** — nowy helper:
- Używa `idb-keyval` do `get`/`set`/`del` w IndexedDB
- Implementuje interfejs `Persister` z `@tanstack/query-persist-client-core`

**`sw.ts`** — zmiana cache Supabase:
```typescript
registerRoute(
  ({ url }) => url.origin.includes('supabase'),
  new StaleWhileRevalidate({
    cacheName: 'supabase-api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);
```

Dodać denylist w navigation handler:
```typescript
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/~oauth/, /^\/login/],
  })
);
```

