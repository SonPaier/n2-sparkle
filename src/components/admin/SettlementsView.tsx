import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal, FileText, RefreshCw, MessageSquare, Plus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  TableCell } from
'@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import { PAYMENT_STATUS_CONFIG, type PaymentStatus } from '@/components/invoicing/invoicing.types';
import { InvoiceStatusBadge } from '@/components/invoicing/InvoiceStatusBadge';
import { CreateInvoiceDrawer } from '@/components/invoicing/CreateInvoiceDrawer';
import CalendarItemDetailsDrawer from './CalendarItemDetailsDrawer';
import SendPaymentSmsDialog from './SendPaymentSmsDialog';
import AddCalendarItemDialog from './AddCalendarItemDialog';
import type { CalendarItem } from './AdminCalendar';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CalendarItemRow {
  id: string;
  title: string;
  item_date: string | null;
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
  start_time: string | null;
  end_time: string | null;
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
  provider: string;
}

const downloadIfirmaPdf = async (invoiceId: string, instanceId: string) => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('invoicing-api', {
      body: { action: 'get_ifirma_pdf', instanceId, invoiceId },
    });
    if (error) throw error;
    // The response comes as arraybuffer via the edge function
    // We need to use fetch directly for binary response
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoicing-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: 'get_ifirma_pdf', instanceId, invoiceId }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faktura-${invoiceId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('PDF download error:', err);
    toast.error('Błąd pobierania PDF');
  }
};

const formatCurrency = (value: number | null) => {
  if (value == null || value === 0) return '—';
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

const STATUS_CONFIG: Record<string, {label: string;badgeClass: string;}> = {
  confirmed: { label: 'Do wykonania', badgeClass: 'border-amber-500 text-amber-600' },
  in_progress: { label: 'W realizacji', badgeClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
  completed: { label: 'Zakończony', badgeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  cancelled: { label: 'Anulowany', badgeClass: 'bg-red-600 hover:bg-red-700 text-white' }
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
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsTemplateType, setSmsTemplateType] = useState<'blik' | 'bank_transfer'>('blik');
  const [smsTarget, setSmsTarget] = useState<CalendarItemRow | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'price' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const { data: columns = [] } = useQuery({
    queryKey: ['settlements-columns', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data } = await supabase.
      from('calendar_columns').
      select('id, name').
      eq('instance_id', instanceId).
      eq('active', true).
      order('sort_order');
      return data || [];
    }
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['settlements', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase.
      from('calendar_items').
      select('id, title, item_date, customer_name, customer_id, customer_email, customer_phone, customer_address_id, created_at, status, payment_status, price, admin_notes, start_time, end_time, column_id, assigned_employee_ids, photo_urls, end_date, order_number').
      eq('instance_id', instanceId).
      order('item_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CalendarItemRow[];
    }
  });

  const addressIds = useMemo(() => {
    return [...new Set(items.map(i => i.customer_address_id).filter(Boolean))] as string[];
  }, [items]);

  const { data: addressMap = {} } = useQuery({
    queryKey: ['settlements-addresses', instanceId, addressIds],
    enabled: addressIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_addresses')
        .select('id, name, street, city')
        .in('id', addressIds);
      const map: Record<string, string> = {};
      (data || []).forEach((a: any) => {
        const parts = [a.street, a.city].filter(Boolean);
        map[a.id] = parts.length > 0 ? parts.join(', ') : a.name;
      });
      return map;
    }
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['settlements-invoices', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase.
      from('invoices').
      select('id, calendar_item_id, pdf_url, payment_to, provider').
      eq('instance_id', instanceId);
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    }
  });

  const { data: smsTemplates = [] } = useQuery({
    queryKey: ['sms-payment-templates', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('sms_payment_templates' as any) as any).
      select('template_type, enabled').
      eq('instance_id', instanceId);
      if (error) throw error;
      return (data || []) as {template_type: string;enabled: boolean;}[];
    }
  });

  const blikTemplateEnabled = smsTemplates.some((t) => t.template_type === 'blik' && t.enabled);
  const bankTemplateEnabled = smsTemplates.some((t) => t.template_type === 'bank_transfer' && t.enabled);

  const invoicesByItemId = useMemo(() => {
    const map: Record<string, InvoiceRow> = {};
    invoices.forEach((inv) => {
      if (inv.calendar_item_id) map[inv.calendar_item_id] = inv;
    });
    return map;
  }, [invoices]);

  const filteredOrders = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.title || '').toLowerCase().includes(q) ||
        (o.item_date || '').includes(q) ||
        (o.customer_address_id && addressMap[o.customer_address_id] && addressMap[o.customer_address_id].toLowerCase().includes(q))
      );
    }
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let valA: any, valB: any;
        switch (sortColumn) {
          case 'order_number': valA = a.order_number || ''; valB = b.order_number || ''; break;
          case 'title': valA = (a.title || '').toLowerCase(); valB = (b.title || '').toLowerCase(); break;
          case 'customer_name': valA = (a.customer_name || '').toLowerCase(); valB = (b.customer_name || '').toLowerCase(); break;
          case 'created_at': valA = a.created_at; valB = b.created_at; break;
          case 'status': valA = a.status; valB = b.status; break;
          case 'payment_status': valA = a.payment_status || ''; valB = b.payment_status || ''; break;
          case 'price': valA = a.price ?? 0; valB = b.price ?? 0; break;
          default: return 0;
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [items, searchQuery, sortColumn, sortDirection, addressMap]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const invalidateSettlements = () => {
    queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
  };

  const changeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.
    from('calendar_items').
    update({ status: newStatus }).
    eq('id', id);
    if (error) {
      toast.error('Błąd zmiany statusu');
      return;
    }
    invalidateSettlements();
    toast.success('Status zmieniony');
  };

  const handleDeleteItem = async (itemId: string) => {
    // Delete related records first to avoid FK constraint violations
    await Promise.all([
      supabase.from('invoices').delete().eq('calendar_item_id', itemId),
      supabase.from('calendar_item_services').delete().eq('calendar_item_id', itemId),
      supabase.from('customer_sms_notifications').delete().eq('calendar_item_id', itemId),
      supabase.from('sms_logs').delete().eq('calendar_item_id', itemId),
      supabase.from('protocols').delete().eq('calendar_item_id', itemId),
    ]);
    const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
    if (error) { toast.error('Błąd usuwania'); return; }
    invalidateSettlements();
    toast.success('Zlecenie usunięte');
  };

  const handleEditItem = (calItem: CalendarItem) => {
    setEditingItem({
      id: calItem.id,
      title: calItem.title,
      customer_name: calItem.customer_name,
      customer_phone: calItem.customer_phone,
      customer_email: calItem.customer_email,
      customer_id: calItem.customer_id,
      customer_address_id: calItem.customer_address_id,
      assigned_employee_ids: calItem.assigned_employee_ids,
      item_date: calItem.item_date,
      end_date: calItem.end_date,
      start_time: calItem.start_time,
      end_time: calItem.end_time,
      column_id: calItem.column_id,
      admin_notes: calItem.admin_notes,
      price: calItem.price,
    });
    setDetailsDrawerOpen(false);
    setDetailsItem(null);
    setAddOrderOpen(true);
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, badgeClass: 'border-muted text-muted-foreground' };
  };

  const changePaymentStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.
    from('calendar_items').
    update({ payment_status: newStatus }).
    eq('id', id);
    if (error) {
      toast.error('Błąd zmiany statusu płatności');
      return;
    }
    invalidateSettlements();
    toast.success('Status płatności zmieniony');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-invoice-statuses', {
        body: { instanceId }
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

  const openSmsDialog = (order: CalendarItemRow, type: 'blik' | 'bank_transfer') => {
    setSmsTarget(order);
    setSmsTemplateType(type);
    setSmsDialogOpen(true);
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
      end_date: order.end_date
    };
    setDetailsItem(calendarItem);
    setDetailsDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Zlecenia</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sprawdź statusy płatności
          </Button>
          <Button size="sm" onClick={() => setAddOrderOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Dodaj zlecenie
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj klienta, tytuł lub datę..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9" />
        </div>
      </div>

      {/* Mobile Cards */}
      {isMobile ?
      <div className="space-y-2">
          {isLoading ?
        <p className="text-center text-muted-foreground py-8">Ładowanie...</p> :
        filteredOrders.length === 0 ?
        <p className="text-center text-muted-foreground py-8">Brak zleceń spełniających kryteria</p> :

        paginatedOrders.map((order) => {
          const statusConfig = getStatusConfig(order.status);
          const invoice = invoicesByItemId[order.id];

          return (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2 cursor-pointer active:bg-primary/5"
              onClick={() => openDetailsDrawer(order)}>

                  {/* Top row: title + amount */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{order.title || '—'}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_name || '—'}</p>
                      {order.customer_address_id && addressMap[order.customer_address_id] && (
                        <p className="text-xs text-muted-foreground/70 truncate">{addressMap[order.customer_address_id]}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                      {formatCurrency(order.price)}
                    </span>
                  </div>

                  {/* Bottom row: date, statuses, actions */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {order.item_date ? format(parseISO(order.item_date), 'dd.MM.yyyy') : 'Bez daty'}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                            <Badge
                          variant={['in_progress', 'completed', 'cancelled'].includes(order.status) ? 'default' : 'outline'}
                          className={`${statusConfig.badgeClass} cursor-pointer text-[11px]`}>

                              {statusConfig.label}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                          {Object.entries(STATUS_CONFIG).map(([key, config]) =>
                      <DropdownMenuItem key={key} onClick={() => changeStatus(order.id, key)}>
                          <Badge
                          variant={['in_progress', 'completed', 'cancelled'].includes(key) ? 'default' : 'outline'}
                          className={`${config.badgeClass}`}>

                                {config.label}
                              </Badge>
                            </DropdownMenuItem>
                      )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {order.status !== 'confirmed' &&
                  <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                              <InvoiceStatusBadge
                          status={order.payment_status}
                          paymentTo={invoice?.payment_to}
                          className="cursor-pointer text-[11px]" />

                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                            {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, config]) =>
                      <DropdownMenuItem key={key} onClick={() => changePaymentStatus(order.id, key)}>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                                  {config.label}
                                </span>
                              </DropdownMenuItem>
                      )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                  }
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => openDetailsDrawer(order)}>Szczegóły</DropdownMenuItem>
                          {(invoice?.pdf_url || invoice?.provider === 'ifirma') &&
                      <DropdownMenuItem onSelect={() => {
                        if (invoice.pdf_url) {
                          window.open(invoice.pdf_url, '_blank');
                        } else if (invoice.provider === 'ifirma') {
                          downloadIfirmaPdf(invoice.id, instanceId);
                        }
                      }}>
                              Pobierz FV
                            </DropdownMenuItem>
                      }
                          <DropdownMenuItem onSelect={() => openInvoiceDrawer(order)}>Wystaw FV</DropdownMenuItem>
                          {blikTemplateEnabled &&
                      <DropdownMenuItem onSelect={() => openSmsDialog(order, 'blik')}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Wyślij SMS BLIK
                            </DropdownMenuItem>
                      }
                          {bankTemplateEnabled &&
                      <DropdownMenuItem onSelect={() => openSmsDialog(order, 'bank_transfer')}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Wyślij SMS z nr konta
                            </DropdownMenuItem>
                      }
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>);

        })
        }
        </div> : (

      /* Desktop Table */
      <div className="rounded-lg border border-border bg-card">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[8%] cursor-pointer select-none" onClick={() => handleSort('order_number')}>
                <span className="flex items-center">Nr<SortIcon column="order_number" /></span>
              </TableHead>
              <TableHead className="w-[19%] cursor-pointer select-none" onClick={() => handleSort('title')}>
                <span className="flex items-center">Tytuł<SortIcon column="title" /></span>
              </TableHead>
              <TableHead className="w-[20%] cursor-pointer select-none" onClick={() => handleSort('customer_name')}>
                <span className="flex items-center">Klient<SortIcon column="customer_name" /></span>
              </TableHead>
              <TableHead className="w-[12%] cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                <span className="flex items-center">
                  <div className="leading-tight">
                    <div>Data utw.</div>
                    <div>Data zakoń.</div>
                  </div>
                  <SortIcon column="created_at" />
                </span>
              </TableHead>
              <TableHead className="w-[12%] cursor-pointer select-none" onClick={() => handleSort('status')}>
                <span className="flex items-center">Status<SortIcon column="status" /></span>
              </TableHead>
              <TableHead className="w-[14%] cursor-pointer select-none" onClick={() => handleSort('payment_status')}>
                <span className="flex items-center">Status płatności<SortIcon column="payment_status" /></span>
              </TableHead>
              <TableHead className="text-right w-[10%] cursor-pointer select-none" onClick={() => handleSort('price')}>
                <span className="flex items-center justify-end">Kwota netto<SortIcon column="price" /></span>
              </TableHead>
              <TableHead className="w-[5%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ?
            <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Ładowanie...
                </TableCell>
              </TableRow> :
            filteredOrders.length === 0 ?
            <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Brak zleceń spełniających kryteria
                </TableCell>
              </TableRow> :

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
                    <TableCell className="text-sm">
                      <div className="line-clamp-2">{order.title || '—'}</div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{order.customer_name || '—'}</div>
                      {order.customer_address_id && addressMap[order.customer_address_id] && (
                        <div className="text-xs text-muted-foreground truncate">{addressMap[order.customer_address_id]}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="leading-tight">
                        <div>{format(parseISO(order.created_at), 'dd.MM.yyyy')}</div>
                        {order.status === 'completed' &&
                      <div>{order.item_date ? format(parseISO(order.item_date), 'dd.MM.yyyy') : 'Bez daty'}</div>
                      }
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                            <Badge
                            variant={['in_progress', 'completed', 'cancelled'].includes(order.status) ? 'default' : 'outline'}
                            className={`${statusConfig.badgeClass} cursor-pointer`}>

                              {statusConfig.label}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {Object.entries(STATUS_CONFIG).map(([key, config]) =>
                        <DropdownMenuItem key={key} onClick={() => changeStatus(order.id, key)}>
                          <Badge
                            variant={['in_progress', 'completed', 'cancelled'].includes(key) ? 'default' : 'outline'}
                            className={`${config.badgeClass}`}>

                                {config.label}
                              </Badge>
                            </DropdownMenuItem>
                        )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      {order.status !== 'confirmed' ?
                    <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="focus:outline-none" onClick={(e) => e.stopPropagation()}>
                                <InvoiceStatusBadge
                              status={order.payment_status}
                              paymentTo={invoice?.payment_to}
                              className="cursor-pointer" />

                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {Object.entries(PAYMENT_STATUS_CONFIG).map(([key, config]) =>
                          <DropdownMenuItem key={key} onClick={() => changePaymentStatus(order.id, key)}>
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
                                    {config.label}
                                  </span>
                                </DropdownMenuItem>
                          )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div> :

                    <span className="text-muted-foreground text-xs">—</span>
                    }
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
                          onClick={(e) => e.stopPropagation()}>

                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                          onSelect={() => openDetailsDrawer(order)}>

                            Szczegóły
                          </DropdownMenuItem>
                          {(invoice?.pdf_url || invoice?.provider === 'ifirma') &&
                        <DropdownMenuItem
                          onSelect={() => {
                            if (invoice.pdf_url) {
                              window.open(invoice.pdf_url, '_blank');
                            } else if (invoice.provider === 'ifirma') {
                              downloadIfirmaPdf(invoice.id, instanceId);
                            }
                          }}>
                              Pobierz FV
                            </DropdownMenuItem>
                        }
                          <DropdownMenuItem
                          onSelect={() => openInvoiceDrawer(order)}>

                            Wystaw FV
                          </DropdownMenuItem>
                          {blikTemplateEnabled &&
                        <DropdownMenuItem onSelect={() => openSmsDialog(order, 'blik')}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Wyślij SMS BLIK
                            </DropdownMenuItem>
                        }
                          {bankTemplateEnabled &&
                        <DropdownMenuItem onSelect={() => openSmsDialog(order, 'bank_transfer')}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Wyślij SMS z nr konta
                            </DropdownMenuItem>
                        }
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>);

            })
            }
          </TableBody>
        </Table>
      </div>)
      }

      {/* Pagination */}
      {totalPages > 1 &&
      <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Strona {currentPage} z {totalPages} ({filteredOrders.length} zleceń)
          </p>
          <div className="flex items-center gap-1">
            <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}>

              <ChevronLeftIcon className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) =>
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            className="w-9"
            onClick={() => setCurrentPage(page)}>

                {page}
              </Button>
          )}
            <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}>

              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      }

      {/* Details Drawer */}
      <CalendarItemDetailsDrawer
        item={detailsItem}
        open={detailsDrawerOpen}
        onClose={() => {setDetailsDrawerOpen(false);setDetailsItem(null);invalidateSettlements();}}
        columns={columns}
        instanceId={instanceId}
        onDelete={handleDeleteItem}
        onEdit={handleEditItem}
        onStatusChange={(itemId, newStatus) => changeStatus(itemId, newStatus)}
        onStartWork={(itemId) => changeStatus(itemId, 'in_progress')}
        onEndWork={(itemId) => changeStatus(itemId, 'completed')}
      />


      {/* Invoice Drawer */}
      <CreateInvoiceDrawer
        open={invoiceDrawerOpen}
        onClose={() => {setInvoiceDrawerOpen(false);setInvoiceTarget(null);}}
        instanceId={instanceId}
        calendarItemId={invoiceTarget?.id}
        customerId={invoiceTarget?.customer_id}
        customerName={invoiceTarget?.customer_name}
        customerEmail={invoiceTarget?.customer_email}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
          queryClient.invalidateQueries({ queryKey: ['settlements-invoices', instanceId] });
        }} />


      {/* SMS Payment Dialog */}
      {smsTarget &&
      <SendPaymentSmsDialog
        open={smsDialogOpen}
        onClose={() => {setSmsDialogOpen(false);setSmsTarget(null);}}
        templateType={smsTemplateType}
        calendarItem={smsTarget}
        instanceId={instanceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['settlements', instanceId] });
        }} />

      }

      {/* Add Order Dialog */}
      <AddCalendarItemDialog
        open={addOrderOpen}
        onClose={() => { setAddOrderOpen(false); setEditingItem(null); }}
        instanceId={instanceId}
        columns={columns}
        editingItem={editingItem}
        onSuccess={() => {
          setAddOrderOpen(false);
          setEditingItem(null);
          invalidateSettlements();
        }} />

    </div>);

};

export default SettlementsView;