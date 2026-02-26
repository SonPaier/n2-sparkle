import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onRecorded: (blob: Blob, name?: string) => void;
  onCancel: () => void;
}

export const AudioRecorder = ({ onRecorded, onCancel }: AudioRecorderProps) => {
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setState('done');
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      };

      recorder.start();
      setState('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onCancel();
    }
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSave = () => {
    if (blobRef.current) onRecorded(blobRef.current, name.trim() || undefined);
  };

  if (state === 'idle') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
        <Button size="sm" onClick={startRecording} className="gap-1.5">
          <Mic className="h-4 w-4" />
          Rozpocznij nagrywanie
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Anuluj</Button>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <div className={cn("h-3 w-3 rounded-full bg-destructive animate-pulse")} />
        <span className="text-sm font-mono font-medium">{formatTime(seconds)}</span>
        <Button size="sm" variant="destructive" onClick={stopRecording} className="gap-1.5 ml-auto">
          <Square className="h-3.5 w-3.5" />
          Zatrzymaj
        </Button>
      </div>
    );
  }

  // done
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
      <Input
        placeholder="Nazwa nagrania (opcjonalne)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 h-8 text-sm"
      />
      <Button size="sm" onClick={handleSave} className="gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Zapisz
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Anuluj</Button>
    </div>
  );
};
