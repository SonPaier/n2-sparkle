import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Employee } from '@/hooks/useEmployees';

interface EmployeeSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  singleSelect?: boolean;
}

const EmployeeSelectionDrawer = ({ open, onClose, employees, selectedIds, onConfirm, singleSelect }: EmployeeSelectionDrawerProps) => {
  const isMobile = useIsMobile();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  // Sync localSelected with selectedIds when drawer opens
  useEffect(() => {
    if (open) setLocalSelected(selectedIds);
  }, [open, selectedIds]);

  const toggle = (id: string) => {
    if (singleSelect) {
      setLocalSelected(prev => prev.includes(id) ? [] : [id]);
    } else {
      setLocalSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  const handleConfirm = () => {
    onConfirm(localSelected);
    onClose();
  };

  const activeEmployees = employees.filter(e => e.active);

  const content = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold">
          {singleSelect ? 'Powiąż pracownika' : 'Przypisz pracowników'}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {singleSelect && (
          <button
            type="button"
            onClick={() => setLocalSelected([])}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
              localSelected.length === 0 ? "bg-primary/10 border border-primary/30" : "hover:bg-primary/5 border border-transparent"
            )}
          >
            <span className="flex-1 text-sm font-medium text-muted-foreground">Brak</span>
            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0">
              {localSelected.length === 0 && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
          </button>
        )}
        {activeEmployees.map(emp => {
          const isSelected = localSelected.includes(emp.id);
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => toggle(emp.id)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
                isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-primary/5 border border-transparent"
              )}
            >
              <Avatar className="w-8 h-8">
                {emp.photo_url && <AvatarImage src={emp.photo_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{emp.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium">{emp.name}</span>
              {singleSelect ? (
                <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0">
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              ) : (
                isSelected && <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          );
        })}
        {activeEmployees.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Brak aktywnych pracowników</p>
        )}
      </div>
      <div className="sticky bottom-0 px-4 py-3 border-t border-border bg-white shrink-0">
        <Button onClick={handleConfirm} className="w-full">
          Potwierdź {!singleSelect && `(${localSelected.length})`}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <SheetContent side="right" className="z-[1100] w-full h-full p-0 flex flex-col" hideCloseButton>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="z-[1100] w-full sm:w-[400px] sm:max-w-[400px] h-full p-0 flex flex-col" hideCloseButton>
        {content}
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeSelectionDrawer;
