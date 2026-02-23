import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Phone, MessageSquare, ChevronLeft, ChevronRight, Plus, Trash2, MapPin } from 'lucide-react';
import { normalizeSearchQuery } from '@/lib/textUtils';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import CustomerEditDrawer from './CustomerEditDrawer';
import CustomersMapDrawer, { type CustomerMapAddress, type MapFilters } from './CustomersMapDrawer';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  company: string | null;
  nip: string | null;
  address: string | null;
  source: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_street_line2: string | null;
  billing_region: string | null;
  billing_country_code: string | null;
  country_code: string | null;
  default_currency: string | null;
  vat_eu_number: string | null;
  sales_notes: string | null;
  short_name: string | null;
  created_at: string | null;
}

export type { Customer };

interface CustomersViewProps {
  instanceId: string | null;
}

const ITEMS_PER_PAGE = 10;

const CustomersView = ({ instanceId }: CustomersViewProps) => {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addressMap, setAddressMap] = useState<Map<string, { id: string; name: string; city: string | null; lat: number | null; lng: number | null }[]>>(new Map());
  const [mapOpen, setMapOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clickedAddressId, setClickedAddressId] = useState<string | null>(null);

  // Map filter state
  const [mapFilters, setMapFilters] = useState<MapFilters>({ customer: null, serviceIds: [], serviceNames: [] });
  const [serviceCustomerIds, setServiceCustomerIds] = useState<Set<string> | null>(null);
  const [futureOrdersCounts, setFutureOrdersCounts] = useState<Map<string, number>>(new Map());

  const fetchCustomers = async () => {
    if (!instanceId) return;
    setLoading(true);
    
    const [customersRes, addressesRes] = await Promise.all([
      supabase.from('customers').select('*').eq('instance_id', instanceId).order('name'),
      supabase.from('customer_addresses').select('id, customer_id, name, city, lat, lng').eq('instance_id', instanceId),
    ]);

    if (!customersRes.error && customersRes.data) {
      setCustomers(customersRes.data as Customer[]);
    }

    const map = new Map<string, { id: string; name: string; city: string | null; lat: number | null; lng: number | null }[]>();
    if (!addressesRes.error && addressesRes.data) {
      for (const addr of addressesRes.data) {
        const list = map.get(addr.customer_id) || [];
        list.push({ id: addr.id, name: addr.name, city: addr.city, lat: addr.lat, lng: addr.lng });
        map.set(addr.customer_id, list);
      }
    }
    setAddressMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [instanceId]);

  // Fetch future orders count per address
  useEffect(() => {
    if (!instanceId) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const fetchFutureCounts = async () => {
      const { data } = await supabase
        .from('calendar_items')
        .select('customer_address_id')
        .eq('instance_id', instanceId)
        .not('customer_address_id', 'is', null)
        .gt('item_date', today);
      const counts = new Map<string, number>();
      data?.forEach(item => {
        if (item.customer_address_id) {
          counts.set(item.customer_address_id, (counts.get(item.customer_address_id) || 0) + 1);
        }
      });
      setFutureOrdersCounts(counts);
    };
    fetchFutureCounts();
  }, [instanceId]);

  // Fetch customer IDs associated with selected services
  useEffect(() => {
    if (!instanceId || mapFilters.serviceIds.length === 0) {
      setServiceCustomerIds(null);
      return;
    }

    const fetchServiceCustomers = async () => {
      // Find calendar_item_ids that have any of the selected services
      const { data: cisData } = await supabase
        .from('calendar_item_services')
        .select('calendar_item_id')
        .eq('instance_id', instanceId)
        .in('service_id', mapFilters.serviceIds);

      if (!cisData || cisData.length === 0) {
        setServiceCustomerIds(new Set());
        return;
      }

      const calendarItemIds = [...new Set(cisData.map(r => r.calendar_item_id))];

      // Fetch customer_ids from those calendar items
      const { data: ciData } = await supabase
        .from('calendar_items')
        .select('customer_id')
        .eq('instance_id', instanceId)
        .in('id', calendarItemIds)
        .not('customer_id', 'is', null);

      const ids = new Set<string>();
      ciData?.forEach(r => { if (r.customer_id) ids.add(r.customer_id); });
      setServiceCustomerIds(ids);
    };

    fetchServiceCustomers();
  }, [instanceId, mapFilters.serviceIds]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const normalizedQuery = normalizeSearchQuery(query);
      result = result.filter(c => {
        if (
          c.name.toLowerCase().includes(query) ||
          normalizeSearchQuery(c.phone).includes(normalizedQuery) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          (c.nip && normalizeSearchQuery(c.nip).includes(normalizedQuery))
        ) return true;

        const addrs = addressMap.get(c.id);
        if (addrs) {
          return addrs.some(a =>
            a.name.toLowerCase().includes(query) ||
            (a.city && a.city.toLowerCase().includes(query))
          );
        }
        return false;
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    return result;
  }, [customers, searchQuery, addressMap]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // All map addresses (unfiltered)
  const allMapAddresses = useMemo<CustomerMapAddress[]>(() => {
    const result: CustomerMapAddress[] = [];
    for (const customer of customers) {
      const addrs = addressMap.get(customer.id);
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.lat != null && addr.lng != null) {
          result.push({
            lat: addr.lat,
            lng: addr.lng,
            customerName: customer.name,
            addressName: addr.name,
            city: addr.city,
            customerId: customer.id,
            addressId: addr.id,
            futureOrdersCount: futureOrdersCounts.get(addr.id) || 0,
          });
        }
      }
    }
    return result;
  }, [customers, addressMap, futureOrdersCounts]);

  // Filtered map addresses
  const filteredMapAddresses = useMemo<CustomerMapAddress[]>(() => {
    let result = allMapAddresses;

    // Filter by customer
    if (mapFilters.customer) {
      result = result.filter(a => a.customerId === mapFilters.customer!.id);
    }

    // Filter by services (customer IDs who had those services)
    if (serviceCustomerIds !== null) {
      result = result.filter(a => serviceCustomerIds.has(a.customerId));
    }

    return result;
  }, [allMapAddresses, mapFilters.customer, serviceCustomerIds]);

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleSms = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `sms:${phone}`;
  };

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsAddMode(true);
  };

  const handleCloseDrawer = () => {
    setSelectedCustomer(null);
    setIsAddMode(false);
  };

  const handleDeleteClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerToDelete.id);
      
      if (error) throw error;
      
      toast.success('Klient usunięty');
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Błąd usuwania klienta');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Ładowanie...
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Klienci</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMapOpen(true)}>
            <MapPin className="w-4 h-4 mr-1" />
            Mapa
          </Button>
          <Button onClick={handleAddCustomer}>
            <Plus className="w-4 h-4 mr-1" />
            Dodaj
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="sm:static sticky top-0 z-20 bg-background pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, telefonie, email, firmie, NIP, adresie..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer list */}
      <div>
        {paginatedCustomers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? 'Brak wyników' : 'Brak klientów'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {paginatedCustomers.map(customer => (
              <div
                key={customer.id}
                onClick={() => {
                  setIsAddMode(false);
                  setSelectedCustomer(customer);
                }}
                className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer hover:border-primary/30 bg-card rounded-lg border border-border shadow-sm"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-medium text-foreground">
                    {customer.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPhoneDisplay(customer.phone)}
                  </div>
                  {customer.company && (
                    <div className="text-xs text-muted-foreground">
                      {customer.company}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={e => handleSms(customer.phone, e)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={e => handleCall(customer.phone, e)}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                    onClick={e => handleDeleteClick(customer, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} z {filteredCustomers.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3 min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Customer Edit Drawer */}
      <CustomerEditDrawer
        customer={selectedCustomer}
        instanceId={instanceId}
        open={!!selectedCustomer || isAddMode}
        onClose={handleCloseDrawer}
        onCustomerUpdated={fetchCustomers}
        isAddMode={isAddMode}
        prefilledAddressId={clickedAddressId || undefined}
        prefilledServiceIds={mapFilters.serviceIds.length > 0 ? mapFilters.serviceIds : undefined}
        prefilledServiceNames={mapFilters.serviceNames.length > 0 ? mapFilters.serviceNames : undefined}
        onNewOrderCreated={() => {
          handleCloseDrawer();
          fetchCustomers();
        }}
      />

      {/* Customers Map Drawer */}
      <CustomersMapDrawer
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        addresses={filteredMapAddresses}
        instanceId={instanceId || ''}
        filters={mapFilters}
        onFiltersChange={setMapFilters}
        onCustomerClick={(customerId, addressId) => {
          const customer = customers.find(c => c.id === customerId);
          if (customer) {
            setIsAddMode(false);
            setSelectedCustomer(customer);
            setClickedAddressId(addressId);
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usunąć klienta?"
        description={`Czy na pewno chcesz usunąć klienta "${customerToDelete?.name}"? Ta operacja jest nieodwracalna.`}
        confirmLabel="Usuń"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
};

export default CustomersView;
