import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecorded: (blob: Blob, name?: string) => void;
  onCancel: () => void;
}

export const AudioRecorder = ({ onRecorded, onCancel }: AudioRecorderProps) => {
  const [state, setState] = useState<'starting' | 'recording' | 'done'>('starting');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef<MediaStream | null>(null);

  const stopAndSave = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setState('done');
  }, []);

  // Auto-start recording on mount
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          blobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          // Auto-save after stop
          if (blobRef.current) {
            onRecorded(blobRef.current);
          }
        };

        recorder.start();
        setState('recording');
        setSeconds(0);
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        onCancel();
      }
    };

    start();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') {
      // Override onstop to not auto-save
      recorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
      };
      recorderRef.current.stop();
    }
    onCancel();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
      <div className={cn("h-3 w-3 rounded-full bg-destructive", state === 'recording' && "animate-pulse")} />
      <span className="text-sm font-mono font-medium flex-1">{formatTime(seconds)}</span>
      <Button size="sm" variant="destructive" onClick={stopAndSave} className="gap-1.5">
        <Square className="h-3.5 w-3.5" />
        Stop
      </Button>
      <Button size="icon" variant="ghost" onClick={handleCancel} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
