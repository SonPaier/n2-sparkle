import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Loader2, MoreHorizontal, Trash2, Users, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationTemplate {
  id: string;
  name: string;
  description: string | null;
  items: { months: number; service_type: string }[];
}

interface TemplateWithCount extends NotificationTemplate {
  activeCustomersCount: number;
}

interface SmsNotificationsViewProps {
  instanceId: string | null;
}

export default function SmsNotificationsView({ instanceId }: SmsNotificationsViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: NotificationTemplate | null }>({
    open: false,
    template: null,
  });
  
  const isAdminPath = location.pathname.startsWith('/admin');
  const basePath = isAdminPath ? '/admin/powiadomienia-sms' : '/powiadomienia-sms';

  useEffect(() => {
    if (instanceId) {
      fetchTemplates();
    }
  }, [instanceId]);

  const fetchTemplates = async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await (supabase
        .from('sms_notification_templates') as any)
        .select('id, name, description, items')
        .eq('instance_id', instanceId)
        .order('name');

      if (templatesError) throw templatesError;

      const { data: countsData, error: countsError } = await (supabase
        .from('customer_sms_notifications') as any)
        .select('notification_template_id, customer_phone')
        .eq('instance_id', instanceId)
        .eq('status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString().split('T')[0]);

      if (countsError) throw countsError;

      const countsByTemplate: Record<string, Set<string>> = {};
      (countsData || []).forEach((row: any) => {
        if (!countsByTemplate[row.notification_template_id]) {
          countsByTemplate[row.notification_template_id] = new Set();
        }
        countsByTemplate[row.notification_template_id].add(row.customer_phone);
      });

      const templatesWithCounts: TemplateWithCount[] = (templatesData || []).map((t: any) => ({
        ...t,
        items: Array.isArray(t.items) ? t.items as { months: number; service_type: string }[] : [],
        activeCustomersCount: countsByTemplate[t.id]?.size || 0,
      }));

      setTemplates(templatesWithCounts);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Błąd pobierania szablonów');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const template = deleteDialog.template;
    if (!template) return;

    try {
      const { count } = await (supabase
        .from('customer_sms_notifications') as any)
        .select('*', { count: 'exact', head: true })
        .eq('notification_template_id', template.id)
        .eq('status', 'scheduled');

      if (count && count > 0) {
        toast.error('Nie można usunąć — szablon ma aktywne powiadomienia');
        setDeleteDialog({ open: false, template: null });
        return;
      }

      const { error } = await (supabase
        .from('sms_notification_templates') as any)
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== template.id));
      toast.success('Szablon usunięty');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Błąd usuwania szablonu');
    } finally {
      setDeleteDialog({ open: false, template: null });
    }
  };

  const handleTemplateClick = (template: NotificationTemplate) => {
    const shortId = template.id.substring(0, 8);
    navigate(`${basePath}/${shortId}`);
  };

  const handleAddNew = () => {
    navigate(`${basePath}/new`);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Powiadomienia SMS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Szablony powiadomień SMS wysyłanych do klientów
          </p>
        </div>
        <Button onClick={handleAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Dodaj szablon</span>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground mb-4">Brak szablonów powiadomień SMS</p>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Dodaj szablon
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="flex items-center justify-between gap-3 p-4 border rounded-lg bg-card hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{template.name}</div>
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {template.items.length} {template.items.length === 1 ? 'przypomnienie' : 'przypomnień'}
                  </Badge>
                  {template.activeCustomersCount > 0 && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {template.activeCustomersCount} {template.activeCustomersCount === 1 ? 'klient' : 'klientów'}
                    </Badge>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteDialog({ open: true, template });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Usuń
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, template: null })}
        title="Usunąć szablon?"
        description={`Czy na pewno chcesz usunąć szablon "${deleteDialog.template?.name || ''}"? Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
