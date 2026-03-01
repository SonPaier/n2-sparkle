import { useState, useEffect } from 'react';
import { Loader2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EmployeeCalendarCard, { EmployeeCalendarConfig } from './EmployeeCalendarCard';
import AddEditEmployeeCalendarDrawer from './AddEditEmployeeCalendarDrawer';

interface EmployeeCalendarsListViewProps {
  instanceId: string | null;
}

interface CalendarColumn {
  id: string;
  name: string;
}

const EmployeeCalendarsListView = ({ instanceId }: EmployeeCalendarsListViewProps) => {
  const [configs, setConfigs] = useState<EmployeeCalendarConfig[]>([]);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmployeeCalendarConfig | null>(null);

  const fetchConfigs = async () => {
    if (!instanceId) return;
    try {
      const { data, error } = await supabase
        .from('employee_calendar_configs')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');

      if (error) throw error;

      const mapped: EmployeeCalendarConfig[] = (data || []).map((h: any) => ({
        id: h.id,
        instance_id: h.instance_id,
        user_id: h.user_id,
        name: h.name,
        column_ids: h.column_ids || [],
        visible_fields: h.visible_fields || {
          customer_name: true,
          customer_phone: true,
          admin_notes: true,
          price: true,
          address: true,
        },
        allowed_actions: h.allowed_actions || {
          add_item: true,
          edit_item: true,
          delete_item: true,
          change_time: true,
          change_column: true,
        },
        sort_order: h.sort_order || 0,
        active: h.active,
      }));

      setConfigs(mapped);
    } catch (error) {
      console.error('Error fetching employee calendar configs:', error);
      toast.error('Błąd ładowania');
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('calendar_columns')
      .select('id, name')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .order('sort_order');
    if (data) setColumns(data);
  };

  useEffect(() => {
    fetchConfigs();
    fetchColumns();
  }, [instanceId]);

  const handleEdit = (config: EmployeeCalendarConfig) => {
    setEditingConfig(config);
    setDrawerOpen(true);
  };

  const handleDelete = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('employee_calendar_configs')
        .update({ active: false } as any)
        .eq('id', configId);
      if (error) throw error;
      setConfigs(prev => prev.filter(c => c.id !== configId));
      toast.success('Kalendarz usunięty');
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Błąd usuwania');
    }
  };

  const handleAddNew = () => {
    setEditingConfig(null);
    setDrawerOpen(true);
  };

  const handleSaved = () => {
    fetchConfigs();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Kalendarze pracowników</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Zarządzaj widokami kalendarza dla pracowników
          </p>
        </div>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          Dodaj kalendarz
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Monitor className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">Brak kalendarzy</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Dodaj pierwszy kalendarz pracownika, aby umożliwić mu dostęp do widoku kalendarza.
          </p>
          <Button onClick={handleAddNew} className="mt-4">
            Dodaj pierwszy kalendarz
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {configs.map((config, index) => (
            <EmployeeCalendarCard
              key={config.id}
              config={config}
              configNumber={index + 1}
              columns={columns}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {instanceId && (
        <AddEditEmployeeCalendarDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          instanceId={instanceId}
          config={editingConfig}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default EmployeeCalendarsListView;
