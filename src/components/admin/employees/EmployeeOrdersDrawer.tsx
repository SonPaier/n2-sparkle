import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import CustomerOrderCard from '@/components/admin/CustomerOrderCard';
import CalendarItemDetailsDrawer from '@/components/admin/CalendarItemDetailsDrawer';
import type { CalendarItem, CalendarColumn } from '@/components/admin/AdminCalendar';

interface EmployeeOrdersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  instanceId: string;
}

interface OrderData {
  id: string;
  itemDate: string;
  endDate?: string | null;
  title: string;
  status: string;
  price: number | null;
  customerName?: string | null;
  addressCity?: string | null;
  addressStreet?: string | null;
  assignedEmployeeNames: string[];
}

const EmployeeOrdersDrawer = ({ open, onOpenChange, employeeId, employeeName, instanceId }: EmployeeOrdersDrawerProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOrders();
      fetchColumns();
    }
  }, [open, employeeId]);

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
        .select('id, title, item_date, end_date, status, price, assigned_employee_ids, customer_name, customer_address_id')
        .contains('assigned_employee_ids', [employeeId])
        .eq('instance_id', instanceId)
        .order('item_date', { ascending: false });

      if (!items || items.length === 0) {
        setOrders([]);
        return;
      }

      // Fetch address info for items that have customer_address_id
      const addressIds = [...new Set(items.map(i => i.customer_address_id).filter(Boolean))] as string[];
      const allEmpIds = [...new Set(items.flatMap(i => i.assigned_employee_ids || []))];

      const [addressesRes, employeesRes] = await Promise.all([
        addressIds.length > 0
          ? supabase.from('customer_addresses').select('id, city, street').in('id', addressIds)
          : Promise.resolve({ data: [] }),
        allEmpIds.length > 0
          ? supabase.from('employees').select('id, name').in('id', allEmpIds)
          : Promise.resolve({ data: [] }),
      ]);

      const addressMap = new Map((addressesRes.data || []).map((a: any) => [a.id, a]));
      const empMap = new Map((employeesRes.data || []).map((e: any) => [e.id, e.name]));

      const result: OrderData[] = items.map(item => {
        const address = item.customer_address_id ? addressMap.get(item.customer_address_id) : null;
        return {
          id: item.id,
          itemDate: item.item_date,
          endDate: item.end_date,
          title: item.title,
          status: item.status,
          price: item.price,
          customerName: item.customer_name,
          addressCity: address?.city ?? null,
          addressStreet: address?.street ?? null,
          assignedEmployeeNames: (item.assigned_employee_ids || []).map((id: string) => empMap.get(id)).filter(Boolean) as string[],
        };
      });

      setOrders(result);
    } catch (err) {
      console.error('Error fetching employee orders:', err);
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col z-[1000]" hideCloseButton>
          <div className="sticky top-0 z-10 bg-background border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{employeeName} — zlecenia</h2>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-full hover:bg-primary/5">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Brak zleceń dla tego pracownika
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <CustomerOrderCard
                    key={order.id}
                    itemDate={order.itemDate}
                    endDate={order.endDate}
                    title={order.title}
                    status={order.status}
                    price={order.price ?? undefined}
                    services={[]}
                    onClick={() => handleCardClick(order.id)}
                    assignedEmployeeNames={order.assignedEmployeeNames}
                    customerName={order.customerName}
                    addressCity={order.addressCity}
                    addressStreet={order.addressStreet}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CalendarItemDetailsDrawer
        item={detailItem}
        open={detailOpen}
        onClose={handleDetailClose}
        columns={columns}
        instanceId={instanceId}
      />
    </>
  );
};

export default EmployeeOrdersDrawer;
