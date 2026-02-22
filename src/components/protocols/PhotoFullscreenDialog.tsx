import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Pen, Undo2, Download, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PhotoFullscreenDialogProps {
  open: boolean;
  onClose: () => void;
  photos: string[];
  initialIndex: number;
  onPhotoEdited?: (index: number, dataUrl: string) => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ffffff', '#000000'];

const PhotoFullscreenDialog = ({ open, onClose, photos, initialIndex, onPhotoEdited }: PhotoFullscreenDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [drawingMode, setDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#ef4444');
  const [showColors, setShowColors] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => { setCurrentIndex(initialIndex); }, [initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setDrawingMode(false);
    historyRef.current = [];
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setDrawingMode(false);
    historyRef.current = [];
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (drawingMode) return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, goNext, goPrev, onClose, drawingMode]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  const toggleDrawing = () => {
    if (!drawingMode) {
      setDrawingMode(true);
      setTimeout(initCanvas, 50);
    } else {
      setDrawingMode(false);
    }
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    ctx.putImageData(prev, 0, 0);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onPhotoEdited) return;
    const dataUrl = canvas.toDataURL('image/png');
    onPhotoEdited(currentIndex, dataUrl);
    setDrawingMode(false);
    historyRef.current = [];
  };

  if (photos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button]:hidden">
        <div className="relative flex items-center justify-center min-h-[60vh]">
          {/* Toolbar */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
            {drawingMode && (
              <>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={undo}>
                  <Undo2 className="w-5 h-5" />
                </Button>
                <div className="relative">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setShowColors(!showColors)}>
                    <Palette className="w-5 h-5" style={{ color: penColor }} />
                  </Button>
                  {showColors && (
                    <div className="absolute top-full right-0 mt-1 flex gap-1 bg-black/80 p-2 rounded-lg">
                      {COLORS.map((c) => (
                        <button key={c} className={`w-6 h-6 rounded-full border-2 ${penColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }}
                          onClick={() => { setPenColor(c); setShowColors(false); }} />
                      ))}
                    </div>
                  )}
                </div>
                {onPhotoEdited && (
                  <Button variant="ghost" size="icon" className="text-green-400 hover:bg-white/20" onClick={saveDrawing}>
                    <Download className="w-5 h-5" />
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" size="icon" className={`hover:bg-white/20 ${drawingMode ? 'text-yellow-400' : 'text-white'}`} onClick={toggleDrawing}>
              <Pen className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Image or Canvas */}
          {drawingMode ? (
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[85vh] object-contain cursor-crosshair touch-none"
              style={{ maxWidth: '100%', maxHeight: '85vh' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
          ) : (
            <img
              ref={imgRef}
              src={photos[currentIndex]}
              alt={`Zdjęcie ${currentIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
              crossOrigin="anonymous"
            />
          )}

          {/* Hidden img for canvas init */}
          {drawingMode && (
            <img ref={imgRef} src={photos[currentIndex]} className="hidden" crossOrigin="anonymous" onLoad={initCanvas} />
          )}

          {photos.length > 1 && !drawingMode && (
            <>
              <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20" onClick={goPrev}>
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20" onClick={goNext}>
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