import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { FakturowniaConfig } from './invoicing.types';

interface FakturowniaConfigFormProps {
  config: FakturowniaConfig | null;
  onChange: (config: FakturowniaConfig) => void;
  instanceId: string;
}

export function FakturowniaConfigForm({ config, onChange, instanceId }: FakturowniaConfigFormProps) {
  const [domain, setDomain] = useState(config?.domain || '');
  const [apiToken, setApiToken] = useState(config?.api_token || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    setDomain(config?.domain || '');
    setApiToken(config?.api_token || '');
  }, [config]);

  const handleChange = (field: keyof FakturowniaConfig, value: string) => {
    const updated = { domain, api_token: apiToken, [field]: value };
    if (field === 'domain') setDomain(value);
    if (field === 'api_token') setApiToken(value);
    onChange(updated);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!domain || !apiToken) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`https://${domain}.fakturownia.pl/invoices.json?period=last_5&page=1&per_page=1&api_token=${apiToken}`);
      setTestResult(res.ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Domena konta</Label>
        <div className="flex items-center gap-2">
          <Input
            value={domain}
            onChange={(e) => handleChange('domain', e.target.value)}
            placeholder="twojafirma"
            className="bg-white"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">.fakturownia.pl</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Token API</Label>
        <Input
          type="password"
          value={apiToken}
          onChange={(e) => handleChange('api_token', e.target.value)}
          placeholder="Wklej token API Fakturowni"
          className="bg-white"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={!domain || !apiToken || testing}
        >
          {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Testuj połączenie
        </Button>
        {testResult === 'success' && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> Połączono
          </span>
        )}
        {testResult === 'error' && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <XCircle className="w-4 h-4" /> Błąd połączenia
          </span>
        )}
      </div>
    </div>
  );
}
