
# Poprawki: "Dodaj protokol" i zapis uslug

## Problem 1: "Dodaj protokol" nie otwiera drawera z danymi klienta

Obecnie klikniecie "Dodaj protokol" w menu szczgolow zlecenia tylko nawiguje do `/admin/protokoly`. Powinno od razu otworzyc drawer `CreateProtocolForm` z wypelnionymi danymi klienta ze zlecenia.

### Rozwiazanie

**CreateProtocolForm** - dodac nowe propsy do pre-fillowania danych:
- `prefillCustomerId`, `prefillCustomerName`, `prefillCustomerPhone`, `prefillCustomerEmail`, `prefillCustomerAddressId`
- W useEffect resetu formularza (tryb nowy) - ustawic te wartosci jesli sa przekazane

**Dashboard.tsx**:
- Dodac stan `protocolFormOpen` i `protocolPrefill` (dane klienta ze zlecenia)
- Zmienic `onAddProtocol` - zamiast nawigacji, ustawic `protocolFormOpen = true` i `protocolPrefill` z danymi zlecenia
- Wyrenderowac `CreateProtocolForm` z pre-fillem na poziomie Dashboard (poza warunkiem `currentView === 'kalendarz'`)
- `onSuccess` refreshuje protokoly

---

## Problem 2: Uslugi nie sa zapisywane w zleceniu

Tabela `calendar_items` nie ma kolumny/tabeli na uslugi. Lokalne stany `selectedServiceIds`, `serviceItems`, `allServices` sa resetowane przy otwarciu drawera, wiec po zapisie i ponownym otwarciu uslugi znikaja.

### Rozwiazanie

**Migracja DB** - dodac tabele `calendar_item_services`:

```text
calendar_item_services
- id (uuid, PK)
- calendar_item_id (uuid, FK -> calendar_items.id, ON DELETE CASCADE)
- service_id (uuid, FK -> unified_services.id)
- custom_price (numeric, nullable)
- instance_id (uuid)
- created_at (timestamptz)
```

Z RLS politykami jak inne tabele (admin/super_admin manage, employee select).

**AddCalendarItemDialog.tsx**:
- W `handleSubmit` - po insert/update calendar_item, zapisac uslugi do `calendar_item_services` (delete starych + insert nowych)
- W useEffect ladowania (isEditMode) - pobrac uslugi z `calendar_item_services` JOIN `unified_services` i ustawic `selectedServiceIds`, `serviceItems`, `allServices`

---

## Zmiany techniczne

| Plik | Zmiana |
|------|--------|
| `CreateProtocolForm.tsx` | Nowe propsy prefill (customerId, name, phone, email, addressId) - ustawiane w useEffect resetu |
| `Dashboard.tsx` | Stan `protocolFormOpen` + `protocolPrefill`, zmiana `onAddProtocol`, renderowanie `CreateProtocolForm` |
| Migracja DB | Tabela `calendar_item_services` z FK, RLS, indeksami |
| `AddCalendarItemDialog.tsx` | Zapis uslug do DB w handleSubmit, ladowanie uslug w useEffect edit mode |
