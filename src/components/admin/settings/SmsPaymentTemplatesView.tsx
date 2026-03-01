import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SmsPaymentTemplatesViewProps {
  instanceId: string | null;
}

interface TemplateData {
  id?: string;
  enabled: boolean;
  sms_body: string;
}

const DEFAULT_BLIK_BODY = `Witam,
poniżej przesyłam numer telefonu BLIK i kwotę za usługę.
{blik_phone}
{cena} PLN
{firma}
{usluga}
Pozdrawiam, {osoba_kontaktowa}`;

const DEFAULT_BANK_BODY = `Witam,
poniżej przesyłam numer konta i kwotę za usługę.
{numer_konta}
{nazwa_banku}
{cena} PLN
{firma}
{usluga}
Pozdrawiam, {osoba_kontaktowa}`;

const BLIK_VARIABLES = [
  { label: 'Firma', value: '{firma}' },
  { label: 'Osoba kontaktowa', value: '{osoba_kontaktowa}' },
  { label: 'Usługa', value: '{usluga}' },
  { label: 'Cena', value: '{cena}' },
  { label: 'Nr tel. BLIK', value: '{blik_phone}' },
];

const BANK_VARIABLES = [
  { label: 'Firma', value: '{firma}' },
  { label: 'Osoba kontaktowa', value: '{osoba_kontaktowa}' },
  { label: 'Usługa', value: '{usluga}' },
  { label: 'Cena', value: '{cena}' },
  { label: 'Nr konta', value: '{numer_konta}' },
  { label: 'Nazwa banku', value: '{nazwa_banku}' },
];

const SmsPaymentTemplatesView = ({ instanceId }: SmsPaymentTemplatesViewProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blik, setBlik] = useState<TemplateData>({ enabled: false, sms_body: DEFAULT_BLIK_BODY });
  const [bank, setBank] = useState<TemplateData>({ enabled: false, sms_body: DEFAULT_BANK_BODY });

  useEffect(() => {
    if (!instanceId) return;
    setLoading(true);
    supabase
      .from('sms_payment_templates' as any)
      .select('*')
      .eq('instance_id', instanceId)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching templates:', error);
        } else if (data) {
          const items = data as any[];
          const blikRow = items.find((r: any) => r.template_type === 'blik');
          const bankRow = items.find((r: any) => r.template_type === 'bank_transfer');
          if (blikRow) setBlik({ id: blikRow.id, enabled: blikRow.enabled, sms_body: blikRow.sms_body || DEFAULT_BLIK_BODY });
          if (bankRow) setBank({ id: bankRow.id, enabled: bankRow.enabled, sms_body: bankRow.sms_body || DEFAULT_BANK_BODY });
        }
        setLoading(false);
      });
  }, [instanceId]);

  const handleSave = async () => {
    if (!instanceId) return;
    setSaving(true);
    try {
      // Upsert BLIK
      if (blik.id) {
        await (supabase.from('sms_payment_templates' as any) as any).update({ enabled: blik.enabled, sms_body: blik.sms_body }).eq('id', blik.id);
      } else {
        const { data } = await (supabase.from('sms_payment_templates' as any) as any).insert({ instance_id: instanceId, template_type: 'blik', enabled: blik.enabled, sms_body: blik.sms_body }).select('id').single();
        if (data) setBlik(prev => ({ ...prev, id: data.id }));
      }
      // Upsert bank_transfer
      if (bank.id) {
        await (supabase.from('sms_payment_templates' as any) as any).update({ enabled: bank.enabled, sms_body: bank.sms_body }).eq('id', bank.id);
      } else {
        const { data } = await (supabase.from('sms_payment_templates' as any) as any).insert({ instance_id: instanceId, template_type: 'bank_transfer', enabled: bank.enabled, sms_body: bank.sms_body }).select('id').single();
        if (data) setBank(prev => ({ ...prev, id: data.id }));
      }
      toast.success('Szablony zapisane');
    } catch (error) {
      console.error('Error saving templates:', error);
      toast.error('Błąd zapisu szablonów');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BLIK template */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">SMS z płatnością BLIK</Label>
          <Switch
            checked={blik.enabled}
            onCheckedChange={(checked) => setBlik(prev => ({ ...prev, enabled: checked }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Treść szablonu</Label>
          <Textarea
            className="bg-white"
            rows={8}
            value={blik.sms_body}
            onChange={(e) => setBlik(prev => ({ ...prev, sms_body: e.target.value }))}
            placeholder="Wpisz treść szablonu SMS..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Dostępne zmienne:</Label>
          <div className="flex flex-wrap gap-1.5">
            {BLIK_VARIABLES.map(v => (
              <Badge key={v.value} variant="secondary" className="text-xs cursor-default">
                {v.label}: <code className="ml-1 font-mono">{v.value}</code>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Bank transfer template */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">SMS z numerem konta</Label>
          <Switch
            checked={bank.enabled}
            onCheckedChange={(checked) => setBank(prev => ({ ...prev, enabled: checked }))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Treść szablonu</Label>
          <Textarea
            className="bg-white"
            rows={10}
            value={bank.sms_body}
            onChange={(e) => setBank(prev => ({ ...prev, sms_body: e.target.value }))}
            placeholder="Wpisz treść szablonu SMS..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Dostępne zmienne:</Label>
          <div className="flex flex-wrap gap-1.5">
            {BANK_VARIABLES.map(v => (
              <Badge key={v.value} variant="secondary" className="text-xs cursor-default">
                {v.label}: <code className="ml-1 font-mono">{v.value}</code>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Zapisz szablony
      </Button>
    </div>
  );
};

export default SmsPaymentTemplatesView;
