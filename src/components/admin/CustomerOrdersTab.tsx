import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import CustomerOrderCard from './CustomerOrderCard';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerOrdersTabProps {
  customerId: string;
  instanceId: string;
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

const CustomerOrdersTab = ({ customerId, instanceId }: CustomerOrdersTabProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [customerId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch calendar items for this customer
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

      // Fetch services, addresses, protocols in parallel
      const [servicesRes, addressesRes, protocolsRes] = await Promise.all([
        supabase
          .from('calendar_item_services')
          .select('calendar_item_id, custom_price, service_id, unified_services(name, price)')
          .in('calendar_item_id', itemIds),
        addressIds.length > 0
          ? supabase
              .from('customer_addresses')
              .select('id, name, street, city')
              .in('id', addressIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('protocols')
          .select('calendar_item_id, public_token')
          .in('calendar_item_id', itemIds),
      ]);

      const servicesMap = new Map<string, { name: string; price?: number }[]>();
      if (servicesRes.data) {
        for (const s of servicesRes.data) {
          const list = servicesMap.get(s.calendar_item_id) || [];
          const svc = s.unified_services as any;
          list.push({
            name: svc?.name || '—',
            price: s.custom_price ?? svc?.price ?? undefined,
          });
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
          if (p.calendar_item_id && p.public_token) {
            protocolMap.set(p.calendar_item_id, p.public_token);
          }
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
      {orders.map(order => (
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
        />
      ))}
    </div>
  );
};

export default CustomerOrdersTab;
