import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatPhoneDisplay } from '@/lib/phoneUtils';

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  nip?: string | null;
}

interface CustomerWithAddresses extends SelectedCustomer {
  addresses: { street: string | null; city: string | null }[];
}

interface CustomerSearchInputProps {
  instanceId: string;
  selectedCustomer: SelectedCustomer | null;
  onSelect: (customer: SelectedCustomer) => void;
  onClear: () => void;
  onCustomerClick?: (customerId: string) => void;
  onAddNew?: (query: string) => void;
}

const CustomerSearchInput = ({ instanceId, selectedCustomer, onSelect, onClear, onCustomerClick, onAddNew }: CustomerSearchInputProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerWithAddresses[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const noResultsForQueryRef = useRef<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      noResultsForQueryRef.current = null;
      return;
    }

    // Skip search if extending a query that already returned no results
    if (noResultsForQueryRef.current && q.startsWith(noResultsForQueryRef.current)) {
      setResults([]);
      setSearching(false);
      return;
    }

    // Reset ref if user changed prefix (e.g. backspace)
    noResultsForQueryRef.current = null;

    setSearching(true);

    // Search customers by name, phone, company
    const { data: directMatches } = await supabase
      .from('customers')
      .select('id, name, phone, email, company, nip')
      .eq('instance_id', instanceId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`)
      .limit(10);

    // Search by address street/city
    const { data: addrMatches } = await supabase
      .from('customer_addresses')
      .select('customer_id')
      .eq('instance_id', instanceId)
      .or(`street.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(20);

    const addrCustomerIds = new Set(addrMatches?.map(a => a.customer_id) || []);
    const directIds = new Set((directMatches || []).map(c => c.id));

    // Fetch additional customers found via address but not in direct results
    const missingIds = [...addrCustomerIds].filter(id => !directIds.has(id));
    let addrCustomers: SelectedCustomer[] = [];
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, email, company, nip')
        .eq('instance_id', instanceId)
        .in('id', missingIds)
        .limit(10);
      addrCustomers = data || [];
    }

    // Merge, dedupe, limit
    const merged = [...(directMatches || []), ...addrCustomers].slice(0, 10);

    // Fetch addresses for all found customers
    const customerIds = merged.map(c => c.id);
    let addressesMap: Record<string, { street: string | null; city: string | null }[]> = {};
    if (customerIds.length > 0) {
      const { data: allAddresses } = await supabase
        .from('customer_addresses')
        .select('customer_id, street, city')
        .in('customer_id', customerIds)
        .order('sort_order');
      
      if (allAddresses) {
        for (const addr of allAddresses) {
          if (!addressesMap[addr.customer_id]) addressesMap[addr.customer_id] = [];
          addressesMap[addr.customer_id].push({ street: addr.street, city: addr.city });
        }
      }
    }

    const resultsWithAddresses: CustomerWithAddresses[] = merged.map(c => ({
      ...c,
      addresses: addressesMap[c.id] || [],
    }));

    if (resultsWithAddresses.length === 0) {
      noResultsForQueryRef.current = q;
    }

    setResults(resultsWithAddresses);
    setSearching(false);
  }, [instanceId]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  const handleSelect = (customer: CustomerWithAddresses) => {
    onSelect(customer);
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
  };

  const formatAddress = (street: string | null, city: string | null) => {
    return [street, city].filter(Boolean).join(', ');
  };

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-white">
        <Search className="w-4 h-4 text-muted-foreground" />
        <button
          type="button"
          className="text-sm flex-1 text-left text-primary hover:underline cursor-pointer"
          onClick={() => onCustomerClick?.(selectedCustomer.id)}
        >
          {selectedCustomer.name}
          {selectedCustomer.phone ? ` • ${formatPhoneDisplay(selectedCustomer.phone)}` : ''}
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder=""
          className="pl-9 pr-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
          {searching ? (
            <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Wyszukiwanie...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0 ${
                  i === selectedIndex ? 'bg-accent' : 'hover:bg-primary/5'
                }`}
                onClick={() => handleSelect(c)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="font-semibold text-base text-foreground">{c.name}</span>
                {c.addresses.length > 0 ? (
                  c.addresses.map((addr, idx) => {
                    const formatted = formatAddress(addr.street, addr.city);
                    return formatted ? (
                      <span key={idx} className="text-muted-foreground text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {formatted}
                      </span>
                    ) : null;
                  })
                ) : (
                  <span className="text-muted-foreground text-sm">Brak adresów</span>
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Brak klienta w bazie</p>
              {onAddNew && (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    const currentQuery = query;
                    setOpen(false);
                    setQuery('');
                    onAddNew(currentQuery);
                  }}
                >
                  Dodaj
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearchInput;
