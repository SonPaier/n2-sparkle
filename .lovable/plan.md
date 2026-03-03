

## Problem: iFirma HMAC autoryzacja i kilka bugów

Przeanalizowałem edge function `invoicing-api/index.ts` i znalazłem **3 krytyczne błędy** w integracji iFirma:

### Bug 1: Klucz API nie jest dekodowany z hex
Klucz API iFirma to string hex (np. `"a1b2c3..."`). Trzeba go zdekodować na bajty przed użyciem jako klucz HMAC. Aktualnie kod robi `TextEncoder.encode(key)` — co koduje sam string hex jako UTF-8, zamiast zdekodować go na bajty.

```
// Aktualnie (ŹLE):
const keyData = encoder.encode("a1b2c3");  // → bajty ASCII liter "a","1","b","2"...

// Powinno być (DOBRZE):
const keyData = hexToBytes("a1b2c3");      // → bajty 0xA1, 0xB2, 0xC3...
```

### Bug 2: Literówki w nazwach pól JSON
- `NazwaSeriiNumerworaci` → powinno być `NazwaSeriiNumeracji`
- `NazwaSzworablonuFaktworury` → powinno być `NazwaSzablonuFaktury`

iFirma może odrzucać/ignorować te pola z błędnymi nazwami.

### Bug 3: Brak obsługi odpowiedzi iFirma
iFirma zwraca `{ "response": { "Identyfikator": 123, ... } }` — ale jeśli odpowiedź ma inną strukturę (np. błąd walidacji z kodem 200), kod nie loguje szczegółów.

### Plan zmian

**Plik: `supabase/functions/invoicing-api/index.ts`**

1. Naprawić `ifirmaHmac()` — dodać dekodowanie hex klucza na bajty:
```typescript
async function ifirmaHmac(hexKey: string, message: string): Promise<string> {
  // Decode hex key to bytes
  const keyData = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const msgData = new TextEncoder().encode(message);
  // ... reszta HMAC jak dotąd
}
```

2. Poprawić literówki w body `ifirmaCreateInvoice`:
   - `NazwaSeriiNumerworaci` → `NazwaSeriiNumeracji`
   - `NazwaSzworablonuFaktworury` → `NazwaSzablonuFaktury`

3. Dodać logowanie odpowiedzi iFirma dla debugowania:
```typescript
const data = await res.json();
console.log("iFirma response:", JSON.stringify(data));
```

4. Naprawić `ifirmaTestConnection` — klucz `abonent` też wymaga hex-decoded HMAC (to już będzie naprawione przez punkt 1).

### Pliki do zmiany
- `supabase/functions/invoicing-api/index.ts` — poprawki HMAC, literówki, logowanie

