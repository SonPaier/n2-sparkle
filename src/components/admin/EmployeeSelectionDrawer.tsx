import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
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
}

const EmployeeSelectionDrawer = ({ open, onClose, employees, selectedIds, onConfirm }: EmployeeSelectionDrawerProps) => {
  const isMobile = useIsMobile();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  const toggle = (id: string) => {
    setLocalSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirm = () => {
    onConfirm(localSelected);
    onClose();
  };

  const activeEmployees = employees.filter(e => e.active);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side={isMobile ? 'bottom' : 'right'} className={`z-[1000] ${isMobile ? 'h-[70vh] overflow-y-auto' : 'sm:max-w-sm overflow-y-auto'}`}>
        <SheetHeader>
          <SheetTitle>Przypisz pracowników</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-1">
          {activeEmployees.map(emp => {
            const isSelected = localSelected.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggle(emp.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
                  isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                )}
              >
                <Avatar className="w-8 h-8">
                  {emp.photo_url && <AvatarImage src={emp.photo_url} />}
                  <AvatarFallback className="text-xs">{emp.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium">{emp.name}</span>
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
          {activeEmployees.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Brak aktywnych pracowników</p>
          )}
        </div>
        <SheetFooter>
          <Button onClick={handleConfirm} className="w-full">
            Potwierdź ({localSelected.length})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeSelectionDrawer;
