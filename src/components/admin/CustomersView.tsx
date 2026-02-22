import { useState, useEffect, useMemo } from 'react';
import { Search, Phone, MessageSquare, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { normalizeSearchQuery } from '@/lib/textUtils';
import { formatPhoneDisplay } from '@/lib/phoneUtils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import CustomerEditDrawer from './CustomerEditDrawer';
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async () => {
    if (!instanceId) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('instance_id', instanceId)
      .order('name');

    if (!error && data) {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [instanceId]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const normalizedQuery = normalizeSearchQuery(query);
      result = result.filter(c =>
        c.name.toLowerCase().includes(query) ||
        normalizeSearchQuery(c.phone).includes(normalizedQuery) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.company && c.company.toLowerCase().includes(query)) ||
        (c.nip && normalizeSearchQuery(c.nip).includes(normalizedQuery))
      );
    }

    result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    return result;
  }, [customers, searchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
        <Button onClick={handleAddCustomer}>
          <Plus className="w-4 h-4 mr-1" />
          Dodaj
        </Button>
      </div>
      
      {/* Search */}
      <div className="sm:static sticky top-0 z-20 bg-background pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, telefonie, email, firmie, NIP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customer list */}
      <div className="rounded-lg border border-border overflow-hidden">
        {paginatedCustomers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? 'Brak wyników' : 'Brak klientów'}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {paginatedCustomers.map(customer => (
              <div
                key={customer.id}
                onClick={() => {
                  setIsAddMode(false);
                  setSelectedCustomer(customer);
                }}
                className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer hover:bg-accent/30"
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
