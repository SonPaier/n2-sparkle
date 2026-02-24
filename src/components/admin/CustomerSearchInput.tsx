import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  nip?: string | null;
}

interface CustomerSearchInputProps {
  instanceId: string;
  selectedCustomer: SelectedCustomer | null;
  onSelect: (customer: SelectedCustomer) => void;
  onClear: () => void;
  onCustomerClick?: (customerId: string) => void;
}

const CustomerSearchInput = ({ instanceId, selectedCustomer, onSelect, onClear, onCustomerClick }: CustomerSearchInputProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, email, company, nip')
      .eq('instance_id', instanceId)
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`)
      .limit(10);

    setResults(data || []);
    setSearching(false);
  }, [instanceId]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(query), 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md border border-input bg-muted/30">
        <Search className="w-4 h-4 text-muted-foreground" />
        <button
          type="button"
          className="text-sm flex-1 text-left text-primary hover:underline cursor-pointer"
          onClick={() => onCustomerClick?.(selectedCustomer.id)}
        >
          {selectedCustomer.name}
          {selectedCustomer.phone ? ` • ${selectedCustomer.phone}` : ''}
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
          <Search className="w-4 h-4 mr-2" />
          Szukaj klienta w bazie...
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[1200] p-0 w-[--radix-popover-trigger-width] pointer-events-auto bg-white"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {searching ? 'Szukam...' : query.length < 2 ? 'Wpisz min. 2 znaki' : 'Brak wyników'}
            </CommandEmpty>
            <CommandGroup>
              {results.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-[15px] text-foreground">{c.name}</div>
                    <div className="text-sm text-foreground">
                      {c.phone}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CustomerSearchInput;
