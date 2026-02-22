import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';
import { useIsMobile } from '@/hooks/use-mobile';

interface MapItem extends CalendarItem {
  address_lat?: number | null;
  address_lng?: number | null;
  address_city?: string | null;
}

interface CalendarMapProps {
  items: MapItem[];
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

const FitBoundsHelper = ({ items, isMobile }: { items: MapItem[]; isMobile: boolean }) => {
  const map = useMap();
  const prevBoundsKey = useRef('');

  useEffect(() => {
    const points = items.filter(i => i.address_lat && i.address_lng);
    if (points.length === 0) return;

    const boundsKey = points.map(p => `${p.id}:${p.address_lat}:${p.address_lng}`).sort().join('|');
    if (boundsKey === prevBoundsKey.current) return;
    prevBoundsKey.current = boundsKey;

    const bounds = L.latLngBounds(points.map(p => [p.address_lat!, p.address_lng!]));
    const padding = isMobile ? 8 : 50;
    map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 });
  }, [items, isMobile, map]);

  return null;
};

const CalendarMap = ({ items, columns, onItemClick }: CalendarMapProps) => {
  const isMobile = useIsMobile();

  const columnColorMap = useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach(col => {
      map.set(col.id, col.color || '#6366f1');
    });
    return map;
  }, [columns]);

  const iconCache = useRef(new Map<string, L.DivIcon>());

  const getIcon = (color: string) => {
    if (!iconCache.current.has(color)) {
      iconCache.current.set(color, createMarkerIcon(color));
    }
    return iconCache.current.get(color)!;
  };

  const validItems = useMemo(
    () => items.filter(i => i.address_lat != null && i.address_lng != null),
    [items]
  );

  const defaultCenter: [number, number] = [52.0, 19.0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={7}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '300px' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBoundsHelper items={validItems} isMobile={isMobile} />
      {validItems.map(item => {
        const color = columnColorMap.get(item.column_id || '') || '#6366f1';
        const city = item.address_city || '';
        const dateStr = format(new Date(item.item_date), 'd MMM', { locale: pl });
        const label = city ? `${city} | ${dateStr}` : dateStr;

        return (
          <Marker
            key={item.id}
            position={[item.address_lat!, item.address_lng!]}
            icon={getIcon(color)}
            eventHandlers={{ click: () => onItemClick(item) }}
          >
            <Tooltip permanent direction="top" offset={[0, -4]} className="!bg-background !text-foreground !border-border !shadow-md !rounded-md !px-2 !py-1 !text-xs !font-medium">
              {label}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default CalendarMap;
