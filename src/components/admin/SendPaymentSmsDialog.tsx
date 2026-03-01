import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';

interface CalendarItemData {
  id: string;
  title: string;
  customer_name: string | null;
  customer_phone: string | null;
  price: number | null;
}

interface SendPaymentSmsDialogProps {
  open: boolean;
  onClose: () => void;
  templateType: 'blik' | 'bank_transfer';
  calendarItem: CalendarItemData;
  instanceId: string;
  onSuccess?: () => void;
}

const SendPaymentSmsDialog = ({
  open,
  onClose,
  templateType,
  calendarItem,
  instanceId,
  onSuccess,
}: SendPaymentSmsDialogProps) => {
  const isMobile = useIsMobile();
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const load = async () => {
      try {
        // Fetch template
        const { data: templates } = await (supabase.from('sms_payment_templates' as any) as any)
          .select('*')
          .eq('instance_id', instanceId)
          .eq('template_type', templateType)
          .single();

        // Fetch instance data
        const { data: instance } = await supabase
          .from('instances')
          .select('name, short_name, contact_person, blik_phone, bank_account_number, bank_name')
          .eq('id', instanceId)
          .single();

        if (!templates?.sms_body) {
          toast.error('Nie znaleziono szablonu SMS');
          onClose();
          return;
        }

        const customerPhone = calendarItem.customer_phone || '';
        setPhone(customerPhone);

        // Get service names from calendar_item_services
        let serviceNames = calendarItem.title || '';
        const { data: itemServices } = await supabase
          .from('calendar_item_services')
          .select('quantity, custom_price, service_id, unified_services(name, price)')
          .eq('calendar_item_id', calendarItem.id);

        if (itemServices && itemServices.length > 0) {
          serviceNames = itemServices
            .map((s: any) => s.unified_services?.name || '')
            .filter(Boolean)
            .join(', ');
        }

        // Replace variables
        let body = templates.sms_body as string;
        body = body.replace(/\{firma\}/g, instance?.short_name || instance?.name || '');
        body = body.replace(/\{osoba_kontaktowa\}/g, instance?.contact_person || '');
        body = body.replace(/\{usluga\}/g, serviceNames);
        body = body.replace(/\{cena\}/g, calendarItem.price != null ? Math.round(calendarItem.price).toString() : '0');
        body = body.replace(/\{blik_phone\}/g, instance?.blik_phone || '');
        body = body.replace(/\{numer_konta\}/g, (instance?.bank_account_number || '').replace(/\s/g, ''));
        body = body.replace(/\{nazwa_banku\}/g, instance?.bank_name || '');

        setMessage(body);
      } catch (err) {
        console.error('Error loading SMS template:', err);
        toast.error('Błąd ładowania szablonu');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, instanceId, templateType, calendarItem]);

  const handleSend = async () => {
    if (!phone) {
      toast.error('Brak numeru telefonu klienta');
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const messageType = templateType === 'blik' ? 'payment_blik' : 'payment_bank_transfer';

      if (isMobile) {
        // Native SMS on mobile
        const smsUri = `sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(message)}`;
        window.open(smsUri, '_self');

        // Log it (assume sent)
        await (supabase.from('sms_logs' as any) as any).insert({
          instance_id: instanceId,
          calendar_item_id: calendarItem.id,
          phone,
          message,
          message_type: messageType,
          status: 'sent_native',
          sent_by: user?.id || null,
        });
      } else {
        // Desktop - use SMS gateway
        const { error } = await supabase.functions.invoke('send-sms', {
          body: {
            phone: phone.replace(/\s/g, ''),
            message,
            instanceId,
            calendarItemId: calendarItem.id,
            messageType,
            sentBy: user?.id || null,
          },
        });
        if (error) throw error;
      }

      // Update payment status
      const newStatus = templateType === 'blik' ? 'sms_blik_sent' : 'sms_bank_sent';
      await supabase
        .from('calendar_items')
        .update({ payment_status: newStatus })
        .eq('id', calendarItem.id);

      toast.success('SMS wysłany');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      toast.error('Błąd wysyłania SMS: ' + (err.message || 'Nieznany błąd'));
    } finally {
      setSending(false);
    }
  };

  const title = templateType === 'blik' ? 'SMS z płatnością BLIK' : 'SMS z numerem konta';

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">
              Odbiorca: {calendarItem.customer_name || '—'} ({phone || 'brak numeru'})
            </Label>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Treść SMS</Label>
            <Textarea
              rows={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Treść wiadomości SMS..."
            />
          </div>
        </>
      )}
    </div>
  );

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={sending}>
        Anuluj
      </Button>
      <Button onClick={handleSend} disabled={sending || loading || !message.trim()}>
        {sending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <MessageSquare className="w-4 h-4 mr-2" />
        )}
        {isMobile ? 'Otwórz SMS' : 'Wyślij'}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">{content}</div>
          <DrawerFooter className="flex-row justify-end gap-2">{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {content}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendPaymentSmsDialog;
