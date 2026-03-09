import { useState, useMemo, DragEvent } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from 'date-fns';
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
  onItemMove?: (itemId: string, newColumnId: string, newDate: string) => void;
}

const DAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

const MonthCalendarView = ({
  items,
  columns,
  currentDate,
  onDayClick,
  onItemClick,
  onItemMove,
}: MonthCalendarViewProps) => {
  const isMobile = useIsMobile();
  const MAX_TILES = isMobile ? 2 : 4;

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [calendarStart.getTime(), calendarEnd.getTime()]);

  const columnColorMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((col) => {
      if (col.color) map.set(col.id, col.color);
    });
    return map;
  }, [columns]);

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

  // Drag handlers
  const handleDragStart = (e: DragEvent, item: CalendarItem) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDragOver = (e: DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDateStr(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDateStr(null);
  };

  const handleDrop = (e: DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDateStr(null);
    const itemId = draggedItemId || e.dataTransfer.getData('text/plain');
    setDraggedItemId(null);
    if (!itemId || !onItemMove) return;
    const item = items.find(i => i.id === itemId);
    if (!item || item.item_date === dateStr) return;
    onItemMove(itemId, item.column_id || '', dateStr);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverDateStr(null);
  };

  return (
    <div className="flex flex-col h-full">
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
              const isDragOver = dragOverDateStr === dateStr;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1 flex flex-col min-h-0 overflow-hidden transition-colors',
                    !isCurrentMonth && 'bg-muted/30',
                    isDragOver && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
                  )}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
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
                          draggable={!!onItemMove}
                          onDragStart={(e) => handleDragStart(e as any, item)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                          className={cn(
                            'text-left rounded px-1 py-0.5 hover:opacity-80 transition-opacity truncate border group cursor-grab active:cursor-grabbing',
                            draggedItemId === item.id && 'opacity-40'
                          )}
                          style={{
                            backgroundColor: colColor ? `${colColor}22` : undefined,
                            borderColor: colColor ? `${colColor}55` : undefined,
                          }}
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
