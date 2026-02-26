import { Loader2, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface MediaUploadProgressProps {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
  label?: string;
}

export const MediaUploadProgress = ({ progress, error, onRetry, label }: MediaUploadProgressProps) => {
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        {label && <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>}
        <Progress value={progress} className="h-2" />
      </div>
      <span className="text-xs font-medium text-muted-foreground shrink-0">{progress}%</span>
    </div>
  );
};
