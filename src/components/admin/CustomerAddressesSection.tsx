import { Plus, Trash2, UserPlus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AddressSearchInput from './AddressSearchInput';
import type { AddressSearchResult } from '@/lib/addressSearch';

export interface AddressContact {
  name: string;
  phone: string;
  email: string;
}

export interface CustomerAddress {
  id?: string;
  name: string;
  street: string;
  city: string;
  postal_code: string;
  contacts: AddressContact[];
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
      contacts: [{ name: '', phone: '', email: '' }],
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
      contacts: [{ name: '', phone: '', email: '' }],
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
    onAddressesChange(addresses.map((a, i) => {
      if (i !== index) return a;
      const updated = { ...a, [field]: value };
      if (field === 'street' || field === 'city') {
        updated.name = [field === 'street' ? value : a.street, field === 'city' ? value : a.city].filter(Boolean).join(', ') || 'Adres';
      }
      return updated;
    }));
  };

  const updateContact = (addrIndex: number, contactIndex: number, field: keyof AddressContact, value: string) => {
    onAddressesChange(addresses.map((a, i) => {
      if (i !== addrIndex) return a;
      const newContacts = [...a.contacts];
      newContacts[contactIndex] = { ...newContacts[contactIndex], [field]: value };
      return { ...a, contacts: newContacts };
    }));
  };

  const addContact = (addrIndex: number) => {
    onAddressesChange(addresses.map((a, i) => {
      if (i !== addrIndex) return a;
      return { ...a, contacts: [...a.contacts, { name: '', phone: '', email: '' }] };
    }));
  };

  const removeContact = (addrIndex: number, contactIndex: number) => {
    onAddressesChange(addresses.map((a, i) => {
      if (i !== addrIndex) return a;
      const newContacts = a.contacts.filter((_, ci) => ci !== contactIndex);
      return { ...a, contacts: newContacts.length > 0 ? newContacts : [{ name: '', phone: '', email: '' }] };
    }));
  };

  if (!isEditing) {
    if (activeAddresses.length === 0) return null;

    const buildMapsUrl = (addr: CustomerAddress) => {
      if (addr.lat && addr.lng) return `https://www.google.com/maps?q=${addr.lat},${addr.lng}`;
      const query = [addr.street, addr.city, addr.postal_code].filter(Boolean).join(', ');
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    };

    return (
      <div>
        <h4 className="text-sm font-medium mb-2">Adresy serwisowe</h4>
        <div className="space-y-2">
          {activeAddresses.map((addr, idx) => (
            <div key={addr.id || idx} className="bg-white p-3 border border-border rounded-lg text-sm space-y-1 shadow-sm">
              {addr.street && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={buildMapsUrl(addr)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:text-primary flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {addr.street}
                  </a>
                </div>
              )}
              {(addr.postal_code || addr.city) && (
                <div className="text-foreground pl-5">
                  {addr.postal_code} {addr.city}
                </div>
              )}
              {addr.contacts.filter(c => c.name || c.phone || c.email).map((c, ci) => (
                <div key={ci} className="text-foreground">
                  {c.name && <span>Kontakt: {c.name}</span>}
                  {c.phone && <span> • {c.phone}</span>}
                  {c.email && <span> • {c.email}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <h3 className="text-sm font-medium mb-3">Adresy serwisowe</h3>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <AddressSearchInput
            onSelect={addFromSearch}
            placeholder="Szukaj adresu..."
            className="bg-card"
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
                  placeholder="Nazwa własna (opcjonalnie)"
                  className="text-sm bg-background"
                />
                <Input
                  value={addr.street}
                  onChange={e => update(idx, 'street', e.target.value)}
                  placeholder="Ulica *"
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

                {/* Osoby kontaktowe per adres */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-medium text-muted-foreground">Osoby kontaktowe</span>
                  {addr.contacts.map((contact, ci) => (
                    <div key={ci} className="space-y-2 p-2 border border-border/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <Input
                          value={contact.name}
                          onChange={e => updateContact(idx, ci, 'name', e.target.value)}
                          placeholder="Imię i nazwisko"
                          className="text-sm bg-background flex-1"
                        />
                        {addr.contacts.length > 1 && (
                          <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 text-destructive" onClick={() => removeContact(idx, ci)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={contact.phone}
                          onChange={e => updateContact(idx, ci, 'phone', e.target.value)}
                          placeholder="Telefon"
                          className="text-sm bg-background"
                        />
                        <Input
                          value={contact.email}
                          onChange={e => updateContact(idx, ci, 'email', e.target.value)}
                          placeholder="Email (opcjonalnie)"
                          className="text-sm bg-background"
                        />
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addContact(idx)} className="text-xs h-7 px-2">
                    <UserPlus className="w-3 h-3 mr-1" />
                    Dodaj osobę
                  </Button>
                </div>

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
