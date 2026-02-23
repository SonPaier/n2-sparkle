import { useState, useEffect } from 'react';
import { Phone, MessageSquare, Mail, X, ChevronDown, CalendarPlus } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from './AdminTabsList';
import CustomerOrdersTab from './CustomerOrdersTab';
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
import CustomerAddressesSection, { type CustomerAddress } from './CustomerAddressesSection';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phoneUtils';
import type { Customer } from './CustomersView';
import AddCalendarItemDialog from './AddCalendarItemDialog';

interface CalendarColumn {
  id: string;
  name: string;
}

interface CustomerEditDrawerProps {
  customer: Customer | null;
  instanceId: string | null;
  open: boolean;
  onClose: () => void;
  onCustomerUpdated?: () => void;
  isAddMode?: boolean;
  prefilledAddressId?: string;
  prefilledServiceIds?: string[];
  prefilledServiceNames?: string[];
  onNewOrderCreated?: () => void;
}

const CustomerEditDrawer = ({
  customer,
  instanceId,
  open,
  onClose,
  onCustomerUpdated,
  isAddMode = false,
  prefilledAddressId,
  prefilledServiceIds,
  prefilledServiceNames,
  onNewOrderCreated,
}: CustomerEditDrawerProps) => {
  const isMobile = useIsMobile();
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(isAddMode);
  const [activeTab, setActiveTab] = useState('dane');
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

  // Fetch calendar columns for new order dialog
  useEffect(() => {
    if (!open || !instanceId || isAddMode) return;
    const fetchColumns = async () => {
      const { data } = await supabase
        .from('calendar_columns')
        .select('id, name')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      if (data) setColumns(data);
    };
    fetchColumns();
  }, [open, instanceId, isAddMode]);

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
        lat: a.lat ?? undefined,
        lng: a.lng ?? undefined,
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
        lat: addr.lat ?? null,
        lng: addr.lng ?? null,
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



  return (
    <>
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
                    <Button variant="ghost" size="icon" onClick={() => setNewOrderOpen(true)} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted">
                      <CalendarPlus className="w-4 h-4" />
                    </Button>
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


          {isAddMode ? (
            /* Add mode: no tabs */
            <div className="mt-6">
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

                <CustomerAddressesSection
                  addresses={addresses}
                  onAddressesChange={setAddresses}
                  isEditing={true}
                />
              </div>
            </div>
          ) : (
            /* View/Edit mode: with tabs */
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <AdminTabsList columns={2}>
                <AdminTabsTrigger value="dane">Dane</AdminTabsTrigger>
                <AdminTabsTrigger value="zlecenia">Zlecenia</AdminTabsTrigger>
              </AdminTabsList>

              <TabsContent value="dane">
                {isEditing ? (
                  <div className="space-y-4 mt-4">
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

                    <CustomerAddressesSection
                      addresses={addresses}
                      onAddressesChange={setAddresses}
                      isEditing={true}
                    />
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
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

                    <CustomerAddressesSection
                      addresses={addresses}
                      onAddressesChange={setAddresses}
                      isEditing={false}
                    />

                    {customer?.notes && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Notatki</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="zlecenia">
                {customer && instanceId && (
                  <CustomerOrdersTab customerId={customer.id} instanceId={instanceId} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

      {/* Sticky footer - only show for add mode or when on "dane" tab */}
      {(isAddMode || activeTab === 'dane') && (
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
      )}
    </SheetContent>
  </Sheet>

  {/* New Order Dialog */}
  {customer && instanceId && (
    <AddCalendarItemDialog
      open={newOrderOpen}
      onClose={() => setNewOrderOpen(false)}
      instanceId={instanceId}
      columns={columns}
      onSuccess={() => {
        setNewOrderOpen(false);
        toast.success('Zlecenie dodane');
        onNewOrderCreated?.();
      }}
      initialCustomerId={customer.id}
      initialCustomerName={customer.name}
      initialCustomerPhone={customer.phone}
      initialCustomerEmail={customer.email || undefined}
      initialCustomerAddressId={prefilledAddressId}
      initialServiceIds={prefilledServiceIds}
    />
  )}
  </>
  );
};

export default CustomerEditDrawer;
