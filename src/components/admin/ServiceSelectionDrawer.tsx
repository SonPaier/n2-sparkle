import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Check, Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Service {
  id: string;
  name: string;
  short_name?: string | null;
  category_id: string | null;
  duration_minutes: number | null;
  price: number | null;
  sort_order: number | null;
  category_prices_are_net?: boolean;
}

interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number | null;
  prices_are_net: boolean;
}

export interface ServiceWithCategory {
  id: string;
  name: string;
  short_name?: string | null;
  category_id: string | null;
  duration_minutes: number | null;
  price: number | null;
  category_prices_are_net?: boolean;
  unit?: string;
}

interface ServiceSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  selectedServiceIds: string[];
  onConfirm: (serviceIds: string[], totalDuration: number, services: ServiceWithCategory[]) => void;
  hideSelectedSection?: boolean;
  hidePricesAndDuration?: boolean;
}

// Round to nearest 5 PLN
const roundToNearest5 = (value: number): number => {
  return Math.round(value / 5) * 5;
};

// Convert net price to brutto (gross) and round
const netToBrutto = (netPrice: number): number => {
  const brutto = netPrice * 1.23;
  return roundToNearest5(brutto);
};

const ServiceSelectionDrawer = ({
  open,
  onClose,
  instanceId,
  selectedServiceIds: initialSelectedIds,
  onConfirm,
  hideSelectedSection = false,
  hidePricesAndDuration = false,
}: ServiceSelectionDrawerProps) => {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset selected and search when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds);
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [open, initialSelectedIds]);

  // Fetch services and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;

      setLoading(true);

      const [servicesRes, categoriesRes] = await Promise.all([
        supabase
          .from('unified_services')
          .select('id, name, short_name, category_id, duration_minutes, price, sort_order, unit')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('unified_categories')
          .select('id, name, sort_order, prices_are_net')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order'),
      ]);

      if (servicesRes.data && categoriesRes.data) {
        const categoryNetMap = new Map<string, boolean>();
        categoriesRes.data.forEach(cat => {
          categoryNetMap.set(cat.id, cat.prices_are_net || false);
        });

        const enrichedServices = servicesRes.data.map(s => ({
          ...s,
          category_prices_are_net: s.category_id ? categoryNetMap.get(s.category_id) || false : false,
        }));

        setServices(enrichedServices);
        setCategories(categoriesRes.data);
      } else {
        if (servicesRes.data) setServices(servicesRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
      }

      setLoading(false);
    };

    fetchData();
  }, [open, instanceId]);

  // Parse search tokens and find matching services
  const { matchingServices } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { matchingServices: [] };
    }

    const tokens = searchQuery.toUpperCase().split(/\s+/).filter(Boolean);
    const matched: { service: Service; token: string }[] = [];

    tokens.forEach(token => {
      let found = services.find(s =>
        s.short_name?.toUpperCase() === token &&
        !selectedIds.includes(s.id) &&
        !matched.some(m => m.service.id === s.id)
      );

      if (!found) {
        found = services.find(s =>
          s.short_name?.toUpperCase().startsWith(token) &&
          !selectedIds.includes(s.id) &&
          !matched.some(m => m.service.id === s.id)
        );
      }

      if (!found) {
        found = services.find(s =>
          s.name.toUpperCase().includes(token) &&
          !selectedIds.includes(s.id) &&
          !matched.some(m => m.service.id === s.id)
        );
      }

      if (found) {
        matched.push({ service: found, token });
      }
    });

    return { matchingServices: matched };
  }, [searchQuery, services, selectedIds]);

  // Get selected services with details
  const selectedServices = useMemo(() => {
    return selectedIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined);
  }, [selectedIds, services]);

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups: { category: ServiceCategory; services: Service[] }[] = [];

    categories.forEach(category => {
      let categoryServices = services.filter(s => s.category_id === category.id);

      if (searchQuery.trim()) {
        const query = searchQuery.toUpperCase();
        categoryServices = categoryServices.filter(s =>
          s.short_name?.toUpperCase().includes(query) ||
          s.name.toUpperCase().includes(query)
        );
      }

      groups.push({ category, services: categoryServices });
    });

    return groups;
  }, [services, categories, searchQuery]);

  // Get price for service (always returns brutto)
  const getPrice = (service: Service): number | null => {
    if (service.price === null) return null;
    if (service.category_prices_are_net) {
      return netToBrutto(service.price);
    }
    return service.price;
  };

  // Get duration
  const getDuration = (service: Service): number => {
    return service.duration_minutes || 60;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}min`;
  };

  // Format price
  const formatPrice = (price: number | null): string => {
    if (price === null) return 'Cena zmienna';
    return `${price.toFixed(0)} zł`;
  };

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Add service from matching chips
  const addFromMatch = (service: Service, token: string) => {
    setSelectedIds(prev => [...prev, service.id]);
    const newQuery = searchQuery
      .toUpperCase()
      .split(/\s+/)
      .filter(t => t !== token)
      .join(' ');
    setSearchQuery(newQuery);
    searchInputRef.current?.focus();
  };

  // Remove selected service
  const removeService = (serviceId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== serviceId));
  };

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return selectedIds.reduce((total, id) => {
      const service = services.find(s => s.id === id);
      return total + (service ? getDuration(service) : 0);
    }, 0);
  }, [selectedIds, services]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    let total = 0;
    let hasVariablePrice = false;

    selectedIds.forEach(id => {
      const service = services.find(s => s.id === id);
      if (service) {
        const price = getPrice(service);
        if (price !== null) {
          total += price;
        } else {
          hasVariablePrice = true;
        }
      }
    });

    return { total, hasVariablePrice };
  }, [selectedIds, services]);

  // Handle confirm
  const handleConfirm = () => {
    const selectedWithCategory: ServiceWithCategory[] = selectedIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined)
      .map(s => ({
        id: s.id,
        name: s.name,
        short_name: s.short_name,
        category_id: s.category_id,
        duration_minutes: s.duration_minutes,
        price: s.price,
        category_prices_are_net: s.category_prices_are_net,
        unit: (s as any).unit || 'szt.',
      }));

    onConfirm(selectedIds, totalDuration, selectedWithCategory);
    onClose();
  };

  // Get display label for service chip
  const getChipLabel = (service: Service): string => {
    if (service.short_name) return service.short_name;
    return service.name.length > 12 ? service.name.substring(0, 10) + '...' : service.name;
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        hideOverlay
        hideCloseButton
        className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)] z-[1000] bg-white"
        onFocusOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader
          className="border-b px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            Wybierz usługi i produkty
          </SheetTitle>
        </SheetHeader>

        {/* Search Section */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj usługi..."
              className="pl-9 pr-9 h-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Matching Services Chips */}
          {matchingServices.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Pasujące usługi</p>
              <div className="flex flex-wrap gap-2">
                {matchingServices.map(({ service, token }) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => addFromMatch(service, token)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors min-h-[36px]"
                  >
                    <span className="font-bold">{service.short_name || service.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No matches */}
          {searchQuery.trim() && matchingServices.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak pasujących usług</p>
          )}

        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-4">
              {groupedServices.map(({ category, services: categoryServices }) => {
                if (categoryServices.length === 0) return null;

                return (
                  <div key={category.id}>
                    <div className="py-2 px-4 bg-background">
                      <p className="text-sm font-semibold text-foreground text-center uppercase tracking-wide">
                        {category.name}
                      </p>
                    </div>

                    {categoryServices.map((service) => {
                      const isSelected = selectedIds.includes(service.id);
                      const price = getPrice(service);
                      const duration = getDuration(service);

                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => toggleService(service.id)}
                          className={cn(
                            "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                            isSelected ? "bg-primary/5" : "hover:bg-primary/5"
                          )}
                        >
                          <div className="flex-1 text-left">
                            {service.short_name ? (
                              <>
                                <p className="font-bold text-primary">{service.short_name}</p>
                                <p className="text-muted-foreground" style={{ fontSize: '11px', lineHeight: '1.3' }}>{service.name}</p>
                              </>
                            ) : (
                              <p className="font-medium text-foreground">{service.name}</p>
                            )}
                          </div>

                          {!hidePricesAndDuration && (
                            <div className="text-right mr-4">
                              <p className="font-semibold text-foreground">{formatPrice(price)}</p>
                              <p className="text-xs text-muted-foreground">{formatDuration(duration)}</p>
                            </div>
                          )}

                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/40"
                          )}>
                            {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="border-t px-4 py-4 shrink-0 bg-white">
          {!hidePricesAndDuration && (
            <div className="mb-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">
                  Wybrano: {selectedIds.length}
                </span>
                {totalDuration > 0 && (
                  <span className="text-lg font-bold text-foreground">
                    {formatDuration(totalDuration)}
                  </span>
                )}
              </div>
              {selectedIds.length > 0 && (
                <div className="text-right">
                  <span className="text-xl font-bold text-foreground">
                    {totalPrice.hasVariablePrice ? 'od ' : ''}
                    {totalPrice.total.toFixed(0)} zł
                  </span>
                </div>
              )}
            </div>
          )}
          {hidePricesAndDuration && selectedIds.length > 0 && (
            <div className="mb-3">
              <span className="text-lg font-semibold text-foreground">
                Wybrano: {selectedIds.length}
              </span>
            </div>
          )}
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="w-full"
            size="lg"
          >
            Zatwierdź
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ServiceSelectionDrawer;
