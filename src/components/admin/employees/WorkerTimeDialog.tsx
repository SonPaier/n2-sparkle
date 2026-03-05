import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimeEntries, TimeEntry } from '@/hooks/useTimeEntries';
import { Employee, useUpdateEmployee } from '@/hooks/useEmployees';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageUtils';
import { toast } from 'sonner';
import { Loader2, Pencil, Camera } from 'lucide-react';
import { format } from 'date-fns';
import WeeklySchedule from './WeeklySchedule';

interface WorkerTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  instanceId: string;
  showEditButton?: boolean;
  onEditEmployee?: () => void;
}

const WorkerTimeDialog = ({ open, onOpenChange, employee, instanceId, showEditButton = false, onEditEmployee }: WorkerTimeDialogProps) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [isUploading, setIsUploading] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(employee.photo_url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  const canChangePhoto = isAdmin;
  
  const { data: timeEntries = [] } = useTimeEntries(instanceId, undefined, today, today);
  const updateEmployee = useUpdateEmployee(instanceId);

  const handleAvatarClick = () => { if (canChangePhoto) fileInputRef.current?.click(); };

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
      setCurrentPhotoUrl(publicUrl);
      await updateEmployee.mutateAsync({ id: employee.id, photo_url: publicUrl, name: employee.name });
      toast.success('Zdjęcie zostało zapisane');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Błąd podczas przesyłania zdjęcia');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const todayEmployeeEntries = timeEntries
    .filter((e) => e.employee_id === employee.id && e.end_time)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  const calculateTotalMinutes = () => {
    return timeEntries
      .filter((e) => e.employee_id === employee.id)
      .reduce((total, entry) => total + (entry.total_minutes || 0), 0);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} h`;
    return `${hours} h ${mins} min`;
  };

  const totalMinutes = calculateTotalMinutes();

  const formatTimeFromISO = (isoString: string | null) => {
    if (!isoString) return '';
    try { return format(new Date(isoString), 'HH:mm'); } catch { return isoString.slice(0, 5); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-2xl ${isMobile ? "h-[100dvh] max-h-[100dvh] rounded-none" : "max-h-[90vh]"} overflow-hidden flex flex-col z-[1300]`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="sr-only">Czas pracy</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="flex flex-col items-center py-2 gap-2">
            <div className={`relative ${canChangePhoto ? 'cursor-pointer group' : ''}`} onClick={handleAvatarClick}>
              <Avatar className="h-20 w-20 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                <AvatarImage src={currentPhotoUrl || undefined} alt={employee.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
              ) : canChangePhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white" /></div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{employee.name}</h2>
              {showEditButton && onEditEmployee && (
                <button onClick={onEditEmployee} className="p-1 rounded hover:bg-primary/5"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              )}
            </div>
            {totalMinutes > 0 && (
              <div className="text-center">
                <p className="text-xl font-medium text-muted-foreground">Dzisiaj: {formatDuration(totalMinutes)}</p>
                {todayEmployeeEntries.length > 0 && (
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {todayEmployeeEntries.map((e, i) => (
                      <span key={e.id}>{i > 0 && ', '}{formatTimeFromISO(e.start_time)}-{formatTimeFromISO(e.end_time)}</span>
                    ))}
                  </p>
                )}
              </div>
            )}
            <div className="w-full mt-2">
              <WeeklySchedule employee={employee} instanceId={instanceId} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerTimeDialog;
