import { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SignatureDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

const SignatureDialog = ({ open, onClose, onSave }: SignatureDialogProps) => {
  const sigRef = useRef<SignatureCanvas | null>(null);

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleSave = () => {
    if (sigRef.current?.isEmpty()) return;
    // Use getCanvas() instead of getTrimmedCanvas() to avoid trim-canvas import bug
    const dataUrl = sigRef.current?.getCanvas().toDataURL('image/png');
    if (dataUrl) onSave(dataUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Podpis osoby upoważnionej do odbioru</DialogTitle>
        </DialogHeader>

        <div className="border border-border rounded-md bg-background overflow-hidden">
          {open && (
            <SignatureCanvas
              ref={sigRef}
              penColor="black"
              canvasProps={{
                className: 'w-full',
                style: { width: '100%', height: '200px' },
              }}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClear}>Wyczyść</Button>
          <Button onClick={handleSave}>Zatwierdź podpis</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureDialog;
