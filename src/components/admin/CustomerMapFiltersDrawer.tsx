import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import CustomerMapFilters from './CustomerMapFilters';
import type { SelectedCustomer } from './CustomerSearchInput';
import type { ServiceWithCategory } from './ServiceSelectionDrawer';
import type { OrderStatusFilter } from './CustomersMapDrawer';

interface CustomerMapFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  selectedCustomer: SelectedCustomer | null;
  selectedServiceIds: string[];
  selectedServiceNames: string[];
  selectedCategoryIds: string[];
  selectedOrderStatus: OrderStatusFilter;
  onApply: (customer: SelectedCustomer | null, serviceIds: string[], serviceNames: string[], categoryIds: string[], orderStatus: OrderStatusFilter) => void;
}

const CustomerMapFiltersDrawer = ({
  open,
  onClose,
  instanceId,
  selectedCustomer,
  selectedServiceIds,
  selectedServiceNames,
  selectedCategoryIds,
  selectedOrderStatus,
  onApply,
}: CustomerMapFiltersDrawerProps) => {
  const [tempCustomer, setTempCustomer] = useState<SelectedCustomer | null>(selectedCustomer);
  const [tempServiceIds, setTempServiceIds] = useState<string[]>(selectedServiceIds);
  const [tempServiceNames, setTempServiceNames] = useState<string[]>(selectedServiceNames);
  const [tempCategoryIds, setTempCategoryIds] = useState<string[]>(selectedCategoryIds);
  const [tempOrderStatus, setTempOrderStatus] = useState<OrderStatusFilter>(selectedOrderStatus);

  useEffect(() => {
    if (open) {
      setTempCustomer(selectedCustomer);
      setTempServiceIds(selectedServiceIds);
      setTempServiceNames(selectedServiceNames);
      setTempCategoryIds(selectedCategoryIds);
      setTempOrderStatus(selectedOrderStatus);
    }
  }, [open, selectedCustomer, selectedServiceIds, selectedServiceNames, selectedCategoryIds, selectedOrderStatus]);

  const handleServicesConfirm = (ids: string[], _duration: number, services: ServiceWithCategory[]) => {
    setTempServiceIds(ids);
    setTempServiceNames(services.map(s => s.short_name || s.name));
  };

  const handleRemoveService = (serviceId: string) => {
    const idx = tempServiceIds.indexOf(serviceId);
    setTempServiceIds(prev => prev.filter(id => id !== serviceId));
    if (idx !== -1) {
      setTempServiceNames(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSave = () => {
    onApply(tempCustomer, tempServiceIds, tempServiceNames, tempCategoryIds, tempOrderStatus);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={v => { if (!v) onClose(); }} direction="right">
      <DrawerContent className="ml-auto h-full w-full sm:w-[550px] sm:max-w-[550px] max-w-none rounded-none bg-white">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-lg font-semibold">Filtry</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <CustomerMapFilters
            instanceId={instanceId}
            selectedCustomer={tempCustomer}
            onCustomerSelect={setTempCustomer}
            onCustomerClear={() => setTempCustomer(null)}
            selectedServiceIds={tempServiceIds}
            onServicesConfirm={handleServicesConfirm}
            selectedServiceNames={tempServiceNames}
            onRemoveService={handleRemoveService}
            selectedCategoryIds={tempCategoryIds}
            onCategoryIdsChange={setTempCategoryIds}
            orderStatus={tempOrderStatus}
            onOrderStatusChange={setTempOrderStatus}
          />
        </div>

        <div className="border-t p-4 bg-background">
          <Button onClick={handleSave} className="w-full" size="lg">
            Zapisz
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CustomerMapFiltersDrawer;
