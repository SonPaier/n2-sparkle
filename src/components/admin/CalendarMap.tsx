import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

interface CalendarMapProps {
  items: CalendarItem[];
  columns: CalendarColumn[];
  onItemClick: (item: CalendarItem) => void;
  onNearbyAddressClick?: (address: NearbyAddress) => void;
  hqLocation?: { lat: number; lng: number; name: string } | null;
  showNearby?: boolean;
  instanceId?: string;
}

export interface NearbyAddress {
  id: string;
  customer_id: string;
  lat: number;
  lng: number;
  street: string | null;
  city: string | null;
  name: string;
  customer_name?: string;
  customer_phone?: string;
}

// Haversine distance in km
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

// Convert any color to fully saturated version
const saturateColor = (color: string): string => {
  // Parse hex
  let r = 0, g = 0, b = 0;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return color;
  }
  // Convert to HSL and force full saturation + good lightness
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  // Force saturation to 85% and lightness between 40-50%
  const newS = 85;
  const newL = Math.max(35, Math.min(50, Math.round(l * 100)));
  return `hsl(${Math.round(h * 360)}, ${newS}%, ${newL}%)`;
};

const createMarkerIcon = (color: string) => {
  const vivid = saturateColor(color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${vivid}" stroke="#fff" stroke-width="2.5"/>
    <circle cx="16" cy="16" r="7" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    tooltipAnchor: [0, -42],
  });
};

const createGrayMarkerIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#9ca3af" stroke="#fff" stroke-width="2.5"/>
    <circle cx="16" cy="16" r="7" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    tooltipAnchor: [0, -34],
  });
};

const grayIcon = createGrayMarkerIcon();

const CalendarMap = ({ items, columns, onItemClick, onNearbyAddressClick, hqLocation, showNearby = false, instanceId }: CalendarMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const nearbyMarkersRef = useRef<L.Marker[]>([]);
  const isMobile = useIsMobile();
  const [nearbyAddresses, setNearbyAddresses] = useState<NearbyAddress[]>([]);

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
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?lang=pl', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
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
      let distPart = '';
      if (hqLocation && item.address_lat != null && item.address_lng != null) {
        const km = Math.round(haversineKm(hqLocation.lat, hqLocation.lng, item.address_lat, item.address_lng) * 1.35);
        distPart = `~${km} km`;
      }
      const title = item.title || '';
      const line2Parts = [city, distPart, dateStr].filter(Boolean).join(' · ');
      const tooltipHtml = `<div class="calendar-map-tooltip-content">${title ? `<div class="cmt-line1">${title}</div>` : ''}<div class="cmt-line2">${line2Parts}</div></div>`;

      const marker = L.marker([item.address_lat!, item.address_lng!], {
        icon: getIcon(color),
      })
        .bindTooltip(tooltipHtml, { permanent: false, direction: 'top', offset: [0, -4], className: 'calendar-map-tooltip', interactive: true })
        .on('click', () => onItemClick(item))
        .addTo(map);

      // Make tooltip clicks also open the drawer
      marker.on('tooltipopen', () => {
        const el = marker.getTooltip()?.getElement();
        if (el) {
          el.style.cursor = 'pointer';
          el.onclick = (e) => { e.stopPropagation(); onItemClick(item); };
        }
      });

      markersRef.current.push(marker);
    });

    // HQ marker
    if (hqLocation) {
      const hqSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
        <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.61 26.39 0 17 0z" fill="#1e293b" stroke="#fff" stroke-width="2.5"/>
        <rect x="9" y="10" width="16" height="14" rx="2" fill="#fff"/>
        <rect x="13" y="16" width="3" height="4" fill="#1e293b"/>
        <rect x="18" y="16" width="3" height="4" fill="#1e293b"/>
        <rect x="13" y="11" width="3" height="3" fill="#1e293b"/>
        <rect x="18" y="11" width="3" height="3" fill="#1e293b"/>
      </svg>`;
      const hqIcon = L.divIcon({
        html: hqSvg,
        className: '',
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        tooltipAnchor: [0, -44],
      });
      const hqMarker = L.marker([hqLocation.lat, hqLocation.lng], { icon: hqIcon })
        .bindTooltip(`<div class="calendar-map-tooltip-content"><div class="cmt-line1">🏢 ${hqLocation.name}</div><div class="cmt-line2">Baza firmy</div></div>`, {
          permanent: false, direction: 'top', offset: [0, -4], className: 'calendar-map-tooltip calendar-map-tooltip-hq',
        })
        .addTo(map);
      markersRef.current.push(hqMarker);
    }

    // Fit bounds
    const allPoints: [number, number][] = validItems.map(i => [i.address_lat!, i.address_lng!]);
    if (hqLocation) allPoints.push([hqLocation.lat, hqLocation.lng]);
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      const padding = isMobile ? 8 : 50;
      map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 });
    }
  }, [validItems, columnColorMap, getIcon, onItemClick, isMobile, hqLocation]);

  // Fetch nearby customer addresses
  useEffect(() => {
    if (!showNearby || !instanceId || validItems.length === 0) {
      setNearbyAddresses([]);
      return;
    }
    const fetchNearby = async () => {
      const existingAddressIds = new Set(
        validItems.map(i => i.customer_address_id).filter(Boolean)
      );

      const { data, error } = await supabase
        .from('customer_addresses')
        .select('id, customer_id, lat, lng, street, city, name, customers(name, phone)')
        .eq('instance_id', instanceId)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error || !data) return;

      const nearby: NearbyAddress[] = [];
      for (const addr of data) {
        if (existingAddressIds.has(addr.id)) continue;
        if (addr.lat == null || addr.lng == null) continue;
        const isClose = validItems.some(item =>
          item.address_lat != null && item.address_lng != null &&
          haversineKm(item.address_lat, item.address_lng, addr.lat!, addr.lng!) <= 3.0
        );
        if (isClose) {
          nearby.push({
            ...addr,
            lat: addr.lat!,
            lng: addr.lng!,
            customer_name: (addr.customers as any)?.name || '',
            customer_phone: (addr.customers as any)?.phone || '',
          });
        }
      }
      setNearbyAddresses(nearby);
    };
    fetchNearby();
  }, [showNearby, instanceId, validItems]);

  // Render nearby gray markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    nearbyMarkersRef.current.forEach(m => m.remove());
    nearbyMarkersRef.current = [];

    if (!showNearby) return;

    nearbyAddresses.forEach(addr => {
      const line1Parts = [addr.customer_name || addr.name, addr.customer_phone].filter(Boolean);
      const line1 = line1Parts.join(' · ');
      const line2 = [addr.street, addr.city].filter(Boolean).join(', ');
      const tooltipHtml = `<div class="calendar-map-tooltip-content"><div class="cmt-line1">${line1}</div>${line2 ? `<div class="cmt-line2">${line2}</div>` : ''}</div>`;

      const marker = L.marker([addr.lat, addr.lng], { icon: grayIcon })
        .bindTooltip(tooltipHtml, {
          permanent: false, direction: 'top', offset: [0, -4],
          className: 'calendar-map-tooltip',
        })
        .on('click', () => onNearbyAddressClick?.(addr))
        .addTo(map);

      marker.on('tooltipopen', () => {
        const el = marker.getTooltip()?.getElement();
        if (el) {
          el.style.cursor = 'pointer';
          el.onclick = (e) => { e.stopPropagation(); onNearbyAddressClick?.(addr); };
        }
      });

      nearbyMarkersRef.current.push(marker);
    });
  }, [nearbyAddresses, showNearby, onNearbyAddressClick]);

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
          border-radius: 8px !important;
          padding: 0 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
          cursor: pointer !important;
        }
        .calendar-map-tooltip::before {
          border-top-color: hsl(var(--border)) !important;
        }
        .calendar-map-tooltip-content {
          padding: 5px 10px;
        }
        .cmt-line1 {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
        }
        .cmt-line2 {
          font-size: 11px;
          font-weight: 600;
          color: hsl(var(--foreground));
          line-height: 1.3;
          margin-top: 1px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full rounded-lg" style={{ minHeight: '300px' }} />
    </>
  );
};

export default CalendarMap;
