

# Sekcja "Powiadomienia SMS" w formularzu uslugi (ServiceFormDialog)

## Zakres

Skopiowanie sekcji "Szablon przypomnien" z N2Wash `ServiceFormDialog` (linie 829-881) i dodanie jej do obecnego `ServiceFormDialog.tsx` w sekcji "Zaawansowane wlasciwosci". Nazwa zmieniona na "Powiadomienia SMS".

Wymaga wczesniejszego istnienia tabeli `sms_notification_templates` i kolumny `notification_template_id` w `unified_services` (z glownego planu).

---

## Zmiany w `src/components/admin/ServiceFormDialog.tsx`

### 1. Nowe importy
- `useNavigate`, `useLocation` z `react-router-dom`
- `Plus` z `lucide-react` (opcjonalnie, przycisk "Dodaj" uzywa juz istniejacego `Button`)

### 2. Nowe interfejsy (na gorze pliku)

```typescript
interface SmsTemplateItem {
  months: number;
  service_type: string;
}

interface SmsTemplateOption {
  id: string;
  name: string;
  items?: SmsTemplateItem[];
}
```

### 3. Rozszerzenie `ServiceData`
Dodanie pola:
```typescript
notification_template_id?: string | null;
```

### 4. W komponencie `ServiceFormContent`

**Nowe hooki i state:**
- `useNavigate()`, `useLocation()`
- `const [smsTemplates, setSmsTemplates] = useState<SmsTemplateOption[]>([])`

**useEffect -- fetch szablonow SMS:**
Pobranie z tabeli `sms_notification_templates` (kolumny: `id`, `name`, `items`), filtrowane po `instance_id`.

**formData -- nowe pole:**
```typescript
notification_template_id: service?.notification_template_id || '__none__'
```

**Wyliczenie wybranego szablonu:**
```typescript
const selectedSmsTemplate = smsTemplates.find(t => t.id === formData.notification_template_id);
const smsTemplateItems = selectedSmsTemplate?.items || [];
```

**hasAdvancedValues -- dodanie warunku:**
```typescript
service?.notification_template_id
```

**handleSave -- mapowanie:**
`notification_template_id: formData.notification_template_id === '__none__' ? null : formData.notification_template_id`

### 5. JSX -- nowa sekcja w `CollapsibleContent`

Po checkboxie "Popularna usluga", przed zamknieciem `</CollapsibleContent>`, dodanie (kopia z N2Wash, linie 829-881, z polskimi etykietami inline):

- Label: "Powiadomienie SMS"
- FieldInfo tooltip: "Automatyczne powiadomienia SMS po wykonaniu uslugi"
- Select z opcjami: "Brak" (`__none__`) + lista szablonow z `sms_notification_templates`
- Przycisk "Dodaj" obok selecta -- nawiguje do `/admin/powiadomienia-sms/new?returnToService=true&serviceId=X`
- Pod selectem: lista pozycji wybranego szablonu (miesiace + typ uslugi), wyswietlana jako `border-l-2` lista tekstowa

---

## Kolejnosc

Ta zmiana jest czescia kroku 5 z glownego planu i zostanie zaimplementowana po:
1. Migracji DB (tabele + kolumna `notification_template_id`)
2. Widoku listy szablonow
3. Strony edycji szablonu
4. Routingu i sidebaru

