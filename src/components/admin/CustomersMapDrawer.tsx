import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerMapFilters from './CustomerMapFilters';
import CustomerMapFiltersDrawer from './CustomerMapFiltersDrawer';
import type { SelectedCustomer } from './CustomerSearchInput';
import type { ServiceWithCategory } from './ServiceSelectionDrawer';

export interface CustomerMapAddress {
  lat: number;
  lng: number;
  customerName: string;
  addressName: string;
  city: string | null;
  customerId: string;
  addressId: string;
  futureOrdersCount?: number;
}

export type OrderStatusFilter = 'all' | 'with_orders' | 'without_orders';

export interface MapFilters {
  customer: SelectedCustomer | null;
  serviceIds: string[];
  serviceNames: string[];
  categoryIds: string[];
  orderStatus: OrderStatusFilter;
}

interface CustomersMapDrawerProps {
  open: boolean;
  onClose: () => void;
  addresses: CustomerMapAddress[];
  onCustomerClick: (customerId: string, addressId: string) => void;
  instanceId: string;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  categoryNames?: Record<string, string>;
}

const MARKER_COLOR = '#6366f1';

const createMarkerIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="-6 -8 44 50">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="${MARKER_COLOR}" stroke="#fff" stroke-width="2.5"/>
    <circle cx="16" cy="16" r="7" fill="#fff"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [44, 50],
    iconAnchor: [22, 50],
    tooltipAnchor: [0, -50],
  });
};

// Active filter chips bar
const ActiveFiltersBar = ({ filters, onFiltersChange, categoryNames }: { filters: MapFilters; onFiltersChange: (f: MapFilters) => void; categoryNames?: Record<string, string> }) => {
  const hasFilters = filters.customer || filters.serviceIds.length > 0 || filters.categoryIds.length > 0 || filters.orderStatus !== 'all';
  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border bg-muted/30">
      {filters.customer && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          Klient: {filters.customer.name}
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, customer: null })}
            className="hover:text-primary/70"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
      {filters.serviceNames.map((name, idx) => (
        <span
          key={filters.serviceIds[idx]}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
        >
          {name}
          <button
            type="button"
            onClick={() => {
              const newIds = filters.serviceIds.filter((_, i) => i !== idx);
              const newNames = filters.serviceNames.filter((_, i) => i !== idx);
              onFiltersChange({ ...filters, serviceIds: newIds, serviceNames: newNames });
            }}
            className="hover:text-primary/70"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.categoryIds.map(catId => (
        <span
          key={catId}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
        >
          {categoryNames?.[catId] || catId}
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, categoryIds: filters.categoryIds.filter(id => id !== catId) })}
            className="hover:text-primary/70"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.orderStatus !== 'all' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {filters.orderStatus === 'with_orders' ? 'Ze zleceniami' : 'Bez zleceń'}
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, orderStatus: 'all' })}
            className="hover:text-primary/70"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
};

const CustomersMapDrawer = ({ open, onClose, addresses, onCustomerClick, instanceId, filters, onFiltersChange, categoryNames }: CustomersMapDrawerProps) => {
  const isMobile = useIsMobile();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [52.0, 19.0],
      zoom: 7,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!open) {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
      prevAddressKeyRef.current = '';
      return;
    }
    const timer = setTimeout(() => {
      initMap();
      updateMarkers(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [open]);

  const prevAddressKeyRef = useRef<string>('');

  const updateMarkers = useCallback((shouldFitBounds = false) => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    addresses.forEach(addr => {
      const line2Parts = [addr.addressName, addr.city].filter(Boolean).join(', ');
      const tooltipHtml = `<div class="calendar-map-tooltip-content"><div class="cmt-line1">${addr.customerName}</div>${line2Parts ? `<div class="cmt-line2">${line2Parts}</div>` : ''}</div>`;

      const marker = L.marker([addr.lat, addr.lng], { icon: createMarkerIcon() })
        .bindTooltip(tooltipHtml, {
          permanent: false,
          direction: 'top',
          offset: [0, -4],
          className: 'calendar-map-tooltip',
          interactive: true,
        })
        .on('click', () => onCustomerClick(addr.customerId, addr.addressId))
        .addTo(map);

      marker.on('tooltipopen', () => {
        const el = marker.getTooltip()?.getElement();
        if (el) {
          el.style.cursor = 'pointer';
          el.onclick = (e) => { e.stopPropagation(); onCustomerClick(addr.customerId, addr.addressId); };
        }
      });

      markersRef.current.push(marker);
    });

    if (shouldFitBounds && addresses.length > 0) {
      const bounds = L.latLngBounds(addresses.map(a => [a.lat, a.lng] as [number, number]));
      const padding = isMobile ? 8 : 50;
      map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 15 });
    }
  }, [addresses, isMobile, onCustomerClick]);

  useEffect(() => {
    if (open && mapRef.current) {
      // Only fitBounds when the actual set of addresses changes (filters applied)
      const newKey = addresses.map(a => a.addressId).sort().join(',');
      const shouldFit = newKey !== prevAddressKeyRef.current;
      prevAddressKeyRef.current = newKey;
      updateMarkers(shouldFit);
    }
  }, [addresses, open, updateMarkers]);

  const handleServicesConfirm = (ids: string[], _duration: number, services: ServiceWithCategory[]) => {
    onFiltersChange({
      ...filters,
      serviceIds: ids,
      serviceNames: services.map(s => s.short_name || s.name),
    });
  };

  const handleRemoveService = (serviceId: string) => {
    const idx = filters.serviceIds.indexOf(serviceId);
    onFiltersChange({
      ...filters,
      serviceIds: filters.serviceIds.filter(id => id !== serviceId),
      serviceNames: filters.serviceNames.filter((_, i) => i !== idx),
    });
  };

  const handleMobileFiltersApply = (customer: SelectedCustomer | null, serviceIds: string[], serviceNames: string[], categoryIds: string[], orderStatus: OrderStatusFilter) => {
    onFiltersChange({ customer, serviceIds, serviceNames, categoryIds, orderStatus });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={v => { if (!v) onClose(); }}
      direction={isMobile ? 'bottom' : 'right'}
      modal={false}
      dismissible={false}
    >
      <DrawerContent
        hideHandle
        className={`z-[80] ${
          isMobile
            ? 'h-[100dvh] rounded-none bg-white'
            : 'ml-auto h-full w-full max-w-none rounded-none bg-white'
        }`}
      >
        {isMobile ? (
          // Mobile layout
          <div className="flex flex-col h-full">
             <div className="flex items-center justify-between p-3 border-b border-border bg-white">
              <h2 className="text-lg font-semibold">Mapa klientów</h2>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setMobileFiltersOpen(true)}>
                  <Filter className="w-4 h-4 mr-1" />
                  Filtry
                  {(filters.customer || filters.serviceIds.length > 0 || filters.categoryIds.length > 0 || filters.orderStatus !== 'all') && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {(filters.customer ? 1 : 0) + filters.serviceIds.length + filters.categoryIds.length + (filters.orderStatus !== 'all' ? 1 : 0)}
                    </span>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <ActiveFiltersBar filters={filters} onFiltersChange={onFiltersChange} categoryNames={categoryNames} />
            <div ref={containerRef} className="flex-1 w-full" style={{ minHeight: '300px' }} />

            <CustomerMapFiltersDrawer
              open={mobileFiltersOpen}
              onClose={() => setMobileFiltersOpen(false)}
              instanceId={instanceId}
              selectedCustomer={filters.customer}
              selectedServiceIds={filters.serviceIds}
              selectedServiceNames={filters.serviceNames}
              selectedCategoryIds={filters.categoryIds}
              selectedOrderStatus={filters.orderStatus}
              onApply={handleMobileFiltersApply}
            />
          </div>
        ) : (
          // Desktop layout: full-width header, then sidebar + map
          <div className="flex flex-col h-full">
            {/* Full-width header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-white">
              <h2 className="text-lg font-semibold text-foreground">Mapa klientów</h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ActiveFiltersBar filters={filters} onFiltersChange={onFiltersChange} categoryNames={categoryNames} />
            {/* Sidebar + map */}
            <div className="flex flex-row flex-1 min-h-0">
              <div className="min-w-[250px] w-[20%] border-r border-border flex flex-col bg-white">
                <div className="flex-1 overflow-y-auto">
                  <CustomerMapFilters
                    instanceId={instanceId}
                    selectedCustomer={filters.customer}
                    onCustomerSelect={(c) => onFiltersChange({ ...filters, customer: c })}
                    onCustomerClear={() => onFiltersChange({ ...filters, customer: null })}
                    selectedServiceIds={filters.serviceIds}
                    onServicesConfirm={handleServicesConfirm}
                    selectedServiceNames={filters.serviceNames}
                    onRemoveService={handleRemoveService}
                    selectedCategoryIds={filters.categoryIds}
                    onCategoryIdsChange={(ids) => onFiltersChange({ ...filters, categoryIds: ids })}
                    orderStatus={filters.orderStatus}
                    onOrderStatusChange={(status) => onFiltersChange({ ...filters, orderStatus: status })}
                  />
                </div>
              </div>
              <div ref={containerRef} className="flex-1 w-full" />
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default CustomersMapDrawer;
