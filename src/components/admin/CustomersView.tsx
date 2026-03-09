import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Phone, MessageSquare, Plus, Trash2, MapPin, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeSearchQuery } from '@/lib/textUtils';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import CustomerEditDrawer from './CustomerEditDrawer';
import CustomersMapDrawer, { type CustomerMapAddress, type MapFilters } from './CustomersMapDrawer';
import { CustomerCategoryManagementDialog } from './CustomerCategoryManagementDialog';
import { useCustomerCategories } from '@/hooks/useCustomerCategories';
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
  additional_contacts: any[] | null;
}

export type { Customer };

interface CustomersViewProps {
  instanceId: string | null;
}

const ITEMS_PER_PAGE = 10;

interface AddressInfo {
  id: string;
  name: string;
  city: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
}

const formatAddressShort = (addr: AddressInfo) => {
  const parts = [addr.city, addr.street].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : addr.name;
};

const CustomersView = ({ instanceId }: CustomersViewProps) => {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addressMap, setAddressMap] = useState<Map<string, AddressInfo[]>>(new Map());
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
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Customer categories
  const { categories: customerCategories, customerCounts, customerCategoryMap, refetch: refetchCategories } = useCustomerCategories(instanceId);

  // Map filter state
  const [mapFilters, setMapFilters] = useState<MapFilters>({ customer: null, serviceIds: [], serviceNames: [], categoryIds: [], orderStatus: 'all' });
  const [serviceCustomerIds, setServiceCustomerIds] = useState<Set<string> | null>(null);
  const [orderCustomerIds, setOrderCustomerIds] = useState<Set<string> | null>(null);

  const fetchCustomers = async () => {
    if (!instanceId) return;
    setLoading(true);
    
    const [customersRes, addressesRes] = await Promise.all([
      supabase.from('customers').select('*').eq('instance_id', instanceId).order('name'),
      supabase.from('customer_addresses').select('id, customer_id, name, city, street, lat, lng').eq('instance_id', instanceId),
    ]);

    if (!customersRes.error && customersRes.data) {
      setCustomers(customersRes.data as Customer[]);
    }

    const map = new Map<string, AddressInfo[]>();
    if (!addressesRes.error && addressesRes.data) {
      for (const addr of addressesRes.data) {
        const list = map.get(addr.customer_id) || [];
        list.push({ id: addr.id, name: addr.name, city: addr.city, street: addr.street, lat: addr.lat, lng: addr.lng });
        map.set(addr.customer_id, list);
      }
    }
    setAddressMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [instanceId]);

  // Fetch customer IDs associated with selected services
  useEffect(() => {
    if (!instanceId || mapFilters.serviceIds.length === 0) {
      setServiceCustomerIds(null);
      return;
    }

    const fetchServiceCustomers = async () => {
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

  // Fetch customer IDs that have calendar items (for order status filter)
  useEffect(() => {
    if (!instanceId || mapFilters.orderStatus === 'all') {
      setOrderCustomerIds(null);
      return;
    }

    const fetchOrderCustomers = async () => {
      const { data } = await supabase
        .from('calendar_items')
        .select('customer_id')
        .eq('instance_id', instanceId)
        .not('customer_id', 'is', null);

      const ids = new Set<string>();
      data?.forEach(r => { if (r.customer_id) ids.add(r.customer_id); });
      setOrderCustomerIds(ids);
    };

    fetchOrderCustomers();
  }, [instanceId, mapFilters.orderStatus]);

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
            (a.city && a.city.toLowerCase().includes(query)) ||
            (a.street && a.street.toLowerCase().includes(query))
          );
        }
        return false;
      });
    }

    // Filter by selected categories
    if (selectedCategoryIds.length > 0) {
      const selectedSet = new Set(selectedCategoryIds);
      result = result.filter(c => {
        const cats = customerCategoryMap.get(c.id);
        return cats && cats.some(catId => selectedSet.has(catId));
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    return result;
  }, [customers, searchQuery, addressMap, selectedCategoryIds, customerCategoryMap]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // All map addresses
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
          });
        }
      }
    }
    return result;
  }, [customers, addressMap]);

  // Filtered map addresses
  const filteredMapAddresses = useMemo<CustomerMapAddress[]>(() => {
    let result = allMapAddresses;
    if (mapFilters.customer) {
      result = result.filter(a => a.customerId === mapFilters.customer!.id);
    }
    if (serviceCustomerIds !== null) {
      result = result.filter(a => serviceCustomerIds.has(a.customerId));
    }
    // Filter by map category filter
    if (mapFilters.categoryIds && mapFilters.categoryIds.length > 0) {
      const catSet = new Set(mapFilters.categoryIds);
      result = result.filter(a => {
        const cats = customerCategoryMap.get(a.customerId);
        return cats && cats.some(catId => catSet.has(catId));
      });
    }
    // Filter by order status
    if (mapFilters.orderStatus !== 'all' && orderCustomerIds !== null) {
      if (mapFilters.orderStatus === 'with_orders') {
        result = result.filter(a => orderCustomerIds.has(a.customerId));
      } else {
        result = result.filter(a => !orderCustomerIds.has(a.customerId));
      }
    }
    return result;
  }, [allMapAddresses, mapFilters.customer, serviceCustomerIds, mapFilters.categoryIds, customerCategoryMap, mapFilters.orderStatus, orderCustomerIds]);

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

  const openCustomer = (customer: Customer) => {
    setIsAddMode(false);
    setSelectedCustomer(customer);
  };

  // Address display helper for desktop: comma-separated "city, street" per address
  const getAddressDisplay = (customerId: string): string | string[] => {
    const addrs = addressMap.get(customerId);
    if (!addrs || addrs.length === 0) return '—';
    return addrs.map(a => formatAddressShort(a));
  };

  // Pagination page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Ładowanie...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Klienci</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCategoryDialogOpen(true)} title="Zarządzaj kategoriami">
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setMapOpen(true)}>
            <MapPin className="w-4 h-4 mr-1" />
            Mapa
          </Button>
          <Button onClick={handleAddCustomer}>
            <Plus className="w-4 h-4 mr-1" />
            Dodaj klienta
          </Button>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, telefonie, email, firmie, NIP, adresie..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {customerCategories.length > 0 && (
          <Select
            value={selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : '__all__'}
            onValueChange={(val) => {
              if (val === '__all__') {
                setSelectedCategoryIds([]);
              } else {
                setSelectedCategoryIds([val]);
              }
            }}
          >
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Wszystkie ({customers.length})</SelectItem>
              {customerCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({customerCounts[cat.id] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Customer list */}
      {paginatedCustomers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {searchQuery ? 'Brak wyników' : 'Brak klientów'}
        </div>
      ) : isMobile ? (
        /* Mobile: cards with addresses */
        <div className="flex flex-col gap-2">
          {paginatedCustomers.map(customer => {
            const addrs = addressMap.get(customer.id) || [];
            const visibleAddrs = addrs.slice(0, 2);
            const hiddenAddrs = addrs.slice(2);

            return (
              <div
                key={customer.id}
                onClick={() => openCustomer(customer)}
                className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer hover:border-primary/30 bg-card rounded-lg border border-border shadow-sm"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-medium text-foreground">
                    {customer.name}
                  </div>
                  {addrs.length > 0 && (
                    <div className="text-sm text-foreground flex flex-col">
                      {visibleAddrs.map((a) => (
                        <span key={a.id}>
                          {formatAddressShort(a)}
                        </span>
                      ))}
                      {hiddenAddrs.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-1 text-xs text-muted-foreground cursor-default">
                                +{hiddenAddrs.length}…
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[250px]">
                              {hiddenAddrs.map(a => (
                                <div key={a.id} className="text-xs">{formatAddressShort(a)}</div>
                              ))}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-foreground">
                    {formatPhoneDisplay(customer.phone)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={e => handleSms(customer.phone, e)}>
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-primary/5" onClick={e => handleCall(customer.phone, e)}>
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={e => handleDeleteClick(customer, e)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop: table */
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCustomers.map(customer => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => openCustomer(customer)}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="max-w-[300px]">
                    {(() => {
                      const display = getAddressDisplay(customer.id);
                      if (typeof display === 'string') return display;
                      return (
                        <div className="flex flex-col">
                          {display.map((line, i) => (
                            <span key={i} className="truncate">{line}</span>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatPhoneDisplay(customer.phone)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={e => handleDeleteClick(customer, e)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredCustomers.length} klientów)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {getPageNumbers().map((page, idx) =>
              page === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setCurrentPage(page as number)}
                >
                  {page}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
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
        onCustomerUpdated={() => { fetchCustomers(); refetchCategories(); }}
        isAddMode={isAddMode}
        prefilledAddressId={clickedAddressId || undefined}
        prefilledServiceIds={mapFilters.serviceIds.length > 0 ? mapFilters.serviceIds : undefined}
        prefilledServiceNames={mapFilters.serviceNames.length > 0 ? mapFilters.serviceNames : undefined}
        onNewOrderCreated={() => {
          handleCloseDrawer();
          fetchCustomers();
        }}
        customerCategories={customerCategories}
        customerCategoryMap={customerCategoryMap}
      />

      {/* Customer Category Management Dialog */}
      <CustomerCategoryManagementDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        instanceId={instanceId || ''}
        customerCounts={customerCounts}
        onCategoriesChanged={refetchCategories}
      />

      {/* Customers Map Drawer */}
      <CustomersMapDrawer
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        addresses={filteredMapAddresses}
        instanceId={instanceId || ''}
        filters={mapFilters}
        onFiltersChange={setMapFilters}
        categoryNames={Object.fromEntries(customerCategories.map(c => [c.id, c.name]))}
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
