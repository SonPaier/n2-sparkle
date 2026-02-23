import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, ChevronDown, ChevronRight, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from '@/components/invoicing/invoicing.types';
import { CreateInvoiceDrawer } from '@/components/invoicing/CreateInvoiceDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CalendarItemRow {
  id: string;
  item_date: string;
  customer_name: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_address_id: string | null;
  created_at: string;
  status: string;
  payment_status: string | null;
  price: number | null;
  admin_notes: string | null;
}

interface ServiceRow {
  id: string;
  custom_price: number | null;
  service: {
    name: string;
    price: number | null;
    unit: string;
  } | null;
}

interface InvoiceRow {
  id: string;
  calendar_item_id: string;
  pdf_url: string | null;
}

const formatCurrency = (value: number | null) => {
  if (value == null) return '—';
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: 'Do potwierdzenia', badgeClass: 'border-amber-500 text-amber-600' },
  confirmed: { label: 'Potwierdzony', badgeClass: 'border-amber-500 text-amber-600' },
  in_progress: { label: 'W realizacji', badgeClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
  completed: { label: 'Zakończony', badgeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  cancelled: { label: 'Anulowany', badgeClass: 'bg-red-600 hover:bg-red-700 text-white' },
};

const ITEMS_PER_PAGE = 10;

interface SettlementsViewProps {
  instanceId: string;
}

const SettlementsView = ({ instanceId }: SettlementsViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [servicesCache, setServicesCache] = useState<Record<string, ServiceRow[]>>({});
  const [addressCache, setAddressCache] = useState<Record<string, { name: string; street?: string | null; city?: string | null; postal_code?: string | null } | null>>({});
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<CalendarItemRow | null>(null);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['settlements', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('id, item_date, customer_name, customer_id, customer_email, customer_address_id, created_at, status, payment_status, price, admin_notes')
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CalendarItemRow[];
    },
  });

  // Fetch invoices with pdf_url for all calendar items
  const { data: invoices = [] } = useQuery({
    queryKey: ['settlements-invoices', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, calendar_item_id, pdf_url')
        .eq('instance_id', instanceId);
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

  const invoicesByItemId = useMemo(() => {
    const map: Record<string, InvoiceRow> = {};
    invoices.forEach((inv) => {
      if (inv.calendar_item_id) map[inv.calendar_item_id] = inv;
    });
    return map;
  }, [invoices]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (o) =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        o.item_date.includes(q)
    );
  }, [items, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const toggleExpand = async (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (!servicesCache[id]) {
      const { data, error } = await supabase
        .from('calendar_item_services')
        .select('id, custom_price, service:unified_services(name, price, unit)')
        .eq('calendar_item_id', id);
      if (!error && data) {
        setServicesCache((prev) => ({ ...prev, [id]: data as unknown as ServiceRow[] }));
      }
    }

    if (!(id in addressCache)) {
      const item = items.find((i) => i.id === id);
      if (item?.customer_address_id) {
        const { data } = await supabase
          .from('customer_addresses')
          .select('name, street, city, postal_code')
          .eq('id', item.customer_address_id)
          .maybeSingle();
        setAddressCache((prev) => ({ ...prev, [id]: data }));
      } else {
        setAddressCache((prev) => ({ ...prev, [id]: null }));
      }
    }
  };

  const changeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('calendar_items')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error('Błąd zmiany statusu');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
    toast.success('Status zmieniony');
  };

  const changePaymentStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('calendar_items')
      .update({ payment_status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error('Błąd zmiany statusu płatności');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
    toast.success('Status płatności zmieniony');
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, badgeClass: 'border-muted text-muted-foreground' };
  };

  const formatOrderNumber = (item: CalendarItemRow) => {
    try {
      return format(parseISO(item.item_date), 'dd.MM.yyyy');
    } catch {
      return item.item_date;
    }
  };

  const openInvoiceDrawer = (order: CalendarItemRow) => {
    setInvoiceTarget(order);
    setInvoiceDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Rozliczenia</h2>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta lub nr zlecenia..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Nr</TableHead>
              <TableHead className="w-[200px]">Klient</TableHead>
              <TableHead className="w-[130px]">
                <div className="leading-tight">
                  <div>Data utw.</div>
                  <div>Data zakoń.</div>
                </div>
              </TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[160px]">Status płatności</TableHead>
              <TableHead className="text-right w-[120px]">Kwota</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Brak zleceń spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const isExpanded = expandedRows.has(order.id);
                const statusConfig = getStatusConfig(order.status);
                const invoice = invoicesByItemId[order.id];
                const paymentKey = (order.payment_status || 'not_invoiced') as PaymentStatus;
                const paymentConfig = PAYMENT_STATUS_CONFIG[paymentKey] || PAYMENT_STATUS_CONFIG.not_invoiced;

                return (
                  <>
                    <TableRow
                      key={order.id}
                      className="group cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(order.id)}
                    >
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {formatOrderNumber(order)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{order.customer_name || '—'}</TableCell>
                      <TableCell className="text-sm">
                        <div className="leading-tight">
                          <div>{format(parseISO(order.created_at), 'dd.MM.yyyy')}</div>
                          {order.status === 'completed' && (
                            <div>{format(parseISO(order.item_date), 'dd.MM.yyyy')}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                              <Badge
                                variant={['in_progress', 'completed', 'cancelled'].includes(order.status) ? 'default' : 'outline'}
                                className={`${statusConfig.badgeClass} cursor-pointer`}
                              >
                                {statusConfig.label}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <DropdownMenuItem key={key} onClick={() => changeStatus(order.id, key)}>
                                <Badge
                                  variant={['in_progress', 'completed', 'cancelled'].includes(key) ? 'default' : 'outline'}
                                  className={`${config.badgeClass} mr-2`}
                                >
                                  {config.label}
                                </Badge>
                                Oznacz jako {config.label.toLowerCase()}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${paymentConfig.color}`}
                                >
                                  {paymentConfig.label}
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, config]) => (
                                <DropdownMenuItem key={key} onClick={() => changePaymentStatus(order.id, key)}>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mr-2 ${config.color}`}>
                                    {config.label}
                                  </span>
                                  {config.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {invoice?.pdf_url && (
                            <a
                              href={invoice.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(order.price)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.info('Szczegóły zlecenia w przygotowaniu')}>
                              Szczegóły
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openInvoiceDrawer(order)}>
                              Wystaw FV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-expanded`} className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-background px-6 py-4 border-t border-border/50">
                            {addressCache[order.id] && (
                              <p className="text-sm text-muted-foreground mb-3">
                                📍 {[addressCache[order.id]!.name, addressCache[order.id]!.street, addressCache[order.id]!.postal_code, addressCache[order.id]!.city].filter(Boolean).join(', ')}
                              </p>
                            )}
                            {order.admin_notes && (
                              <p className="text-sm text-muted-foreground mb-3">{order.admin_notes}</p>
                            )}
                            <div className="space-y-1.5">
                              {servicesCache[order.id] ? (
                                servicesCache[order.id].length > 0 ? (
                                  servicesCache[order.id].map((svc) => (
                                    <div
                                      key={svc.id}
                                      className="flex items-center justify-between text-sm gap-4"
                                    >
                                      <span className="text-muted-foreground min-w-0 truncate">
                                        {svc.service?.name || 'Usługa usunięta'}
                                      </span>
                                      <div className="flex items-center gap-4 shrink-0 tabular-nums text-xs text-muted-foreground">
                                        <span>1 {svc.service?.unit || 'szt.'}</span>
                                        <span className="w-24 text-right">
                                          {formatCurrency(svc.custom_price ?? svc.service?.price ?? null)}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">Brak przypisanych usług</p>
                                )
                              ) : (
                                <p className="text-sm text-muted-foreground">Ładowanie usług...</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredOrders.length} zleceń)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Poprzednia
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className="w-9"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Następna
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Invoice Drawer */}
      <CreateInvoiceDrawer
        open={invoiceDrawerOpen}
        onClose={() => { setInvoiceDrawerOpen(false); setInvoiceTarget(null); }}
        instanceId={instanceId}
        calendarItemId={invoiceTarget?.id}
        customerId={invoiceTarget?.customer_id}
        customerName={invoiceTarget?.customer_name}
        customerEmail={invoiceTarget?.customer_email}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
          queryClient.invalidateQueries({ queryKey: ['settlements-invoices', instanceId] });
        }}
      />
    </div>
  );
};

export default SettlementsView;
