import { useState, useMemo, useCallback, DragEvent } from 'react';
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

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MonthCalendarView = ({
  items,
  columns,
  currentDate,
  onDayClick,
  onItemClick,
  onItemMove,
}: MonthCalendarViewProps) => {
  const isMobile = useIsMobile();

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

  const handleDragStart = useCallback((e: DragEvent, item: CalendarItem) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  }, []);

  const handleDragOver = useCallback((e: DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDateStr(dateStr);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && (e.currentTarget as HTMLElement).contains(relatedTarget)) return;
    setDragOverDateStr(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDateStr(null);
    const itemId = e.dataTransfer.getData('text/plain');
    setDraggedItemId(null);
    if (!itemId || !onItemMove) return;
    const item = items.find(i => i.id === itemId);
    if (!item || item.item_date === dateStr) return;
    onItemMove(itemId, item.column_id || '', dateStr);
  }, [items, onItemMove]);

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDragOverDateStr(null);
  }, []);

  return (
    <div className="flex flex-col">
      {/* Day names header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-muted-foreground py-2 border-r border-border last:border-r-0">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div>
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border last:border-b-0 min-h-[80px]">
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const dayItems = itemsByDate.get(dateStr) || [];
              const isDragOver = dragOverDateStr === dateStr;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1 flex flex-col min-h-0 overflow-hidden overflow-y-auto transition-colors bg-white dark:bg-card',
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
                      'text-xs font-medium mb-0.5 w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors self-start shrink-0',
                      isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      !isCurrentMonth && 'text-muted-foreground/40'
                    )}
                  >
                    {format(day, 'd')}
                  </button>

                  {/* Item tiles */}
                  <div className="flex flex-col gap-0.5 min-h-0 flex-1">
                    {dayItems.map((item) => {
                      const colColor = item.column_id ? columnColorMap.get(item.column_id) : undefined;
                      const address = [item.address_city, item.address_street].filter(Boolean).join(', ') || item.address_name || '';
                      const employees = item.assigned_employees || [];

                      const tileStyle = colColor ? {
                        backgroundColor: colColor,
                        borderLeft: `3px solid ${colColor}`,
                      } : undefined;

                      return (
                        <button
                          key={`${item.id}-${dateStr}`}
                          draggable={!!onItemMove}
                          onDragStart={(e) => handleDragStart(e as any, item)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                          className={cn(
                            'text-left rounded-sm px-1.5 py-0.5 hover:opacity-80 transition-opacity group cursor-grab active:cursor-grabbing shrink-0',
                            draggedItemId === item.id && 'opacity-40',
                            !colColor && 'bg-muted/60 border-l-[3px] border-muted-foreground/30'
                          )}
                          style={tileStyle}
                        >
                          {isMobile ? (
                            <div className="text-[10px] font-semibold text-foreground line-clamp-2">
                              {item.title}
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-[11px] font-bold tabular-nums shrink-0 text-foreground">
                                  {item.start_time?.slice(0, 5)}
                                </span>
                                <span className="text-[11px] font-bold truncate text-foreground">
                                  {item.title}
                                </span>
                              </div>
                              {address && (
                                <div className="text-[10px] text-foreground/70 truncate pl-0.5">
                                  {address}
                                </div>
                              )}
                              {employees.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {employees.map((emp) => (
                                    <span
                                      key={emp.id}
                                      className="text-[9px] rounded px-1 py-px truncate max-w-[80px] font-medium bg-foreground/10 text-foreground/80"
                                    >
                                      {emp.name.split(' ')[0]}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
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
