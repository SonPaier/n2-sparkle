import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendProtocolEmailDialogProps {
  open: boolean;
  onClose: () => void;
  protocol: {
    id: string;
    customer_name: string;
    customer_email: string | null;
    public_token: string;
  };
  instanceId: string;
}

const SendProtocolEmailDialog = ({ open, onClose, protocol, instanceId }: SendProtocolEmailDialogProps) => {
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setRecipientEmail(protocol.customer_email || '');
    setSubject(`Protokół zakończenia prac – ${protocol.customer_name}`);
    const link = `${window.location.origin}/protocols/${protocol.public_token}`;
    setMessage(`Dzień dobry,\n\nW załączeniu przesyłamy link do protokołu zakończenia prac:\n${link}\n\nZ poważaniem`);
  }, [open, protocol]);

  const handleSend = async () => {
    if (!recipientEmail.trim()) { toast.error('Podaj adres email'); return; }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-protocol-email', {
        body: {
          protocolId: protocol.id,
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim(),
          message: message.trim(),
          instanceId,
        },
      });
      if (error) throw error;
      toast.success('Email wysłany');
      onClose();
    } catch (err: any) {
      console.error('Error sending email:', err);
      toast.error('Błąd wysyłania emaila');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wyślij protokół emailem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Adres email odbiorcy</Label>
            <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="email@example.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label>Temat</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Treść wiadomości</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Wyślij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendProtocolEmailDialog;
