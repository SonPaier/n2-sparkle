

# Skopiowanie rysika i fullscreen z N2Wash

## Problem

Obecny `PhotoFullscreenDialog` to zle wymyslona implementacja rysika -- wszystko w jednym komponencie, inny UI niz w N2Wash. Trzeba skopiowac dokladna logike i flow z N2Wash.

## Co robimy

Zamieniamy obecne pliki na dokladne kopie z N2Wash (z minimalnymi adaptacjami):

### 1. Nowy plik: `src/components/protocols/PhotoAnnotationDialog.tsx`

Dokladna kopia z N2Wash -- osobny fullscreen dialog do rysowania po zdjeciu:
- Canvas z PointerEvents (dziala na mobile i desktop)
- Toolbar gora: kolory (czerwony, zolty, niebieski) po lewej, rysik + X po prawej
- Toolbar dol: undo/redo/clear po lewej, przycisk "Zapisz" po prawej (pojawia sie tylko gdy sa kreski)
- Zapis: renderuje obraz + kreski na offscreen canvas, uploaduje do `protocol-photos` bucket, usuwa stary plik, zwraca nowy URL
- Uzywamy `@radix-ui/react-dialog` primitives (DialogPrimitive) z z-index 10001+ (nad fullscreen viewerem)

### 2. Zastapienie: `src/components/protocols/PhotoFullscreenDialog.tsx`

Dokladna kopia z N2Wash -- prosty fullscreen viewer:
- Props: `open`, `onOpenChange`, `photoUrl`, `onAnnotate?`, `allPhotos?`, `initialIndex?`
- Przyciski: rysik (otwiera PhotoAnnotationDialog) + X (zamknij) -- okragle biale przyciski
- Strzalki carousel (lewo/prawo) -- okragle biale przyciski
- Licznik zdjec na dole
- Klikniecie w tlo zamyka dialog
- Uzywamy `@radix-ui/react-dialog` primitives z z-index 9998+
- Export jako named export: `export const PhotoFullscreenDialog`

### 3. Zastapienie: `src/components/protocols/ProtocolPhotosUploader.tsx`

Dokladna kopia z N2Wash z adaptacjami:
- Props: `photos`, `onPhotosChange`, `onPhotoUploaded?`, `maxPhotos?`, `label?`, `disabled?`, `protocolId?`
- Grid 4 kolumny z miniaturami
- Tile "Dodaj zdjecie" z ikona kamery
- Klikniecie w miniature otwiera fullscreen
- X na miniaturze otwiera AlertDialog potwierdzenia
- Kompresja obrazow przed uploadem (inline `compressImage`)
- `onAnnotate` callback: po zapisaniu rysika aktualizuje liste zdjec i auto-zapisuje do tabeli `protocols` (zamiast `vehicle_protocols`)
- Named export: `export const ProtocolPhotosUploader`

### 4. Modyfikacja: `src/components/protocols/CreateProtocolForm.tsx`

- Zmiana importu z default na named: `import { ProtocolPhotosUploader } from './ProtocolPhotosUploader'`
- Zmiana propsow: `photoUrls`/`onChange` -> `photos`/`onPhotosChange` + dodanie `protocolId={editingProtocolId}`

## Podsumowanie zmian

| Plik | Akcja |
|------|-------|
| `src/components/protocols/PhotoAnnotationDialog.tsx` | Nowy -- kopia z N2Wash |
| `src/components/protocols/PhotoFullscreenDialog.tsx` | Zastapienie -- kopia z N2Wash |
| `src/components/protocols/ProtocolPhotosUploader.tsx` | Zastapienie -- kopia z N2Wash (tabela `protocols` zamiast `vehicle_protocols`) |
| `src/components/protocols/CreateProtocolForm.tsx` | Modyfikacja importow i propsow ProtocolPhotosUploader |

