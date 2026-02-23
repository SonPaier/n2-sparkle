import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CalendarMap from './CalendarMap';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';

interface CalendarMapPanelProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  onItemClick: (item: CalendarItem) => void;
  onClose: () => void;
  hqLocation?: { lat: number; lng: number; name: string } | null;
}

const CalendarMapPanel = ({ items, columns, onItemClick, onClose, hqLocation }: CalendarMapPanelProps) => {
  const filteredItems = useMemo(() => {
    return items.filter(item => item.status !== 'cancelled');
  }, [items]);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border relative">
      {/* Close button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-2 right-2 z-[40] h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
      >
        <X className="w-4 h-4" />
      </Button>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <CalendarMap items={filteredItems} columns={columns} onItemClick={onItemClick} hqLocation={hqLocation} />
      </div>
    </div>
  );
};

export default CalendarMapPanel;
