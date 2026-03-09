import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWorkersSettings, useUpdateWorkersSettings } from '@/hooks/useWorkersSettings';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkersSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
}

const WorkersSettingsDrawer = ({ open, onOpenChange, instanceId }: WorkersSettingsDrawerProps) => {
  const { data: settings, isLoading } = useWorkersSettings(instanceId);
  const updateSettings = useUpdateWorkersSettings(instanceId);

  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [standardHours, setStandardHours] = useState('8');
  const [reportFrequency, setReportFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [settlementType, setSettlementType] = useState<'hourly' | 'per_order'>('hourly');
  const [timeInputMode, setTimeInputMode] = useState<'total' | 'start_end'>('total');

  useEffect(() => {
    if (settings) {
      setOvertimeEnabled(settings.overtime_enabled ?? false);
      setStandardHours(settings.standard_hours_per_day?.toString() ?? '8');
      setReportFrequency(settings.report_frequency ?? 'monthly');
      setSettlementType(settings.settlement_type ?? 'hourly');
      setTimeInputMode(settings.time_input_mode ?? 'total');
    }
  }, [settings]);

  const handleClose = () => { onOpenChange(false); };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        overtime_enabled: overtimeEnabled,
        standard_hours_per_day: parseInt(standardHours) || 8,
        report_frequency: reportFrequency,
        settlement_type: settlementType,
        time_input_mode: timeInputMode,
      });
      toast.success('Ustawienia zostały zapisane');
      handleClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania ustawień');
    }
  };

  const saving = updateSettings.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col z-[1000]" hideCloseButton>
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ustawienia czasu pracy</h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-primary/5"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="overtime">Naliczanie nadgodzin</Label>
                  <Switch id="overtime" checked={overtimeEnabled} onCheckedChange={setOvertimeEnabled} />
                </div>
                <p className="text-xs text-muted-foreground">Automatycznie oznacza godziny ponad normę</p>
              </div>
              {overtimeEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="standard-hours">Norma dzienna (godziny)</Label>
                  <Input id="standard-hours" type="number" min="1" max="24" value={standardHours} onChange={(e) => setStandardHours(e.target.value)} className="w-24" />
                </div>
              )}
              <div className="space-y-3">
                <Label>Okres rozliczeniowy</Label>
                <RadioGroup value={reportFrequency} onValueChange={(v) => setReportFrequency(v as 'monthly' | 'weekly')}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly" className="font-normal cursor-pointer">Miesięcznie</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Podsumowanie raz w miesiącu</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly" className="font-normal cursor-pointer">Tygodniowo</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Podsumowanie co tydzień</p>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Typ rozliczenia</Label>
                <RadioGroup value={settlementType} onValueChange={(v) => setSettlementType(v as 'hourly' | 'per_order')}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="hourly" id="hourly-settlement" />
                      <Label htmlFor="hourly-settlement" className="font-normal cursor-pointer">Godzinowe</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Rozliczenie na podstawie przepracowanych godzin</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="per_order" id="per-order-settlement" />
                      <Label htmlFor="per-order-settlement" className="font-normal cursor-pointer">Per zlecenie</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Rozliczenie na podstawie wykonanych zleceń</p>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Sposób raportowania czasu</Label>
                <RadioGroup value={timeInputMode} onValueChange={(v) => setTimeInputMode(v as 'total' | 'start_end')}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="total" id="time-total" />
                      <Label htmlFor="time-total" className="font-normal cursor-pointer">Pracownik podaje łączny czas pracy</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Wybiera liczbę godzin i minut</p>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="start_end" id="time-start-end" />
                      <Label htmlFor="time-start-end" className="font-normal cursor-pointer">Pracownik podaje czas rozpoczęcia i zakończenia</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">Wybiera godzinę Od i Do</p>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>
        <div className="sticky bottom-0 bg-background border-t p-4 flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1">Anuluj</Button>
          <Button onClick={handleSave} disabled={saving || isLoading} className="flex-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Zapisz
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkersSettingsDrawer;
