import { useState } from 'react';
import { X, Plus, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ProjectDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
  instanceId: string;
  onEdit: (project: any) => void;
  onOrdersChanged: () => void;
  onAddOrder?: (projectId: string, customerId: string | null, customerAddressId: string | null) => void;
  onOrderClick?: (orderId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  not_started: { label: 'Nierozpoczęty', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' },
  in_progress: { label: 'W trakcie', badgeClass: 'bg-blue-100 text-blue-700 border-blue-300' },
  completed: { label: 'Zakończony', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  confirmed: { label: 'Do wykonania', badgeClass: 'border-amber-500 text-amber-600' },
  in_progress: { label: 'W realizacji', badgeClass: 'bg-blue-600 text-white' },
  completed: { label: 'Zakończony', badgeClass: 'bg-emerald-600 text-white' },
  cancelled: { label: 'Anulowany', badgeClass: 'bg-red-600 text-white' },
};

const ProjectDetailsDrawer = ({ open, onClose, projectId, instanceId, onEdit, onOrdersChanged, onAddOrder, onOrderClick }: ProjectDetailsDrawerProps) => {
  const { data: project } = useQuery({
    queryKey: ['project-detail', projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from('projects' as any) as any)
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: customerName } = useQuery({
    queryKey: ['project-customer', project?.customer_id],
    enabled: !!project?.customer_id,
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('name').eq('id', project.customer_id).single();
      return data?.name || '—';
    },
  });

  const { data: addressName } = useQuery({
    queryKey: ['project-address', project?.customer_address_id],
    enabled: !!project?.customer_address_id,
    queryFn: async () => {
      const { data } = await supabase.from('customer_addresses').select('name, street, city').eq('id', project.customer_address_id).single();
      if (!data) return '—';
      const parts = [data.street, data.city].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.name;
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['project-orders', projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('id, title, item_date, start_time, end_time, status, stage_number, order_number')
        .eq('project_id', projectId!)
        .order('stage_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const nonCancelledOrders = orders.filter((o: any) => o.status !== 'cancelled');
  const completedOrders = nonCancelledOrders.filter((o: any) => o.status === 'completed');
  const statusCfg = STATUS_CONFIG[project?.status] || STATUS_CONFIG.not_started;

  if (!project) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        hideCloseButton
        hideOverlay
        className="flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold truncate pr-2">{project.title}</SheetTitle>
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(project)} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
              <span className="text-sm font-medium">Etapy: {completedOrders.length}/{nonCancelledOrders.length}</span>
            </div>

            {customerName && (
              <div>
                <p className="text-xs text-muted-foreground">Klient</p>
                <p className="text-sm font-medium">{customerName}</p>
              </div>
            )}

            {addressName && (
              <div>
                <p className="text-xs text-muted-foreground">Adres serwisowy</p>
                <p className="text-sm">{addressName}</p>
              </div>
            )}

            {project.description && (
              <div>
                <p className="text-xs text-muted-foreground">Opis</p>
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              </div>
            )}

            {project.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notatki</p>
                <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
              </div>
            )}
          </div>

          {/* Orders list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Zlecenia w projekcie</h3>
              {onAddOrder && project.status !== 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddOrder(project.id, project.customer_id, project.customer_address_id)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Dodaj zlecenie
                </Button>
              )}
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Brak zleceń w tym projekcie</p>
            ) : (
              <div className="space-y-2">
                {orders.map((order: any) => {
                  const orderStatus = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.confirmed;
                  return (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border bg-white p-3 space-y-1 cursor-pointer hover:shadow-sm transition-shadow active:bg-muted/20"
                      onClick={() => onOrderClick?.(order.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {order.stage_number && (
                            <span className="text-xs font-bold text-muted-foreground shrink-0">#{order.stage_number}</span>
                          )}
                          <span className="text-sm font-medium truncate">{order.title}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${orderStatus.badgeClass}`}>{orderStatus.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.item_date ? (
                          <>
                            {format(new Date(order.item_date + 'T00:00:00'), 'd MMM yyyy', { locale: pl })}
                            {order.start_time && order.end_time && `, ${order.start_time.slice(0, 5)}–${order.end_time.slice(0, 5)}`}
                          </>
                        ) : (
                          'Bez daty'
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {onAddOrder && project.status !== 'completed' && orders.length === 0 && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onAddOrder(project.id, project.customer_id, project.customer_address_id)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Dodaj zlecenie do projektu
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ProjectDetailsDrawer;
