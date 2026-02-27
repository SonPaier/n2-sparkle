import { X } from 'lucide-react';
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
          className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1"
        >
          <span className="text-xs font-medium">{emp.name}</span>
          <button
            type="button"
            onClick={() => onRemove(emp.id)}
            className="ml-0.5 p-0.5 rounded-full text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AssignedEmployeesChips;
