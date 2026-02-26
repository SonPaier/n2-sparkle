import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoicingSettings } from './useInvoicingSettings';
import { FakturowniaConfigForm } from './FakturowniaConfigForm';
import { IfirmaConfigForm } from './IfirmaConfigForm';
import type {
  InvoicingProvider,
  FakturowniaConfig,
  IfirmaConfig,
  DocumentKind,
  ProviderConfig,
} from './invoicing.types';
import { VAT_RATES, DOCUMENT_KINDS, CURRENCIES } from './invoicing.types';

interface IntegrationsSettingsViewProps {
  instanceId: string | null;
}

export function IntegrationsSettingsView({ instanceId }: IntegrationsSettingsViewProps) {
  const { settings, isLoading, saveSettings, isSaving } = useInvoicingSettings(instanceId);

  const [activeProvider, setActiveProvider] = useState<InvoicingProvider | null>(null);
  const [fakturowniaConfig, setFakturowniaConfig] = useState<FakturowniaConfig>({ domain: '', api_token: '' });
  const [ifirmaConfig, setIfirmaConfig] = useState<IfirmaConfig>({ invoice_api_user: '', invoice_api_key: '' });
  const [vatRate, setVatRate] = useState(23);
  const [paymentDays, setPaymentDays] = useState(14);
  const [documentKind, setDocumentKind] = useState<DocumentKind>('vat');
  const [currency, setCurrency] = useState('PLN');
  const [autoSendEmail, setAutoSendEmail] = useState(false);

  useEffect(() => {
    if (settings) {
      setActiveProvider(settings.active ? (settings.provider as InvoicingProvider) : null);
      setVatRate(settings.default_vat_rate);
      setPaymentDays(settings.default_payment_days);
      setDocumentKind(settings.default_document_kind as DocumentKind);
      setCurrency(settings.default_currency);
      setAutoSendEmail(settings.auto_send_email);

      if (settings.provider === 'fakturownia' && settings.provider_config) {
        setFakturowniaConfig(settings.provider_config as FakturowniaConfig);
      }
      if (settings.provider === 'ifirma' && settings.provider_config) {
        setIfirmaConfig(settings.provider_config as IfirmaConfig);
      }
    }
  }, [settings]);

  const handleToggleProvider = (provider: InvoicingProvider, enabled: boolean) => {
    if (enabled) {
      setActiveProvider(provider);
    } else {
      setActiveProvider(null);
    }
  };

  const handleSave = async () => {
    const config: ProviderConfig | Record<string, never> = activeProvider === 'fakturownia'
      ? fakturowniaConfig
      : activeProvider === 'ifirma'
        ? ifirmaConfig
        : {};

    saveSettings({
      provider: activeProvider,
      provider_config: config as any,
      default_vat_rate: vatRate,
      default_payment_days: paymentDays,
      default_document_kind: documentKind,
      default_currency: currency,
      auto_send_email: autoSendEmail,
      active: !!activeProvider,
    });

    // Auto-register webhook for Fakturownia
    if (activeProvider === 'fakturownia' && fakturowniaConfig.domain && fakturowniaConfig.api_token) {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const webhookUrl = `https://${projectId}.supabase.co/functions/v1/fakturownia-webhook`;

        const res = await fetch(
          `https://${fakturowniaConfig.domain}.fakturownia.pl/webhooks.json`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_token: fakturowniaConfig.api_token,
              webhook: {
                url: webhookUrl,
                kind: 'invoice:update',
                enabled: true,
              },
            }),
          }
        );

        if (res.ok) {
          toast.success('Webhook Fakturowni zarejestrowany');
        } else {
          // Non-critical — webhook may already exist
          console.warn('Webhook registration response:', res.status);
        }
      } catch (e) {
        console.warn('Webhook registration failed (non-critical):', e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderCommonSettings = () => (
    <div className="space-y-4 pt-4">
      <Separator />
      <h4 className="text-sm font-medium">Ustawienia fakturowania</h4>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Domyślna stawka VAT</Label>
          <Select value={String(vatRate)} onValueChange={(v) => setVatRate(Number(v))}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAT_RATES.map((r) => (
                <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Termin płatności (dni)</Label>
          <Input
            type="number"
            min={1}
            value={paymentDays}
            onChange={(e) => setPaymentDays(Number(e.target.value))}
            className="bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Typ dokumentu</Label>
          <Select value={documentKind} onValueChange={(v) => setDocumentKind(v as DocumentKind)}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_KINDS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Waluta</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="auto-send">Automatycznie wysyłaj mailem</Label>
        <Switch
          id="auto-send"
          checked={autoSendEmail}
          onCheckedChange={setAutoSendEmail}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Fakturownia Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Fakturownia</CardTitle>
              <CardDescription>Integracja z fakturownia.pl</CardDescription>
            </div>
            <Switch
              checked={activeProvider === 'fakturownia'}
              onCheckedChange={(v) => handleToggleProvider('fakturownia', v)}
            />
          </div>
        </CardHeader>
        {activeProvider === 'fakturownia' && (
          <CardContent className="pt-0">
            <FakturowniaConfigForm
              config={fakturowniaConfig}
              onChange={setFakturowniaConfig}
              instanceId={instanceId || ''}
            />
            {renderCommonSettings()}
          </CardContent>
        )}
      </Card>

      {/* iFirma Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">iFirma</CardTitle>
              <CardDescription>Integracja z ifirma.pl</CardDescription>
            </div>
            <Switch
              checked={activeProvider === 'ifirma'}
              onCheckedChange={(v) => handleToggleProvider('ifirma', v)}
            />
          </div>
        </CardHeader>
        {activeProvider === 'ifirma' && (
          <CardContent className="pt-0">
            <IfirmaConfigForm
              config={ifirmaConfig}
              onChange={setIfirmaConfig}
              instanceId={instanceId || ''}
            />
            {renderCommonSettings()}
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Zapisz ustawienia
      </Button>
    </div>
  );
}
