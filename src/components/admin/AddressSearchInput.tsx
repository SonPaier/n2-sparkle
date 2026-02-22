import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { searchAddress, type AddressSearchResult } from '@/lib/addressSearch';

interface AddressSearchInputProps {
  onSelect: (result: AddressSearchResult) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

const AddressSearchInput = ({
  onSelect,
  placeholder = 'Szukaj adresu...',
  defaultValue = '',
  className,
}: AddressSearchInputProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [displayValue, setDisplayValue] = useState(defaultValue);
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    try {
      const data = await searchAddress(q, controller.signal);
      setResults(data);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSelect = (result: AddressSearchResult) => {
    const label = [result.street, result.postal_code, result.city]
      .filter(Boolean)
      .join(', ');
    setDisplayValue(label || result.display_name);
    setOpen(false);
    setQuery('');
    setResults([]);
    onSelect(result);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal bg-background ${!displayValue ? 'text-muted-foreground' : ''} ${className || ''}`}
        >
          <MapPin className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Wpisz adres, ulicę lub miasto..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {searching ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Szukam...
                </span>
              ) : query.length < 3 ? (
                'Wpisz min. 3 znaki'
              ) : (
                'Brak wyników'
              )}
            </CommandEmpty>
            <CommandGroup>
              {results.map((r, i) => (
                <CommandItem
                  key={`${r.lat}-${r.lng}-${i}`}
                  onSelect={() => handleSelect(r)}
                  className="cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {r.street || r.city}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[r.postal_code, r.city, r.street ? '' : '']
                        .filter(Boolean)
                        .join(' ')}
                      {r.street && r.city ? ` • ${r.city}` : ''}
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

export default AddressSearchInput;
