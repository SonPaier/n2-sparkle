import { useState, useMemo } from 'react';
import { format, addDays, isAfter, isBefore, startOfDay, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import CalendarMap from './CalendarMap';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';

type DateFilter = 'today' | 'week' | 'month';

interface CalendarMapPanelProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  onItemClick: (item: CalendarItem) => void;
  onClose: () => void;
}

const CalendarMapPanel = ({ items, columns, onItemClick, onClose }: CalendarMapPanelProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [columnFilter, setColumnFilter] = useState<string>('all');
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const today = startOfDay(new Date());

    return items.filter(item => {
      // Only today and future
      const itemDate = startOfDay(new Date(item.item_date));
      if (isBefore(itemDate, today)) return false;

      // Column filter
      if (columnFilter !== 'all' && item.column_id !== columnFilter) return false;

      // Skip cancelled
      if (item.status === 'cancelled') return false;

      // Date range filter
      if (customDate) {
        return isSameDay(itemDate, customDate);
      }

      if (dateFilter === 'today') {
        return isSameDay(itemDate, today);
      }
      if (dateFilter === 'week') {
        const weekEnd = addDays(today, 7);
        return !isAfter(itemDate, weekEnd);
      }
      if (dateFilter === 'month') {
        const monthEnd = addDays(today, 30);
        return !isAfter(itemDate, monthEnd);
      }

      return true;
    });
  }, [items, dateFilter, customDate, columnFilter]);

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    setCustomDate(undefined);
  };

  const handleCustomDate = (date: Date | undefined) => {
    setCustomDate(date);
    setDatePickerOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Mapa zleceń</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['today', 'week', 'month'] as DateFilter[]).map(f => (
            <Button
              key={f}
              variant={dateFilter === f && !customDate ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleDateFilterChange(f)}
              className="rounded-none border-0 px-2.5 h-8 text-xs"
            >
              {f === 'today' ? 'Dziś' : f === 'week' ? 'Tydzień' : 'Miesiąc'}
            </Button>
          ))}
        </div>

        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={customDate ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 gap-1 text-xs"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {customDate ? format(customDate, 'd MMM', { locale: pl }) : 'Data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={handleCustomDate}
              locale={pl}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        <Select value={columnFilter} onValueChange={setColumnFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Kolumna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {columns.map(col => (
              <SelectItem key={col.id} value={col.id}>
                <div className="flex items-center gap-2">
                  {col.color && (
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  )}
                  {col.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredItems.length} {filteredItems.length === 1 ? 'punkt' : 'punktów'}
        </span>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <CalendarMap items={filteredItems} columns={columns} onItemClick={onItemClick} />
      </div>
    </div>
  );
};

export default CalendarMapPanel;
