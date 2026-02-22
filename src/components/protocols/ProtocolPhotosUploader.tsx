import { useState, useRef } from 'react';
import { Plus, X, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PhotoFullscreenDialog from './PhotoFullscreenDialog';

interface ProtocolPhotosUploaderProps {
  instanceId: string;
  photoUrls: string[];
  onChange: (urls: string[]) => void;
}

const ProtocolPhotosUploader = ({ instanceId, photoUrls, onChange }: ProtocolPhotosUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fileName = `${instanceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('protocol-photos')
        .upload(fileName, file, { contentType: file.type });

      if (error) {
        console.error('Upload error:', error);
        toast.error(`Błąd uploadu: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('protocol-photos')
        .getPublicUrl(fileName);

      newUrls.push(urlData.publicUrl);
    }

    onChange([...photoUrls, ...newUrls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(photoUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photoUrls.map((url, i) => (
          <div key={i} className="relative group w-20 h-20 rounded-md overflow-hidden border border-border">
            <img src={url} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setFullscreenIndex(i)}>
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => handleRemove(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 rounded-md border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      <PhotoFullscreenDialog
        open={fullscreenIndex !== null}
        onClose={() => setFullscreenIndex(null)}
        photos={photoUrls}
        initialIndex={fullscreenIndex || 0}
      />
    </div>
  );
};

export default ProtocolPhotosUploader;
