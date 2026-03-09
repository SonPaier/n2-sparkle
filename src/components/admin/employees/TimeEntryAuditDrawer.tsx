import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { FileText } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTimeEntryAuditLog, AuditLogEntry } from '@/hooks/useTimeEntryAuditLog';
import { Employee } from '@/hooks/useEmployees';

interface TimeEntryAuditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  instanceId: string;
  dateFrom: string;
  dateTo: string;
}

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const formatTimestamp = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    const time = format(d, 'HH:mm');
    const date = format(d, 'dd.MM.yyyy');
    return `o ${time} dnia ${date}`;
  } catch {
    return isoString;
  }
};

const formatDayHeader = (dateStr: string): string => {
  try {
    const d = parseISO(dateStr);
    const dayName = format(d, 'EEEE', { locale: pl });
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const dayMonth = format(d, 'd MMMM', { locale: pl });
    return `${capitalized} ${dayMonth}`;
  } catch {
    return dateStr;
  }
};

const DiffBadge = ({ diffMinutes, variant = 'default' }: { diffMinutes: number; variant?: 'default' | 'warning' }) => {
  if (diffMinutes === 0) return null;
  const isPositive = diffMinutes > 0;
  const sign = isPositive ? '+' : '\u2212';
  const label = `${sign}${formatMinutes(Math.abs(diffMinutes))}`;

  const colorClass = variant === 'warning'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
};

const AuditEntry = ({
  entry,
  prevEntry,
  isFirst,
  firstEntryDate,
}: {
  entry: AuditLogEntry;
  prevEntry: AuditLogEntry | null;
  isFirst: boolean;
  firstEntryDate: string;
}) => {
  const isCreate = entry.change_type === 'create';
  const isDelete = entry.change_type === 'delete';
  const isUpdate = entry.change_type === 'update';

  const currentMinutes = entry.new_total_minutes ?? 0;
  const prevMinutes = prevEntry?.new_total_minutes ?? prevEntry?.old_total_minutes ?? 0;
  const diffMinutes = isDelete
    ? -(entry.old_total_minutes ?? 0)
    : isUpdate
    ? currentMinutes - prevMinutes
    : 0;

  const changeDate = entry.created_at.slice(0, 10);
  const isDifferentDay = changeDate !== firstEntryDate;

  let bgClass = '';
  if (isUpdate && isDifferentDay) bgClass = 'bg-amber-50 dark:bg-amber-900/10';
  if (isDelete) bgClass = 'bg-destructive/5';

  return (
    <div className={`rounded-md px-3 py-2 ${bgClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isCreate && (
            <p className="text-sm text-foreground">
              zaraportowano <span className="font-semibold">{formatMinutes(currentMinutes)}</span>
            </p>
          )}
          {isUpdate && (
            <p className="text-sm text-foreground">
              zmieniono na <span className="font-semibold">{formatMinutes(currentMinutes)}</span>
            </p>
          )}
          {isDelete && (
            <p className="text-sm text-destructive">
              usunięto wpis
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTimestamp(entry.created_at)}
          </p>
        </div>
        {(isUpdate || isDelete) && diffMinutes !== 0 && (
          <div className="flex-shrink-0 mt-0.5">
            <DiffBadge diffMinutes={diffMinutes} variant={isDifferentDay ? 'warning' : 'default'} />
          </div>
        )}
      </div>
    </div>
  );
};

const TimeEntryAuditDrawer = ({
  open,
  onOpenChange,
  employee,
  instanceId,
  dateFrom,
  dateTo,
}: TimeEntryAuditDrawerProps) => {
  const isMobile = useIsMobile();
  const { data: dayGroups, isLoading } = useTimeEntryAuditLog(
    instanceId,
    employee.id,
    dateFrom,
    dateTo
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`${isMobile ? 'w-full' : 'w-[550px] sm:max-w-[550px]'} h-full flex flex-col p-0`}
      >
        <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-left">{employee.name} — historia zmian</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dayGroups.length === 0 ? (
            <EmptyState icon={FileText} message="Brak zmian w wybranym okresie" />
          ) : (
            <div className="space-y-5">
              {dayGroups.map((group) => (
                <div key={group.date} className="relative">
                  {/* Day header */}
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {formatDayHeader(group.date)}
                  </h3>

                  {/* Timeline with left border */}
                  <div
                    className={`border-l-2 pl-3 space-y-1.5 ${
                      group.hasChanges ? 'border-primary' : 'border-border'
                    }`}
                  >
                    {group.entries.map((entry, idx) => (
                      <AuditEntry
                        firstEntryDate={group.entries[0]?.created_at.slice(0, 10) ?? group.date}
                        key={entry.id}
                        entry={entry}
                        prevEntry={idx > 0 ? group.entries[idx - 1] : null}
                        isFirst={idx === 0}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default TimeEntryAuditDrawer;
