

# Wyszukiwanie klientów po adresach (name, city)

## Zmiana

Rozszerzenie wyszukiwarki klientów o dane z tabeli `customer_addresses` -- pola `name` i `city`.

## Szczegóły techniczne

### Plik: `src/components/admin/CustomersView.tsx`

1. Dodanie stanu `addressMap` typu `Map<string, {name: string, city: string | null}[]>` -- mapowanie customer_id na listę adresów.

2. W `fetchCustomers` -- drugi query do `customer_addresses` pobierający `customer_id, name, city` dla danego `instance_id`. Wynik zapisany do mapy.

3. W `filteredCustomers` useMemo -- dodanie warunku: jeśli fraza pasuje do `address.name.toLowerCase()` lub `address.city?.toLowerCase()` któregokolwiek adresu klienta, klient jest uwzględniony w wynikach.

4. Placeholder inputa zmieniony na: `"Szukaj po nazwie, telefonie, email, firmie, NIP, adresie..."`.

