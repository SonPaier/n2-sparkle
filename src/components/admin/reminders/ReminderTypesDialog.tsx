import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { ReminderType } from '@/hooks/useReminders';

interface Props {
  open: boolean;
  onClose: () => void;
  types: ReminderType[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function ReminderTypesDialog({ open, onClose, types, onAdd, onUpdate, onDelete }: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName('');
  };

  const startEdit = (t: ReminderType) => {
    setEditingId(t.id);
    setEditingName(t.name);
  };

  const saveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    onUpdate(editingId, editingName.trim());
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kategorie przypomnień</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-auto">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-background">
              {editingId === t.id ? (
                <>
                  <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="flex-1 h-8" autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={saveEdit}><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{t.name}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => startEdit(t)}><Pencil className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => onDelete(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </>
              )}
            </div>
          ))}
          {types.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Brak kategorii. Dodaj pierwszą kategorię poniżej.</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nowa kategoria..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Dodaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
