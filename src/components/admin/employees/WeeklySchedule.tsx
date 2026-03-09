import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Palmtree, Trash2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, subWeeks, isSameDay, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useTimeEntries, useTimeEntriesForDateRange, useCreateTimeEntry, useUpdateTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, useCreateEmployeeDayOff, useDeleteEmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const WEEKDAY_TO_KEY: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

interface WeeklyScheduleProps {
  employee: Employee;
  instanceId: string;
}

interface EditingCell {
  date: string;
  hours: string;
  minutes: string;
  startTime: string;
  endTime: string;
}

const WeeklySchedule = ({ employee, instanceId }: WeeklyScheduleProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [editingCell, setEditingCell] = useState<EditingCell | null>(() => ({
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '0',
    minutes: '0',
    startTime: '',
    endTime: '',
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  const dateFrom = format(currentWeekStart, 'yyyy-MM-dd');
  const dateTo = format(weekEnd, 'yyyy-MM-dd');
  const monthStartDate = startOfMonth(currentWeekStart);
  const monthEndDate = endOfMonth(currentWeekStart);
  const monthFrom = format(monthStartDate, 'yyyy-MM-dd');
  const monthTo = format(monthEndDate, 'yyyy-MM-dd');

  const { data: timeEntries = [] } = useTimeEntries(instanceId, employee.id, dateFrom, dateTo);
  const { data: monthTimeEntries = [] } = useTimeEntriesForDateRange(instanceId, monthFrom, monthTo);
  const { data: daysOff = [] } = useEmployeeDaysOff(instanceId, employee.id);
  const { data: workingHours } = useWorkingHours(instanceId);
  const { data: workersSettings } = useWorkersSettings(instanceId);
  const timeInputMode = workersSettings?.time_input_mode ?? 'total';
  const createTimeEntry = useCreateTimeEntry(instanceId);
  const updateTimeEntry = useUpdateTimeEntry(instanceId);
  const createDayOff = useCreateEmployeeDayOff(instanceId);
  const deleteDayOff = useDeleteEmployeeDayOff(instanceId);

  const minutesByDate = useMemo(() => {
    const map = new Map<string, { totalMinutes: number; entries: TimeEntry[] }>();
    timeEntries.forEach(entry => {
      const existing = map.get(entry.entry_date) || { totalMinutes: 0, entries: [] };
      existing.totalMinutes += entry.total_minutes || 0;
      existing.entries.push(entry);
      map.set(entry.entry_date, existing);
    });
    return map;
  }, [timeEntries]);

  useEffect(() => {
    if (!initialLoadDone && editingCell && timeEntries.length > 0) {
      const existing = minutesByDate.get(editingCell.date);
      const totalMinutes = existing?.totalMinutes || 0;
      const firstEntry = existing?.entries[0];
      const startT = firstEntry?.start_time ? firstEntry.start_time.slice(11, 16) : '';
      const endT = firstEntry?.end_time ? firstEntry.end_time.slice(11, 16) : '';
      setEditingCell(prev => prev ? { ...prev, hours: Math.floor(totalMinutes / 60).toString(), minutes: (totalMinutes % 60).toString(), startTime: startT, endTime: endT } : null);
      setInitialLoadDone(true);
    }
  }, [timeEntries, initialLoadDone]);

  const getDayOffRecord = (dateStr: string) => daysOff.find(d => dateStr >= d.date_from && dateStr <= d.date_to);

  const handleCellClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = minutesByDate.get(dateStr);
    const totalMinutes = existing?.totalMinutes || 0;
    const firstEntry = existing?.entries[0];
    const startT = firstEntry?.start_time ? firstEntry.start_time.slice(11, 16) : '';
    const endT = firstEntry?.end_time ? firstEntry.end_time.slice(11, 16) : '';
    setEditingCell({ date: dateStr, hours: Math.floor(totalMinutes / 60).toString(), minutes: (totalMinutes % 60).toString(), startTime: startT, endTime: endT });
  };

  const saveEntry = async (hoursStr: string, minutesStr: string) => {
    if (!editingCell || isSaving) return;
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minutesStr) || 0;
    const totalMinutes = hours * 60 + minutes;
    const existing = minutesByDate.get(editingCell.date);
    setIsSaving(true);
    try {
      if (existing && existing.entries.length > 0) {
        const firstEntry = existing.entries[0];
        const startTime = new Date(`${editingCell.date}T08:00:00`);
        const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
        await updateTimeEntry.mutateAsync({ id: firstEntry.id, start_time: startTime.toISOString(), end_time: endTime.toISOString() });
        // Remove any duplicate entries for the same day
        if (existing.entries.length > 1) {
          const duplicateIds = existing.entries.slice(1).map(e => e.id);
          await supabase.from('time_entries').delete().in('id', duplicateIds);
        }
      } else if (totalMinutes > 0) {
        // Double-check DB to prevent duplicate creation (race condition)
        const { data: dbCheck } = await supabase
          .from('time_entries')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('employee_id', employee.id)
          .eq('entry_date', editingCell.date)
          .limit(1);
        
        const startTime = new Date(`${editingCell.date}T08:00:00`);
        const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
        
        if (dbCheck && dbCheck.length > 0) {
          await updateTimeEntry.mutateAsync({ id: dbCheck[0].id, start_time: startTime.toISOString(), end_time: endTime.toISOString() });
        } else {
          await createTimeEntry.mutateAsync({ employee_id: employee.id, entry_date: editingCell.date, start_time: startTime.toISOString(), end_time: endTime.toISOString(), entry_type: 'manual' });
        }
      }
      
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHoursChange = async (value: string) => {
    if (!editingCell) return;
    setEditingCell({ ...editingCell, hours: value });
    await saveEntry(value, editingCell.minutes);
  };

  const handleMinutesChange = async (value: string) => {
    if (!editingCell) return;
    setEditingCell({ ...editingCell, minutes: value });
    await saveEntry(editingCell.hours, value);
  };

  const saveStartEndEntry = async (start: string, end: string) => {
    if (!editingCell || isSaving || !start || !end || start.length < 5 || end.length < 5 || start >= end) return;
    const existing = minutesByDate.get(editingCell.date);
    const startTimestamp = `${editingCell.date}T${start}:00`;
    const endTimestamp = `${editingCell.date}T${end}:00`;
    setIsSaving(true);
    try {
      if (existing && existing.entries.length > 0) {
        const firstEntry = existing.entries[0];
        await updateTimeEntry.mutateAsync({ id: firstEntry.id, start_time: startTimestamp, end_time: endTimestamp });
        if (existing.entries.length > 1) {
          const duplicateIds = existing.entries.slice(1).map(e => e.id);
          await supabase.from('time_entries').delete().in('id', duplicateIds);
        }
      } else {
        const { data: dbCheck } = await supabase
          .from('time_entries')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('employee_id', employee.id)
          .eq('entry_date', editingCell.date)
          .limit(1);
        if (dbCheck && dbCheck.length > 0) {
          await updateTimeEntry.mutateAsync({ id: dbCheck[0].id, start_time: startTimestamp, end_time: endTimestamp });
        } else {
          await createTimeEntry.mutateAsync({ employee_id: employee.id, entry_date: editingCell.date, start_time: startTimestamp, end_time: endTimestamp, entry_type: 'manual' });
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTimeChange = async (value: string) => {
    if (!editingCell) return;
    setEditingCell({ ...editingCell, startTime: value });
    await saveStartEndEntry(value, editingCell.endTime);
  };

  const handleEndTimeChange = async (value: string) => {
    if (!editingCell) return;
    setEditingCell({ ...editingCell, endTime: value });
    await saveStartEndEntry(editingCell.startTime, value);
  };

  const handleMarkDayOff = async () => {
    if (!editingCell) return;
    try {
      await createDayOff.mutateAsync({ employee_id: employee.id, date_from: editingCell.date, date_to: editingCell.date, day_off_type: 'vacation' });
      toast.success('Zapisano jako wolne');
      setEditingCell(null);
    } catch (error) { toast.error('Błąd podczas zapisywania'); }
  };

  const handleRemoveDayOff = async () => {
    if (!editingCell) return;
    const dayOffRecord = getDayOffRecord(editingCell.date);
    if (!dayOffRecord) return;
    try {
      await deleteDayOff.mutateAsync(dayOffRecord.id);
      toast.success('Usunięto wolne');
      setEditingCell({ ...editingCell, hours: '0', minutes: '0' });
    } catch (error) { toast.error('Błąd podczas usuwania'); }
  };

  const weekTotal = useMemo(() => {
    let total = 0;
    minutesByDate.forEach(({ totalMinutes }) => { total += totalMinutes; });
    return total;
  }, [minutesByDate]);

  const monthTotal = useMemo(() => {
    return monthTimeEntries.filter(e => e.employee_id === employee.id).reduce((sum, e) => sum + (e.total_minutes || 0), 0);
  }, [monthTimeEntries, employee.id]);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  };

  const editingDayLabel = editingCell ? format(new Date(editingCell.date), 'EEEE, d MMM', { locale: pl }) : '';
  const monthName = format(monthStartDate, 'LLLL', { locale: pl });
  const editingCellIsDayOff = editingCell ? !!getDayOffRecord(editingCell.date) : false;
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-2xl">
          {format(currentWeekStart, 'd MMM', { locale: pl })} - {format(weekEnd, 'd MMM yyyy', { locale: pl })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = editingCell?.date === dateStr;
          const dayData = minutesByDate.get(dateStr);
          const totalMinutes = dayData?.totalMinutes || 0;
          const isToday = isSameDay(day, new Date());
          const isOff = !!getDayOffRecord(dateStr);
          
          return (
            <div key={dateStr} className="flex flex-col">
              <div className={`text-center text-xs py-1 rounded-t ${isToday ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                <div className="font-medium">{format(day, 'EEE', { locale: pl })}</div>
                <div>{format(day, 'd')}</div>
              </div>
              <button
                onClick={() => handleCellClick(day)}
                className={`border rounded-b p-1 text-center min-h-[40px] flex items-center justify-center transition-colors ${
                  isSelected ? 'ring-2 ring-primary border-primary bg-primary/10'
                    : isOff ? 'bg-orange-50 border-orange-200'
                    : totalMinutes > 0 ? 'bg-green-50 border-green-200 hover:bg-green-100'
                    : 'bg-background hover:bg-primary/5'
                }`}
              >
                <span className={`text-sm font-medium ${isOff ? 'text-orange-600' : totalMinutes > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {isOff ? 'Wolne' : totalMinutes > 0 ? formatMinutes(totalMinutes) : '-'}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {editingCell && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="text-2xl font-semibold text-center capitalize">{editingDayLabel}</div>
          <div className="flex items-center justify-center gap-2">
            {timeInputMode === 'start_end' ? (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">Od</span>
                  <input
                    type="time"
                    value={editingCell.startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="h-14 w-32 text-center text-xl font-medium border rounded-md px-2 bg-background"
                  />
                </div>
                <span className="text-2xl font-bold mt-6">-</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">Do</span>
                  <input
                    type="time"
                    value={editingCell.endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="h-14 w-32 text-center text-xl font-medium border rounded-md px-2 bg-background"
                  />
                </div>
              </>
            ) : (
              <>
                <Select value={editingCell.hours} onValueChange={handleHoursChange}>
                  <SelectTrigger className="h-14 w-24 text-center text-xl font-medium"><SelectValue placeholder="0" /></SelectTrigger>
                  <SelectContent>{hourOptions.map(h => (<SelectItem key={h} value={h.toString()}>{h}</SelectItem>))}</SelectContent>
                </Select>
                <span className="text-2xl font-bold">:</span>
                <Select value={editingCell.minutes} onValueChange={handleMinutesChange}>
                  <SelectTrigger className="h-14 w-24 text-center text-xl font-medium"><SelectValue placeholder="0" /></SelectTrigger>
                  <SelectContent>{minuteOptions.map(m => (<SelectItem key={m} value={m.toString()}>{m}</SelectItem>))}</SelectContent>
                </Select>
              </>
            )}
          </div>
          {editingCellIsDayOff ? (
            <Button onClick={handleRemoveDayOff} variant="outline" className="w-full h-12 bg-red-50 border-red-200 text-red-700 hover:bg-red-100">
              <Trash2 className="w-4 h-4 mr-2" />Usuń Wolne
            </Button>
          ) : (
            <Button onClick={handleMarkDayOff} variant="outline" className="w-full h-12 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
              <Palmtree className="w-4 h-4 mr-2" />Wolne
            </Button>
          )}
        </div>
      )}

      <div className="space-y-1.5 pt-2 border-t">
        <div className="flex justify-end items-center gap-3">
          <span className="text-sm font-bold text-foreground">Suma tygodnia:</span>
          <span className="font-bold">{formatMinutes(weekTotal)}</span>
        </div>
        <div className="flex justify-end items-center gap-3">
          <span className="text-sm font-bold text-foreground">Suma miesiąca ({monthName}):</span>
          <span className="font-bold">{formatMinutes(monthTotal)}</span>
        </div>
      </div>
    </div>
  );
};

export default WeeklySchedule;
