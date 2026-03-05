import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateEmployee, useUpdateEmployee, useDeleteEmployee, Employee } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, X, Trash2, Camera } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/imageUtils';

interface AddEditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null;
  employee?: Employee | null;
  isAdmin?: boolean;
}

const AddEditEmployeeDialog = ({ open, onOpenChange, instanceId, employee, isAdmin = true }: AddEditEmployeeDialogProps) => {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createEmployee = useCreateEmployee(instanceId);
  const updateEmployee = useUpdateEmployee(instanceId);
  const deleteEmployee = useDeleteEmployee(instanceId);

  const isEditing = !!employee;
  const isSubmitting = createEmployee.isPending || updateEmployee.isPending;
  const isDeleting = deleteEmployee.isPending;

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setHourlyRate(employee.hourly_rate?.toString() || '');
      setPhotoUrl(employee.photo_url);
    } else {
      setName('');
      setHourlyRate('');
      setPhotoUrl(null);
      setCreateAccount(false);
      setUsername('');
      setPassword('');
    }
  }, [employee, open]);

  const handleAvatarClick = () => { fileInputRef.current?.click(); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;
    if (!file.type.startsWith('image/')) { toast.error('Dozwolone są tylko pliki graficzne'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Maksymalny rozmiar pliku to 10MB'); return; }

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file, 400, 0.85, true);
      const fileName = `${instanceId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('employee-photos').upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('employee-photos').getPublicUrl(fileName);
      setPhotoUrl(publicUrl);
      if (isEditing && employee) {
        await updateEmployee.mutateAsync({ id: employee.id, photo_url: publicUrl, name: name.trim() || employee.name, hourly_rate: isAdmin && hourlyRate ? parseFloat(hourlyRate) : employee.hourly_rate });
        toast.success('Zdjęcie zostało zapisane');
      } else {
        toast.success('Zdjęcie zostało przesłane');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => { setPhotoUrl(null); };

  const isAccountValid = !createAccount || (username.trim().length >= 3 && password.length >= 6);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Podaj imię lub ksywkę'); return; }
    if (!isAccountValid) return;
    try {
      const data = { name: name.trim(), hourly_rate: isAdmin && hourlyRate ? parseFloat(hourlyRate) : null, photo_url: photoUrl };
      if (isEditing && employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...data });
        toast.success('Pracownik został zaktualizowany');
      } else {
        const created = await createEmployee.mutateAsync(data);
        toast.success('Pracownik został dodany');

        if (createAccount && instanceId) {
          try {
            const response = await supabase.functions.invoke('manage-instance-users', {
              body: { action: 'create', instanceId, username: username.trim(), password, role: 'employee', employeeId: created.id },
            });
            if (response.error) throw new Error(response.error.message);
            if (response.data?.error) throw new Error(response.data.error);
            toast.success('Konto użytkownika zostało utworzone');
          } catch (accountError: any) {
            console.error('Account creation error:', accountError);
            toast.error(`Błąd tworzenia konta: ${accountError.message || 'Nieznany błąd'}`);
          }
        }
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Wystąpił błąd');
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    try {
      const { error } = await supabase.from('employees').update({ active: false }).eq('id', employee.id);
      if (error) throw error;
      toast.success('Pracownik został usunięty');
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      deleteEmployee.reset();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Błąd podczas usuwania pracownika');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edytuj pracownika' : 'Dodaj pracownika'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
                <Avatar className="h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                  <AvatarImage src={photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">{name.slice(0, 2).toUpperCase() || '??'}</AvatarFallback>
                </Avatar>
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
                )}
                {photoUrl && !isUploading && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleRemovePhoto(); }} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kliknij zdjęcie aby zrobić nowe</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Imię / ksywka *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Jan, Kowal, Mechanik" />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="rate">Stawka godzinowa na rękę (zł)</Label>
                <Input id="rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="np. 30" />
              </div>
            )}
            {!isEditing && isAdmin && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox id="createAccount" checked={createAccount} onCheckedChange={(checked) => setCreateAccount(checked === true)} />
                  <Label htmlFor="createAccount" className="text-sm font-normal cursor-pointer">Stwórz konto w aplikacji dla pracownika</Label>
                </div>
                {createAccount && (
                  <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label htmlFor="username">Nazwa użytkownika *</Label>
                      <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="np. jan.kowalski" autoComplete="off" />
                      {username.length > 0 && username.trim().length < 3 && (
                        <p className="text-xs text-destructive">Min. 3 znaki</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Hasło *</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 znaków" autoComplete="new-password" />
                      {password.length > 0 && password.length < 6 && (
                        <p className="text-xs text-destructive">Min. 6 znaków</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex flex-row gap-2">
            {isEditing && isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmOpen(true)} disabled={isDeleting} className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto">
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className={cn(!isEditing && "flex-1")}>Anuluj</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !isAccountValid} className={cn(!isEditing && "flex-1")}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} title="Usuń pracownika" description={`Czy na pewno chcesz usunąć pracownika "${employee?.name}"? Wpisy czasu pracy zostaną zachowane.`} confirmLabel="Usuń" onConfirm={handleDelete} variant="destructive" />
    </>
  );
};

export default AddEditEmployeeDialog;
