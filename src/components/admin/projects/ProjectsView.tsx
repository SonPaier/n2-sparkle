import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, MoreHorizontal, Trash2, Eye, FolderKanban, GripVertical, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import EmptyState from '@/components/ui/empty-state';
import AddEditProjectDrawer from './AddEditProjectDrawer';
import ProjectDetailsDrawer from './ProjectDetailsDrawer';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  customer_id: string | null;
  customer_address_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ProjectOrder {
  id: string;
  project_id: string;
  title: string;
  item_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  stage_number: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  not_started: { label: 'Nierozpoczęty', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' },
  in_progress: { label: 'W trakcie', badgeClass: 'bg-blue-100 text-blue-700 border-blue-300' },
  completed: { label: 'Zakończony', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  confirmed: { label: 'Do wykonania', dotClass: 'bg-amber-500' },
  in_progress: { label: 'W realizacji', dotClass: 'bg-blue-500' },
  completed: { label: 'Zakończony', dotClass: 'bg-emerald-500' },
  cancelled: { label: 'Anulowany', dotClass: 'bg-red-400' },
};

const ITEMS_PER_PAGE = 10;

// Sortable order row component
const SortableOrderRow = ({ order, onClick, onMore }: { order: ProjectOrder; onClick: () => void; onMore?: (action: 'edit' | 'delete') => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.confirmed;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="!bg-white hover:!bg-white cursor-pointer"
      onClick={onClick}
    >
      <TableCell className="w-[60px] py-1.5">
        <button
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </TableCell>
      <TableCell colSpan={2} className="py-1.5">
        <div className="flex items-center gap-2 pl-4">
          <span className="text-xs font-medium">
            {order.stage_number ? `#${order.stage_number}` : '—'}
          </span>
          <span className="text-sm truncate">{order.title}</span>
        </div>
      </TableCell>
      <TableCell className="py-1.5 text-xs text-muted-foreground">
        {order.item_date
          ? format(new Date(order.item_date + 'T00:00:00'), 'd MMM yyyy', { locale: pl })
          : 'Bez daty'}
      </TableCell>
      <TableCell className="py-1.5">
        <span className="text-xs text-muted-foreground">{statusCfg.label}</span>
      </TableCell>
      
      <TableCell>
        {onMore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMore('edit'); }}>
                <Pencil className="w-4 h-4 mr-2" />Edytuj
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMore('delete'); }} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />Usuń z projektu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

// Mobile sortable order row
const SortableMobileOrderRow = ({ order, onClick, onMore }: { order: ProjectOrder; onClick: () => void; onMore?: (action: 'edit' | 'delete') => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const osCfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.confirmed;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5"
      onClick={onClick}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <span className="font-medium">{order.stage_number ? `#${order.stage_number}` : '—'}</span>
      <span className="truncate flex-1">{order.title}</span>
      <span className="text-muted-foreground shrink-0">
        {order.item_date
          ? format(new Date(order.item_date + 'T00:00:00'), 'd MMM', { locale: pl })
          : 'Bez daty'}
      </span>
      {onMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"><MoreHorizontal className="w-3.5 h-3.5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMore('edit'); }}>
              <Pencil className="w-4 h-4 mr-2" />Edytuj
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMore('delete'); }} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />Usuń z projektu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

interface ProjectsViewProps {
  instanceId: string;
  onAddOrder?: (projectId: string, customerId: string | null, customerAddressId: string | null) => void;
  onOpenCalendarItem?: (itemId: string) => void;
  onEditOrder?: (orderId: string) => void;
}

const ProjectsView = ({ instanceId, onAddOrder, onOpenCalendarItem, onEditOrder }: ProjectsViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsProjectId, setDetailsProjectId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('projects' as any) as any)
        .select('id, title, description, customer_id, customer_address_id, status, notes, created_at')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectRow[];
    },
  });

  const customerIds = useMemo(() => [...new Set(projects.map(p => p.customer_id).filter(Boolean))] as string[], [projects]);
  const { data: customerMap = {} } = useQuery({
    queryKey: ['projects-customers', instanceId, customerIds],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name').in('id', customerIds);
      const map: Record<string, string> = {};
      (data || []).forEach(c => { map[c.id] = c.name; });
      return map;
    },
  });

  // Fetch customer addresses for projects
  const addressIds = useMemo(() => [...new Set(projects.map(p => p.customer_address_id).filter(Boolean))] as string[], [projects]);
  const { data: addressMap = {} } = useQuery({
    queryKey: ['projects-addresses', instanceId, addressIds],
    enabled: addressIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('customer_addresses').select('id, name, street, city').in('id', addressIds);
      const map: Record<string, string> = {};
      (data || []).forEach(a => {
        const parts = [a.street, a.city].filter(Boolean);
        map[a.id] = parts.length > 0 ? parts.join(', ') : a.name;
      });
      return map;
    },
  });

  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { data: allOrders = [] } = useQuery({
    queryKey: ['projects-orders', instanceId],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase
        .from('calendar_items') as any)
        .select('id, project_id, title, item_date, start_time, end_time, status, stage_number')
        .in('project_id', projectIds)
        .order('stage_number', { ascending: true, nullsFirst: false });
      return (data || []) as ProjectOrder[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const ordersMap = useMemo(() => {
    const map: Record<string, ProjectOrder[]> = {};
    allOrders.forEach(o => {
      if (!map[o.project_id]) map[o.project_id] = [];
      map[o.project_id].push(o);
    });
    return map;
  }, [allOrders]);

  const stageMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    allOrders.forEach(o => {
      if (!map[o.project_id]) map[o.project_id] = { total: 0, completed: 0 };
      if (o.status !== 'cancelled') {
        map[o.project_id].total++;
        if (o.status === 'completed') map[o.project_id].completed++;
      }
    });
    return map;
  }, [allOrders]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.customer_id && (customerMap[p.customer_id] || '').toLowerCase().includes(q))
    );
  }, [projects, searchQuery, customerMap]);

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('projects' as any) as any).delete().eq('id', id);
    if (error) { toast.error('Błąd usuwania projektu'); return; }
    queryClient.invalidateQueries({ queryKey: ['projects', instanceId] });
    toast.success('Projekt usunięty');
  };

  const handleOpenDetails = (projectId: string) => {
    setDetailsProjectId(projectId);
    setDetailsOpen(true);
  };

  const handleEdit = (project: ProjectRow) => {
    setEditingProject(project);
    setDrawerOpen(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', instanceId] });
    queryClient.invalidateQueries({ queryKey: ['projects-orders', instanceId] });
  };

  const handleOrderClick = (orderId: string) => {
    if (onOpenCalendarItem) {
      onOpenCalendarItem(orderId);
    }
  };

  const handleOrderMore = async (orderId: string, action: 'edit' | 'delete') => {
    if (action === 'edit') {
      if (onEditOrder) {
        onEditOrder(orderId);
      } else if (onOpenCalendarItem) {
        onOpenCalendarItem(orderId);
      }
    } else if (action === 'delete') {
      // Remove order from project (unlink, don't delete the order itself)
      const { error } = await (supabase.from('calendar_items') as any)
        .update({ project_id: null, stage_number: null })
        .eq('id', orderId);
      if (error) { toast.error('Błąd usuwania zlecenia z projektu'); return; }
      toast.success('Zlecenie usunięte z projektu');
      invalidate();
    }
  };

  // Auto-update project status based on orders
  useEffect(() => {
    if (!allOrders.length || !projects.length) return;
    projects.forEach(async (project) => {
      const projectOrders = ordersMap[project.id] || [];
      if (projectOrders.length === 0) return;
      const hasInProgress = projectOrders.some(o => o.status === 'in_progress');
      if (hasInProgress && project.status !== 'in_progress') {
        await (supabase.from('projects' as any) as any)
          .update({ status: 'in_progress' })
          .eq('id', project.id);
        queryClient.invalidateQueries({ queryKey: ['projects', instanceId] });
      }
    });
  }, [allOrders, projects, ordersMap, instanceId, queryClient]);

  const handleDragEnd = useCallback(async (event: DragEndEvent, projectId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const projectOrders = ordersMap[projectId] || [];
    const oldIndex = projectOrders.findIndex(o => o.id === active.id);
    const newIndex = projectOrders.findIndex(o => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally
    const reordered = [...projectOrders];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update stage_numbers: 1-based
    const updates = reordered.map((o, i) => ({ id: o.id, stage_number: i + 1 }));

    // Optimistic update
    queryClient.setQueryData(['projects-orders', instanceId, projectIds], (old: ProjectOrder[] | undefined) => {
      if (!old) return old;
      const updateMap = new Map(updates.map(u => [u.id, u.stage_number]));
      return old.map(o => updateMap.has(o.id) ? { ...o, stage_number: updateMap.get(o.id)! } : o);
    });

    // Persist
    for (const u of updates) {
      await (supabase.from('calendar_items') as any)
        .update({ stage_number: u.stage_number })
        .eq('id', u.id);
    }

    queryClient.invalidateQueries({ queryKey: ['projects-orders', instanceId] });
  }, [ordersMap, queryClient, instanceId, projectIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Projekty</h2>
        <Button size="sm" onClick={() => { setEditingProject(null); setDrawerOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj projekt
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj projektu lub klienta..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
          ) : filteredProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} message="Brak projektów — dodaj pierwszy projekt, aby grupować zlecenia" />
          ) : paginatedProjects.map(project => {
            const stages = stageMap[project.id] || { total: 0, completed: 0 };
            const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.not_started;
            const projectOrders = ordersMap[project.id] || [];
            return (
              <div
                key={project.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div
                  className="p-3 space-y-2 cursor-pointer active:bg-primary/5"
                  onClick={() => handleOpenDetails(project.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{project.title}</p>
                      {project.customer_id && customerMap[project.customer_id] && (
                        <p className="text-xs text-muted-foreground">{customerMap[project.customer_id]}</p>
                      )}
                      {project.customer_address_id && addressMap[project.customer_address_id] && (
                        <p className="text-xs text-muted-foreground">{addressMap[project.customer_address_id]}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Etapy: {stages.completed}/{stages.total}</span>
                    <span>{format(new Date(project.created_at), 'd MMM yyyy', { locale: pl })}</span>
                  </div>
                </div>
                {projectOrders.length > 0 && (
                  <div className="border-t border-border !bg-white px-3 py-2 space-y-1">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, project.id)}
                    >
                      <SortableContext items={projectOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                        {projectOrders.map(order => (
                          <SortableMobileOrderRow
                            key={order.id}
                            order={order}
                            onClick={() => handleOrderClick(order.id)}
                            onMore={(action) => handleOrderMore(order.id, action)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => {
            // Find which project this order belongs to
            const activeId = e.active.id as string;
            const order = allOrders.find(o => o.id === activeId);
            if (order) handleDragEnd(e, order.project_id);
          }}
        >
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Nr</TableHead>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
                ) : filteredProjects.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Brak projektów</TableCell></TableRow>
                ) : paginatedProjects.map((project, idx) => {
                  const stages = stageMap[project.id] || { total: 0, completed: 0 };
                  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.not_started;
                  const projectOrders = ordersMap[project.id] || [];
                  return (
                    <SortableContext key={project.id} items={projectOrders.map(o => o.id)} strategy={verticalListSortingStrategy}>
                      <TableRow className="cursor-pointer border-b-0 font-medium" onClick={() => handleOpenDetails(project.id)}>
                        <TableCell className="text-xs">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                        <TableCell className="font-medium">{project.title}</TableCell>
                        <TableCell>
                          <div>
                            {project.customer_id ? customerMap[project.customer_id] || '—' : '—'}
                            {project.customer_address_id && addressMap[project.customer_address_id] && (
                              <p className="text-xs text-muted-foreground">{addressMap[project.customer_address_id]}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(project.created_at), 'd MMM yyyy', { locale: pl })}</TableCell>
                        <TableCell><Badge variant="outline" className={statusCfg.badgeClass}>{statusCfg.label}</Badge></TableCell>
                        
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDetails(project.id); }}>
                                <Eye className="w-4 h-4 mr-2" />Zobacz
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(project); }}>
                                <Pencil className="w-4 h-4 mr-2" />Edytuj
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />Usuń
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {projectOrders.map(order => (
                        <SortableOrderRow
                          key={order.id}
                          order={order}
                          onClick={() => handleOrderClick(order.id)}
                          onMore={(action) => handleOrderMore(order.id, action)}
                        />
                      ))}
                    </SortableContext>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DndContext>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Poprzednia</Button>
          <span className="text-sm text-muted-foreground">{currentPage} z {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Następna</Button>
        </div>
      )}

      <AddEditProjectDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingProject(null); }}
        instanceId={instanceId}
        editingProject={editingProject}
        onSuccess={() => { setDrawerOpen(false); setEditingProject(null); invalidate(); }}
      />

      <ProjectDetailsDrawer
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setDetailsProjectId(null); }}
        projectId={detailsProjectId}
        instanceId={instanceId}
        onEdit={(project) => { setDetailsOpen(false); handleEdit(project); }}
        onOrdersChanged={invalidate}
        onAddOrder={onAddOrder ? (projectId, customerId, customerAddressId) => {
          setDetailsOpen(false);
          onAddOrder(projectId, customerId, customerAddressId);
        } : undefined}
        onOrderClick={onOpenCalendarItem ? (orderId) => {
          setDetailsOpen(false);
          onOpenCalendarItem(orderId);
        } : undefined}
      />
    </div>
  );
};

export default ProjectsView;
