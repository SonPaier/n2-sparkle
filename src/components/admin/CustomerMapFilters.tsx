import { useState, useEffect } from 'react';
import { X, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import CustomerSearchInput, { type SelectedCustomer } from './CustomerSearchInput';
import type { OrderStatusFilter } from './CustomersMapDrawer';
import ServiceSelectionDrawer, { type ServiceWithCategory } from './ServiceSelectionDrawer';
import { useCustomerCategories, type CustomerCategory } from '@/hooks/useCustomerCategories';

interface CustomerMapFiltersProps {
  instanceId: string;
  selectedCustomer: SelectedCustomer | null;
  onCustomerSelect: (customer: SelectedCustomer) => void;
  onCustomerClear: () => void;
  selectedServiceIds: string[];
  onServicesConfirm: (ids: string[], duration: number, services: ServiceWithCategory[]) => void;
  selectedServiceNames: string[];
  onRemoveService: (serviceId: string) => void;
  selectedCategoryIds: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  orderStatus: OrderStatusFilter;
  onOrderStatusChange: (status: OrderStatusFilter) => void;
}

const CustomerMapFilters = ({
  instanceId,
  selectedCustomer,
  onCustomerSelect,
  onCustomerClear,
  selectedServiceIds,
  onServicesConfirm,
  selectedServiceNames,
  onRemoveService,
  selectedCategoryIds,
  onCategoryIdsChange,
  orderStatus,
  onOrderStatusChange,
}: CustomerMapFiltersProps) => {
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const { categories } = useCustomerCategories(instanceId);

  const toggleCategory = (catId: string) => {
    if (selectedCategoryIds.includes(catId)) {
      onCategoryIdsChange(selectedCategoryIds.filter(id => id !== catId));
    } else {
      onCategoryIdsChange([...selectedCategoryIds, catId]);
    }
  };

  return (
    <div className="space-y-5 p-4">
      {/* Customer filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Klient</label>
        <CustomerSearchInput
          instanceId={instanceId}
          selectedCustomer={selectedCustomer}
          onSelect={onCustomerSelect}
          onClear={onCustomerClear}
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Kategorie klientów</label>
          <div className="space-y-1.5">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                <Checkbox
                  id={`map-cat-${cat.id}`}
                  checked={selectedCategoryIds.includes(cat.id)}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <Label htmlFor={`map-cat-${cat.id}`} className="text-sm cursor-pointer">
                  {cat.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Usługi</label>
        <Button
          variant="outline"
          className="w-full justify-start font-normal bg-white text-foreground"
          onClick={() => setServiceDrawerOpen(true)}
        >
          <ListFilter className="w-4 h-4 mr-2" />
          {selectedServiceIds.length > 0
            ? `Wybrano: ${selectedServiceIds.length}`
            : 'Wybierz usługi...'}
        </Button>

      </div>

      {/* Order status filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Status zleceń</label>
        <RadioGroup value={orderStatus} onValueChange={(v) => onOrderStatusChange(v as OrderStatusFilter)}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="all" id="map-order-all" />
            <Label htmlFor="map-order-all" className="text-sm cursor-pointer">Wszyscy</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="with_orders" id="map-order-with" />
            <Label htmlFor="map-order-with" className="text-sm cursor-pointer">Ze zleceniami</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="without_orders" id="map-order-without" />
            <Label htmlFor="map-order-without" className="text-sm cursor-pointer">Bez zleceń</Label>
          </div>
        </RadioGroup>
      </div>

      <ServiceSelectionDrawer
        open={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        instanceId={instanceId}
        selectedServiceIds={selectedServiceIds}
        onConfirm={onServicesConfirm}
        hideSelectedSection={true}
        hidePricesAndDuration={true}
      />
    </div>
  );
};

export default CustomerMapFilters;
