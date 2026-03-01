import { RotateCcw, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface MediaUploadProgressProps {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  label?: string;
}

export const MediaUploadProgress = ({ progress, error, onRetry, onCancel }: MediaUploadProgressProps) => {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Ponów
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
      <div className="flex-1 min-w-0">
        <Progress value={progress} className="h-2" />
      </div>
      <span className="text-xs font-medium text-muted-foreground shrink-0">{progress}%</span>
      {onCancel && (
        <button onClick={onCancel} className="p-1 rounded-full hover:bg-primary/5 transition-colors shrink-0" title="Anuluj">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};
