import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtocolSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
}

const defaultTemplate = `Dzień dobry {imie_klienta},

W załączeniu przesyłamy link do protokołu zakończenia prac.

{link_protokolu}

Z poważaniem,
{nazwa_firmy}`;

const ProtocolSettingsDialog = ({ open, onClose, instanceId }: ProtocolSettingsDialogProps) => {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('instances')
      .select('protocol_email_template')
      .eq('id', instanceId)
      .single()
      .then(({ data }) => {
        setTemplate((data as any)?.protocol_email_template || defaultTemplate);
        setLoading(false);
      });
  }, [open, instanceId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('instances')
      .update({ protocol_email_template: template.trim() || null } as any)
      .eq('id', instanceId);
    if (error) { toast.error('Błąd zapisu'); }
    else { toast.success('Szablon zapisany'); onClose(); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ustawienia protokołów</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Szablon wiadomości email</Label>
              <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={8} />
              <p className="text-xs text-muted-foreground">
                Dostępne zmienne: {'{imie_klienta}'}, {'{link_protokolu}'}, {'{nazwa_firmy}'}, {'{data_protokolu}'}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProtocolSettingsDialog;
