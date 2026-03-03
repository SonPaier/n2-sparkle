

## Plan: Drawer audytu czasu pracy pracownika

### Cel
Ikonka przy kazdym pracowniku w tabeli. Klikniecie otwiera Sheet z prawej z historia zmian time entries w wybranym okresie. Design wg specyfikacji: grupowanie po dniach, timeline z kolorowa kreska, badge roznicowe.

### Pliki do utworzenia

**1. `src/hooks/useTimeEntryAuditLog.ts`**
- Query `time_entry_audit_log` po `employee_id`, `instance_id`, zakres dat (`entry_date` between)
- Sortowanie: `entry_date ASC`, `created_at ASC`
- Osobny query na `profiles` po unikalnych `changed_by` zeby pobrac imiona

**2. `src/components/admin/employees/TimeEntryAuditDrawer.tsx`**
- Sheet standardowy (400px desktop, 100% mobile, od prawej)
- Naglowek: imie pracownika
- Tresc: ScrollArea z lista dni

Struktura UI per dzien:
```text
┌─ Poniedziałek 2 marca ──────────────────┐
│▐ zaraportowano 7h 30min                  │  ← szary tekst, brak tla
│▐   o 17:12 dnia 02.03.2026              │
│▐ zmieniono na 8h 20min          [+50min] │  ← fioletowe tlo, badge
│▐   o 19:32 dnia 27.03.2026              │
└──────────────────────────────────────────┘
```

- Pionowa kreska lewa: fioletowa jesli dzien ma update/delete, szara jesli tylko create
- Create: szary tekst, bez tla — "zaraportowano **Xh Ymin** o HH:MM dnia DD.MM.YYYY"
- Update: lekko fioletowe tlo — "zmieniono na **Xh Ymin** o HH:MM dnia DD.MM.YYYY" + badge
- Delete: lekko czerwone tlo — "usunięto wpis o HH:MM dnia DD.MM.YYYY"
- Badge: pomaranczowy (+), zielony (−U+2212), roznica vs poprzedni wpis w danym dniu
- Format: `7h 30min`, `8h 00min`

**3. Modyfikacja `src/components/admin/employees/EmployeesView.tsx`**
- Dodanie ikonki `FileText` w wierszu pracownika (obok avatara lub po prawej)
- Stan `auditEmployeeId: string | null` — toggle, jeden drawer naraz
- Ikonka wyszarzona (`opacity-30 pointer-events-none`) jesli brak wpisow w okresie
- Import i renderowanie `TimeEntryAuditDrawer`

**4. Modyfikacja `src/components/admin/employees/index.ts`**
- Eksport `TimeEntryAuditDrawer`

### Logika grupowania

1. Pobierz logi z `time_entry_audit_log` dla employee + okres
2. Grupuj po `entry_date`
3. Sortuj dni chronologicznie, wpisy w dniu po `created_at`
4. Pierwszy wpis dnia (create) = "zaraportowano" + `new_total_minutes`
5. Kolejne wpisy = "zmieniono" + `new_total_minutes` + badge z roznica (`new_total_minutes - prev.new_total_minutes`)
6. Delete = "usunięto" + badge ujemny (`-old_total_minutes`)
7. Border-left kolor: fioletowy jesli dzien ma update/delete, szary jesli tylko create

### Brak zmian w bazie
Tabela `time_entry_audit_log` + RLS + trigger juz istnieja.

