import { supabase } from '@/integrations/supabase/client';

export const compressImage = async (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};

export const compressVideo = (
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Blob> => {
  // Skip compression for files under 50MB
  const MAX_SIZE_NO_COMPRESS = 50 * 1024 * 1024;
  if (file.size < MAX_SIZE_NO_COMPRESS) {
    onProgress?.(100);
    return Promise.resolve(file);
  }

  const TIMEOUT_MS = 10_000;

  const compressionPromise = new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration === Infinity) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      let w = video.videoWidth;
      let h = video.videoHeight;
      const maxH = 720;
      if (h > maxH) {
        w = Math.round(w * (maxH / h));
        h = maxH;
      }
      w = w % 2 === 0 ? w : w - 1;
      h = h % 2 === 0 ? h : h - 1;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(24);
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        // no audio track or unsupported
      }

      let mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        resolve(file);
        return;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1_500_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob.size < file.size ? blob : file);
      };
      recorder.onerror = () => resolve(file);

      recorder.start();
      video.currentTime = 0;
      video.play();

      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        onProgress?.(Math.min(99, Math.round((video.currentTime / duration) * 100)));
        requestAnimationFrame(drawFrame);
      };
      video.onplay = drawFrame;
      video.onended = () => {
        onProgress?.(100);
        if (recorder.state === 'recording') recorder.stop();
      };
    };

    video.onerror = () => resolve(file);
    video.src = URL.createObjectURL(file);
  });

  // Race against timeout — if compression hangs, return original file
  const timeoutPromise = new Promise<Blob>((resolve) => {
    setTimeout(() => {
      onProgress?.(100);
      resolve(file);
    }, TIMEOUT_MS);
  });

  return Promise.race([compressionPromise, timeoutPromise]);
};

export type UploadProgressCallback = (pct: number) => void;

export const uploadFileWithProgress = (
  bucket: string,
  path: string,
  file: Blob,
  contentType: string,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || supabaseKey;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-upsert', 'true');

      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload anulowany'));
        });
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          resolve(urlData.publicUrl);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(file);
    });
  });
};

export const getMediaTypeFromMime = (mime: string): 'image' | 'video' | 'audio' | 'file' => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
};

export const generateFileName = (prefix: string, ext: string) => {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}.${ext}`;
};
