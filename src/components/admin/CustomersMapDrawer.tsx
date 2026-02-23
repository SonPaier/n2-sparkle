import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CustomerMapAddress {
  lat: number;
  lng: number;
  customerName: string;
  addressName: string;
  city: string | null;
  customerId: string;
}

interface CustomersMapDrawerProps {
  open: boolean;
  onClose: () => void;
  addresses: CustomerMapAddress[];
  onCustomerClick: (customerId: string) => void;
}

const MARKER_COLOR = '#6366f1';

const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${MARKER_COLOR}" stroke="#fff" stroke-width="2.5"/>
  <circle cx="16" cy="16" r="7" fill="#fff"/>
</svg>`;

const markerIcon = L.divIcon({
  html: markerSvg,
  className: '',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  tooltipAnchor: [0, -42],
});

const CustomersMapDrawer = ({ open, onClose, addresses, onCustomerClick }: CustomersMapDrawerProps) => {
  const isMobile = useIsMobile();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [52.0, 19.0],
      zoom: 7,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);
  }, []);

  // Init map after drawer animation
  useEffect(() => {
    if (!open) {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
      return;
    }
    const timer = setTimeout(() => {
      initMap();
      updateMarkers();
    }, 350);
    return () => clearTimeout(timer);
  }, [open]);

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    addresses.forEach(addr => {
      const line2Parts = [addr.addressName, addr.city].filter(Boolean).join(', ');
      const tooltipHtml = `<div class="calendar-map-tooltip-content"><div class="cmt-line1">${addr.customerName}</div>${line2Parts ? `<div class="cmt-line2">${line2Parts}</div>` : ''}</div>`;

      const marker = L.marker([addr.lat, addr.lng], { icon: markerIcon })
        .bindTooltip(tooltipHtml, {
          permanent: true,
          direction: 'top',
          offset: [0, -4],
          className: 'calendar-map-tooltip',
          interactive: true,
        })
        .on('click', () => onCustomerClick(addr.customerId))
        .addTo(map);

      marker.on('tooltipopen', () => {
        const el = marker.getTooltip()?.getElement();
        if (el) {
          el.style.cursor = 'pointer';
          el.onclick = (e) => { e.stopPropagation(); onCustomerClick(addr.customerId); };
        }
      });

      markersRef.current.push(marker);
    });

    if (addresses.length > 0) {
      const bounds = L.latLngBounds(addresses.map(a => [a.lat, a.lng] as [number, number]));
      const padding = isMobile ? 8 : 50;
      map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 });
    }
  }, [addresses, isMobile, onCustomerClick]);

  // Update markers when addresses change while open
  useEffect(() => {
    if (open && mapRef.current) {
      updateMarkers();
    }
  }, [addresses, open, updateMarkers]);

  return (
    <Drawer
      open={open}
      onOpenChange={v => { if (!v) onClose(); }}
      direction={isMobile ? 'bottom' : 'right'}
    >
      <DrawerContent
        className={
          isMobile
            ? 'h-[100dvh] rounded-none'
            : 'ml-auto h-full w-[80vw] max-w-none rounded-none'
        }
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-lg font-semibold">Mapa klientów</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div ref={containerRef} className="flex-1 w-full" style={{ minHeight: '300px' }} />
      </DrawerContent>
    </Drawer>
  );
};

export default CustomersMapDrawer;
