import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Employee } from '@/hooks/useEmployees';
import WeeklySchedule from '@/components/admin/employees/WeeklySchedule';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface EmployeeTimeTrackingViewProps {
  instanceId: string;
}

const EmployeeTimeTrackingView = ({ instanceId }: EmployeeTimeTrackingViewProps) => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instanceId || !user) return;
    setLoading(true);
    supabase
      .from('employees')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('linked_user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data) setEmployee(data as Employee);
        setLoading(false);
      });
  }, [instanceId, user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nie znaleziono powiązanego konta pracownika.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Czas pracy</h1>
      <div className="max-w-2xl mx-auto">
        <WeeklySchedule employee={employee} instanceId={instanceId} />
      </div>
    </div>
  );
};

export default EmployeeTimeTrackingView;
