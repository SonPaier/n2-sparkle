import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Plus, Search, MoreHorizontal, Trash2, Edit, Link2, Mail, Settings2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import CreateProtocolForm from './CreateProtocolForm';
import SendProtocolEmailDialog from './SendProtocolEmailDialog';
import ProtocolSettingsDialog from './ProtocolSettingsDialog';

interface Protocol {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  protocol_date: string;
  protocol_type: string;
  status: string;
  prepared_by: string | null;
  public_token: string;
  created_at: string;
}

interface ProtocolsViewProps {
  instanceId: string;
  filterByUserId?: string;
}

const protocolTypeLabels: Record<string, string> = {
  completion: 'Zakończenie prac',
};

const ProtocolsView = ({ instanceId, filterByUserId }: ProtocolsViewProps) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [emailDialogProtocol, setEmailDialogProtocol] = useState<Protocol | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const sortedProtocols = useMemo(() => {
    if (!sortColumn) return protocols;
    return [...protocols].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case 'customer_name': valA = a.customer_name.toLowerCase(); valB = b.customer_name.toLowerCase(); break;
        case 'protocol_type': valA = a.protocol_type; valB = b.protocol_type; break;
        case 'protocol_date': valA = a.protocol_date; valB = b.protocol_date; break;
        case 'prepared_by': valA = (a.prepared_by || '').toLowerCase(); valB = (b.prepared_by || '').toLowerCase(); break;
        default: return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [protocols, sortColumn, sortDirection]);

  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('protocols')
      .select('id, customer_name, customer_phone, customer_email, protocol_date, protocol_type, status, prepared_by, public_token, created_at')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false });

    if (filterByUserId) {
      query = query.eq('created_by_user_id', filterByUserId);
    }

    if (searchQuery.trim()) {
      query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.limit(50);
    if (error) { console.error(error); toast.error('Błąd ładowania protokołów'); }
    setProtocols(data || []);
    setLoading(false);
  }, [instanceId, searchQuery, filterByUserId]);

  useEffect(() => { fetchProtocols(); }, [fetchProtocols]);

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('protocols').delete().eq('id', deletingId);
    if (error) { toast.error('Błąd usuwania'); return; }
    toast.success('Protokół usunięty');
    setDeletingId(null);
    fetchProtocols();
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/protocols/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link skopiowany do schowka');
  };

  const handleEdit = (protocol: Protocol) => {
    setEditingProtocol(protocol);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Protokoły</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button onClick={() => { setEditingProtocol(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Dodaj protokół
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie klienta lub telefonie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('customer_name')}>
                <span className="flex items-center">Klient<SortIcon column="customer_name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('protocol_type')}>
                <span className="flex items-center">Typ<SortIcon column="protocol_type" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('protocol_date')}>
                <span className="flex items-center">Data<SortIcon column="protocol_date" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('prepared_by')}>
                <span className="flex items-center">Sporządził<SortIcon column="prepared_by" /></span>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : protocols.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak protokołów'}
                </TableCell>
              </TableRow>
            ) : (
              sortedProtocols.map((p) => (
                <TableRow key={p.id} className="group cursor-pointer" onClick={() => handleEdit(p)}>
                  <TableCell className="font-medium">{p.customer_name}</TableCell>
                  <TableCell className="text-sm">
                    {protocolTypeLabels[p.protocol_type] || p.protocol_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(p.protocol_date), 'd MMM yyyy', { locale: pl })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.prepared_by || '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleEdit(p)}>
                          <Edit className="w-4 h-4 mr-2" />Edytuj
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyLink(p.public_token)}>
                          <Link2 className="w-4 h-4 mr-2" />Kopiuj link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEmailDialogProtocol(p)}>
                          <Mail className="w-4 h-4 mr-2" />Wyślij emailem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteClick(p.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />Usuń
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Ładowanie...</p>
        ) : protocols.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak protokołów'}
          </p>
        ) : (
          sortedProtocols.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card p-4 cursor-pointer active:bg-primary/5"
              onClick={() => handleEdit(p)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-medium truncate">{p.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {protocolTypeLabels[p.protocol_type] || p.protocol_type}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => handleEdit(p)}>
                      <Edit className="w-4 h-4 mr-2" />Edytuj
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyLink(p.public_token)}>
                      <Link2 className="w-4 h-4 mr-2" />Kopiuj link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEmailDialogProtocol(p)}>
                      <Mail className="w-4 h-4 mr-2" />Wyślij emailem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteClick(p.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Usuń
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span>{format(new Date(p.protocol_date), 'd MMM yyyy', { locale: pl })}</span>
                {p.prepared_by && (
                  <>
                    <span>·</span>
                    <span>{p.prepared_by}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Form */}
      <CreateProtocolForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingProtocol(null); }}
        instanceId={instanceId}
        onSuccess={fetchProtocols}
        editingProtocolId={editingProtocol?.id || null}
      />

      {/* Send Email Dialog */}
      {emailDialogProtocol && (
        <SendProtocolEmailDialog
          open={!!emailDialogProtocol}
          onClose={() => setEmailDialogProtocol(null)}
          protocol={emailDialogProtocol}
          instanceId={instanceId}
        />
      )}

      {/* Settings */}
      <ProtocolSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        instanceId={instanceId}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Usuń protokół"
        description="Czy na pewno chcesz usunąć ten protokół? Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default ProtocolsView;
