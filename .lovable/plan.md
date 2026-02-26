

## Plan: Poprawki MediaUploader

### Problem z utratą danych (audio/video nie widoczne po ponownym otwarciu)
Główny select w `Dashboard.tsx` (linia 120) i `EmployeeCalendarPage.tsx` (linia 118) nie zawiera kolumny `media_items`. Dane zapisują się do bazy prawidłowo, ale przy ponownym otwarciu drawera `item.media_items` jest `undefined` i fallback ładuje tylko zdjęcia z `photo_urls`.

### Zmiany

**1. Dodać `media_items` do selectów w:**
- `src/pages/Dashboard.tsx` — linia 120 i linia 339
- `src/pages/EmployeeCalendarPage.tsx` — linia 118

**2. AudioRecorder — przywrócić czerwony "Stop"**
- Zamienić przycisk "Zapisz" na czerwony "Stop" z ikoną Square
- Zachować auto-start nagrywania

**3. MediaUploadProgress — flat, białe tło**
- Usunąć Loader2 spinner
- Białe tło (`bg-background border`)
- Prosty pasek postępu z % na końcu, bez labela nad paskiem

**4. Przywrócić nagłówki sekcji**
- "Nagrania głosowe" nad listą audio
- "Dokumenty" nad listą plików
- "Video" nad listą video

**5. Ujednolicić fonty**
- Wszystkie pozycje (video, audio, pliki): ten sam `text-sm` styl

### Pliki do edycji:
- `src/pages/Dashboard.tsx` (2 selecty)
- `src/pages/EmployeeCalendarPage.tsx` (1 select)
- `src/components/media/AudioRecorder.tsx`
- `src/components/media/MediaUploadProgress.tsx`
- `src/components/media/MediaUploader.tsx`

