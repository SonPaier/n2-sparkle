import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Settings2, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useReminders, useReminderTypes } from '@/hooks/useReminders';
import type { Reminder } from '@/hooks/useReminders';
import AddEditReminderDrawer from './AddEditReminderDrawer';
import ReminderTypesDialog from './ReminderTypesDialog';
import { format } from 'date-fns';

interface Props {
  instanceId: string;
}

const DAYS_OF_WEEK_LABELS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

function getRecurringLabel(recurringType: string | null, recurringValue: number | null): string {
  if (!recurringType) return 'Cykliczne';
  if (recurringType === 'monthly' && recurringValue) return `Cykliczne: ${recurringValue} dnia miesiąca`;
  if (recurringType === 'weekly' && recurringValue !== null) return `Cykliczne: co ${DAYS_OF_WEEK_LABELS[recurringValue] || ''}`;
  return 'Cykliczne';
}

function getDaysUntil(deadline: string): number {
  const d = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyClasses(deadline: string): {border: string;text: string;badge: string;label: string | null;} {
  const days = getDaysUntil(deadline);
  if (days <= 3) return { border: 'border-l-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200', label: 'PILNE' };
  if (days <= 7) return { border: 'border-l-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'WKRÓTCE' };
  return { border: 'border-l-green-500', text: 'text-green-700', badge: '', label: null };
}

function formatDeadline(deadline: string): string {
  try {return format(new Date(deadline), 'dd.MM.yyyy');} catch {return deadline;}
}

function getDaysLabel(deadline: string): string {
  const days = getDaysUntil(deadline);
  if (days < 0) return `${Math.abs(days)} dni po terminie!`;
  if (days === 0) return 'Dziś!';
  return `za ${days} dni`;
}

export default function RemindersView({ instanceId }: Props) {
  const { reminders, loading, saveReminder, updateStatus, deleteReminder } = useReminders(instanceId);
  const { types, addType, updateType, deleteType } = useReminderTypes(instanceId);

  const [activeTab, setActiveTab] = useState<'todo' | 'archive'>('todo');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const todoReminders = useMemo(() => reminders.filter((r) => r.status === 'todo'), [reminders]);
  const archiveReminders = useMemo(() => reminders.filter((r) => r.status === 'done' || r.status === 'cancelled'), [reminders]);

  const displayedReminders = activeTab === 'todo' ? todoReminders : archiveReminders;

  const openNew = () => {setEditingReminder(null);setDrawerOpen(true);};
  const openEdit = (r: Reminder) => {setEditingReminder(r);setDrawerOpen(true);};

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Przypomnienia</h1>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setTypesDialogOpen(true)}>
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button className="h-9" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" />
            Dodaj przypomnienie
          </Button>
        </div>
      </div>

      {/* Tabs + Filter */}
      <div className="flex border-b border-border/50">
          <button
          onClick={() => setActiveTab('todo')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'todo' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>

            Do zrobienia
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-white">{todoReminders.length}</span>
          </button>
          <button
          onClick={() => setActiveTab('archive')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'archive' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>

            Archiwum
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-white">{archiveReminders.length}</span>
          </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground text-center py-8">Ładowanie...</p>}
        {!loading && displayedReminders.length === 0 &&
        <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Brak przypomnień</p>
          </div>
        }
        {displayedReminders.map((r) => {
          const isArchive = r.status !== 'todo';
          const urgency = getUrgencyClasses(r.deadline);

          return (
            <div
              key={r.id}
              onClick={() => openEdit(r)}
              className={`flex items-center gap-4 p-3 rounded-lg border border-border/50 border-l-4 cursor-pointer transition-colors hover:bg-primary/5 ${isArchive ? 'border-l-muted opacity-70' : urgency.border} bg-card`}>

              {/* Checkbox for quick complete */}
              {!isArchive &&
              <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                      onClick={(e) => {e.stopPropagation();updateStatus(r.id, 'done', r);}}
                      className="shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center transition-colors hover:border-primary hover:bg-primary/10 group">

                        <Check className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Oznacz jako zrobione</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {r.reminder_type_name &&
                  <Badge variant="secondary" className="text-xs">{r.reminder_type_name}</Badge>
                  }
                  {r.customer_name &&
                  <Badge variant="outline" className="text-xs">{r.customer_name}</Badge>
                  }
                  {(r as any).assigned_employee_name &&
                  <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">{(r as any).assigned_employee_name}</Badge>
                  }
                  {r.is_recurring &&
                  <span className="text-xs text-muted-foreground">
                      {getRecurringLabel(r.recurring_type, r.recurring_value)}
                    </span>
                  }
                </div>
              </div>

              {/* Right: deadline or status + delete */}
              <div className="flex items-center gap-2 shrink-0">
                {isArchive ?
                <>
                    <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {e.stopPropagation();updateStatus(r.id, 'todo');}}>

                      Przywróć
                    </Button>
                    <button
                    onClick={(e) => {e.stopPropagation();setDeleteConfirmId(r.id);}}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 transition-colors">

                      <Trash2 className="w-4 h-4 text-foreground" />
                    </button>
                  </> :

                <>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${urgency.text}`}>{formatDeadline(r.deadline)}</div>
                      <div className={`text-xs ${urgency.text}`}>{getDaysLabel(r.deadline)}</div>
                      {urgency.label &&
                    <Badge className={`text-[10px] mt-1 ${urgency.badge}`}>{urgency.label}</Badge>
                    }
                    </div>
                    <button
                    onClick={(e) => {e.stopPropagation();setDeleteConfirmId(r.id);}}
                    className="shrink-0 p-1 rounded hover:bg-destructive/10 transition-colors">

                      <Trash2 className="w-4 h-4 text-foreground" />
                    </button>
                  </>
                }
              </div>
            </div>);

        })}
      </div>

      {/* Drawers & Dialogs */}
      <AddEditReminderDrawer
        open={drawerOpen}
        onClose={() => {setDrawerOpen(false);setEditingReminder(null);}}
        instanceId={instanceId}
        reminderTypes={types}
        onSave={saveReminder}
        onDelete={deleteReminder}
        editingReminder={editingReminder} />


      <ReminderTypesDialog
        open={typesDialogOpen}
        onClose={() => setTypesDialogOpen(false)}
        types={types}
        onAdd={addType}
        onUpdate={updateType}
        onDelete={deleteType} />


      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {if (!open) setDeleteConfirmId(null);}}
        title="Usuń przypomnienie"
        description="Czy na pewno chcesz usunąć to przypomnienie?"
        onConfirm={() => {if (deleteConfirmId) {deleteReminder(deleteConfirmId);setDeleteConfirmId(null);}}} />

    </div>);

}