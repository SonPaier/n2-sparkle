import { MapPin, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AddressSearchInput from './AddressSearchInput';
import type { AddressSearchResult } from '@/lib/addressSearch';

export interface CustomerAddress {
  id?: string;
  name: string;
  street: string;
  city: string;
  postal_code: string;
  contact_person: string;
  contact_phone: string;
  notes: string;
  is_default: boolean;
  lat?: number;
  lng?: number;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface CustomerAddressesSectionProps {
  addresses: CustomerAddress[];
  onAddressesChange: (addresses: CustomerAddress[]) => void;
  isEditing: boolean;
}

const CustomerAddressesSection = ({
  addresses,
  onAddressesChange,
  isEditing,
}: CustomerAddressesSectionProps) => {
  const activeAddresses = addresses.filter(a => !a._deleted);

  const addEmpty = () => {
    onAddressesChange([{
      name: '',
      street: '',
      city: '',
      postal_code: '',
      contact_person: '',
      contact_phone: '',
      notes: '',
      is_default: false,
      _isNew: true,
    }, ...addresses]);
  };

  const addFromSearch = (result: AddressSearchResult) => {
    onAddressesChange([{
      name: '',
      street: result.street,
      city: result.city,
      postal_code: result.postal_code,
      contact_person: '',
      contact_phone: '',
      notes: '',
      is_default: false,
      lat: result.lat,
      lng: result.lng,
      _isNew: true,
    }, ...addresses]);
  };

  const remove = (index: number) => {
    const addr = addresses[index];
    if (addr.id && !addr._isNew) {
      onAddressesChange(addresses.map((a, i) => i === index ? { ...a, _deleted: true } : a));
    } else {
      onAddressesChange(addresses.filter((_, i) => i !== index));
    }
  };

  const update = (index: number, field: keyof CustomerAddress, value: string | boolean) => {
    onAddressesChange(addresses.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  if (!isEditing) {
    if (activeAddresses.length === 0) return null;
    return (
      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Adresy serwisowe
        </h4>
        <div className="space-y-2">
          {activeAddresses.map((addr, idx) => (
            <div key={addr.id || idx} className="p-3 border border-border rounded-lg text-sm space-y-1">
              <div className="font-medium">{addr.name}</div>
              {addr.street && <div className="text-muted-foreground">{addr.street}</div>}
              {(addr.postal_code || addr.city) && (
                <div className="text-muted-foreground">
                  {addr.postal_code} {addr.city}
                </div>
              )}
              {addr.contact_person && (
                <div className="text-muted-foreground">
                  Kontakt: {addr.contact_person} {addr.contact_phone && `• ${addr.contact_phone}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4" />
        Adresy serwisowe
      </h3>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <AddressSearchInput
            onSelect={addFromSearch}
            placeholder="Szukaj adresu..."
            className="bg-background"
          />
        </div>
        <Button variant="outline" size="sm" onClick={addEmpty}>
          <Plus className="w-3 h-3 mr-1" />
          Dodaj
        </Button>
      </div>

      {activeAddresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak adresów</p>
      ) : (
        <div className="space-y-4">
          {addresses.map((addr, idx) => {
            if (addr._deleted) return null;
            return (
              <div key={addr.id || `new-${idx}`} className="p-3 border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Adres #{activeAddresses.indexOf(addr) + 1}</span>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => remove(idx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input
                  value={addr.name}
                  onChange={e => update(idx, 'name', e.target.value)}
                  placeholder="Nazwa lokalizacji *"
                  className="text-sm bg-background"
                />
                <Input
                  value={addr.street}
                  onChange={e => update(idx, 'street', e.target.value)}
                  placeholder="Ulica"
                  className="text-sm bg-background"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={addr.city}
                    onChange={e => update(idx, 'city', e.target.value)}
                    placeholder="Miasto"
                    className="text-sm bg-background"
                  />
                  <Input
                    value={addr.postal_code}
                    onChange={e => update(idx, 'postal_code', e.target.value)}
                    placeholder="Kod pocztowy"
                    className="text-sm bg-background"
                  />
                </div>
                <Input
                  value={addr.contact_person}
                  onChange={e => update(idx, 'contact_person', e.target.value)}
                  placeholder="Osoba kontaktowa"
                  className="text-sm bg-background"
                />
                <Input
                  value={addr.contact_phone}
                  onChange={e => update(idx, 'contact_phone', e.target.value)}
                  placeholder="Telefon kontaktowy"
                  className="text-sm bg-background"
                />
                <Textarea
                  value={addr.notes}
                  onChange={e => update(idx, 'notes', e.target.value)}
                  placeholder="Notatki do adresu"
                  rows={2}
                  className="text-sm bg-background"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerAddressesSection;
