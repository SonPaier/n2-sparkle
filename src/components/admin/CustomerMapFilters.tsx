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
          className="w-full justify-start text-muted-foreground font-normal"
          onClick={() => setServiceDrawerOpen(true)}
        >
          <ListFilter className="w-4 h-4 mr-2" />
          {selectedServiceIds.length > 0
            ? `Wybrano: ${selectedServiceIds.length}`
            : 'Wybierz usługi...'}
        </Button>

        {/* Selected service chips */}
        {selectedServiceNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedServiceNames.map((name, idx) => (
              <span
                key={selectedServiceIds[idx]}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              >
                {name}
                <button
                  type="button"
                  onClick={() => onRemoveService(selectedServiceIds[idx])}
                  className="hover:text-primary/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <ServiceSelectionDrawer
        open={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        instanceId={instanceId}
        selectedServiceIds={selectedServiceIds}
        onConfirm={onServicesConfirm}
        hideSelectedSection={false}
      />
    </div>
  );
};

export default CustomerMapFilters;
