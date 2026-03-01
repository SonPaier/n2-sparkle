import { useState, useEffect } from 'react';
import { Loader2, UserPlus, MoreVertical, Shield, User, Lock, Unlock, Trash2, KeyRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import AddInstanceUserDialog from './AddInstanceUserDialog';
import EditInstanceUserDialog from './EditInstanceUserDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import DeleteUserDialog from './DeleteUserDialog';
import { useEmployees } from '@/hooks/useEmployees';

interface InstanceUser {
  id: string;
  username: string;
  email: string;
  is_blocked: boolean;
  created_at: string;
  role: 'admin' | 'employee';
  linked_employee_name?: string;
}

interface InstanceUsersTabProps {
  instanceId: string;
}

const InstanceUsersTab = ({ instanceId }: InstanceUsersTabProps) => {
  const [users, setUsers] = useState<InstanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<InstanceUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: employees = [] } = useEmployees(instanceId);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sesja wygasła');
        return;
      }

      const response = await supabase.functions.invoke('manage-instance-users', {
        body: { action: 'list', instanceId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      const fetchedUsers = (response.data?.users || []) as InstanceUser[];

      // Fetch linked employees
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, linked_user_id')
        .eq('instance_id', instanceId)
        .not('linked_user_id', 'is', null);
      const empMap = new Map((emps || []).map((e: any) => [e.linked_user_id, e.name]));

      setUsers(fetchedUsers.map(u => ({
        ...u,
        username: u.username || 'Brak nazwy',
        linked_employee_name: empMap.get(u.id) || undefined,
      })));
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || 'Błąd ładowania użytkowników');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) fetchUsers();
  }, [instanceId]);

  const handleBlockUnblock = async (user: InstanceUser) => {
    setActionLoading(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sesja wygasła'); return; }

      const response = await supabase.functions.invoke('manage-instance-users', {
        body: { action: user.is_blocked ? 'unblock' : 'block', instanceId, userId: user.id },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success(user.is_blocked ? 'Użytkownik odblokowany' : 'Użytkownik zablokowany');
      fetchUsers();
    } catch (error: any) {
      console.error('Error blocking/unblocking user:', error);
      toast.error(error.message || 'Wystąpił błąd');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (user: InstanceUser) => { setSelectedUser(user); setEditDialogOpen(true); };
  const handleResetPassword = (user: InstanceUser) => { setSelectedUser(user); setResetPasswordDialogOpen(true); };
  const handleDelete = (user: InstanceUser) => { setSelectedUser(user); setDeleteDialogOpen(true); };

  const getRoleBadge = (role: 'admin' | 'employee') => {
    if (role === 'admin') {
      return <Badge variant="default" className="gap-1"><Shield className="w-3 h-3" />Admin</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><User className="w-3 h-3" />Pracownik</Badge>;
  };

  const getStatusBadge = (isBlocked: boolean) => {
    if (isBlocked) return <Badge variant="destructive">Zablokowany</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-700">Aktywny</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Użytkownicy</h2>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2 w-full sm:w-auto">
          <UserPlus className="w-4 h-4" />
          Dodaj użytkownika
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Brak użytkowników</p>
          <Button variant="link" onClick={() => setAddDialogOpen(true)} className="mt-2">
            Dodaj pierwszego użytkownika
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="font-medium truncate">{user.username}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.is_blocked)}
                      {user.linked_employee_name && (
                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                          <Users className="w-3 h-3" />{user.linked_employee_name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'd MMM yyyy', { locale: pl })}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={actionLoading === user.id}>
                        {actionLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <User className="w-4 h-4 mr-2" />Edytuj
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                        <KeyRound className="w-4 h-4 mr-2" />Resetuj hasło
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBlockUnblock(user)}>
                        {user.is_blocked ? <><Unlock className="w-4 h-4 mr-2" />Odblokuj</> : <><Lock className="w-4 h-4 mr-2" />Zablokuj</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(user)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Usuń
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddInstanceUserDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} instanceId={instanceId} onSuccess={fetchUsers} />
      <EditInstanceUserDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} instanceId={instanceId} user={selectedUser} onSuccess={fetchUsers} employees={employees} />
      <ResetPasswordDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen} instanceId={instanceId} user={selectedUser} />
      <DeleteUserDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} instanceId={instanceId} user={selectedUser} onSuccess={fetchUsers} />
    </div>
  );
};

export default InstanceUsersTab;
