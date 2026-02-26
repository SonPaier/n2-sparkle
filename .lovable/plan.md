

## Plan: MediaUploader — reużywalny komponent

### Zakres zmian po uwagach użytkownika:
- Akceptowane pliki: zdjęcia, video, nagrania głosowe, PDF/DOC/DOCX (nic więcej)
- Każde usunięcie wymaga confirmation popup (ConfirmDialog)
- Bez wyświetlania rozmiaru plików na UI
- Wykorzystanie istniejących komponentów: PhotoFullscreenDialog, PhotoAnnotationDialog, ConfirmDialog

### Nowe pliki:

**1. `src/components/media/mediaTypes.ts`** — typy
```typescript
interface MediaItem {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  mimeType?: string;
}
```

**2. `src/components/media/mediaUtils.ts`** — kompresja obrazów (z ProtocolPhotosUploader), kompresja video (canvas re-encoding z obniżonym bitrate)

**3. `src/components/media/MediaUploadProgress.tsx`** — overlay z progress bar (%), spinner, przycisk retry na błąd. Używa XMLHttpRequest.upload.onprogress

**4. `src/components/media/AudioRecorder.tsx`** — MediaRecorder API, pulsujący dot + czas, po zakończeniu opcjonalny input na nazwę, przycisk "Zapisz"

**5. `src/components/media/MediaUploader.tsx`** — główny komponent:
- Przycisk "Dodaj plik" → DropdownMenu z 4 opcjami: Zdjęcie, Video, Nagranie głosowe, Dokument (PDF/DOC/DOCX)
- Sekcja zdjęcia+video: grid 4 kolumny, kafelki aspect-square, zdjęcia klikalne → PhotoFullscreenDialog z rysikiem, video z ikoną play
- Sekcja nagrania głosowe: lista z play/pause, nazwa, przycisk usuń
- Sekcja dokumenty: lista z ikoną, nazwa, przycisk usuń
- Każdy delete → ConfirmDialog (istniejący komponent)
- Upload z progress bar (MediaUploadProgress)
- Retry na błąd uploadu

### Edycje istniejących plików:

**6. `src/components/admin/CalendarItemDetailsDrawer.tsx`**
- Tab "Pliki": zamiana ProtocolPhotosUploader na MediaUploader
- Dane: kolumna `media_items` (JSONB) w calendar_items + fallback z `photo_urls`

### Backend:

**7. Migracja SQL:**
- `ALTER TABLE calendar_items ADD COLUMN media_items jsonb DEFAULT '[]'`
- Nowy storage bucket `media-files` (public)
- RLS policies na bucket

### Pliki do edycji/utworzenia:
1. `src/components/media/mediaTypes.ts` (nowy)
2. `src/components/media/mediaUtils.ts` (nowy)
3. `src/components/media/MediaUploadProgress.tsx` (nowy)
4. `src/components/media/AudioRecorder.tsx` (nowy)
5. `src/components/media/MediaUploader.tsx` (nowy)
6. `src/components/admin/CalendarItemDetailsDrawer.tsx` (edycja)
7. Migracja SQL (nowa kolumna + bucket)

