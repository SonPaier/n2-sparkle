import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import CustomerOrderCard from './CustomerOrderCard';
import { Skeleton } from '@/components/ui/skeleton';
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
  endDate?: string | null;
  title: string;
  status: string;
  price: number | null;
  services: { name: string; price?: number }[];
  assignedEmployeeNames: string[];
}

const CustomerOrdersTab = ({ customerId, instanceId, hidePrices }: CustomerOrdersTabProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
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
        .select('id, title, item_date, end_date, status, price, assigned_employee_ids')
        .eq('customer_id', customerId)
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });

      if (!items || items.length === 0) {
        setOrders([]);
        return;
      }

      const itemIds = items.map(i => i.id);
      const allEmpIds = [...new Set(items.flatMap(i => i.assigned_employee_ids || []))];

      const [servicesRes, employeesRes] = await Promise.all([
        supabase
          .from('calendar_item_services')
          .select('calendar_item_id, custom_price, service_id, unified_services(name, price)')
          .in('calendar_item_id', itemIds),
        allEmpIds.length > 0
          ? supabase.from('employees').select('id, name').in('id', allEmpIds)
          : Promise.resolve({ data: [] }),
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

      const empMap = new Map((employeesRes.data || []).map((e: any) => [e.id, e.name]));

      const result: OrderData[] = items.map(item => ({
        id: item.id,
        itemDate: item.item_date,
        endDate: item.end_date,
        title: item.title,
        status: item.status,
        price: item.price,
        services: servicesMap.get(item.id) || [],
        assignedEmployeeNames: (item.assigned_employee_ids || []).map(id => empMap.get(id)).filter(Boolean) as string[],
      }));

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
        id: data.id, title: data.title, item_date: data.item_date, end_date: data.end_date,
        start_time: data.start_time, end_time: data.end_time, column_id: data.column_id,
        status: data.status, admin_notes: data.admin_notes, price: data.price,
        customer_id: data.customer_id, customer_address_id: data.customer_address_id,
        assigned_employee_ids: data.assigned_employee_ids,
        customer_name: data.customer_name, customer_phone: data.customer_phone,
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
    <div className="space-y-2 mt-4">
      {orders.map(order => (
        <CustomerOrderCard
          key={order.id}
          itemDate={order.itemDate}
          endDate={order.endDate}
          title={order.title}
          status={order.status}
          price={order.price ?? undefined}
          services={order.services}
          onClick={() => handleCardClick(order.id)}
          hidePrices={hidePrices}
          assignedEmployeeNames={order.assignedEmployeeNames}
        />
      ))}

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
