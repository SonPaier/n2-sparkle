

## Analiza: gdzie trzymać feature toggles

### Opcje

1. **Nowa tabela `instance_features`** (key-value: `instance_id` + `feature_key` + `enabled`) — dodanie nowego feature = tylko INSERT, zero migracji schemy
2. **Kolumny w `instances`** (np. `activities_enabled boolean`) — każdy nowy feature = nowa migracja ALTER TABLE

### Rekomendacja: `instance_features` (opcja 1)

Skoro w przyszłości będzie dużo feature toggleów, key-value jest zdecydowanie lepsze:
- Nowy feature = po prostu nowy `feature_key` string, bez migracji
- Łatwe query: `SELECT enabled FROM instance_features WHERE instance_id = X AND feature_key = 'activities'`
- Zakładka "Aplikacja" w ustawieniach może dynamicznie renderować listę toggleów
- Można dodać kolumnę `label` / `description` żeby UI sam się budował

### Schemat tabeli

```text
instance_features
├── id (uuid, PK)
├── instance_id (uuid, NOT NULL)
├── feature_key (text, NOT NULL)       -- np. 'activities', 'protocols', 'invoicing'
├── enabled (boolean, DEFAULT true)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── UNIQUE (instance_id, feature_key)
```

### Plan implementacji (bez zmian vs. poprzedni plan)

Plan z poprzedniej wiadomości pozostaje taki sam — `instance_features` to właściwe miejsce. Jedyna drobna zmiana: hook `useInstanceFeature` powinien zwracać `true` jako domyślną wartość gdy brak wiersza w tabeli (feature domyślnie włączony), co pozwala na stopniowe dodawanie toggleów bez potrzeby seedowania danych.

Czy zatwierdzasz ten plan do implementacji?

