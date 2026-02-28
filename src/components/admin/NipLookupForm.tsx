import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface NipLookupData {
  nip: string;
  company: string;
  billingStreet: string;
  billingPostalCode: string;
  billingCity: string;
}

interface NipLookupFormProps {
  value: NipLookupData;
  onChange: (data: NipLookupData) => void;
  readOnly?: boolean;
}

const NipLookupForm = ({ value, onChange, readOnly = false }: NipLookupFormProps) => {
  const [loading, setLoading] = useState(false);

  const update = (field: keyof NipLookupData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  const lookupNip = async () => {
    const nip = value.nip.replace(/[^0-9]/g, '');
    if (!nip || nip.length !== 10) {
      toast.error('Wprowadź poprawny NIP (10 cyfr)');
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`
      );
      if (!response.ok) throw new Error('Nie znaleziono firmy');
      const data = await response.json();
      if (data.result?.subject) {
        const subject = data.result.subject;
        const addr = subject.workingAddress || subject.residenceAddress || '';
        // Parse: "ULICA NR, KOD MIASTO"
        const match = addr.match(/^(.+),\s*(\d{2}-\d{3})\s+(.+)$/);
        onChange({
          nip: value.nip,
          company: subject.name || '',
          billingStreet: match ? match[1].trim() : '',
          billingPostalCode: match ? match[2].trim() : '',
          billingCity: match ? match[3].trim() : '',
        });
        toast.success('Pobrano dane firmy z GUS');
      } else {
        toast.error('Nie znaleziono firmy o podanym NIP');
      }
    } catch {
      toast.error('Nie udało się pobrać danych firmy');
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) {
    return (
      <div className="space-y-2 text-sm">
        {value.nip && <div><span className="font-medium">NIP:</span> {value.nip}</div>}
        {value.company && <div><span className="font-medium">Firma:</span> {value.company}</div>}
        {value.billingStreet && <div><span className="font-medium">Adres:</span> {value.billingStreet}</div>}
        {(value.billingPostalCode || value.billingCity) && (
          <div>{value.billingPostalCode} {value.billingCity}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1.5 block text-xs">NIP</Label>
        <div className="flex items-center gap-2">
          <Input
            value={value.nip}
            onChange={e => update('nip', e.target.value)}
            placeholder="0000000000"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={lookupNip}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            {loading ? 'Szukam...' : 'Pobierz z GUS'}
          </Button>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs">Nazwa firmy</Label>
        <Input value={value.company} onChange={e => update('company', e.target.value)} placeholder="Nazwa firmy" />
      </div>
      <div>
        <Label className="mb-1.5 block text-xs">Ulica</Label>
        <Input value={value.billingStreet} onChange={e => update('billingStreet', e.target.value)} placeholder="Ulica i numer" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1.5 block text-xs">Kod pocztowy</Label>
          <Input value={value.billingPostalCode} onChange={e => update('billingPostalCode', e.target.value)} placeholder="00-000" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Miasto</Label>
          <Input value={value.billingCity} onChange={e => update('billingCity', e.target.value)} placeholder="Miasto" />
        </div>
      </div>
    </div>
  );
};

export default NipLookupForm;
