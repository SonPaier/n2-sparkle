import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';

interface MonthCalendarViewProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
}

const DAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

const MonthCalendarView = ({
  items,
  columns,
  currentDate,
  onMonthChange,
  onDayClick,
  onItemClick,
}: MonthCalendarViewProps) => {
  const isMobile = useIsMobile();
  const MAX_TILES = isMobile ? 2 : 4;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build array of all days to display
  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [calendarStart.getTime(), calendarEnd.getTime()]);

  // Build column color map
  const columnColorMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((col) => {
      if (col.color) map.set(col.id, col.color);
    });
    return map;
  }, [columns]);

  // Build dateStr → items map (with multi-day expansion)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      if (!item.item_date) continue;
      const startDate = item.item_date;
      const endDate = item.end_date || item.item_date;
      let current = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      while (current <= end) {
        const dateStr = format(current, 'yyyy-MM-dd');
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)!.push(item);
        current = addDays(current, 1);
      }
    }
    // Sort each day's items by start_time
    for (const [, dayItems] of map) {
      dayItems.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }
    return map;
  }, [items]);

  const today = new Date();

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between py-2 px-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentDate, 1))} className="h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentDate, 1))} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())} className="ml-2">
            Dziś
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentDate, 'LLLL yyyy', { locale: pl })}
        </h2>
        <div /> {/* spacer */}
      </div>

      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid auto-rows-fr" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const dayItems = itemsByDate.get(dateStr) || [];
              const visibleItems = dayItems.slice(0, MAX_TILES);
              const overflowCount = dayItems.length - MAX_TILES;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1 flex flex-col min-h-0 overflow-hidden',
                    !isCurrentMonth && 'bg-muted/30'
                  )}
                >
                  {/* Day number */}
                  <button
                    onClick={() => onDayClick(day)}
                    className={cn(
                      'text-xs font-medium mb-0.5 w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors self-start',
                      isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      !isCurrentMonth && 'text-muted-foreground/50'
                    )}
                  >
                    {format(day, 'd')}
                  </button>

                  {/* Item tiles */}
                  <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden flex-1">
                    {visibleItems.map((item) => {
                      const colColor = item.column_id ? columnColorMap.get(item.column_id) : undefined;
                      const address = [item.address_city, item.address_street].filter(Boolean).join(', ') || item.address_name || '';

                      return (
                        <button
                          key={`${item.id}-${dateStr}`}
                          onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                          className="text-left rounded px-1 py-0.5 hover:opacity-80 transition-opacity truncate bg-muted/60 border border-border/50 group"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {colColor && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: colColor }}
                              />
                            )}
                            <span className="text-[10px] md:text-[11px] font-medium tabular-nums shrink-0 text-muted-foreground">
                              {item.start_time?.slice(0, 5)}
                            </span>
                            <span className="text-[10px] md:text-[11px] font-semibold truncate text-foreground">
                              {item.title}
                            </span>
                          </div>
                          {address && !isMobile && (
                            <div className="text-[9px] md:text-[10px] text-muted-foreground truncate pl-3">
                              {address}
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {overflowCount > 0 && (
                      <button
                        onClick={() => onDayClick(day)}
                        className="text-[10px] text-primary font-medium hover:underline text-left px-1"
                      >
                        jeszcze {overflowCount}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthCalendarView;
