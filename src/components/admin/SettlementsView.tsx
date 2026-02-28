import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal, FileText, RefreshCw } from 'lucide-react';
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
import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from '@/components/invoicing/invoicing.types';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { CreateInvoiceDrawer } from '@/components/invoicing/CreateInvoiceDrawer';
import CalendarItemDetailsDrawer from './CalendarItemDetailsDrawer';
import type { CalendarItem } from './AdminCalendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CalendarItemRow {
  id: string;
  title: string;
  item_date: string;
  customer_name: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address_id: string | null;
  created_at: string;
  status: string;
  payment_status: string | null;
  price: number | null;
  admin_notes: string | null;
  start_time: string;
  end_time: string;
  column_id: string | null;
  assigned_employee_ids: string[] | null;
  photo_urls: unknown;
  end_date: string | null;
  order_number: string | null;
}

interface InvoiceRow {
  id: string;
  calendar_item_id: string;
  pdf_url: string | null;
  payment_to: string | null;
}

const formatCurrency = (value: number | null) => {
  if (value == null) return '—';
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: 'Do potw.', badgeClass: 'border-amber-500 text-amber-600' },
  confirmed: { label: 'Do wykonania', badgeClass: 'border-amber-500 text-amber-600' },
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
  const [currentPage, setCurrentPage] = useState(1);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState<CalendarItemRow | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<CalendarItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['settlements', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('id, title, item_date, customer_name, customer_id, customer_email, customer_phone, customer_address_id, created_at, status, payment_status, price, admin_notes, start_time, end_time, column_id, assigned_employee_ids, photo_urls, end_date, order_number')
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CalendarItemRow[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['settlements-invoices', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, calendar_item_id, pdf_url, payment_to')
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
        (o.title || '').toLowerCase().includes(q) ||
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-invoice-statuses', {
        body: { instanceId },
      });
      if (error) throw error;
      toast.success(`Zsynchronizowano ${data?.synced || 0} z ${data?.total || 0} faktur`);
      queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
      queryClient.invalidateQueries({ queryKey: ['settlements-invoices', instanceId] });
    } catch (e: any) {
      toast.error('Błąd synchronizacji: ' + (e.message || 'Nieznany błąd'));
    } finally {
      setSyncing(false);
    }
  };

  const formatOrderNumber = (item: CalendarItemRow) => {
    return item.order_number || '—';
  };

  const openInvoiceDrawer = (order: CalendarItemRow) => {
    setDetailsDrawerOpen(false);
    setDetailsItem(null);
    setInvoiceTarget(order);
    setInvoiceDrawerOpen(true);
  };

  const openDetailsDrawer = (order: CalendarItemRow) => {
    const calendarItem: CalendarItem = {
      id: order.id,
      title: order.title,
      column_id: order.column_id,
      item_date: order.item_date,
      start_time: order.start_time,
      end_time: order.end_time,
      status: order.status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
      customer_id: order.customer_id,
      customer_address_id: order.customer_address_id,
      assigned_employee_ids: order.assigned_employee_ids,
      admin_notes: order.admin_notes,
      price: order.price,
      payment_status: order.payment_status,
      photo_urls: Array.isArray(order.photo_urls) ? order.photo_urls as string[] : [],
      end_date: order.end_date,
    };
    setDetailsItem(calendarItem);
    setDetailsDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Zlecenia</h2>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta, tytuł lub datę..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sprawdź statusy płatności
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table className="table-fixed w-full min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Nr</TableHead>
              <TableHead className="w-[200px] max-w-[200px]">Tytuł</TableHead>
              <TableHead className="w-[200px]">Klient</TableHead>
              <TableHead className="w-[130px]">
                <div className="leading-tight">
                  <div>Data utw.</div>
                  <div>Data zakoń.</div>
                </div>
              </TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[160px]">Status płatności</TableHead>
              <TableHead className="text-right w-[120px]">Kwota netto</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Brak zleceń spełniających kryteria
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const invoice = invoicesByItemId[order.id];
                const paymentKey = (order.payment_status || 'not_invoiced') as PaymentStatus;
                const paymentConfig = PAYMENT_STATUS_CONFIG[paymentKey] || PAYMENT_STATUS_CONFIG.not_invoiced;

                return (
                  <TableRow key={order.id} className="group cursor-pointer" onClick={() => openDetailsDrawer(order)}>
                    <TableCell className="text-sm">
                      {formatOrderNumber(order)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {order.title || '—'}
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
                      {order.status !== 'confirmed' ? (
                        <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                                <InvoiceStatusBadge
                                  status={order.payment_status}
                                  paymentTo={invoice?.payment_to}
                                  className="cursor-pointer"
                                />
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
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
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
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={() => openDetailsDrawer(order)}
                          >
                            Szczegóły
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openInvoiceDrawer(order)}
                          >
                            Wystaw FV
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
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
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      <CalendarItemDetailsDrawer
        item={detailsItem}
        open={detailsDrawerOpen}
        onClose={() => { setDetailsDrawerOpen(false); setDetailsItem(null); }}
        columns={[]}
        instanceId={instanceId}
        onStatusChange={(itemId, newStatus) => {
          changeStatus(itemId, newStatus);
        }}
      />

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
