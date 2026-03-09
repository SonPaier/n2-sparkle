import { useState, useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeEntriesForMonth, calculateMonthlySummary, formatMinutesToTime, useDeleteTimeEntry, TimeEntry } from '@/hooks/useTimeEntries';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Plus, Loader2, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isWeekend, getWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';
import AddEditTimeEntryDialog from './AddEditTimeEntryDialog';
import { cn } from '@/lib/utils';

interface TimeEntriesViewProps {
  instanceId: string | null;
}

interface WeekGroup {
  weekNumber: number;
  days: Date[];
}

const TimeEntriesView = ({ instanceId }: TimeEntriesViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [prefilledEmployee, setPrefilledEmployee] = useState<string | undefined>();
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntriesForMonth(instanceId, year, month);
  const { data: workersSettings } = useWorkersSettings(instanceId);

  const activeEmployees = employees.filter(e => e.active);
  const filteredEmployees = selectedEmployeeId === 'all' ? activeEmployees : activeEmployees.filter(e => e.id === selectedEmployeeId);

  const entriesByEmployeeAndDate = useMemo(() => {
    const map = new Map<string, Map<string, TimeEntry[]>>();
    timeEntries.forEach(entry => {
      if (!map.has(entry.employee_id)) map.set(entry.employee_id, new Map());
      const employeeMap = map.get(entry.employee_id)!;
      if (!employeeMap.has(entry.entry_date)) employeeMap.set(entry.entry_date, []);
      employeeMap.get(entry.entry_date)!.push(entry);
    });
    return map;
  }, [timeEntries]);

  const weeks = useMemo((): WeekGroup[] => {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(new Date(year, month));
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const weekMap = new Map<number, Date[]>();
    allDays.forEach(day => {
      const wn = getWeek(day, { weekStartsOn: 1, locale: pl });
      if (!weekMap.has(wn)) weekMap.set(wn, []);
      weekMap.get(wn)!.push(day);
    });

    return Array.from(weekMap.entries()).map(([weekNumber, days]) => ({ weekNumber, days }));
  }, [year, month]);

  const monthlySummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);

  const getWeekMinutes = (employeeId: string, days: Date[]): number => {
    const empMap = entriesByEmployeeAndDate.get(employeeId);
    if (!empMap) return 0;
    return days.reduce((sum, day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const entries = empMap.get(dateStr);
      if (!entries) return sum;
      return sum + entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
    }, 0);
  };

  const handleCellClick = (employeeId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const empMap = entriesByEmployeeAndDate.get(employeeId);
    const entries = empMap?.get(dateStr);

    if (entries && entries.length > 0) {
      setEditingEntry(entries[0]);
      setPrefilledEmployee(undefined);
      setPrefilledDate(undefined);
    } else {
      setEditingEntry(null);
      setPrefilledEmployee(employeeId);
      setPrefilledDate(dateStr);
    }
    setDialogOpen(true);
  };

  const isLoading = loadingEmployees || loadingEntries;
  const isHourly = !workersSettings || workersSettings.settlement_type === 'hourly';

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (activeEmployees.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Brak aktywnych pracowników</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-medium min-w-[140px] text-center capitalize">{format(currentDate, 'LLLL yyyy', { locale: pl })}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Wszyscy pracownicy" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy pracownicy</SelectItem>
              {activeEmployees.map(emp => (<SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingEntry(null); setPrefilledEmployee(undefined); setPrefilledDate(undefined); setDialogOpen(true); }} size="sm"><Plus className="w-4 h-4 mr-1" />Dodaj wpis</Button>
        </div>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Data</TableHead>
              {filteredEmployees.map(emp => (
                <TableHead key={emp.id} className="text-center min-w-[110px]">
                  <span className="truncate block max-w-[110px]">{emp.name}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeks.map((week, wi) => (
              <>
                {week.days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const weekend = isWeekend(day);
                  return (
                    <TableRow key={dateStr} className={cn(weekend && 'bg-muted/30')}>
                      <TableCell className="sticky left-0 bg-background z-10 text-xs font-medium whitespace-nowrap">
                        <span className={cn(weekend && 'text-muted-foreground')}>
                          {format(day, 'EEE d', { locale: pl })}
                        </span>
                      </TableCell>
                      {filteredEmployees.map(emp => {
                        const empMap = entriesByEmployeeAndDate.get(emp.id);
                        const entries = empMap?.get(dateStr);
                        const hasEntry = entries && entries.length > 0;
                        const entry = hasEntry ? entries[0] : null;
                        const totalMin = hasEntry ? entries.reduce((s, e) => s + (e.total_minutes || 0), 0) : 0;

                        return (
                          <TableCell
                            key={emp.id}
                            className="text-center cursor-pointer hover:bg-primary/5 transition-colors p-1.5"
                            onClick={() => handleCellClick(emp.id, day)}
                          >
                            {hasEntry ? (
                              <div>
                                {entry?.start_time && entry?.end_time ? (
                                  <div className="text-xs font-medium">
                                    {String(entry.start_time).slice(0, 5)}-{String(entry.end_time).slice(0, 5)}
                                  </div>
                                ) : null}
                                <div className="text-[10px] text-muted-foreground">{formatMinutesToTime(totalMin)}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {/* Week subtotal */}
                <TableRow key={`week-${wi}`} className="bg-muted/50 border-b-2">
                  <TableCell className="sticky left-0 bg-muted/50 z-10 text-xs font-bold whitespace-nowrap">
                    Tydzień {wi + 1}
                  </TableCell>
                  {filteredEmployees.map(emp => {
                    const weekMin = getWeekMinutes(emp.id, week.days);
                    return (
                      <TableCell key={emp.id} className="text-center text-xs font-bold">
                        {weekMin > 0 ? formatMinutesToTime(weekMin) : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </>
            ))}

            {/* Monthly total */}
            <TableRow className="border-t-2 border-foreground/20">
              <TableCell className="sticky left-0 bg-background z-10 font-bold text-sm">SUMA</TableCell>
              {filteredEmployees.map(emp => {
                const summary = monthlySummary.get(emp.id);
                return (
                  <TableCell key={emp.id} className="text-center font-bold text-sm">
                    {summary ? formatMinutesToTime(summary.total_minutes) : '-'}
                  </TableCell>
                );
              })}
            </TableRow>

            {/* Wypłata row - only for hourly settlement */}
            {isHourly && (
              <TableRow className="bg-muted/30">
                <TableCell className="sticky left-0 bg-muted/30 z-10 font-bold text-sm">WYPŁATA</TableCell>
                {filteredEmployees.map(emp => {
                  const summary = monthlySummary.get(emp.id);
                  if (!summary || !emp.hourly_rate) {
                    return <TableCell key={emp.id} className="text-center text-sm text-muted-foreground">-</TableCell>;
                  }
                  const earnings = ((summary.total_minutes / 60) * emp.hourly_rate).toFixed(2);
                  return (
                    <TableCell key={emp.id} className="text-center font-bold text-sm">
                      {earnings} zł
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div></CardContent></Card>

      <AddEditTimeEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
        entry={editingEntry}
        defaultEmployeeId={prefilledEmployee}
        defaultDate={prefilledDate}
      />
    </div>
  );
};

export default TimeEntriesView;
