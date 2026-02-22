import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface CustomerAddress {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  is_default: boolean | null;
}

interface CustomerAddressSelectProps {
  instanceId: string;
  customerId: string | null;
  value: string | null;
  onChange: (addressId: string | null) => void;
  label?: string;
  showLabel?: boolean;
}

const CustomerAddressSelect = ({
  instanceId,
  customerId,
  value,
  onChange,
  label = 'Adres serwisowy',
  showLabel = true,
}: CustomerAddressSelectProps) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  useEffect(() => {
    if (!customerId) {
      setAddresses([]);
      onChange(null);
      return;
    }

    const fetchAddresses = async () => {
      const { data } = await supabase
        .from('customer_addresses')
        .select('id, name, street, city, is_default')
        .eq('customer_id', customerId)
        .order('sort_order');
      
      const addrs = data || [];
      setAddresses(addrs);
      
      // Auto-select default or first address
      if (addrs.length > 0 && !value) {
        const defaultAddr = addrs.find(a => a.is_default) || addrs[0];
        onChange(defaultAddr.id);
      }
    };
    fetchAddresses();
  }, [customerId]);

  if (!customerId || addresses.length === 0) return null;

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {label}
        </Label>
      )}
      <Select value={value || ''} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger><SelectValue placeholder="Wybierz adres..." /></SelectTrigger>
        <SelectContent>
          {addresses.map((addr) => (
            <SelectItem key={addr.id} value={addr.id}>
              {addr.name}{addr.street ? `, ${addr.street}` : ''}{addr.city ? `, ${addr.city}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CustomerAddressSelect;
