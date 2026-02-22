import { useState } from 'react';
import { Copy, Check, Pencil, Trash2, MoreVertical, Eye, Columns, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export interface EmployeeCalendarConfig {
  id: string;
  instance_id: string;
  user_id: string;
  name: string;
  column_ids: string[];
  visible_fields: {
    customer_name: boolean;
    customer_phone: boolean;
    admin_notes: boolean;
    price: boolean;
    address: boolean;
  };
  allowed_actions: {
    add_item: boolean;
    edit_item: boolean;
    delete_item: boolean;
    change_time: boolean;
    change_column: boolean;
  };
  sort_order: number;
  active: boolean;
}

interface CalendarColumn {
  id: string;
  name: string;
}

interface EmployeeCalendarCardProps {
  config: EmployeeCalendarConfig;
  configNumber: number;
  columns: CalendarColumn[];
  onEdit: (config: EmployeeCalendarConfig) => void;
  onDelete: (configId: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Nazwa klienta',
  customer_phone: 'Telefon klienta',
  admin_notes: 'Notatki',
  price: 'Cena',
  address: 'Adres',
};

const ACTION_LABELS: Record<string, string> = {
  add_item: 'Dodawanie zleceń',
  edit_item: 'Edycja zleceń',
  delete_item: 'Usuwanie zleceń',
  change_time: 'Zmiana czasu',
  change_column: 'Zmiana kolumny',
};

const EmployeeCalendarCard = ({ config, configNumber, columns, onEdit, onDelete }: EmployeeCalendarCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const getCalendarUrl = () => `/employee-calendars/${configNumber}`;

  const handlePreview = () => {
    window.open(getCalendarUrl(), '_blank');
  };

  const handleDelete = () => {
    onDelete(config.id);
    setDeleteDialogOpen(false);
  };

  const visibleFieldNames = Object.entries(config.visible_fields)
    .filter(([_, visible]) => visible)
    .map(([key]) => FIELD_LABELS[key] || key);

  const allowedActionNames = Object.entries(config.allowed_actions)
    .filter(([_, allowed]) => allowed)
    .map(([key]) => ACTION_LABELS[key] || key);

  const configColumnNames = columns
    .filter(c => config.column_ids.includes(c.id))
    .map(c => c.name);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow flex flex-col">
        <CardContent className="p-4 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-semibold text-lg truncate flex-1">{config.name}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(config)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edytuj
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Usuń
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* URL */}
          <div className="mt-3 space-y-1">
            <span className="text-xs text-muted-foreground">Link do kalendarza</span>
            <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
              <code className="text-xs text-muted-foreground truncate flex-1">
                /employee-calendars/{configNumber}
              </code>
            </div>
          </div>

          {/* Columns */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Columns className="h-3.5 w-3.5" />
              <span className="font-medium">Widoczne kolumny:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {configColumnNames.length > 0 ? (
                configColumnNames.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">{name}</Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Brak wybranych kolumn</span>
              )}
            </div>
          </div>

          {/* Visible fields */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="font-medium">Widoczne pola:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visibleFieldNames.length > 0 ? (
                visibleFieldNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{name}</Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Brak wybranych pól</span>
              )}
            </div>
          </div>

          {/* Allowed actions */}
          <div className="mt-6 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              <span className="font-medium">Możliwość edycji:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {allowedActionNames.length > 0 ? (
                allowedActionNames.map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{name}</Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Brak uprawnień</span>
              )}
            </div>
          </div>

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={handlePreview}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Podgląd
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć kalendarz?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć kalendarz "{config.name}"? Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmployeeCalendarCard;
