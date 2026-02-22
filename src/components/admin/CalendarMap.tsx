import { useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarMapProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  onItemClick: (item: CalendarItem) => void;
}

const createMarkerIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="#fff" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    tooltipAnchor: [0, -36],
  });
};

const CalendarMap = ({ items, columns, onItemClick }: CalendarMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const isMobile = useIsMobile();

  const columnColorMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach(col => map.set(col.id, col.color || '#6366f1'));
    return map;
  }, [columns]);

  const iconCache = useRef(new Map<string, L.DivIcon>());
  const getIcon = useCallback((color: string) => {
    if (!iconCache.current.has(color)) {
      iconCache.current.set(color, createMarkerIcon(color));
    }
    return iconCache.current.get(color)!;
  }, []);

  const validItems = useMemo(
    () => items.filter(i => i.address_lat != null && i.address_lng != null),
    [items]
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [52.0, 19.0],
      zoom: 7,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    validItems.forEach(item => {
      const color = columnColorMap.get(item.column_id || '') || '#6366f1';
      const city = item.address_city || '';
      const dateStr = format(new Date(item.item_date), 'd MMM', { locale: pl });
      const label = city ? `${city} | ${dateStr}` : dateStr;

      const marker = L.marker([item.address_lat!, item.address_lng!], {
        icon: getIcon(color),
      })
        .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -4], className: 'calendar-map-tooltip' })
        .on('click', () => onItemClick(item))
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (validItems.length > 0) {
      const bounds = L.latLngBounds(validItems.map(i => [i.address_lat!, i.address_lng!] as [number, number]));
      const padding = isMobile ? 8 : 50;
      map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 });
    }
  }, [validItems, columnColorMap, getIcon, onItemClick, isMobile]);

  // Invalidate size when container resizes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [validItems]);

  return (
    <>
      <style>{`
        .calendar-map-tooltip {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 6px !important;
          padding: 2px 8px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
        }
        .calendar-map-tooltip::before {
          border-top-color: hsl(var(--border)) !important;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full rounded-lg" style={{ minHeight: '300px' }} />
    </>
  );
};

export default CalendarMap;
