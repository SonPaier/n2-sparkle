import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CustomerOrderCard from './CustomerOrderCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import CalendarItemDetailsDrawer from './CalendarItemDetailsDrawer';
import type { CalendarItem, CalendarColumn } from './AdminCalendar';

interface CustomerOrdersTabProps {
  customerId: string;
  instanceId: string;
  hidePrices?: boolean;
}

interface OrderData {
  id: string;
  itemDate: string;
  status: string;
  price: number | null;
  addressName?: string;
  addressStreet?: string;
  addressCity?: string;
  services: { name: string; price?: number }[];
  protocolPublicToken?: string;
}

const CustomerOrdersTab = ({ customerId, instanceId, hidePrices }: CustomerOrdersTabProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchColumns();
  }, [customerId]);

  const fetchColumns = async () => {
    const { data } = await supabase
      .from('calendar_columns')
      .select('id, name')
      .eq('instance_id', instanceId)
      .eq('active', true)
      .order('sort_order');
    if (data) setColumns(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: items } = await supabase
        .from('calendar_items')
        .select('id, item_date, status, price, customer_address_id')
        .eq('customer_id', customerId)
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });

      if (!items || items.length === 0) {
        setOrders([]);
        return;
      }

      const itemIds = items.map(i => i.id);
      const addressIds = items.map(i => i.customer_address_id).filter(Boolean) as string[];

      const [servicesRes, addressesRes, protocolsRes] = await Promise.all([
        supabase
          .from('calendar_item_services')
          .select('calendar_item_id, custom_price, service_id, unified_services(name, price)')
          .in('calendar_item_id', itemIds),
        addressIds.length > 0
          ? supabase.from('customer_addresses').select('id, name, street, city').in('id', addressIds)
          : Promise.resolve({ data: [] }),
        supabase.from('protocols').select('calendar_item_id, public_token').in('calendar_item_id', itemIds),
      ]);

      const servicesMap = new Map<string, { name: string; price?: number }[]>();
      if (servicesRes.data) {
        for (const s of servicesRes.data) {
          const list = servicesMap.get(s.calendar_item_id) || [];
          const svc = s.unified_services as any;
          list.push({ name: svc?.name || '—', price: s.custom_price ?? svc?.price ?? undefined });
          servicesMap.set(s.calendar_item_id, list);
        }
      }

      const addressMap = new Map<string, { name: string; street?: string; city?: string }>();
      if (addressesRes.data) {
        for (const a of addressesRes.data as any[]) {
          addressMap.set(a.id, { name: a.name, street: a.street, city: a.city });
        }
      }

      const protocolMap = new Map<string, string>();
      if (protocolsRes.data) {
        for (const p of protocolsRes.data) {
          if (p.calendar_item_id && p.public_token) protocolMap.set(p.calendar_item_id, p.public_token);
        }
      }

      const result: OrderData[] = items.map(item => {
        const addr = item.customer_address_id ? addressMap.get(item.customer_address_id) : undefined;
        return {
          id: item.id,
          itemDate: item.item_date,
          status: item.status,
          price: item.price,
          addressName: addr?.name,
          addressStreet: addr?.street,
          addressCity: addr?.city,
          services: servicesMap.get(item.id) || [],
          protocolPublicToken: protocolMap.get(item.id),
        };
      });

      setOrders(result);
    } catch (err) {
      console.error('Error fetching customer orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = async (orderId: string) => {
    const { data } = await supabase
      .from('calendar_items')
      .select('id, title, item_date, end_date, start_time, end_time, column_id, status, admin_notes, price, customer_id, customer_address_id, assigned_employee_ids, customer_name, customer_phone, customer_email, photo_urls')
      .eq('id', orderId)
      .single();

    if (data) {
      const calendarItem: CalendarItem = {
        id: data.id,
        title: data.title,
        item_date: data.item_date,
        end_date: data.end_date,
        start_time: data.start_time,
        end_time: data.end_time,
        column_id: data.column_id,
        status: data.status,
        admin_notes: data.admin_notes,
        price: data.price,
        customer_id: data.customer_id,
        customer_address_id: data.customer_address_id,
        assigned_employee_ids: data.assigned_employee_ids,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        photo_urls: Array.isArray(data.photo_urls) ? data.photo_urls as string[] : [],
      };
      setDetailItem(calendarItem);
      setDetailOpen(true);
    }
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setDetailItem(null);
    fetchOrders();
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const futureOrders = useMemo(() => orders.filter(o => o.itemDate >= today), [orders, today]);
  const pastOrders = useMemo(() => orders.filter(o => o.itemDate < today), [orders, today]);

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        Brak zleceń dla tego klienta
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {futureOrders.map(order => (
        <CustomerOrderCard
          key={order.id}
          itemDate={order.itemDate}
          status={order.status}
          price={order.price ?? undefined}
          addressName={order.addressName}
          addressStreet={order.addressStreet}
          addressCity={order.addressCity}
          services={order.services}
          protocolPublicToken={order.protocolPublicToken}
          onClick={() => handleCardClick(order.id)}
          hidePrices={hidePrices}
        />
      ))}

      {pastOrders.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowPast(!showPast)}
          >
            Zobacz przeszłe ({pastOrders.length})
            {showPast ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>

          {showPast && pastOrders.map(order => (
            <CustomerOrderCard
              key={order.id}
              itemDate={order.itemDate}
              status={order.status}
              price={order.price ?? undefined}
              addressName={order.addressName}
              addressStreet={order.addressStreet}
              addressCity={order.addressCity}
              services={order.services}
              protocolPublicToken={order.protocolPublicToken}
              onClick={() => handleCardClick(order.id)}
              hidePrices={hidePrices}
            />
          ))}
        </>
      )}

      <CalendarItemDetailsDrawer
        item={detailItem}
        open={detailOpen}
        onClose={handleDetailClose}
        columns={columns}
        instanceId={instanceId}
        hidePrices={hidePrices}
      />
    </div>
  );
};

export default CustomerOrdersTab;
