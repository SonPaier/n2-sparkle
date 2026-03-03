import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  id: string;
  time_entry_id: string | null;
  employee_id: string;
  instance_id: string;
  entry_date: string;
  change_type: string;
  changed_by: string | null;
  old_start_time: string | null;
  old_end_time: string | null;
  old_total_minutes: number | null;
  new_start_time: string | null;
  new_end_time: string | null;
  new_total_minutes: number | null;
  created_at: string;
}

export interface AuditDayGroup {
  date: string;
  entries: AuditLogEntry[];
  hasChanges: boolean; // true if any update/delete exists
}

export const useTimeEntryAuditLog = (
  instanceId: string | null,
  employeeId: string | null,
  dateFrom: string,
  dateTo: string
) => {
  const logsQuery = useQuery({
    queryKey: ['time_entry_audit_log', instanceId, employeeId, dateFrom, dateTo],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!instanceId || !employeeId) return [];

      const { data, error } = await supabase
        .from('time_entry_audit_log')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('employee_id', employeeId)
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!instanceId && !!employeeId,
    staleTime: 2 * 60 * 1000,
  });

  // Collect unique changed_by UUIDs
  const changedByIds = Array.from(
    new Set(
      (logsQuery.data || [])
        .map((l) => l.changed_by)
        .filter((id): id is string => !!id)
    )
  );

  const profilesQuery = useQuery({
    queryKey: ['profiles_for_audit', changedByIds],
    queryFn: async () => {
      if (changedByIds.length === 0) return new Map<string, string>();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', changedByIds);
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach((p) => map.set(p.id, p.full_name || 'Nieznany'));
      return map;
    },
    enabled: changedByIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Group by entry_date
  const grouped: AuditDayGroup[] = (() => {
    const logs = logsQuery.data || [];
    if (logs.length === 0) return [];

    const map = new Map<string, AuditLogEntry[]>();
    logs.forEach((l) => {
      const arr = map.get(l.entry_date) || [];
      arr.push(l);
      map.set(l.entry_date, arr);
    });

    return Array.from(map.entries()).map(([date, entries]) => ({
      date,
      entries,
      hasChanges: entries.some((e) => e.change_type !== 'create'),
    }));
  })();

  return {
    data: grouped,
    profiles: profilesQuery.data || new Map<string, string>(),
    isLoading: logsQuery.isLoading,
    totalCount: logsQuery.data?.length || 0,
  };
};
