import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Plus, Search, MoreHorizontal, Trash2, Edit, Link2, Mail, Settings2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
}

const protocolTypeLabels: Record<string, string> = {
  completion: 'Zakończenie prac',
};

const ProtocolsView = ({ instanceId }: ProtocolsViewProps) => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [emailDialogProtocol, setEmailDialogProtocol] = useState<Protocol | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('protocols')
      .select('id, customer_name, customer_phone, customer_email, protocol_date, protocol_type, status, prepared_by, public_token, created_at')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false });

    if (searchQuery.trim()) {
      query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.limit(50);
    if (error) { console.error(error); toast.error('Błąd ładowania protokołów'); }
    setProtocols(data || []);
    setLoading(false);
  }, [instanceId, searchQuery]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Protokoły</h2>
          <p className="text-sm text-muted-foreground">Protokoły serwisowe zakończenia prac</p>
        </div>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie klienta lub telefonie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : protocols.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak protokołów. Utwórz pierwszy!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {protocols.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{p.customer_name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {protocolTypeLabels[p.protocol_type] || p.protocol_type}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(p.protocol_date), 'd MMM yyyy', { locale: pl })}
                  {p.customer_phone && ` • ${p.customer_phone}`}
                  {p.prepared_by && ` • ${p.prepared_by}`}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
          ))}
        </div>
      )}

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
