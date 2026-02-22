import { X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Employee } from '@/hooks/useEmployees';

interface AssignedEmployeesChipsProps {
  employees: Employee[];
  selectedIds: string[];
  onRemove: (id: string) => void;
}

const AssignedEmployeesChips = ({ employees, selectedIds, onRemove }: AssignedEmployeesChipsProps) => {
  if (selectedIds.length === 0) return null;

  const selected = selectedIds
    .map(id => employees.find(e => e.id === id))
    .filter(Boolean) as Employee[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {selected.map(emp => (
        <div
          key={emp.id}
          className="flex items-center gap-1 bg-muted rounded-full pl-0.5 pr-1 py-0.5 border border-border"
        >
          <Avatar className="w-5 h-5">
            {emp.photo_url && <AvatarImage src={emp.photo_url} />}
            <AvatarFallback className="text-[8px]">{emp.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-xs">{emp.name}</span>
          <button
            type="button"
            onClick={() => onRemove(emp.id)}
            className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AssignedEmployeesChips;
