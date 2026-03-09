import { useState, useMemo, useEffect } from 'react';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useTimeEntriesForDateRange, calculateMonthlySummary, formatMinutesToTime, TimeEntry } from '@/hooks/useTimeEntries';
import { useEmployeeDaysOff, DAY_OFF_TYPE_LABELS, DayOffType, EmployeeDayOff } from '@/hooks/useEmployeeDaysOff';
import { useWorkersSettings } from '@/hooks/useWorkersSettings';
import { useWorkingHours } from '@/hooks/useWorkingHours';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, ChevronLeft, ChevronRight, Loader2, User, Settings2, CalendarOff, MoreVertical, FileText, ClipboardList } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, getISOWeek, addWeeks, subWeeks, isWithinInterval, eachDayOfInterval, isSameMonth, isSameWeek, getDay, isWeekend, getWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AddEditEmployeeDialog from './AddEditEmployeeDialog';
import WorkerTimeDialog from './WorkerTimeDialog';
import AddEmployeeDayOffDialog from './AddEmployeeDayOffDialog';
import WorkersSettingsDrawer from './WorkersSettingsDrawer';
import TimeEntryAuditDrawer from './TimeEntryAuditDrawer';
import EmployeeOrdersDrawer from './EmployeeOrdersDrawer';
import AddEditTimeEntryDialog from './AddEditTimeEntryDialog';

const WEEKDAY_TO_KEY: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'ND', 1: 'PN', 2: 'WT', 3: 'ŚR', 4: 'CZ', 5: 'PT', 6: 'SB',
};

interface EmployeesViewProps {
  instanceId: string | null;
}

const EmployeesView = ({ instanceId }: EmployeesViewProps) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  const isMobile = useIsMobile();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workerDialogEmployee, setWorkerDialogEmployee] = useState<Employee | null>(null);
  const [dayOffDialogOpen, setDayOffDialogOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [auditEmployee, setAuditEmployee] = useState<Employee | null>(null);
  const [ordersEmployee, setOrdersEmployee] = useState<Employee | null>(null);
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [prefilledEmployee, setPrefilledEmployee] = useState<string | undefined>();
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>();

  const { data: workersSettings, isLoading: loadingSettings } = useWorkersSettings(instanceId);
  const isWeeklyMode = workersSettings?.report_frequency === 'weekly';
  const isPerOrder = workersSettings?.settlement_type === 'per_order';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(currentDate);
  
  const dateFrom = isWeeklyMode ? format(weekStart, 'yyyy-MM-dd') : format(monthStart, 'yyyy-MM-dd');
  const dateTo = isWeeklyMode ? format(weekEnd, 'yyyy-MM-dd') : format(monthEnd, 'yyyy-MM-dd');
  
  const periodStart = isWeeklyMode ? weekStart : monthStart;
  const periodEnd = isWeeklyMode ? weekEnd : monthEnd;

  const { data: employees = [], isLoading: loadingEmployees } = useEmployees(instanceId);
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntriesForDateRange(instanceId, dateFrom, dateTo);
  const { data: daysOff = [], isLoading: loadingDaysOff } = useEmployeeDaysOff(instanceId, null);
  const { data: workingHours } = useWorkingHours(instanceId);

  // Fetch completed orders count per employee for per_order settlement
  const [completedOrderCounts, setCompletedOrderCounts] = useState<Map<string, number>>(new Map());
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!isPerOrder || !instanceId) {
      setCompletedOrderCounts(new Map());
      return;
    }
    const fetchCompletedOrders = async () => {
      setLoadingOrders(true);
      try {
        const { data } = await supabase
          .from('calendar_items')
          .select('id, assigned_employee_ids')
          .eq('instance_id', instanceId)
          .eq('status', 'completed')
          .gte('item_date', dateFrom)
          .lte('item_date', dateTo);

        const counts = new Map<string, number>();
        if (data) {
          data.forEach(item => {
            (item.assigned_employee_ids || []).forEach((empId: string) => {
              counts.set(empId, (counts.get(empId) || 0) + 1);
            });
          });
        }
        setCompletedOrderCounts(counts);
      } catch (err) {
        console.error('Error fetching completed orders:', err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchCompletedOrders();
  }, [isPerOrder, instanceId, dateFrom, dateTo]);

  const getOpeningTime = (dateStr: string): Date | null => {
    if (!workingHours) return null;
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = getDay(date);
    const dayKey = WEEKDAY_TO_KEY[dayOfWeek];
    const dayHours = workingHours[dayKey];
    if (!dayHours || !dayHours.open) return null;
    const [hours, minutes] = dayHours.open.split(':').map(Number);
    const openingDate = new Date(dateStr + 'T00:00:00');
    openingDate.setHours(hours, minutes, 0, 0);
    return openingDate;
  };

  const calculatePreOpeningMinutes = (entries: TimeEntry[], dateStr: string): number => {
    const openingTime = getOpeningTime(dateStr);
    if (!openingTime) return 0;
    let preOpeningMinutes = 0;
    entries.forEach(entry => {
      if (!entry.start_time) return;
      const startTime = new Date(entry.start_time);
      if (startTime < openingTime) {
        const endTime = entry.end_time ? new Date(entry.end_time) : new Date();
        const effectiveEnd = endTime < openingTime ? endTime : openingTime;
        const diffMs = effectiveEnd.getTime() - startTime.getTime();
        preOpeningMinutes += Math.max(0, Math.floor(diffMs / 60000));
      }
    });
    return preOpeningMinutes;
  };

  const preOpeningByEmployee = useMemo(() => {
    const result = new Map<string, number>();
    const entriesByEmployeeDate = new Map<string, Map<string, TimeEntry[]>>();
    timeEntries.forEach(entry => {
      if (!entriesByEmployeeDate.has(entry.employee_id)) {
        entriesByEmployeeDate.set(entry.employee_id, new Map());
      }
      const dateMap = entriesByEmployeeDate.get(entry.employee_id)!;
      if (!dateMap.has(entry.entry_date)) {
        dateMap.set(entry.entry_date, []);
      }
      dateMap.get(entry.entry_date)!.push(entry);
    });
    entriesByEmployeeDate.forEach((dateMap, employeeId) => {
      let totalPreOpening = 0;
      dateMap.forEach((entries, dateStr) => {
        totalPreOpening += calculatePreOpeningMinutes(entries, dateStr);
      });
      result.set(employeeId, totalPreOpening);
    });
    return result;
  }, [timeEntries, workingHours]);

  const activeEmployees = employees.filter(e => e.active);
  const periodSummary = useMemo(() => calculateMonthlySummary(timeEntries), [timeEntries]);
  const timeCalculationMode = workersSettings?.time_calculation_mode ?? 'start_to_stop';

  // Build entries lookup map by employee+date
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

  // Compute weeks of the month
  interface WeekGroup { weekNumber: number; days: Date[]; }
  const weeks = useMemo((): WeekGroup[] => {
    const mStart = startOfMonth(new Date(year, month));
    const mEnd = endOfMonth(new Date(year, month));
    const allDays = eachDayOfInterval({ start: mStart, end: mEnd });
    const weekMap = new Map<number, Date[]>();
    allDays.forEach(day => {
      const wn = getWeek(day, { weekStartsOn: 1, locale: pl });
      if (!weekMap.has(wn)) weekMap.set(wn, []);
      weekMap.get(wn)!.push(day);
    });
    return Array.from(weekMap.entries()).map(([weekNumber, days]) => ({ weekNumber, days }));
  }, [year, month]);

  const getWeekMinutes = (employeeId: string, days: Date[]): number => {
    const empMap = entriesByEmployeeAndDate.get(employeeId);
    if (!empMap) return 0;
    return days.reduce((sum, day) => {
      const ds = format(day, 'yyyy-MM-dd');
      const entries = empMap.get(ds);
      if (!entries) return sum;
      return sum + entries.reduce((s, e) => s + (e.total_minutes || 0), 0);
    }, 0);
  };

  const handleCellClick = (employeeId: string, date: Date) => {
    const ds = format(date, 'yyyy-MM-dd');
    const empMap = entriesByEmployeeAndDate.get(employeeId);
    const entries = empMap?.get(ds);
    if (entries && entries.length > 0) {
      setEditingTimeEntry(entries[0]);
      setPrefilledEmployee(undefined);
      setPrefilledDate(undefined);
    } else {
      setEditingTimeEntry(null);
      setPrefilledEmployee(employeeId);
      setPrefilledDate(ds);
    }
    setTimeEntryDialogOpen(true);
  };

  const totalEarnings = useMemo(() => {
    return activeEmployees.reduce((sum, employee) => {
      const summary = periodSummary.get(employee.id);
      if (summary && employee.hourly_rate) {
        const preOpeningMinutes = preOpeningByEmployee.get(employee.id) || 0;
        const displayMinutes = timeCalculationMode === 'opening_to_stop'
          ? Math.max(0, summary.total_minutes - preOpeningMinutes)
          : summary.total_minutes;
        return sum + (displayMinutes / 60) * employee.hourly_rate;
      }
      return sum;
    }, 0);
  }, [activeEmployees, periodSummary, preOpeningByEmployee, timeCalculationMode]);

  const getDaysOffForEmployee = (employeeId: string) => {
    return daysOff.filter(d => {
      if (d.employee_id !== employeeId) return false;
      const from = parseISO(d.date_from);
      const to = parseISO(d.date_to);
      return from <= periodEnd && to >= periodStart;
    });
  };

  type DayOffLine = { from: string; to: string | null };
  
  const formatDaysOffForPeriodLines = (employeeDaysOff: EmployeeDayOff[]): DayOffLine[] => {
    const allDates: Date[] = [];
    employeeDaysOff.forEach(item => {
      const from = parseISO(item.date_from);
      const to = parseISO(item.date_to);
      const daysInRange = eachDayOfInterval({ start: from, end: to });
      daysInRange.forEach(day => {
        const isInPeriod = isWeeklyMode 
          ? isSameWeek(day, currentDate, { weekStartsOn: 1 })
          : isSameMonth(day, currentDate);
        if (isInPeriod) allDates.push(day);
      });
    });
    if (allDates.length === 0) return [];
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const uniqueDates = allDates.filter((d, i, arr) => i === 0 || d.getTime() !== arr[i-1].getTime());

    const formatDateWithDay = (date: Date) => {
      const dayNum = format(date, 'd');
      const monthName = format(date, 'LLLL', { locale: pl });
      const weekday = WEEKDAY_SHORT[getDay(date)];
      return `${dayNum} ${monthName} (${weekday})`;
    };

    const lines: DayOffLine[] = [];
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    uniqueDates.forEach((date, idx) => {
      const prevDate = uniqueDates[idx - 1];
      const isConsecutive = prevDate && (date.getTime() - prevDate.getTime()) === 24 * 60 * 60 * 1000;
      if (isConsecutive && rangeStart) {
        rangeEnd = date;
      } else {
        if (rangeStart) {
          lines.push({ from: formatDateWithDay(rangeStart), to: rangeEnd ? formatDateWithDay(rangeEnd) : null });
        }
        rangeStart = date;
        rangeEnd = null;
      }
    });
    if (rangeStart) {
      lines.push({ from: formatDateWithDay(rangeStart), to: rangeEnd ? formatDateWithDay(rangeEnd) : null });
    }
    return lines;
  };

  const handlePrevPeriod = () => {
    if (isWeeklyMode) setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextPeriod = () => {
    if (isWeeklyMode) setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleAddEmployee = () => { setEditingEmployee(null); setDialogOpen(true); };
  const handleEditEmployee = (e: React.MouseEvent, employee: Employee) => { e.stopPropagation(); setEditingEmployee(employee); setDialogOpen(true); };
  const handleTileClick = (employee: Employee) => { setWorkerDialogEmployee(employee); };
  const handleDialogClose = () => { setDialogOpen(false); setEditingEmployee(null); setWorkerDialogEmployee(null); };

  const formatWeekDisplay = () => {
    const startFormatted = format(weekStart, 'd.MM');
    const endFormatted = format(weekEnd, 'd.MM');
    return `Tydzień ${weekNumber} (${startFormatted} - ${endFormatted})`;
  };

  const isLoading = loadingEmployees || loadingEntries || loadingDaysOff || loadingSettings;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Pracownicy</h2>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setSettingsDrawerOpen(true)} variant="outline" size="icon" className="h-9 w-9" title="Ustawienia czasu pracy">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button onClick={() => setDayOffDialogOpen(true)} variant="outline" size="icon" className="h-9 w-9" title="Dodaj nieobecność">
              <CalendarOff className="w-4 h-4" />
            </Button>
            <Button onClick={handleAddEmployee} title="Dodaj pracownika">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          </div>
        )}
      </div>

      {activeEmployees.length > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevPeriod}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium min-w-[200px] text-center text-lg">
            {isWeeklyMode ? formatWeekDisplay() : format(currentDate, 'LLLL yyyy', { locale: pl })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextPeriod}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {activeEmployees.length === 0 ? (
        <div className="py-12 text-center">
          <User className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Brak pracowników</p>
          <p className="text-sm text-muted-foreground mt-1">Dodaj pierwszego pracownika, aby rozpocząć rejestrację czasu pracy</p>
          {isAdmin && (
            <Button onClick={handleAddEmployee} className="mt-4">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj pracownika
            </Button>
          )}
        </div>
      ) : (
        <>
           <div className="rounded-lg border border-border bg-card overflow-x-auto -mx-4 px-0 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <Table className="w-full [&>div]:overflow-visible">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="sticky left-0 bg-card z-10 w-[70px] min-w-[70px] text-foreground font-medium border-r text-xs sm:text-sm">Data</TableHead>
                  {activeEmployees.map(emp => (
                    <TableHead key={emp.id} className="text-center text-foreground font-medium border-r last:border-r-0 px-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="truncate block max-w-[80px] sm:max-w-[100px] text-xs sm:text-sm">{emp.name}</span>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-0.5 rounded hover:bg-primary/5 transition-colors">
                                <MoreVertical className="w-3 h-3 text-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              <DropdownMenuItem onClick={() => { setEditingEmployee(emp); setDialogOpen(true); }}>
                                <Settings2 className="w-4 h-4 mr-2" />Edytuj
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAuditEmployee(emp)}>
                                <FileText className="w-4 h-4 mr-2" />Historia zmian
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setOrdersEmployee(emp)}>
                                <ClipboardList className="w-4 h-4 mr-2" />Wykonane zlecenia
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((week, wi) => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  const visibleDays = week.days.filter(day => format(day, 'yyyy-MM-dd') <= today);
                  if (visibleDays.length === 0) return null;
                  return (
                    <>
                      {visibleDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        return (
                          <TableRow key={dateStr}>
                            <TableCell className="sticky left-0 bg-card z-10 font-medium whitespace-nowrap py-1.5 text-foreground border-r">
                              {format(day, 'EEE d', { locale: pl })}
                            </TableCell>
                            {activeEmployees.map(emp => {
                              const empMap = entriesByEmployeeAndDate.get(emp.id);
                              const entries = empMap?.get(dateStr);
                              const hasEntry = entries && entries.length > 0;
                              const totalMin = hasEntry ? entries.reduce((s, e) => s + (e.total_minutes || 0), 0) : 0;
                              const displayTime = totalMin > 0 ? formatMinutesToTime(totalMin) : '';
                              const firstEntry = hasEntry ? entries[0] : null;
                               const startT = firstEntry?.start_time ? firstEntry.start_time.slice(11, 16) : undefined;
                               const endT = firstEntry?.end_time ? firstEntry.end_time.slice(11, 16) : undefined;
                              const hasStartEnd = startT && endT;
                              return (
                                <TableCell
                                  key={emp.id}
                                  className="text-center cursor-pointer hover:bg-primary/5 transition-colors p-1 border-r last:border-r-0"
                                  onClick={() => handleCellClick(emp.id, day)}
                                >
                                  {displayTime ? (
                                    <div className="flex flex-col items-center">
                                      {hasStartEnd && (
                                        <span className="text-[10px] text-muted-foreground leading-tight">{startT}-{endT}</span>
                                      )}
                                      <span className="text-sm font-medium text-foreground">{displayTime}</span>
                                    </div>
                                  ) : (
                                    <span className="text-foreground/20 text-xs">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      <TableRow key={`week-${wi}`} className="border-b-2">
                        <TableCell className="sticky left-0 bg-card z-10 font-bold whitespace-nowrap py-1.5 text-foreground border-r">
                          Tydzień {wi + 1}
                        </TableCell>
                        {activeEmployees.map(emp => {
                          const weekMin = getWeekMinutes(emp.id, visibleDays);
                          const displayTime = weekMin > 0 ? formatMinutesToTime(weekMin) : '-';
                          return (
                            <TableCell key={emp.id} className="text-center font-bold py-1.5 text-foreground border-r last:border-r-0">
                              {displayTime}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </>
                  );
                })}
                <TableRow className="border-t-2 border-foreground/20">
                  <TableCell className="sticky left-0 bg-card z-10 font-bold text-sm py-2 text-foreground border-r">SUMA</TableCell>
                  {activeEmployees.map(emp => {
                    const summary = periodSummary.get(emp.id);
                    const displayTime = summary && summary.total_minutes > 0 ? formatMinutesToTime(summary.total_minutes) : '-';
                    return (
                      <TableCell key={emp.id} className="text-center font-bold text-sm py-2 text-foreground border-r last:border-r-0">
                        {displayTime}
                      </TableCell>
                    );
                  })}
                </TableRow>
                {!isPerOrder && (
                  <TableRow>
                    <TableCell className="sticky left-0 bg-card z-10 font-bold text-sm py-2 text-foreground border-r">WYPŁATA</TableCell>
                    {activeEmployees.map(emp => {
                      const summary = periodSummary.get(emp.id);
                      if (!summary || !emp.hourly_rate || summary.total_minutes === 0) {
                        return <TableCell key={emp.id} className="text-center text-sm text-foreground py-2 border-r last:border-r-0">-</TableCell>;
                      }
                      const preOpeningMinutes = preOpeningByEmployee.get(emp.id) || 0;
                      const displayMinutes = timeCalculationMode === 'opening_to_stop'
                        ? Math.max(0, summary.total_minutes - preOpeningMinutes) : summary.total_minutes;
                      const earnings = ((displayMinutes / 60) * emp.hourly_rate).toFixed(2);
                      return (
                        <TableCell key={emp.id} className="text-center font-bold text-sm py-2 text-foreground border-r last:border-r-0">
                          {earnings} zł
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(() => {
            const employeesWithDaysOff = activeEmployees
              .map(emp => ({ employee: emp, daysOffLines: formatDaysOffForPeriodLines(getDaysOffForEmployee(emp.id)) }))
              .filter(item => item.daysOffLines.length > 0);
            if (employeesWithDaysOff.length === 0) return null;
            return (
              <div className="mt-6 space-y-3">
                <h3 className="font-medium text-muted-foreground">Nieobecności</h3>
                <div className="space-y-2">
                  {employeesWithDaysOff.map(({ employee, daysOffLines }) => (
                    <div key={employee.id} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee.photo_url || undefined} alt={employee.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium mb-1">{employee.name}</div>
                        <div className="text-sm space-y-1.5">
                          {daysOffLines.map((line, idx) => (
                            <div key={idx}>
                              {line.to ? (
                                <>
                                  <span className="text-muted-foreground">od </span>
                                  <span className="font-medium text-foreground">{line.from}</span>
                                  <span className="text-muted-foreground"> do </span>
                                  <span className="font-medium text-foreground">{line.to}</span>
                                </>
                              ) : (
                                <span className="font-medium text-foreground">{line.from}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      <AddEditEmployeeDialog open={dialogOpen} onOpenChange={handleDialogClose} instanceId={instanceId} employee={editingEmployee} isAdmin={isAdmin} />

      {workerDialogEmployee && instanceId && (
        <WorkerTimeDialog
          open={!!workerDialogEmployee}
          onOpenChange={(open) => !open && setWorkerDialogEmployee(null)}
          employee={workerDialogEmployee}
          instanceId={instanceId}
          showEditButton={isAdmin}
          onEditEmployee={() => { setEditingEmployee(workerDialogEmployee); setDialogOpen(true); }}
        />
      )}

      <AddEmployeeDayOffDialog open={dayOffDialogOpen} onOpenChange={setDayOffDialogOpen} instanceId={instanceId} employees={activeEmployees} />
      <WorkersSettingsDrawer open={settingsDrawerOpen} onOpenChange={setSettingsDrawerOpen} instanceId={instanceId} />

      {auditEmployee && instanceId && (
        <TimeEntryAuditDrawer
          open={!!auditEmployee}
          onOpenChange={(open) => !open && setAuditEmployee(null)}
          employee={auditEmployee}
          instanceId={instanceId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {ordersEmployee && instanceId && (
        <EmployeeOrdersDrawer
          open={!!ordersEmployee}
          onOpenChange={(open) => !open && setOrdersEmployee(null)}
          employeeId={ordersEmployee.id}
          employeeName={ordersEmployee.name}
          instanceId={instanceId}
        />
      )}

      <AddEditTimeEntryDialog
        open={timeEntryDialogOpen}
        onOpenChange={setTimeEntryDialogOpen}
        instanceId={instanceId}
        employees={activeEmployees}
        entry={editingTimeEntry}
        defaultEmployeeId={prefilledEmployee}
        defaultDate={prefilledDate}
      />
    </div>
  );
};

export default EmployeesView;
