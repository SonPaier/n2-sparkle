import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { DashboardSettings } from '@/hooks/useDashboardSettings';

interface DashboardSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: DashboardSettings;
  onSave: (settings: DashboardSettings) => Promise<any>;
  isEmployee?: boolean;
}

const DashboardSettingsDrawer = ({ open, onClose, settings, onSave, isEmployee }: DashboardSettingsDrawerProps) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>(settings.viewMode);
  const [visibleSections, setVisibleSections] = useState(settings.visibleSections);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setViewMode(settings.viewMode);
      setVisibleSections(settings.visibleSections);
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ viewMode, visibleSections });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col" hideCloseButton hideOverlay>
        <SheetTitle className="sr-only">Ustawienia widoku</SheetTitle>
        <SheetDescription className="sr-only">Konfiguracja widoku dashboardu</SheetDescription>

        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">Ustawienia widoku</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* View mode */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Widok</Label>
            <RadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="day" id="view-day" />
                <Label htmlFor="view-day" className="cursor-pointer">Dzień (2-3 dni robocze)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="week" id="view-week" />
                <Label htmlFor="view-week" className="cursor-pointer">Tydzień (7 dni do przodu)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Visible sections - only for admin */}
          {!isEmployee && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Widoczne sekcje</Label>
              <div className="space-y-2">
                {[
                  { key: 'orders' as const, label: 'Zlecenia' },
                  { key: 'reminders' as const, label: 'Przypomnienia' },
                  { key: 'payments' as const, label: 'Płatności' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`section-${key}`}
                      checked={visibleSections[key]}
                      onCheckedChange={(checked) =>
                        setVisibleSections(prev => ({ ...prev, [key]: !!checked }))
                      }
                    />
                    <Label htmlFor={`section-${key}`} className="cursor-pointer">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Anuluj
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Zapisuję...' : 'Zapisz'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DashboardSettingsDrawer;
