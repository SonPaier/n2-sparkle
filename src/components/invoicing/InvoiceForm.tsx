import { useState } from 'react';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { DOCUMENT_KINDS, VAT_RATES, type InvoicePosition, type DocumentKind } from './invoicing.types';

type PriceMode = 'netto' | 'brutto';

interface InvoiceFormProps {
  kind: DocumentKind;
  onKindChange: (v: DocumentKind) => void;
  issueDate: string;
  onIssueDateChange: (v: string) => void;
  sellDate: string;
  onSellDateChange: (v: string) => void;
  paymentDays: number;
  onPaymentDaysChange: (v: number) => void;
  buyerName: string;
  onBuyerNameChange: (v: string) => void;
  buyerTaxNo: string;
  onBuyerTaxNoChange: (v: string) => void;
  buyerEmail: string;
  onBuyerEmailChange: (v: string) => void;
  buyerStreet: string;
  onBuyerStreetChange: (v: string) => void;
  buyerPostCode: string;
  onBuyerPostCodeChange: (v: string) => void;
  buyerCity: string;
  onBuyerCityChange: (v: string) => void;
  positions: InvoicePosition[];
  onAddPosition: () => void;
  onRemovePosition: (idx: number) => void;
  onUpdatePosition: (idx: number, field: keyof InvoicePosition, value: any) => void;
  priceMode: PriceMode;
  onPriceModeChange: (v: PriceMode) => void;
  totalNetto: number;
  totalVat: number;
  totalGross: number;
  paymentTo: string;
  autoSendEmail: boolean;
  onAutoSendEmailChange: (v: boolean) => void;
  settingsActive?: boolean;
}

export function InvoiceForm({
  kind, onKindChange,
  issueDate, onIssueDateChange,
  sellDate, onSellDateChange,
  paymentDays, onPaymentDaysChange,
  buyerName, onBuyerNameChange,
  buyerTaxNo, onBuyerTaxNoChange,
  buyerEmail, onBuyerEmailChange,
  buyerStreet, onBuyerStreetChange,
  buyerPostCode, onBuyerPostCodeChange,
  buyerCity, onBuyerCityChange,
  positions, onAddPosition, onRemovePosition, onUpdatePosition,
  priceMode, onPriceModeChange,
  totalNetto, totalVat, totalGross,
  paymentTo,
  autoSendEmail,
  onAutoSendEmailChange,
  settingsActive,
}: InvoiceFormProps) {
  const [nipLoading, setNipLoading] = useState(false);
  const priceLabel = priceMode === 'netto' ? 'Cena netto' : 'Cena brutto';

  const handleNipLookup = async () => {
    const nip = buyerTaxNo.replace(/[^0-9]/g, '');
    if (!nip || nip.length !== 10) {
      toast.error('Wprowadź poprawny NIP (10 cyfr)');
      return;
    }
    setNipLoading(true);
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
        const match = addr.match(/^(.+),\s*(\d{2}-\d{3})\s+(.+)$/);
        onBuyerNameChange(subject.name || '');
        if (match) {
          onBuyerStreetChange(match[1].trim());
          onBuyerPostCodeChange(match[2].trim());
          onBuyerCityChange(match[3].trim());
        }
        toast.success('Pobrano dane firmy z GUS');
      } else {
        toast.error('Nie znaleziono firmy o podanym NIP');
      }
    } catch {
      toast.error('Nie udało się pobrać danych firmy');
    } finally {
      setNipLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {settingsActive === false && (
        <p className="text-sm text-destructive">
          Skonfiguruj integrację fakturowania w Ustawieniach → Integracje
        </p>
      )}

      {/* Document type & dates */}
      <div className="space-y-1.5">
        <Label className="text-xs">Typ dokumentu</Label>
        <Select value={kind} onValueChange={(v) => onKindChange(v as DocumentKind)}>
          <SelectTrigger className="bg-white h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_KINDS.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Data wystawienia</Label>
          <Input type="date" value={issueDate} onChange={(e) => onIssueDateChange(e.target.value)} className="bg-white h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data sprzedaży</Label>
          <Input type="date" value={sellDate} onChange={(e) => onSellDateChange(e.target.value)} className="bg-white h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Termin (dni)</Label>
          <Input type="number" min={1} value={paymentDays} onChange={(e) => onPaymentDaysChange(Number(e.target.value))} className="bg-white h-9 text-sm" />
        </div>
      </div>

      <Separator />

      {/* Buyer */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Nabywca</h3>
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">NIP</Label>
              <Input value={buyerTaxNo} onChange={(e) => onBuyerTaxNoChange(e.target.value)} placeholder="0000000000" className="bg-white h-9" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={handleNipLookup} disabled={nipLoading}>
              {nipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
              {nipLoading ? '...' : 'GUS'}
            </Button>
          </div>
          <Input value={buyerName} onChange={(e) => onBuyerNameChange(e.target.value)} placeholder="Nazwa nabywcy *" className="bg-white h-9" />
          <Input value={buyerEmail} onChange={(e) => onBuyerEmailChange(e.target.value)} placeholder="Email" className="bg-white h-9" />
          <Input value={buyerStreet} onChange={(e) => onBuyerStreetChange(e.target.value)} placeholder="Ulica" className="bg-white h-9" />
          <div className="grid grid-cols-3 gap-2">
            <Input value={buyerPostCode} onChange={(e) => onBuyerPostCodeChange(e.target.value)} placeholder="Kod pocztowy" className="bg-white h-9" />
            <Input value={buyerCity} onChange={(e) => onBuyerCityChange(e.target.value)} placeholder="Miasto" className="bg-white h-9 col-span-2" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Price mode radio */}
      <RadioGroup
        value={priceMode}
        onValueChange={(v) => onPriceModeChange(v as PriceMode)}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="netto" id="price-netto" />
          <Label htmlFor="price-netto" className="text-sm cursor-pointer">Kwoty netto</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="brutto" id="price-brutto" />
          <Label htmlFor="price-brutto" className="text-sm cursor-pointer">Kwoty brutto</Label>
        </div>
      </RadioGroup>

      {/* Positions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pozycje</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onAddPosition}>
            <Plus className="w-4 h-4 mr-1" /> Dodaj
          </Button>
        </div>
        {positions.map((pos, idx) => (
            <div key={idx} className="space-y-2 p-3 rounded-lg border border-border bg-white">
              <div className="flex items-center gap-2">
                <Input
                  value={pos.name}
                  onChange={(e) => onUpdatePosition(idx, 'name', e.target.value)}
                  placeholder="Nazwa usługi / produktu"
                  className="bg-white h-8 text-sm flex-1"
                />
                {positions.length > 1 && (
                  <button onClick={() => onRemovePosition(idx)} className="p-1 rounded hover:bg-primary/5">
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Ilość</Label>
                  <Input
                    type="number"
                    min={1}
                    value={pos.quantity}
                    onChange={(e) => onUpdatePosition(idx, 'quantity', Number(e.target.value))}
                    className="bg-white h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{priceLabel}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={pos.unit_price_gross}
                    onChange={(e) => onUpdatePosition(idx, 'unit_price_gross', Number(e.target.value))}
                    className="bg-white h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">VAT</Label>
                  <Select value={String(pos.vat_rate)} onValueChange={(v) => onUpdatePosition(idx, 'vat_rate', Number(v))}>
                    <SelectTrigger className="bg-white h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map(r => (
                        <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
      </div>

      <Separator />

      {/* Summary */}
      <div className="bg-white rounded-lg border border-border p-4 space-y-2">
        <div className="flex justify-between text-xs text-foreground">
          <span>Razem netto</span>
          <span>{totalNetto.toFixed(2)} PLN</span>
        </div>
        <div className="flex justify-between text-xs text-foreground">
          <span>VAT</span>
          <span>{totalVat.toFixed(2)} PLN</span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-foreground">Razem brutto</span>
          <span className="text-lg font-bold text-foreground">{totalGross.toFixed(2)} PLN</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-foreground">Termin płatności</span>
          <span className="text-foreground">{paymentTo}</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="auto-send-email"
            checked={autoSendEmail}
            onCheckedChange={(v) => onAutoSendEmailChange(!!v)}
          />
          <Label htmlFor="auto-send-email" className="text-xs text-muted-foreground cursor-pointer">
            ✉ Wyślij automatycznie na email nabywcy
          </Label>
        </div>
      </div>
    </div>
  );
}
