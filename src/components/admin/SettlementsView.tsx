import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, ChevronDown, ChevronRight, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface CalendarItemRow {
  id: string;
  item_date: string;
  customer_name: string | null;
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

const formatCurrency = (value: number | null) => {
  if (value == null) return '—';
  return value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
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
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['settlements', instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('id, item_date, customer_name, created_at, status, payment_status, price, admin_notes')
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });
      if (error) throw error;
      return (data || []) as CalendarItemRow[];
    },
  });

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

    // Lazy load services
    if (!servicesCache[id]) {
      const { data, error } = await supabase
        .from('calendar_item_services')
        .select('id, custom_price, service:unified_services(name, price, unit)')
        .eq('calendar_item_id', id);
      if (!error && data) {
        setServicesCache((prev) => ({ ...prev, [id]: data as unknown as ServiceRow[] }));
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
              <TableHead className="w-[130px]">Status płatności</TableHead>
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
                        <InvoiceStatusBadge status={order.payment_status} size="sm" />
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
                            <DropdownMenuItem onClick={() => toast.info('Wystawianie FV w przygotowaniu')}>
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
    </div>
  );
};

export default SettlementsView;
