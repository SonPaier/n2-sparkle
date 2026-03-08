import { useState, useMemo } from 'react';
import { Search, Plus, MoreHorizontal, Trash2, Eye, FolderKanban } from 'lucide-react';
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

interface ProjectStageCount {
  project_id: string;
  total: number;
  completed: number;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  active: { label: 'Aktywny', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  completed: { label: 'Zakończony', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' },
  cancelled: { label: 'Anulowany', badgeClass: 'bg-red-100 text-red-600 border-red-300' },
};

const ITEMS_PER_PAGE = 10;

interface ProjectsViewProps {
  instanceId: string;
}

const ProjectsView = ({ instanceId }: ProjectsViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsProjectId, setDetailsProjectId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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

  // Fetch customer names
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

  // Fetch stage counts per project
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
  const { data: stageCounts = [] } = useQuery({
    queryKey: ['projects-stages', instanceId, projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('calendar_items')
        .select('id, project_id, status')
        .in('project_id', projectIds);
      
      const countMap = new Map<string, { total: number; completed: number }>();
      (data || []).forEach((item: any) => {
        if (!item.project_id) return;
        if (!countMap.has(item.project_id)) countMap.set(item.project_id, { total: 0, completed: 0 });
        const entry = countMap.get(item.project_id)!;
        if (item.status !== 'cancelled') {
          entry.total++;
          if (item.status === 'completed') entry.completed++;
        }
      });
      return Array.from(countMap.entries()).map(([project_id, counts]) => ({
        project_id,
        ...counts,
      })) as ProjectStageCount[];
    },
  });

  const stageMap = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    stageCounts.forEach(s => { map[s.project_id] = { total: s.total, completed: s.completed }; });
    return map;
  }, [stageCounts]);

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
    const { error } = await supabase
      .from('projects' as any)
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) { toast.error('Błąd anulowania projektu'); return; }
    queryClient.invalidateQueries({ queryKey: ['projects', instanceId] });
    toast.success('Projekt anulowany');
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
    queryClient.invalidateQueries({ queryKey: ['projects-stages', instanceId] });
  };

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
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
          ) : filteredProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Brak projektów" description="Dodaj pierwszy projekt, aby grupować zlecenia" />
          ) : paginatedProjects.map(project => {
            const stages = stageMap[project.id] || { total: 0, completed: 0 };
            const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
            return (
              <div
                key={project.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2 cursor-pointer active:bg-primary/5"
                onClick={() => handleOpenDetails(project.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{project.title}</p>
                    {project.customer_id && customerMap[project.customer_id] && (
                      <p className="text-xs text-muted-foreground">{customerMap[project.customer_id]}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Etapy: {stages.completed}/{stages.total}</span>
                  <span>{format(new Date(project.created_at), 'd MMM yyyy', { locale: pl })}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Nr</TableHead>
                <TableHead>Tytuł</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Data utworzenia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Etapy</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Ładowanie...</TableCell></TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak projektów</TableCell></TableRow>
              ) : paginatedProjects.map((project, idx) => {
                const stages = stageMap[project.id] || { total: 0, completed: 0 };
                const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
                return (
                  <TableRow key={project.id} className="cursor-pointer" onClick={() => handleOpenDetails(project.id)}>
                    <TableCell className="text-muted-foreground text-xs">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                    <TableCell className="font-medium">{project.title}</TableCell>
                    <TableCell className="text-muted-foreground">{project.customer_id ? customerMap[project.customer_id] || '—' : '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(project.created_at), 'd MMM yyyy', { locale: pl })}</TableCell>
                    <TableCell><Badge variant="outline" className={statusCfg.badgeClass}>{statusCfg.label}</Badge></TableCell>
                    <TableCell className="text-center font-medium">{stages.completed}/{stages.total}</TableCell>
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
                            Edytuj
                          </DropdownMenuItem>
                          {project.status !== 'cancelled' && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />Anuluj
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
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
      />
    </div>
  );
};

export default ProjectsView;
