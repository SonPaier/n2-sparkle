import { useState } from 'react';
import { X, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSearchInput, { type SelectedCustomer } from './CustomerSearchInput';
import ServiceSelectionDrawer, { type ServiceWithCategory } from './ServiceSelectionDrawer';

interface CustomerMapFiltersProps {
  instanceId: string;
  selectedCustomer: SelectedCustomer | null;
  onCustomerSelect: (customer: SelectedCustomer) => void;
  onCustomerClear: () => void;
  selectedServiceIds: string[];
  onServicesConfirm: (ids: string[], duration: number, services: ServiceWithCategory[]) => void;
  selectedServiceNames: string[];
  onRemoveService: (serviceId: string) => void;
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
}: CustomerMapFiltersProps) => {
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);

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
