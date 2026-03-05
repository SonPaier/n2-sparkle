import { useState, useRef, useCallback } from 'react';
import { Camera, Video, Mic, FileText, Plus, Play, Pause, Trash2, FileIcon, FolderOpen } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PhotoFullscreenDialog } from '@/components/protocols/PhotoFullscreenDialog';
import { MediaUploadProgress } from './MediaUploadProgress';
import { AudioRecorder } from './AudioRecorder';
import type { MediaItem } from './mediaTypes';
import {
  compressImage,
  compressVideo,
  uploadFileWithProgress,
  generateFileName,
} from './mediaUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaUploaderProps {
  items: MediaItem[];
  onItemsChange: (items: MediaItem[]) => void;
  onAutoSave?: (items: MediaItem[]) => void;
  storageBucket?: string;
  imageBucket?: string;
  filePrefix?: string;
  maxItems?: number;
  disabled?: boolean;
  enableAnnotation?: boolean;
}

export const MediaUploader = ({
  items,
  onItemsChange,
  onAutoSave,
  storageBucket = 'media-files',
  imageBucket = 'protocol-photos',
  filePrefix = 'media',
  maxItems = 50,
  disabled = false,
  enableAnnotation = true,
}: MediaUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anyFileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const images = items.filter((i) => i.type === 'image');
  const videos = items.filter((i) => i.type === 'video');
  const audios = items.filter((i) => i.type === 'audio');
  const files = items.filter((i) => i.type === 'file');

  const saveItems = useCallback(
    (newItems: MediaItem[]) => {
      onItemsChange(newItems);
      onAutoSave?.(newItems);
    },
    [onItemsChange, onAutoSave],
  );

  const handleCancelUpload = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadLabel('');
  };

  const doUpload = async (
    file: Blob,
    bucket: string,
    fileName: string,
    contentType: string,
    mediaType: MediaItem['type'],
    displayName?: string,
  ) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadLabel(displayName || fileName);
    setRetryFn(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const url = await uploadFileWithProgress(bucket, fileName, file, contentType, setUploadProgress, controller.signal);
      const newItem: MediaItem = { type: mediaType, url, name: displayName || fileName, mimeType: contentType };
      const newItems = [...items, newItem];
      saveItems(newItems);
      toast.success('Plik przesłany');
    } catch (err: any) {
      if (err?.message === 'Upload anulowany') return;
      setUploadError(err?.message || 'Błąd przesyłania');
      setRetryFn(() => () => doUpload(file, bucket, fileName, contentType, mediaType, displayName));
    } finally {
      abortControllerRef.current = null;
      setUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageInputRef.current) imageInputRef.current.value = '';
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadLabel('Kompresja zdjęcia...');
      setUploadError(null);
      const compressed = await compressImage(file);
      const fileName = generateFileName(filePrefix, 'jpg');
      await doUpload(compressed, imageBucket, fileName, 'image/jpeg', 'image', file.name);
    } catch {
      setUploading(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoInputRef.current) videoInputRef.current.value = '';
    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadLabel('Kompresja video...');
      setUploadError(null);
      const compressed = await compressVideo(file, (pct) => {
        setUploadLabel(`Kompresja video... ${pct}%`);
      });
      const ext = file.name.split('.').pop() || 'webm';
      const fileName = generateFileName(filePrefix, compressed === file ? ext : 'webm');
      const ct = compressed === file ? file.type : 'video/webm';
      await doUpload(compressed, storageBucket, fileName, ct, 'video', file.name);
    } catch {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = generateFileName(filePrefix, ext);
    await doUpload(file, storageBucket, fileName, file.type, 'file', file.name);
  };

  const handleAnyFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (anyFileInputRef.current) anyFileInputRef.current.value = '';

    if (file.type.startsWith('image/')) {
      try {
        setUploading(true);
        setUploadProgress(0);
        setUploadLabel('Kompresja zdjęcia...');
        setUploadError(null);
        const compressed = await compressImage(file);
        const fileName = generateFileName(filePrefix, 'jpg');
        await doUpload(compressed, imageBucket, fileName, 'image/jpeg', 'image', file.name);
      } catch {
        setUploading(false);
      }
    } else if (file.type.startsWith('video/')) {
      try {
        setUploading(true);
        setUploadProgress(0);
        setUploadLabel('Kompresja video...');
        setUploadError(null);
        const compressed = await compressVideo(file, (pct) => {
          setUploadLabel(`Kompresja video... ${pct}%`);
        });
        const ext = file.name.split('.').pop() || 'webm';
        const fileName = generateFileName(filePrefix, compressed === file ? ext : 'webm');
        const ct = compressed === file ? file.type : 'video/webm';
        await doUpload(compressed, storageBucket, fileName, ct, 'video', file.name);
      } catch {
        setUploading(false);
      }
    } else {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = generateFileName(filePrefix, ext);
      await doUpload(file, storageBucket, fileName, file.type, 'file', file.name);
    }
  };

  const handleAudioRecorded = async (blob: Blob, name?: string) => {
    setShowAudioRecorder(false);
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const fileName = generateFileName(filePrefix + '-audio', ext);
    await doUpload(blob, storageBucket, fileName, blob.type, 'audio', name || `Nagranie ${audios.length + 1}`);
  };

  const handleDelete = async (index: number) => {
    const item = items[index];
    const newItems = items.filter((_, i) => i !== index);
    saveItems(newItems);
    try {
      const bucket = item.type === 'image' ? imageBucket : storageBucket;
      const urlParts = item.url.split('/');
      const fName = urlParts[urlParts.length - 1];
      if (fName) await supabase.storage.from(bucket).remove([fName]);
    } catch {}
    setDeleteIndex(null);
  };

  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudio(null);
      audio.onerror = () => {
        toast.error('Nie udało się odtworzyć nagrania');
        setPlayingAudio(null);
      };
      audio.play().catch(() => {
        toast.error('Nie udało się odtworzyć nagrania');
        setPlayingAudio(null);
      });
      audioRef.current = audio;
      setPlayingAudio(url);
    }
  };

  const handleAnnotate = async (newUrl: string) => {
    const oldUrl = fullscreenPhoto;
    if (!oldUrl) return;
    const newItems = items.map((i) => (i.url === oldUrl ? { ...i, url: newUrl } : i));
    saveItems(newItems);
    setFullscreenPhoto(newUrl);
  };

  const allPhotos = images.map((i) => i.url);

  // Empty state
  if (items.length === 0 && !uploading && !uploadError && !showAudioRecorder) {
    return (
      <div className="space-y-4">
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileSelect} className="hidden" />
        <input ref={anyFileInputRef} type="file" accept="*" onChange={handleAnyFileSelect} className="hidden" />

        <EmptyState icon={FolderOpen} message="To zlecenie nie ma dodanych plików" />

        {!disabled && (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Dodaj plik
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2">
                  <Camera className="h-4 w-4" /> Zdjęcie
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => videoInputRef.current?.click()} className="gap-2">
                  <Video className="h-4 w-4" /> Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAudioRecorder(true)} className="gap-2">
                  <Mic className="h-4 w-4" /> Nagranie głosowe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <FileText className="h-4 w-4" /> Dokument (PDF/DOC)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => anyFileInputRef.current?.click()} className="gap-2">
                  <FolderOpen className="h-4 w-4" /> Plik z dysku
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileSelect} className="hidden" />
      <input ref={anyFileInputRef} type="file" accept="*" onChange={handleAnyFileSelect} className="hidden" />

      {/* Add button */}
      {!disabled && items.length < maxItems && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Dodaj plik
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2">
              <Camera className="h-4 w-4" /> Zdjęcie
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => videoInputRef.current?.click()} className="gap-2">
              <Video className="h-4 w-4" /> Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAudioRecorder(true)} className="gap-2">
              <Mic className="h-4 w-4" /> Nagranie głosowe
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
              <FileText className="h-4 w-4" /> Dokument (PDF/DOC)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => anyFileInputRef.current?.click()} className="gap-2">
              <FolderOpen className="h-4 w-4" /> Plik z dysku
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Upload progress */}
      {(uploading || uploadError) && (
        <MediaUploadProgress
          progress={uploadProgress}
          error={uploadError}
          onRetry={retryFn || undefined}
          onCancel={uploading ? handleCancelUpload : undefined}
          label={uploadLabel}
        />
      )}

      {/* Audio recorder */}
      {showAudioRecorder && (
        <AudioRecorder
          onRecorded={handleAudioRecorded}
          onCancel={() => setShowAudioRecorder(false)}
        />
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground uppercase tracking-wide">Zdjęcia</p>
          <div className="grid grid-cols-4 gap-2">
            {images.map((m) => {
              const globalIdx = items.indexOf(m);
              return (
                <div key={m.url} className="relative aspect-square group cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setFullscreenPhoto(m.url)}>
                  <img src={m.url} alt={m.name || ''} className="w-full h-full object-cover rounded-lg" />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteIndex(globalIdx); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground uppercase tracking-wide">Video</p>
          {videos.map((v) => {
            const globalIdx = items.indexOf(v);
            return (
              <div key={v.url} className="flex items-center gap-2 py-1">
                <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate flex-1 text-primary hover:underline cursor-pointer">
                  {v.name || 'Video'}
                </a>
                {!disabled && (
                  <button type="button" onClick={() => setDeleteIndex(globalIdx)} className="text-destructive hover:text-destructive/80 shrink-0 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audio */}
      {audios.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground uppercase tracking-wide">Nagrania głosowe</p>
          {audios.map((a) => {
            const globalIdx = items.indexOf(a);
            return (
              <div key={a.url} className="flex items-center gap-2 py-1">
                <button type="button" onClick={() => toggleAudio(a.url)} className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer">
                  {playingAudio === a.url ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <span className="text-sm truncate flex-1 cursor-pointer hover:text-primary" onClick={() => toggleAudio(a.url)}>{a.name || 'Nagranie'}</span>
                {!disabled && (
                  <button type="button" onClick={() => setDeleteIndex(globalIdx)} className="text-destructive hover:text-destructive/80 shrink-0 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground uppercase tracking-wide">Dokumenty</p>
          {files.map((f) => {
            const globalIdx = items.indexOf(f);
            return (
              <div key={f.url} className="flex items-center gap-2 py-1">
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm truncate flex-1 text-primary hover:underline cursor-pointer">
                  {f.name || 'Plik'}
                </a>
                {!disabled && (
                  <button type="button" onClick={() => setDeleteIndex(globalIdx)} className="text-destructive hover:text-destructive/80 shrink-0 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen photo dialog */}
      <PhotoFullscreenDialog
        open={!!fullscreenPhoto}
        onOpenChange={(open) => { if (!open) setFullscreenPhoto(null); }}
        photoUrl={fullscreenPhoto}
        allPhotos={allPhotos}
        initialIndex={fullscreenPhoto ? allPhotos.indexOf(fullscreenPhoto) : 0}
        onAnnotate={enableAnnotation ? handleAnnotate : undefined}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}
        title="Usuń plik"
        description="Czy na pewno chcesz usunąć ten plik? Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        variant="destructive"
        onConfirm={() => { if (deleteIndex !== null) handleDelete(deleteIndex); }}
      />
    </div>
  );
};
