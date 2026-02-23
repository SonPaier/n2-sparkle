
# Zdjecia do zlecen (calendar items) z rysikiem

## Co robimy
Dodajemy mozliwosc dodawania zdjec do zlecen (calendar_items) - identyczna funkcjonalnosc jak w protokolach: upload zdjec, podglad fullscreen z karuzelą, rysik do adnotacji.

## Zmiany

### 1. Migracja bazy danych
Dodanie kolumny `photo_urls` (jsonb, default `'[]'`) do tabeli `calendar_items`.

```sql
ALTER TABLE public.calendar_items ADD COLUMN photo_urls jsonb DEFAULT '[]'::jsonb;
```

### 2. Reużywalny komponent zdjec
Komponenty `PhotoFullscreenDialog` i `PhotoAnnotationDialog` z folderu `protocols/` sa juz w pelni reuzywalne - nie trzeba ich zmieniac. Komponent `ProtocolPhotosUploader` jest prawie reuzywalny, ale ma zakodowany na sztywno bucket `protocol-photos` i auto-zapis do tabeli `protocols`. Stworzymy nowy, generyczny komponent lub dodamy propsy do istniejacego.

**Podejscie**: Dodamy do `ProtocolPhotosUploader` nowe propsy:
- `storageBucket?: string` (domyslnie `'protocol-photos'`)
- `filePrefix?: string` (domyslnie `'protokol'`)
- `onAutoSave?: (photos: string[]) => void` - zastapi zakodowany zapis do tabeli protocols

To pozwoli reuzywac ten sam komponent zarowno w protokolach jak i w zleceniach.

### 3. CalendarItemDetailsDrawer - sekcja zdjec
Dodanie sekcji "Zdjecia" w drawerze szczegolow zlecenia (miedzy notatkami a SMS):
- Fetch `photo_urls` z `calendar_items` przy otwarciu
- Wyswietlenie `ProtocolPhotosUploader` z odpowiednimi propsami
- Auto-zapis do `calendar_items.photo_urls` po kazdej zmianie (upload/delete/annotacja)

### 4. AddCalendarItemDialog - obsluga photo_urls
Dodanie `photo_urls` do `EditingCalendarItem` interface i logiki zapisu, aby zdjecia nie byly tracone przy edycji zlecenia.

## Pliki do edycji

1. **Migracja SQL** - nowa kolumna `photo_urls` w `calendar_items`
2. **`src/components/protocols/ProtocolPhotosUploader.tsx`** - dodanie propsow `storageBucket`, `filePrefix`, `onAutoSave` dla reużywalnosci
3. **`src/components/admin/CalendarItemDetailsDrawer.tsx`** - sekcja zdjec z uploaderem i rysikiem
4. **`src/components/admin/AddCalendarItemDialog.tsx`** - interface `EditingCalendarItem` + obsluga `photo_urls`
5. **`src/components/admin/AdminCalendar.tsx`** - interface `CalendarItem` + fetch `photo_urls`

## Szczegoly techniczne

### ProtocolPhotosUploader - nowe propsy
```typescript
interface ProtocolPhotosUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  onPhotoUploaded?: (url: string) => void;
  maxPhotos?: number;
  label?: string;
  disabled?: boolean;
  protocolId?: string | null;      // zachowane dla kompatybilnosci
  storageBucket?: string;           // nowe, default 'protocol-photos'
  filePrefix?: string;              // nowe, default 'protokol'
  onAutoSave?: (photos: string[]) => void;  // nowe, generyczny auto-save
}
```

### CalendarItemDetailsDrawer
- Nowy state: `itemPhotos: string[]`
- Fetch photo_urls z calendar_items przy otwarciu (item juz ma dane, trzeba sprawdzic czy photo_urls jest w typie CalendarItem)
- Sekcja z ikona Camera i tytul "Zdjecia"
- ProtocolPhotosUploader z `storageBucket="protocol-photos"`, `filePrefix="zlecenie"`, `onAutoSave` zapisujacy do `calendar_items.photo_urls`

### Bucket storage
Reuzywamy istniejacy bucket `protocol-photos` (publiczny, juz istnieje) - nie trzeba tworzyc nowego.
