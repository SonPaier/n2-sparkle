import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
    <div className="flex flex-wrap gap-1.5">
      {filters.customer && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-foreground shadow-sm">
          Klient: {filters.customer.name}
          <button type="button" onClick={() => onFiltersChange({ ...filters, customer: null })} className="hover:text-primary">
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
      {filters.serviceNames.map((name, idx) => (
        <span key={filters.serviceIds[idx]} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-foreground shadow-sm">
          {name}
          <button
            type="button"
            onClick={() => {
              const newIds = filters.serviceIds.filter((_, i) => i !== idx);
              const newNames = filters.serviceNames.filter((_, i) => i !== idx);
              onFiltersChange({ ...filters, serviceIds: newIds, serviceNames: newNames });
            }}
            className="hover:text-primary"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.categoryIds.map(catId => (
        <span key={catId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-foreground shadow-sm">
          {categoryNames?.[catId] || catId}
          <button type="button" onClick={() => onFiltersChange({ ...filters, categoryIds: filters.categoryIds.filter(id => id !== catId) })} className="hover:text-primary">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.orderStatus !== 'all' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-foreground shadow-sm">
          {filters.orderStatus === 'with_orders' ? 'Ze zleceniami' : 'Bez zleceń'}
          <button type="button" onClick={() => onFiltersChange({ ...filters, orderStatus: 'all' })} className="hover:text-primary">
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
  const prevAddressKeyRef = useRef<string>('');

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [52.0, 19.0],
      zoom: 7,
      scrollWheelZoom: true,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?lang=pl', {
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
    }, 150);
    return () => clearTimeout(timer);
  }, [open]);

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

  const activeFilterCount = (filters.customer ? 1 : 0) + filters.serviceIds.length + filters.categoryIds.length + (filters.orderStatus !== 'all' ? 1 : 0);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Map background */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Desktop: sidebar filters */}
      {!isMobile && (
        <div className="absolute left-0 top-0 w-[280px] h-full bg-card border-r border-border z-10 flex flex-col">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="font-semibold text-sm">Filtry</h3>
          </div>
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
      )}

      {/* Floating filter chips (desktop) */}
      {!isMobile && (
        <div className="absolute top-4 left-[296px] z-20">
          <ActiveFiltersBar filters={filters} onFiltersChange={onFiltersChange} categoryNames={categoryNames} />
        </div>
      )}

      {/* Mobile: floating filters button + chips */}
      {isMobile && (
        <div className="absolute top-4 left-4 right-14 z-20 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileFiltersOpen(true)}
            className="h-9 gap-1 text-xs bg-white text-foreground hover:bg-white/90 shadow-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtry
            {activeFilterCount > 0 && (
              <span className="ml-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <ActiveFiltersBar filters={filters} onFiltersChange={onFiltersChange} categoryNames={categoryNames} />
        </div>
      )}

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-white hover:bg-accent shadow-sm"
      >
        <X className="w-5 h-5 text-foreground" />
      </Button>

      {/* Mobile filters drawer */}
      {isMobile && (
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
      )}
    </div>,
    document.body
  );
};

export default CustomersMapDrawer;
