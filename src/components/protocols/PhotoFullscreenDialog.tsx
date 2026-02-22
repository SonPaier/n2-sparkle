import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PhotoFullscreenDialogProps {
  open: boolean;
  onClose: () => void;
  photos: string[];
  initialIndex: number;
}

const PhotoFullscreenDialog = ({ open, onClose, photos, initialIndex }: PhotoFullscreenDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => { setCurrentIndex(initialIndex); }, [initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, goNext, goPrev, onClose]);

  if (photos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        <div className="relative flex items-center justify-center min-h-[60vh]">
          <img
            src={photos[currentIndex]}
            alt={`Zdjęcie ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain"
          />

          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={goPrev}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                onClick={goNext}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoFullscreenDialog;
