import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface CustomerAddress {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  is_default: boolean | null;
}

interface AddressSearchResult {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
}

export interface ResolvedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface CustomerAddressSelectProps {
  instanceId: string;
  customerId: string | null;
  value: string | null;
  onChange: (addressId: string | null) => void;
  onCustomerResolved?: (customer: ResolvedCustomer, addressId: string) => void;
  onAddNew?: (query: string) => void;
  label?: string;
  showLabel?: boolean;
}

const CustomerAddressSelect = ({
  instanceId,
  customerId,
  value,
  onChange,
  onCustomerResolved,
  onAddNew,
  label = 'Adres serwisowy',
  showLabel = true,
}: CustomerAddressSelectProps) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  // Global search state (when no customer selected)
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const noResultsForQueryRef = useRef<string | null>(null);

  // Load customer addresses when customerId is set
  useEffect(() => {
    if (!customerId) {
      setAddresses([]);
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
      
      // Auto-select default or first address only if no value set
      if (addrs.length > 0 && !value) {
        const defaultAddr = addrs.find(a => a.is_default) || addrs[0];
        onChange(defaultAddr.id);
      }
    };
    fetchAddresses();
    // Clear global search state when customer is selected
    setSelectedAddress(null);
    setQuery('');
  }, [customerId]);

  // Global address search
  const searchAddresses = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      noResultsForQueryRef.current = null;
      return;
    }

    // Skip search if extending a query that already returned no results
    if (noResultsForQueryRef.current && q.startsWith(noResultsForQueryRef.current)) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    noResultsForQueryRef.current = null;
    setSearching(true);

    const { data } = await supabase
      .from('customer_addresses')
      .select('id, name, street, city, customer_id, customers!inner(id, name, phone, email)')
      .eq('instance_id', instanceId)
      .or(`street.ilike.%${q}%,city.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);

    if (data && data.length > 0) {
      const results: AddressSearchResult[] = data.map((a: any) => ({
        id: a.id,
        name: a.name,
        street: a.street,
        city: a.city,
        customer_id: a.customers.id,
        customer_name: a.customers.name,
        customer_phone: a.customers.phone,
        customer_email: a.customers.email,
      }));
      setSearchResults(results);
    } else {
      setSearchResults([]);
      noResultsForQueryRef.current = q;
    }
    setSearching(false);
  }, [instanceId]);

  useEffect(() => {
    if (!customerId) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => searchAddresses(query), 300);
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }
  }, [query, searchAddresses, customerId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || searchResults.length === 0) {
      if (e.key === 'Escape') setDropdownOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleSelectGlobalAddress(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setDropdownOpen(false);
        break;
    }
  };

  const handleSelectGlobalAddress = (addr: AddressSearchResult) => {
    setSelectedAddress(addr);
    setDropdownOpen(false);
    setQuery('');
    setSearchResults([]);
    setSelectedIndex(-1);
    onChange(addr.id);
    if (onCustomerResolved) {
      onCustomerResolved({
        id: addr.customer_id,
        name: addr.customer_name,
        phone: addr.customer_phone,
        email: addr.customer_email,
      }, addr.id);
    }
  };

  const handleClearGlobalAddress = () => {
    setSelectedAddress(null);
    onChange(null);
  };

  const formatAddress = (street: string | null, city: string | null) => {
    return [street, city].filter(Boolean).join(', ') || 'Adres';
  };

  // --- RENDER ---

  // When customer is selected: show Select with their addresses
  if (customerId && addresses.length > 0) {
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
          <SelectContent className="z-[1200]">
            {addresses.map((addr) => (
              <SelectItem key={addr.id} value={addr.id}>
                {formatAddress(addr.street, addr.city)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // When customer is selected but has no addresses
  if (customerId && addresses.length === 0) {
    return (
      <div className="space-y-2">
        {showLabel && (
          <Label className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {label}
          </Label>
        )}
        <p className="text-sm text-muted-foreground">Brak adresów serwisowych</p>
      </div>
    );
  }

  // No customer selected: global address search
  // If an address was already selected from global search, show it
  if (selectedAddress) {
    return (
      <div className="space-y-2">
        {showLabel && (
          <Label className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {label}
          </Label>
        )}
        <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-white">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm flex-1">{formatAddress(selectedAddress.street, selectedAddress.city)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClearGlobalAddress}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Global search input
  const showDropdown = dropdownOpen && query.length >= 2;

  return (
    <div className="space-y-2">
      {showLabel && (
        <Label className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {label}
        </Label>
      )}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => { if (query.length >= 2) setDropdownOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj adresu..."
            className="pl-9 pr-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
            {searching ? null : searchResults.length > 0 ? (
              searchResults.map((addr, i) => (
                <button
                  key={addr.id}
                  type="button"
                  className={`w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0 ${
                    i === selectedIndex ? 'bg-accent' : 'hover:bg-primary/5'
                  }`}
                  onClick={() => handleSelectGlobalAddress(addr)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span className="font-semibold text-base text-foreground">{formatAddress(addr.street, addr.city)}</span>
                  <span className="text-foreground text-sm">{addr.customer_name}</span>
                </button>
              ))
            ) : (
              <div className="p-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Nie ma klienta z takim adresem serwisowym</p>
                {onAddNew && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                      const currentQuery = query;
                      setDropdownOpen(false);
                      setQuery('');
                      onAddNew(currentQuery);
                    }}
                  >
                    Dodaj klienta
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAddressSelect;
