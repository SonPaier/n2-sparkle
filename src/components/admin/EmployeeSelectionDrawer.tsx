import { useState, useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isWithinInterval } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEmployeeDaysOff, DAY_OFF_TYPE_LABELS } from '@/hooks/useEmployeeDaysOff';
import type { Employee } from '@/hooks/useEmployees';
import type { EmployeeDayOff } from '@/hooks/useEmployeeDaysOff';

interface EmployeeSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  singleSelect?: boolean;
  instanceId?: string | null;
  orderDateFrom?: string | null; // yyyy-MM-dd
  orderDateTo?: string | null;   // yyyy-MM-dd
}

/** Check if an employee has days off overlapping with the order date range */
function getOverlappingDaysOff(
  employeeId: string,
  daysOff: EmployeeDayOff[],
  orderFrom: string | null | undefined,
  orderTo: string | null | undefined,
): EmployeeDayOff[] {
  if (!orderFrom) return [];
  const from = parseISO(orderFrom);
  const to = orderTo ? parseISO(orderTo) : from;

  return daysOff.filter(d => {
    if (d.employee_id !== employeeId) return false;
    const dFrom = parseISO(d.date_from);
    const dTo = parseISO(d.date_to);
    // Ranges overlap if one starts before the other ends
    return dFrom <= to && dTo >= from;
  });
}

function formatDayOffLabel(d: EmployeeDayOff): string {
  const from = parseISO(d.date_from);
  const to = parseISO(d.date_to);
  if (d.date_from === d.date_to) {
    return `Nieobecny ${format(from, 'd MMMM', { locale: pl })}`;
  }
  return `Nieobecny ${format(from, 'd MMM', { locale: pl })} – ${format(to, 'd MMM', { locale: pl })}`;
}

const EmployeeSelectionDrawer = ({
  open,
  onClose,
  employees,
  selectedIds,
  onConfirm,
  singleSelect,
  instanceId,
  orderDateFrom,
  orderDateTo,
}: EmployeeSelectionDrawerProps) => {
  const isMobile = useIsMobile();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  const { data: allDaysOff = [] } = useEmployeeDaysOff(instanceId || null);

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

  // Pre-compute overlapping days off per employee
  const employeeDaysOffMap = useMemo(() => {
    const map = new Map<string, EmployeeDayOff[]>();
    for (const emp of activeEmployees) {
      const overlaps = getOverlappingDaysOff(emp.id, allDaysOff, orderDateFrom, orderDateTo);
      if (overlaps.length > 0) map.set(emp.id, overlaps);
    }
    return map;
  }, [activeEmployees, allDaysOff, orderDateFrom, orderDateTo]);

  const content = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {singleSelect ? 'Powiąż pracownika' : 'Przypisz pracowników'}
        </h2>
        <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md bg-background hover:bg-primary/5 transition-colors">
          <X className="w-4 h-4" />
        </button>
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
          const overlaps = employeeDaysOffMap.get(emp.id);
          const hasConflict = !!overlaps;

          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => toggle(emp.id)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
                isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-primary/5 border border-transparent",
              )}
            >
              <Avatar className="w-8 h-8 shrink-0">
                {emp.photo_url && <AvatarImage src={emp.photo_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{emp.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block">{emp.name}</span>
                {hasConflict && overlaps!.map(d => (
                  <span key={d.id} className="text-[11px] text-destructive block">
                    {formatDayOffLabel(d)}
                  </span>
                ))}
              </div>
              {singleSelect ? (
                <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0">
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              ) : (
                isSelected && <Check className="w-4 h-4 text-primary shrink-0" />
              )}
            </button>
          );
        })}
        {activeEmployees.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Brak aktywnych pracowników</p>
        )}
      </div>
      <div className="sticky bottom-0 px-4 py-3 border-t border-border bg-white dark:bg-card shrink-0">
        <Button onClick={handleConfirm} className="w-full">
          Potwierdź {!singleSelect && `(${localSelected.length})`}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className={cn("z-[1100] h-full p-0 flex flex-col", isMobile ? "w-full" : "w-full sm:w-[550px] sm:max-w-[550px]")} hideCloseButton>
        {content}
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeSelectionDrawer;
