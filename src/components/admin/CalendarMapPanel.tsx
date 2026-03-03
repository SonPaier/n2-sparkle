import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, isAfter, isBefore, startOfDay, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import { X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import CalendarMap, { type NearbyAddress } from './CalendarMap';
import CustomerOrderCard from './CustomerOrderCard';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';
import { useIsMobile } from '@/hooks/use-mobile';

type DateFilter = 'today' | 'week' | 'month';

interface CalendarMapPanelProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  onItemClick: (item: CalendarItem) => void;
  onNearbyAddressClick?: (address: NearbyAddress) => void;
  onClose: () => void;
  hqLocation?: { lat: number; lng: number; name: string } | null;
  instanceId: string;
}

const CalendarMapPanel = ({ items, columns, onItemClick, onNearbyAddressClick, onClose, hqLocation, instanceId }: CalendarMapPanelProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [columnFilter, setColumnFilter] = useState<string>('all');
  const [showNearby, setShowNearby] = useState(false);
  const isMobile = useIsMobile();

  const filteredItems = useMemo(() => {
    const today = startOfDay(new Date());

    return items.filter(item => {
      const itemStart = startOfDay(new Date(item.item_date));
      const itemEnd = item.end_date ? startOfDay(new Date(item.end_date)) : itemStart;
      if (isBefore(itemEnd, today)) return false;
      if (columnFilter !== 'all' && item.column_id !== columnFilter) return false;
      if (item.status === 'cancelled') return false;

      if (dateFilter === 'today') {
        return !isAfter(itemStart, today) && !isBefore(itemEnd, today);
      }
      if (dateFilter === 'week') {
        const weekEnd = addDays(today, 7);
        return !isAfter(itemStart, weekEnd);
      }
      if (dateFilter === 'month') {
        const monthEnd = addDays(today, 30);
        return !isAfter(itemStart, monthEnd);
      }

      return true;
    });
  }, [items, dateFilter, columnFilter]);

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Map background — z-0 so panels stay on top */}
      <div className="absolute inset-0 z-0">
        <CalendarMap items={filteredItems} columns={columns} onItemClick={onItemClick} onNearbyAddressClick={onNearbyAddressClick} hqLocation={hqLocation} showNearby={showNearby} instanceId={instanceId} />
      </div>

      {/* Left order list panel — desktop only */}
      {!isMobile && (
        <div className="absolute left-0 top-0 w-[300px] h-full bg-card border-r border-border z-10">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="font-semibold text-sm">
              Zlecenia ({filteredItems.length})
            </h3>
          </div>
          <ScrollArea className="h-[calc(100%-41px)]">
            <div className="p-2 space-y-2">
              {filteredItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Brak zleceń</p>
              )}
              {filteredItems.map(item => (
                <CustomerOrderCard
                  key={item.id}
                  itemDate={item.item_date}
                  endDate={item.end_date}
                  title={item.title}
                  status={item.status}
                  services={[]}
                  price={item.price ?? undefined}
                  onClick={() => onItemClick(item)}
                  assignedEmployeeNames={item.assigned_employees?.map(e => e.name)}
                  customerName={item.customer_name}
                  addressCity={item.address_city}
                  addressStreet={item.address_street}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Floating filters */}
      <div className={`absolute ${isMobile ? 'top-4 left-4 right-14 flex flex-wrap gap-2' : 'top-4 left-[316px] flex items-center gap-2'} z-20`}>
        <div className="flex rounded-lg overflow-hidden shadow-sm">
          {(['today', 'week', 'month'] as DateFilter[]).map(f => (
            <Button
              key={f}
              variant="ghost"
              size="sm"
              onClick={() => setDateFilter(f)}
              className={`rounded-none border-0 px-2.5 h-9 text-xs shadow-none ${
                dateFilter === f
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-white text-foreground hover:bg-white/90'
              }`}
            >
              {f === 'today' ? 'Dziś' : f === 'week' ? 'Tydzień' : 'Miesiąc'}
            </Button>
          ))}
        </div>

        <Select value={columnFilter} onValueChange={setColumnFilter}>
          <SelectTrigger className="h-9 w-[130px] text-xs bg-white border-0 shadow-sm">
            <SelectValue placeholder="Kolumna" />
          </SelectTrigger>
          <SelectContent className="z-[1300]">
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

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNearby(v => !v)}
          className={`h-9 gap-1 text-xs shadow-sm ${
            showNearby
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-white text-foreground hover:bg-white/90'
          }`}
          title="Pokaż klientów w okolicy (3 km)"
        >
          <Users className="w-3.5 h-3.5" />
          W okolicy
        </Button>
      </div>

      {/* Close button — white bg, purple hover */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-white hover:bg-accent shadow-sm"
      >
        <X className="w-5 h-5 text-foreground" />
      </Button>
    </div>,
    document.body
  );
};

export default CalendarMapPanel;
