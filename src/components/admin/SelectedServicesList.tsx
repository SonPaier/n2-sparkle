import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ServiceWithCategory {
  id: string;
  name: string;
  short_name?: string | null;
  duration_minutes: number | null;
  price: number | null;
  category_id?: string | null;
  category_prices_are_net?: boolean;
  unit?: string;
}

export interface ServiceItem {
  service_id: string;
  custom_price: number | null;
  quantity: number;
  name?: string;
  short_name?: string | null;
  price?: number | null;
  unit?: string;
}

interface SelectedServicesListProps {
  services: ServiceWithCategory[];
  selectedServiceIds: string[];
  serviceItems: ServiceItem[];
  onRemoveService: (serviceId: string) => void;
  onPriceChange: (serviceId: string, price: number | null) => void;
  onQuantityChange: (serviceId: string, qty: number) => void;
  onAddMore: () => void;
  onTotalPriceChange?: (newTotal: number) => void;
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

const SelectedServicesList = ({
  services,
  selectedServiceIds,
  serviceItems,
  onRemoveService,
  onPriceChange,
  onQuantityChange,
  onAddMore,
  onTotalPriceChange,
}: SelectedServicesListProps) => {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');

  // Get base price for a service
  const getBasePrice = (service: ServiceWithCategory): number => {
    let price = service.price || 0;
    if (service.category_prices_are_net) {
      price = netToBrutto(price);
    }
    return price;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}min`;
  };

  // Get displayed price (custom or calculated)
  const getDisplayedPrice = (serviceId: string, service: ServiceWithCategory): number => {
    const item = serviceItems.find(si => si.service_id === serviceId);
    if (item?.custom_price !== null && item?.custom_price !== undefined) {
      return item.custom_price;
    }
    return getBasePrice(service);
  };

  const getQuantity = (serviceId: string): number => {
    const item = serviceItems.find(si => si.service_id === serviceId);
    return item?.quantity ?? 1;
  };

  const getUnit = (serviceId: string, service: ServiceWithCategory): string => {
    const item = serviceItems.find(si => si.service_id === serviceId);
    return item?.unit || service.unit || 'szt.';
  };

  // Get selected services with details
  const selectedServices = selectedServiceIds
    .map(id => services.find(s => s.id === id))
    .filter((s): s is ServiceWithCategory => s !== undefined);

  // Calculate totals
  const totalDuration = selectedServices.reduce((total, service) => {
    return total + (service.duration_minutes || 60);
  }, 0);

  const totalPrice = selectedServices.reduce((total, service) => {
    const qty = getQuantity(service.id);
    return total + getDisplayedPrice(service.id, service) * qty;
  }, 0);

  // Recalculate and notify parent of total
  const recalcTotal = (changedServiceId: string, newPrice?: number | null, newQty?: number) => {
    if (!onTotalPriceChange) return;
    const newTotal = selectedServices.reduce((total, s) => {
      const price = s.id === changedServiceId && newPrice !== undefined
        ? (newPrice || 0)
        : getDisplayedPrice(s.id, s);
      const qty = s.id === changedServiceId && newQty !== undefined
        ? newQty
        : getQuantity(s.id);
      return total + price * qty;
    }, 0);
    onTotalPriceChange(newTotal);
  };

  if (selectedServices.length === 0) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={onAddMore}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Dodaj usługi lub produkty
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 rounded-lg overflow-hidden">
        {selectedServices.map((service) => {
          const displayedPrice = getDisplayedPrice(service.id, service);
          const hasCustomPrice = serviceItems.find(si => si.service_id === service.id)?.custom_price !== null;
          const duration = service.duration_minutes;
          const qty = getQuantity(service.id);
          const unit = getUnit(service.id, service);
          const lineTotal = displayedPrice * qty;
          const isEditingPrice = editingPriceId === service.id;
          const isEditingQty = editingQtyId === service.id;

          return (
            <div key={service.id} className="bg-background rounded-lg border border-border">
              {/* Line 1: Name, duration, delete */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {service.short_name && (
                      <span className="text-primary font-bold mr-1.5">{service.short_name}</span>
                    )}
                    <span className={service.short_name ? "text-[15px]" : ""}>{service.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveService(service.id)}
                  className="p-1 rounded-full hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Line 2: qty × price = total */}
              <div className="flex items-center gap-1 px-3 pb-2.5 text-sm">
                {/* Quantity */}
                {isEditingQty ? (
                  <Input
                    type="number"
                    value={editingQtyValue}
                    onChange={(e) => {
                      setEditingQtyValue(e.target.value);
                      const val = parseFloat(e.target.value) || 1;
                      onQuantityChange(service.id, val);
                      recalcTotal(service.id, undefined, val);
                    }}
                    onBlur={() => {
                      if (!editingQtyValue || parseFloat(editingQtyValue) <= 0) {
                        onQuantityChange(service.id, 1);
                      }
                      setEditingQtyId(null);
                      setEditingQtyValue('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingQtyId(null);
                        setEditingQtyValue('');
                      }
                    }}
                    className="w-14 h-7 text-center text-sm font-semibold bg-accent border-primary/30"
                    min={0.01}
                    step={1}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQtyId(service.id);
                      setEditingQtyValue(qty.toString());
                    }}
                    className="px-1.5 py-0.5 rounded text-sm font-semibold min-w-[28px] hover:bg-primary/5 transition-colors"
                  >
                    {qty}
                  </button>
                )}
                <span className="text-muted-foreground text-xs">{unit}</span>
                <span className="text-muted-foreground mx-0.5">×</span>

                {/* Price */}
                {isEditingPrice ? (
                  <Input
                    type="number"
                    value={editingPriceValue}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      setEditingPriceValue(rawValue);
                      const value = rawValue === '' ? null : parseFloat(rawValue);
                      onPriceChange(service.id, value);
                      recalcTotal(service.id, value, undefined);
                    }}
                    onBlur={() => {
                      if (editingPriceValue === '') {
                        onPriceChange(service.id, null);
                      }
                      setEditingPriceId(null);
                      setEditingPriceValue('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingPriceId(null);
                        setEditingPriceValue('');
                      }
                    }}
                    className={cn(
                      "w-20 h-7 text-right text-sm font-semibold",
                      hasCustomPrice && "bg-accent border-primary/30"
                    )}
                    min={0}
                    step={5}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPriceId(service.id);
                      setEditingPriceValue(displayedPrice.toString());
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-sm font-semibold min-w-[40px] hover:bg-primary/5 transition-colors",
                      hasCustomPrice && "text-primary"
                    )}
                  >
                    {displayedPrice}
                  </button>
                )}
                <span className="text-muted-foreground text-xs">zł</span>

                <span className="text-muted-foreground mx-0.5">=</span>
                <span className="font-bold text-sm">{lineTotal.toFixed(0)} zł</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onAddMore}
        >
          <Plus className="w-4 h-4 mr-1" />
          Dodaj
        </Button>

        <div className="text-right">
          <p className="text-lg font-bold">
            {totalPrice.toFixed(0)} zł
          </p>
        </div>
      </div>
    </div>
  );
};

export default SelectedServicesList;
