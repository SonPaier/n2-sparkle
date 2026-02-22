import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Mail, Clock, Trash2, Pencil, Check, RotateCcw, X, FileText, DollarSign, MapPin, HardHat, MessageSquare, MoreVertical, ChevronDown, Plus, ClipboardCheck } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useEmployees } from '@/hooks/useEmployees';
import EmployeeSelectionDrawer from './EmployeeSelectionDrawer';
import type { CalendarItem, CalendarColumn, AssignedEmployee } from './AdminCalendar';

interface SmsNotificationInfo {
  id: string;
  status: string;
  sent_at: string | null;
  service_type: string;
}

interface CalendarItemDetailsDrawerProps {
  item: CalendarItem | null;
  open: boolean;
  onClose: () => void;
  columns: CalendarColumn[];
  onDelete?: (itemId: string) => void;
  onEdit?: (item: CalendarItem) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
  onStartWork?: (itemId: string) => void;
  onEndWork?: (itemId: string) => void;
  onAddProtocol?: (item: CalendarItem) => void;
  instanceId?: string;
}

const statusLabels: Record<string, string> = {
  confirmed: 'Potwierdzone',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
  change_requested: 'Prośba o zmianę',
};

const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  in_progress: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-slate-100 text-slate-700 border-slate-300',
  cancelled: 'bg-red-100 text-red-700 border-red-300',
  change_requested: 'bg-red-100 text-red-800 border-red-300',
};

const CalendarItemDetailsDrawer = ({
  item,
  open,
  onClose,
  columns,
  onDelete,
  onEdit,
  onStatusChange,
  onStartWork,
  onEndWork,
  onAddProtocol,
  instanceId,
}: CalendarItemDetailsDrawerProps) => {
  const isMobile = useIsMobile();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [smsNotifications, setSmsNotifications] = useState<SmsNotificationInfo[]>([]);
  
  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Employee management
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  const { data: allEmployees = [] } = useEmployees(instanceId || null);

  useEffect(() => {
    if (item) {
      setNotesValue(item.admin_notes || '');
      setEditingNotes(false);
    }
  }, [item?.id, item?.admin_notes]);

  // Fetch address
  useEffect(() => {
    if (!item?.customer_address_id) { setAddressLabel(null); return; }
    const fetchAddr = async () => {
      const { data } = await supabase
        .from('customer_addresses')
        .select('name, street, city')
        .eq('id', item.customer_address_id!)
        .single();
      if (data) {
        const parts = [data.name, data.street, data.city].filter(Boolean);
        setAddressLabel(parts.join(', '));
      }
    };
    fetchAddr();
  }, [item?.customer_address_id]);

  // Fetch SMS notifications
  useEffect(() => {
    if (!item?.id || !open) { setSmsNotifications([]); return; }
    const fetchSms = async () => {
      const { data } = await (supabase.from('customer_sms_notifications') as any)
        .select('id, status, sent_at, service_type')
        .eq('calendar_item_id', item.id);
      if (data) setSmsNotifications(data);
    };
    fetchSms();
  }, [item?.id, open]);

  if (!item) return null;

  const column = columns.find(c => c.id === item.column_id);
  const formattedDate = item.item_date
    ? format(new Date(item.item_date), 'EEEE, d MMMM yyyy', { locale: pl })
    : '';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      onDelete?.(item.id);
      setDeleteDialogOpen(false);
      onClose();
    } catch {
      toast.error('Błąd podczas usuwania');
    } finally {
      setDeleting(false);
    }
  };

  const handleNotesBlur = async () => {
    setEditingNotes(false);
    if (notesValue === (item.admin_notes || '')) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('calendar_items')
      .update({ admin_notes: notesValue.trim() || null })
      .eq('id', item.id);
    setSavingNotes(false);
    if (error) {
      toast.error('Błąd zapisu notatek');
      setNotesValue(item.admin_notes || '');
    }
  };

  const handleRemoveEmployee = async (empId: string) => {
    const newIds = (item.assigned_employee_ids || []).filter(id => id !== empId);
    const { error } = await supabase
      .from('calendar_items')
      .update({ assigned_employee_ids: newIds.length > 0 ? newIds : null })
      .eq('id', item.id);
    if (error) { toast.error('Błąd usuwania pracownika'); return; }
    // Update local state
    if (item.assigned_employees) {
      item.assigned_employees = item.assigned_employees.filter(e => e.id !== empId);
    }
    item.assigned_employee_ids = newIds;
    onStatusChange?.(item.id, item.status); // trigger refresh
  };

  const handleEmployeesConfirmed = async (ids: string[]) => {
    const { error } = await supabase
      .from('calendar_items')
      .update({ assigned_employee_ids: ids.length > 0 ? ids : null })
      .eq('id', item.id);
    if (error) { toast.error('Błąd przypisania pracowników'); return; }
    onStatusChange?.(item.id, item.status); // trigger refresh
  };

  // Footer button config based on status
  const renderFooter = () => {
    const editBtn = onEdit && (
      <Button variant="outline" className="bg-white flex-1" onClick={() => onEdit(item)}>
        <Pencil className="w-4 h-4 mr-1" />
        Edytuj
      </Button>
    );

    const moreMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="bg-white shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onAddProtocol && (
            <DropdownMenuItem onClick={() => onAddProtocol(item)}>
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Dodaj protokół
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Usuń
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const statusDropdown = (mainLabel: string, mainAction: () => void, mainColor: string, otherStatuses: { label: string; status: string; icon: React.ReactNode }[]) => (
      <div className="flex flex-1">
        <Button
          className={`${mainColor} flex-1 rounded-r-none`}
          onClick={mainAction}
        >
          {mainLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={`${mainColor} rounded-l-none border-l border-white/20 px-2`}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {otherStatuses.map(s => (
              <DropdownMenuItem key={s.status} onClick={() => onStatusChange?.(item.id, s.status)}>
                {s.icon}
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

    return (
      <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center gap-2">
        {editBtn}
        {moreMenu}

        {item.status === 'confirmed' && onStartWork && statusDropdown(
          'Rozpocznij pracę',
          () => onStartWork(item.id),
          'bg-emerald-600 hover:bg-emerald-700 text-white',
          [
            { label: 'Zakończone', status: 'completed', icon: <Check className="w-4 h-4 mr-2" /> },
            { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
          ]
        )}

        {item.status === 'in_progress' && onEndWork && statusDropdown(
          'Zakończ pracę',
          () => onEndWork(item.id),
          'bg-sky-500 hover:bg-sky-600 text-white',
          [
            { label: 'Potwierdzone', status: 'confirmed', icon: <RotateCcw className="w-4 h-4 mr-2" /> },
            { label: 'Anuluj', status: 'cancelled', icon: <X className="w-4 h-4 mr-2" /> },
          ]
        )}

        {item.status === 'completed' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 bg-white" disabled>
                Zakończone
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Cofnij do potwierdzone
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'in_progress')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Cofnij do w trakcie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {item.status === 'cancelled' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 bg-white">
                Anulowane
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange?.(item.id, 'confirmed')}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Przywróć
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          hideCloseButton
          hideOverlay
          className={`flex flex-col p-0 gap-0 ${isMobile ? 'h-[85vh]' : 'sm:max-w-lg'}`}
        >
          {/* Accessible title */}
          <SheetTitle className="sr-only">{item.title}</SheetTitle>
          <SheetDescription className="sr-only">Szczegóły zlecenia</SheetDescription>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[item.status] || 'bg-muted'}>
                    {statusLabels[item.status] || item.status}
                  </Badge>
                  {column && (
                    <span className="text-xs text-muted-foreground">{column.name}</span>
                  )}
                </div>
                <h3 className="text-base font-semibold mt-1">{item.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Customer */}
            {(item.customer_name || item.customer_phone || item.customer_email) && (
              <div className="space-y-2">
                {item.customer_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{item.customer_name}</span>
                    {item.customer_phone && (
                      <a href={`tel:${item.customer_phone}`} className="ml-auto p-1 rounded hover:bg-muted">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    )}
                    {item.customer_phone && (
                      <a href={`sms:${item.customer_phone}`} className="p-1 rounded hover:bg-muted">
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </a>
                    )}
                  </div>
                )}
                {item.customer_phone && (
                  <div className="flex items-center gap-2 text-sm ml-6">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${item.customer_phone}`} className="text-primary hover:underline">{item.customer_phone}</a>
                  </div>
                )}
                {item.customer_email && (
                  <div className="flex items-center gap-2 text-sm ml-6">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${item.customer_email}`} className="text-primary hover:underline">{item.customer_email}</a>
                  </div>
                )}
                {addressLabel && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{addressLabel}</span>
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            {item.price != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-bold">{item.price.toFixed(2)} PLN</span>
              </div>
            )}

            {/* Assigned Employees - N2Wash style pills */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardHat className="w-4 h-4 text-muted-foreground" />
                Przypisani pracownicy
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.assigned_employees && item.assigned_employees.map(emp => (
                  <span key={emp.id} className="inline-flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                    {emp.name}
                    <button
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="ml-0.5 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {instanceId && (
                  <button
                    onClick={() => setEmployeeDrawerOpen(true)}
                    className="inline-flex items-center gap-1 border border-dashed border-border rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Dodaj
                  </button>
                )}
              </div>
            </div>

            {/* Notes - inline editable */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Notatki
              </div>
              {editingNotes ? (
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  onBlur={handleNotesBlur}
                  autoFocus
                  rows={3}
                  className="text-sm"
                  placeholder="Dodaj notatkę..."
                />
              ) : (
                <p
                  onClick={() => setEditingNotes(true)}
                  className="text-sm text-muted-foreground ml-6 whitespace-pre-wrap cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 min-h-[2rem]"
                >
                  {notesValue || 'Kliknij, aby dodać notatkę...'}
                </p>
              )}
            </div>

            {/* SMS Notification Status */}
            {smsNotifications.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Powiadomienie SMS
                </div>
                {smsNotifications.map(sms => (
                  <div key={sms.id} className="ml-6 text-sm">
                    {sms.sent_at ? (
                      <span className="text-emerald-600">
                        Wysłano SMS ({sms.service_type}) — {format(new Date(sms.sent_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                      </span>
                    ) : sms.status === 'pending' ? (
                      <span className="text-orange-600">
                        SMS oczekuje na wysłanie ({sms.service_type})
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {renderFooter()}
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zlecenie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć "{item.title}"? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Usuwanie...' : 'Usuń'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Employee Selection Drawer */}
      {instanceId && (
        <EmployeeSelectionDrawer
          open={employeeDrawerOpen}
          onClose={() => setEmployeeDrawerOpen(false)}
          employees={allEmployees}
          selectedIds={item.assigned_employee_ids || []}
          onConfirm={handleEmployeesConfirmed}
        />
      )}
    </>
  );
};

export default CalendarItemDetailsDrawer;
