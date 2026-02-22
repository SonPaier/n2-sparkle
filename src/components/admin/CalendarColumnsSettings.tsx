import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, Calendar, Check, X, GripVertical } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CalendarColumn {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  sort_order: number;
}

interface CalendarColumnsSettingsProps {
  instanceId: string | null;
}

const COLUMN_COLORS = [
  '#E2EFFF', '#E5D5F1', '#FEE0D6', '#FEF1D6',
  '#D8EBE4', '#F5E6D0', '#E8E8E8', '#FDDEDE',
];

function SortableColumnItem({ column, onEdit, onDelete }: { column: CalendarColumn; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-border/50 rounded-lg bg-card",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-5 h-5" />
        </button>
        <div className={cn("p-2 rounded-lg shrink-0", !column.color && "bg-primary/10")} style={column.color ? { backgroundColor: column.color } : undefined}>
          <Calendar className={cn("w-5 h-5", !column.color && "text-primary")} style={column.color ? { color: '#475569' } : undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-medium text-sm sm:text-base">{column.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end sm:justify-start pl-10 sm:pl-0 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const CalendarColumnsSettings = ({ instanceId }: CalendarColumnsSettingsProps) => {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CalendarColumn | null>(null);
  const [formData, setFormData] = useState({ name: '', color: null as string | null });

  const fetchColumns = async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_columns')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');
      if (error) throw error;
      setColumns(data || []);
    } catch (error) {
      console.error('Error fetching calendar columns:', error);
      toast.error('Błąd pobierania kolumn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchColumns(); }, [instanceId]);

  const openEditDialog = (column?: CalendarColumn) => {
    if (column) {
      setEditingColumn(column);
      setFormData({ name: column.name, color: column.color });
    } else {
      setEditingColumn(null);
      setFormData({ name: '', color: null });
    }
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!instanceId || !formData.name.trim()) {
      toast.error('Nazwa kolumny jest wymagana');
      return;
    }
    setSaving(true);
    try {
      if (editingColumn) {
        const { error } = await supabase
          .from('calendar_columns')
          .update({ name: formData.name.trim(), color: formData.color })
          .eq('id', editingColumn.id);
        if (error) throw error;
        toast.success('Kolumna zaktualizowana');
      } else {
        const { error } = await supabase
          .from('calendar_columns')
          .insert({
            instance_id: instanceId,
            name: formData.name.trim(),
            color: formData.color,
            sort_order: columns.length,
          });
        if (error) throw error;
        toast.success('Kolumna dodana');
      }
      setEditDialogOpen(false);
      fetchColumns();
      queryClient.invalidateQueries({ queryKey: ['calendar_columns', instanceId] });
    } catch (error) {
      console.error('Error saving column:', error);
      toast.error('Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex(c => c.id === active.id);
    const newIndex = columns.findIndex(c => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);
    setColumns(reordered);
    try {
      await Promise.all(reordered.map((c, i) =>
        supabase.from('calendar_columns').update({ sort_order: i }).eq('id', c.id)
      ));
      queryClient.invalidateQueries({ queryKey: ['calendar_columns', instanceId] });
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Błąd zmiany kolejności');
      fetchColumns();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę kolumnę?')) return;
    try {
      const { error } = await supabase.from('calendar_columns').delete().eq('id', id);
      if (error) throw error;
      toast.success('Kolumna usunięta');
      fetchColumns();
      queryClient.invalidateQueries({ queryKey: ['calendar_columns', instanceId] });
    } catch (error) {
      console.error('Error deleting column:', error);
      toast.error('Błąd usuwania');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Kolumny kalendarza</h3>
          <p className="text-sm text-muted-foreground">Zarządzaj kolumnami widocznymi w kalendarzu</p>
        </div>
        <Button onClick={() => openEditDialog()} size="sm" className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Dodaj kolumnę
        </Button>
      </div>

      {columns.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Brak kolumn. Dodaj pierwszą kolumnę kalendarza.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {columns.map(column => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onEdit={() => openEditDialog(column)}
                  onDelete={() => handleDelete(column.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingColumn ? 'Edytuj kolumnę' : 'Dodaj nową kolumnę'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nazwa kolumny *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="np. Dostawy, Montaż, Serwis"
              />
            </div>
            <div className="space-y-2">
              <Label>Kolor kolumny</Label>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: null }))}
                  className={cn(
                    "w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all",
                    formData.color === null ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"
                  )}
                  title="Brak koloru"
                >
                  {formData.color === null ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <X className="w-3 h-3 text-muted-foreground/40" />}
                </button>
                {COLUMN_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={cn(
                      "w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all",
                      formData.color === color ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && <Check className="w-4 h-4 text-slate-700" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarColumnsSettings;
