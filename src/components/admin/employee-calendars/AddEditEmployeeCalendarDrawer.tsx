import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EmployeeCalendarConfig } from './EmployeeCalendarCard';

interface CalendarColumn {
  id: string;
  name: string;
}

interface EmployeeUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface AddEditEmployeeCalendarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  config?: EmployeeCalendarConfig | null;
  onSaved: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Nazwa klienta',
  customer_phone: 'Telefon klienta',
  admin_notes: 'Notatki',
  price: 'Cena',
  address: 'Adres',
  hours: 'Godziny zlecenia',
};

const ACTION_LABELS: Record<string, string> = {
  add_item: 'Dodawanie zleceń',
  edit_item: 'Edycja zleceń',
  delete_item: 'Usuwanie zleceń',
  change_time: 'Zmiana czasu',
  change_column: 'Zmiana kolumny',
  edit_services: 'Edycja usług w zleceniu',
};

const defaultVisibleFields = {
  customer_name: true,
  customer_phone: true,
  admin_notes: true,
  price: true,
  address: true,
  hours: true,
};

const defaultAllowedActions = {
  add_item: true,
  edit_item: true,
  delete_item: true,
  change_time: true,
  change_column: true,
  edit_services: true,
};

const AddEditEmployeeCalendarDrawer = ({
  open,
  onOpenChange,
  instanceId,
  config,
  onSaved,
}: AddEditEmployeeCalendarDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [employeeUsers, setEmployeeUsers] = useState<EmployeeUser[]>([]);
  const [employeeUsersLoading, setEmployeeUsersLoading] = useState(true);

  const [name, setName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [visibleFields, setVisibleFields] = useState(defaultVisibleFields);
  const [allowedActions, setAllowedActions] = useState(defaultAllowedActions);

  const isEditing = !!config;

  useEffect(() => {
    if (!open) return;

    const fetchColumns = async () => {
      setColumnsLoading(true);
      const { data } = await supabase
        .from('calendar_columns')
        .select('id, name')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      if (data) setColumns(data);
      setColumnsLoading(false);
    };

    const fetchEmployeeUsers = async () => {
      setEmployeeUsersLoading(true);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('instance_id', instanceId)
        .eq('role', 'employee');

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profiles) {
          setEmployeeUsers(profiles.map(p => ({
            user_id: p.id,
            full_name: p.full_name,
            email: p.email,
          })));
        }
      } else {
        setEmployeeUsers([]);
      }
      setEmployeeUsersLoading(false);
    };

    fetchColumns();
    fetchEmployeeUsers();
  }, [open, instanceId]);

  useEffect(() => {
    if (config) {
      setName(config.name);
      setSelectedUserId(config.user_id);
      setSelectedColumnIds(config.column_ids || []);
      setVisibleFields({ ...defaultVisibleFields, ...(config.visible_fields || {}) });
      setAllowedActions({ ...defaultAllowedActions, ...(config.allowed_actions || {}) });
    } else {
      setName('');
      setSelectedUserId('');
      setSelectedColumnIds([]);
      setVisibleFields(defaultVisibleFields);
      setAllowedActions(defaultAllowedActions);
    }
  }, [config, open]);

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumnIds(prev =>
      prev.includes(columnId) ? prev.filter(id => id !== columnId) : [...prev, columnId]
    );
  };

  const handleVisibleFieldToggle = (field: keyof typeof visibleFields) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAllowedActionToggle = (action: keyof typeof allowedActions) => {
    setAllowedActions(prev => ({ ...prev, [action]: !prev[action] }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nazwa kalendarza jest wymagana');
      return;
    }
    if (!selectedUserId) {
      toast.error('Wybierz pracownika');
      return;
    }
    if (selectedColumnIds.length === 0) {
      toast.error('Wybierz przynajmniej jedną kolumnę');
      return;
    }

    setLoading(true);
    try {
      const configData = {
        instance_id: instanceId,
        user_id: selectedUserId,
        name: name.trim(),
        column_ids: selectedColumnIds,
        visible_fields: visibleFields,
        allowed_actions: allowedActions,
      };

      if (isEditing && config) {
        const { error } = await supabase
          .from('employee_calendar_configs')
          .update(configData as any)
          .eq('id', config.id);
        if (error) throw error;
        toast.success('Kalendarz zaktualizowany');
      } else {
        const { error } = await supabase
          .from('employee_calendar_configs')
          .insert(configData as any);
        if (error) throw error;
        toast.success('Kalendarz utworzony');
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error saving employee calendar config:', error);
      toast.error('Błąd zapisu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full overflow-y-auto z-[1000]" hideCloseButton onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>
              {isEditing ? 'Edytuj kalendarz' : 'Dodaj kalendarz'}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-primary/5 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="calendar-name">Nazwa kalendarza</Label>
            <Input
              id="calendar-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Jan Kowalski"
            />
          </div>

          {/* Employee select */}
          <div className="space-y-2">
            <Label>Pracownik</Label>
            {employeeUsersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : employeeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak pracowników z rolą employee</p>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {employeeUsers.map(eu => (
                    <SelectItem key={eu.user_id} value={eu.user_id}>
                      {eu.full_name || eu.email || eu.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Columns */}
          <div className="space-y-3">
            <Label>Kolumny kalendarza</Label>
            {columnsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak kolumn kalendarza</p>
            ) : (
              <div className="space-y-2">
                {columns.map(col => (
                  <label
                    key={col.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-primary/5 transition-colors"
                  >
                    <Checkbox
                      checked={selectedColumnIds.includes(col.id)}
                      onCheckedChange={() => handleColumnToggle(col.id)}
                    />
                    <span className="font-medium">{col.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Visible Fields */}
          <div className="space-y-3">
            <Label>Widoczne pola</Label>
            <p className="text-xs text-muted-foreground">Które informacje pracownik widzi na zleceniu</p>
            <div className="space-y-2">
              {Object.entries(visibleFields).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-primary/5 transition-colors"
                >
                  <Checkbox
                    checked={value}
                    onCheckedChange={() => handleVisibleFieldToggle(key as keyof typeof visibleFields)}
                  />
                  <span className="text-sm">{FIELD_LABELS[key] || key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Allowed Actions */}
          <div className="space-y-3">
            <Label>Dozwolone akcje</Label>
            <p className="text-xs text-muted-foreground">Co pracownik może robić w kalendarzu</p>
            <div className="space-y-2">
              {Object.entries(allowedActions).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-primary/5 transition-colors"
                >
                  <Checkbox
                    checked={value}
                    onCheckedChange={() => handleAllowedActionToggle(key as keyof typeof allowedActions)}
                  />
                  <span className="text-sm">{ACTION_LABELS[key] || key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Zapisz' : 'Utwórz kalendarz'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddEditEmployeeCalendarDrawer;
