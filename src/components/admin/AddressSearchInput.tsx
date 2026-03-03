import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const [query, setQuery] = useState('');
  const [displayValue, setDisplayValue] = useState(defaultValue);
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isEditing, setIsEditing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setOpen(false);
        setIsEditing(false);
      }
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
        setIsEditing(false);
        break;
    }
  };

  const handleSelect = (result: AddressSearchResult) => {
    const label = [result.street, result.postal_code, result.city]
      .filter(Boolean)
      .join(', ');
    setDisplayValue(label || result.display_name);
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setIsEditing(false);
    onSelect(result);
  };

  const showDropdown = open && query.length >= 3 && (results.length > 0 || searching);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={isEditing ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSelectedIndex(-1);
            if (!isEditing) setIsEditing(true);
          }}
          onFocus={() => {
            setIsEditing(true);
            setQuery('');
            if (query.length >= 3) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-9 pr-9 ${className || ''}`}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              className={`w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0 ${
                i === selectedIndex ? 'bg-accent' : 'hover:bg-primary/5'
              }`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-medium text-base text-foreground">{r.street || r.city}</span>
                {r.postal_code && <span className="text-sm text-muted-foreground ml-2 shrink-0">{r.postal_code}</span>}
              </div>
              <span className="text-sm text-muted-foreground">
                {[r.city, r.region].filter(Boolean).join(', ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressSearchInput;
