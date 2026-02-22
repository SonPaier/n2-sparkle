import { useState, useEffect } from 'react';
import { Phone, MessageSquare, Mail, MapPin, X, Plus, Trash2, ChevronDown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phoneUtils';
import type { Customer } from './CustomersView';

interface CustomerAddress {
  id?: string;
  name: string;
  street: string;
  city: string;
  postal_code: string;
  contact_person: string;
  contact_phone: string;
  notes: string;
  is_default: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface CustomerEditDrawerProps {
  customer: Customer | null;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
  onCustomerUpdated?: () => void;
  isAddMode?: boolean;
}

const CustomerEditDrawer = ({
  customer,
  instanceId,
  open,
  onClose,
  onCustomerUpdated,
  isAddMode = false,
}: CustomerEditDrawerProps) => {
  const isMobile = useIsMobile();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(isAddMode);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editBillingStreet, setEditBillingStreet] = useState('');
  const [editBillingCity, setEditBillingCity] = useState('');
  const [editBillingPostalCode, setEditBillingPostalCode] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [saving, setSaving] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (isAddMode) {
        setIsEditing(true);
        setEditName('');
        setEditPhone('');
        setEditEmail('');
        setEditNotes('');
        setEditCompany('');
        setEditNip('');
        setEditContactPerson('');
        setEditContactPhone('');
        setEditContactEmail('');
        setEditBillingStreet('');
        setEditBillingCity('');
        setEditBillingPostalCode('');
        setAddresses([]);
      } else if (customer) {
        setIsEditing(false);
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditEmail(customer.email || '');
        setEditNotes(customer.notes || '');
        setEditCompany(customer.company || '');
        setEditNip(customer.nip || '');
        setEditContactPerson(customer.contact_person || '');
        setEditContactPhone(customer.contact_phone || '');
        setEditContactEmail(customer.contact_email || '');
        setEditBillingStreet(customer.billing_street || '');
        setEditBillingCity(customer.billing_city || '');
        setEditBillingPostalCode(customer.billing_postal_code || '');
        fetchAddresses(customer.id);
      }
    }
  }, [customer, open, isAddMode]);

  const fetchAddresses = async (customerId: string) => {
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('sort_order');

    if (data) {
      setAddresses(data.map(a => ({
        id: a.id,
        name: a.name,
        street: a.street || '',
        city: a.city || '',
        postal_code: a.postal_code || '',
        contact_person: a.contact_person || '',
        contact_phone: a.contact_phone || '',
        notes: a.notes || '',
        is_default: a.is_default || false,
      })));
    }
  };

  const handleCall = () => {
    if (customer) window.location.href = `tel:${customer.phone}`;
  };

  const handleSms = () => {
    if (customer) window.location.href = `sms:${customer.phone}`;
  };

  const handleSaveCustomer = async () => {
    if (!instanceId) return;
    if (!editName.trim() || !editPhone.trim()) {
      toast.error('Nazwa i telefon są wymagane');
      return;
    }

    setSaving(true);
    try {
      let customerId: string | undefined;

      const customerData = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        notes: editNotes.trim() || null,
        company: editCompany.trim() || null,
        nip: editNip.trim() || null,
        contact_person: editContactPerson.trim() || null,
        contact_phone: editContactPhone.trim() || null,
        contact_email: editContactEmail.trim() || null,
        billing_street: editBillingStreet.trim() || null,
        billing_city: editBillingCity.trim() || null,
        billing_postal_code: editBillingPostalCode.trim() || null,
      };

      if (isAddMode) {
        const normalizedPhone = normalizePhone(editPhone.trim());

        // Check duplicate
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existing.id);
          if (error) throw error;
          customerId = existing.id;
          toast.success('Zaktualizowano istniejącego klienta');
        } else {
          const { data: newCustomer, error } = await supabase
            .from('customers')
            .insert({
              instance_id: instanceId,
              phone: normalizedPhone,
              source: 'manual',
              ...customerData,
            })
            .select('id')
            .single();
          if (error) throw error;
          customerId = newCustomer?.id;
        }
      } else if (customer) {
        const { error } = await supabase
          .from('customers')
          .update({
            ...customerData,
            phone: normalizePhone(editPhone.trim()),
          })
          .eq('id', customer.id);
        if (error) throw error;
        customerId = customer.id;
      }

      // Save addresses
      if (customerId) {
        await syncAddresses(customerId);
      }

      toast.success('Klient zapisany');
      onCustomerUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Błąd zapisywania klienta');
    } finally {
      setSaving(false);
    }
  };

  const syncAddresses = async (customerId: string) => {
    if (!instanceId) return;

    // Delete removed addresses
    const deletedIds = addresses.filter(a => a._deleted && a.id).map(a => a.id!);
    if (deletedIds.length > 0) {
      await supabase.from('customer_addresses').delete().in('id', deletedIds);
    }

    // Upsert remaining
    const activeAddresses = addresses.filter(a => !a._deleted);
    for (let i = 0; i < activeAddresses.length; i++) {
      const addr = activeAddresses[i];
      const addrData = {
        customer_id: customerId,
        instance_id: instanceId,
        name: addr.name.trim(),
        street: addr.street.trim() || null,
        city: addr.city.trim() || null,
        postal_code: addr.postal_code.trim() || null,
        contact_person: addr.contact_person.trim() || null,
        contact_phone: addr.contact_phone.trim() || null,
        notes: addr.notes.trim() || null,
        is_default: addr.is_default,
        sort_order: i,
      };

      if (addr.id && !addr._isNew) {
        await supabase.from('customer_addresses').update(addrData).eq('id', addr.id);
      } else {
        await supabase.from('customer_addresses').insert(addrData);
      }
    }
  };

  const handleCancelEdit = () => {
    if (isAddMode) {
      onClose();
    } else {
      setIsEditing(false);
      if (customer) {
        setEditName(customer.name);
        setEditPhone(customer.phone);
        setEditEmail(customer.email || '');
        setEditNotes(customer.notes || '');
        setEditCompany(customer.company || '');
        setEditNip(customer.nip || '');
        setEditContactPerson(customer.contact_person || '');
        setEditContactPhone(customer.contact_phone || '');
        setEditContactEmail(customer.contact_email || '');
        setEditBillingStreet(customer.billing_street || '');
        setEditBillingCity(customer.billing_city || '');
        setEditBillingPostalCode(customer.billing_postal_code || '');
        fetchAddresses(customer.id);
      }
    }
  };

  const handleClose = () => {
    setIsEditing(isAddMode);
    onClose();
  };

  const addAddress = () => {
    setAddresses(prev => [...prev, {
      name: '',
      street: '',
      city: '',
      postal_code: '',
      contact_person: '',
      contact_phone: '',
      notes: '',
      is_default: false,
      _isNew: true,
    }]);
  };

  const removeAddress = (index: number) => {
    setAddresses(prev => {
      const addr = prev[index];
      if (addr.id && !addr._isNew) {
        // Mark as deleted
        return prev.map((a, i) => i === index ? { ...a, _deleted: true } : a);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateAddress = (index: number, field: keyof CustomerAddress, value: string | boolean) => {
    setAddresses(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  if (!customer && !isAddMode) return null;

  const activeAddresses = addresses.filter(a => !a._deleted);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        className="w-full sm:max-w-md p-0 flex flex-col"
        hideCloseButton
        onFocusOutside={(e) => e.preventDefault()}
      >
        <div className="p-6 flex-1 overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 flex-1 min-w-0">
                <div className="text-xl font-semibold truncate">
                  {isAddMode ? 'Nowy klient' : (isEditing ? editName || customer?.name : customer?.name)}
                </div>
                {!isAddMode && !isEditing && (
                  <div className="flex items-center gap-1 ml-2">
                    <Button variant="ghost" size="icon" onClick={handleSms} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCall} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </SheetTitle>
              <button type="button" onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {isAddMode || isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Nazwa *</Label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Imię i nazwisko / firma" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Telefon *</Label>
                  <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+48..." />
                </div>
                <div>
                  <Label className="mb-1.5 block">Email</Label>
                  <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Firma</Label>
                  <Input value={editCompany} onChange={e => setEditCompany(e.target.value)} placeholder="Nazwa firmy" />
                </div>
                <div>
                  <Label className="mb-1.5 block">NIP</Label>
                  <Input value={editNip} onChange={e => setEditNip(e.target.value)} placeholder="NIP" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Osoba kontaktowa</Label>
                  <Input value={editContactPerson} onChange={e => setEditContactPerson(e.target.value)} placeholder="Osoba kontaktowa" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Telefon kontaktowy</Label>
                  <Input value={editContactPhone} onChange={e => setEditContactPhone(e.target.value)} placeholder="Telefon kontaktowy" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Notatki</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notatki..." rows={3} />
                </div>

                {/* Billing data - collapsible */}
                <Collapsible open={billingOpen} onOpenChange={setBillingOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full py-2">
                    <ChevronDown className={`w-4 h-4 transition-transform ${billingOpen ? 'rotate-180' : ''}`} />
                    Dane do faktury
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div>
                      <Label className="mb-1.5 block text-xs">Ulica</Label>
                      <Input value={editBillingStreet} onChange={e => setEditBillingStreet(e.target.value)} placeholder="Ulica" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Miasto</Label>
                      <Input value={editBillingCity} onChange={e => setEditBillingCity(e.target.value)} placeholder="Miasto" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Kod pocztowy</Label>
                      <Input value={editBillingPostalCode} onChange={e => setEditBillingPostalCode(e.target.value)} placeholder="00-000" />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Addresses section */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Adresy serwisowe
                    </h3>
                    <Button variant="outline" size="sm" onClick={addAddress}>
                      <Plus className="w-3 h-3 mr-1" />
                      Dodaj adres
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
                              <span className="text-xs font-medium text-muted-foreground">Adres #{idx + 1}</span>
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => removeAddress(idx)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <Input
                              value={addr.name}
                              onChange={e => updateAddress(idx, 'name', e.target.value)}
                              placeholder="Nazwa lokalizacji *"
                              className="text-sm"
                            />
                            <Input
                              value={addr.street}
                              onChange={e => updateAddress(idx, 'street', e.target.value)}
                              placeholder="Ulica"
                              className="text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={addr.city}
                                onChange={e => updateAddress(idx, 'city', e.target.value)}
                                placeholder="Miasto"
                                className="text-sm"
                              />
                              <Input
                                value={addr.postal_code}
                                onChange={e => updateAddress(idx, 'postal_code', e.target.value)}
                                placeholder="Kod pocztowy"
                                className="text-sm"
                              />
                            </div>
                            <Input
                              value={addr.contact_person}
                              onChange={e => updateAddress(idx, 'contact_person', e.target.value)}
                              placeholder="Osoba kontaktowa"
                              className="text-sm"
                            />
                            <Input
                              value={addr.contact_phone}
                              onChange={e => updateAddress(idx, 'contact_phone', e.target.value)}
                              placeholder="Telefon kontaktowy"
                              className="text-sm"
                            />
                            <Textarea
                              value={addr.notes}
                              onChange={e => updateAddress(idx, 'notes', e.target.value)}
                              placeholder="Notatki do adresu"
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // View mode
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-lg">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{customer?.phone}</span>
                </div>

                <div className="space-y-2 text-sm">
                  {customer?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer?.company && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Firma:</span> {customer.company}
                    </div>
                  )}
                  {customer?.nip && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">NIP:</span> {customer.nip}
                    </div>
                  )}
                  {customer?.contact_person && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Osoba kontaktowa:</span> {customer.contact_person}
                    </div>
                  )}
                </div>

                {/* Addresses (read-only) */}
                {activeAddresses.length > 0 && (
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
                )}

                {customer?.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notatki</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="p-4 bg-background border-t shrink-0">
          {isAddMode || isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="flex-1">
                Anuluj
              </Button>
              <Button onClick={handleSaveCustomer} disabled={saving} className="flex-1">
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full">
              Edytuj
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CustomerEditDrawer;
