import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { User, Phone, Mail, Clock, Trash2, Pencil, Check, RotateCcw, X, FileText, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';

interface CalendarItemDetailsDrawerProps {
  item: CalendarItem | null;
  open: boolean;
  onClose: () => void;
  columns: CalendarColumn[];
  onDelete?: (itemId: string) => void;
  onEdit?: (item: CalendarItem) => void;
  onStatusChange?: (itemId: string, newStatus: string) => void;
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
}: CalendarItemDetailsDrawerProps) => {
  const isMobile = useIsMobile();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

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

  const handleStatusChange = async (newStatus: string) => {
    setChangingStatus(true);
    try {
      onStatusChange?.(item.id, newStatus);
    } catch {
      toast.error('Błąd zmiany statusu');
    } finally {
      setChangingStatus(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={isMobile ? 'h-[85vh] overflow-y-auto' : 'sm:max-w-lg overflow-y-auto'}>
          <SheetHeader>
            <SheetTitle className="text-left">{item.title}</SheetTitle>
            <SheetDescription className="text-left">
              <Badge className={statusColors[item.status] || 'bg-muted'}>
                {statusLabels[item.status] || item.status}
              </Badge>
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-4">
            {/* Date & Time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{formattedDate}</span>
              </div>
              <div className="text-sm ml-6">
                {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
              </div>
              {column && (
                <div className="text-sm ml-6 text-muted-foreground">
                  Kolumna: {column.name}
                </div>
              )}
            </div>

            {/* Customer */}
            {(item.customer_name || item.customer_phone || item.customer_email) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Klient</h4>
                {item.customer_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{item.customer_name}</span>
                  </div>
                )}
                {item.customer_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${item.customer_phone}`} className="text-primary hover:underline">{item.customer_phone}</a>
                  </div>
                )}
                {item.customer_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${item.customer_email}`} className="text-primary hover:underline">{item.customer_email}</a>
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            {item.price != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{item.price.toFixed(2)} PLN</span>
              </div>
            )}

            {/* Notes */}
            {item.admin_notes && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Notatki
                </div>
                <p className="text-sm text-muted-foreground ml-6 whitespace-pre-wrap">{item.admin_notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-border">
              {/* Status change */}
              {item.status !== 'cancelled' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full" disabled={changingStatus}>
                      Zmień status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {item.status !== 'confirmed' && (
                      <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
                        <Check className="w-4 h-4 mr-2 text-emerald-600" />
                        Potwierdzone
                      </DropdownMenuItem>
                    )}
                    {item.status !== 'in_progress' && (
                      <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}>
                        <RotateCcw className="w-4 h-4 mr-2 text-orange-600" />
                        W trakcie
                      </DropdownMenuItem>
                    )}
                    {item.status !== 'completed' && (
                      <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                        <Check className="w-4 h-4 mr-2 text-slate-600" />
                        Zakończone
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} className="text-destructive">
                      <X className="w-4 h-4 mr-2" />
                      Anuluj zlecenie
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Edit */}
              <Button variant="outline" className="w-full" onClick={() => onEdit?.(item)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edytuj
              </Button>

              {/* Delete */}
              <Button variant="destructive" className="w-full" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Usuń
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
};

export default CalendarItemDetailsDrawer;
