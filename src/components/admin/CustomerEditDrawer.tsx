import { useState, useEffect, useRef } from 'react';
import { Phone, MessageSquare, X, ChevronDown, CalendarPlus } from 'lucide-react';
import type { SelectedCustomer } from './CustomerSearchInput';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { LightTabsList, LightTabsTrigger } from '@/components/ui/light-tabs';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CustomerAddressesSection, { type CustomerAddress } from './CustomerAddressesSection';
import NipLookupForm, { type NipLookupData } from './NipLookupForm';
import { supabase } from '@/integrations/supabase/client';

import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phoneUtils';
import type { Customer } from './CustomersView';
import { useCustomerCategories, type CustomerCategory } from '@/hooks/useCustomerCategories';
import { syncCustomerCategoryAssignments } from '@/hooks/useCustomerCategories';
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
  onCustomerCreated?: (customer: SelectedCustomer, firstAddressId?: string) => void;
  customerCategories?: CustomerCategory[];
  customerCategoryMap?: Map<string, string[]>;
  prefilledName?: string;
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
  onCustomerCreated,
  customerCategories: customerCategoriesProp = [],
  customerCategoryMap: customerCategoryMapProp,
  prefilledName = '',
}: CustomerEditDrawerProps) => {
  
  
  // Auto-fetch categories when not provided via props
  const { categories: fetchedCategories, customerCategoryMap: fetchedCategoryMap } = useCustomerCategories(
    customerCategoriesProp.length === 0 && open ? instanceId : null
  );
  const customerCategories = customerCategoriesProp.length > 0 ? customerCategoriesProp : fetchedCategories;
  const customerCategoryMap = customerCategoryMapProp ?? fetchedCategoryMap;
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [columns, setColumns] = useState<CalendarColumn[]>([]);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(isAddMode);
  const [activeTab, setActiveTab] = useState('dane');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Company data (NipLookupForm)
  const [companyData, setCompanyData] = useState<NipLookupData>({
    nip: '', company: '', billingStreet: '', billingPostalCode: '', billingCity: '',
  });
  const [companyOpen, setCompanyOpen] = useState(false);

  const prevOpenRef = useRef(false);
  const prevCustomerIdRef = useRef<string | null>(null);

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
    const justOpened = open && !prevOpenRef.current;
    const customerChanged = !!customer?.id && customer.id !== prevCustomerIdRef.current;

    if (open && (justOpened || isAddMode || customerChanged)) {
      if (isAddMode) {
        setIsEditing(true);
        setEditName(prefilledName || '');
        setEditPhone('');
        setEditEmail('');
        setEditNotes('');
        setAddresses([]);
        setSelectedCategoryIds([]);

        setCompanyData({ nip: '', company: '', billingStreet: '', billingPostalCode: '', billingCity: '' });
        setCompanyOpen(false);
      } else if (customer) {
        setIsEditing(false);
        setEditName(customer.name);
        setEditPhone(customer.phone || '');
        setEditEmail(customer.email || '');
        setEditNotes(customer.notes || '');
        fetchAddresses(customer.id);
        setSelectedCategoryIds(customerCategoryMap?.get(customer.id) || []);

        setCompanyData({
          nip: customer.nip || '',
          company: customer.company || '',
          billingStreet: customer.billing_street || '',
          billingPostalCode: customer.billing_postal_code || '',
          billingCity: customer.billing_city || '',
        });
        const hasExisting = !!(customer.nip || customer.company || customer.billing_street || customer.billing_city);
        setCompanyOpen(hasExisting);
      }
    }

    prevOpenRef.current = open;
    prevCustomerIdRef.current = customer?.id || null;
  }, [customer, open, isAddMode, prefilledName]);

  useEffect(() => {
    if (!open || isAddMode || !customer || isEditing) return;
    setSelectedCategoryIds(customerCategoryMap?.get(customer.id) || []);
  }, [customerCategoryMap, customer?.id, open, isAddMode, isEditing]);

  const fetchAddresses = async (customerId: string) => {
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('sort_order');

    if (data) {
      setAddresses(data.map(a => {
        // Build contacts array from DB: contacts JSONB + legacy contact_person/contact_phone
        let contacts: { name: string; phone: string; email: string }[] = [];
        const dbContacts = (a as any).contacts;
        if (Array.isArray(dbContacts) && dbContacts.length > 0) {
          contacts = dbContacts.map((c: any) => ({ name: c.name || '', phone: c.phone || '', email: c.email || '' }));
        } else if (a.contact_person || a.contact_phone) {
          contacts = [{ name: a.contact_person || '', phone: a.contact_phone || '', email: '' }];
        }
        if (contacts.length === 0) contacts = [{ name: '', phone: '', email: '' }];
        return {
          id: a.id,
          name: a.name,
          street: a.street || '',
          city: a.city || '',
          postal_code: a.postal_code || '',
          contacts,
          notes: a.notes || '',
          is_default: a.is_default || false,
          lat: a.lat ?? undefined,
          lng: a.lng ?? undefined,
        };
      }));
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
    if (!(editName || '').trim()) {
      toast.error('Imię i nazwisko jest wymagane');
      return;
    }

    setSaving(true);
    try {
      let customerId: string | undefined;

      const customerData = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        notes: editNotes.trim() || null,
        company: companyData.company.trim() || null,
        nip: companyData.nip.trim() || null,
        billing_street: companyData.billingStreet.trim() || null,
        billing_city: companyData.billingCity.trim() || null,
        billing_postal_code: companyData.billingPostalCode.trim() || null,
      };

      if (isAddMode) {
        const normalizedPhone = normalizePhone(editPhone.trim());

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

      let firstAddressId: string | undefined;
      if (customerId) {
        firstAddressId = await syncAddresses(customerId);
        if (instanceId) {
          await syncCustomerCategoryAssignments(customerId, instanceId, selectedCategoryIds);
        }
      }

      if (isAddMode && customerId && onCustomerCreated) {
        onCustomerCreated({
          id: customerId,
          name: editName.trim(),
          phone: normalizePhone(editPhone.trim()),
          email: editEmail.trim() || null,
          company: companyData.company.trim() || null,
          nip: companyData.nip.trim() || null,
        }, firstAddressId);
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

  const syncAddresses = async (customerId: string): Promise<string | undefined> => {
    if (!instanceId) return undefined;

    const deletedIds = addresses.filter(a => a._deleted && a.id).map(a => a.id!);
    if (deletedIds.length > 0) {
      await supabase.from('customer_addresses').delete().in('id', deletedIds);
    }

    const activeAddresses = addresses.filter(a => !a._deleted);
    let firstAddressId: string | undefined;
    for (let i = 0; i < activeAddresses.length; i++) {
      const addr = activeAddresses[i];
      const addrData = {
        customer_id: customerId,
        instance_id: instanceId,
        name: addr.name.trim(),
        street: addr.street.trim() || null,
        city: addr.city.trim() || null,
        postal_code: addr.postal_code.trim() || null,
        contact_person: addr.contacts[0]?.name?.trim() || null,
        contact_phone: addr.contacts[0]?.phone?.trim() || null,
        contacts: addr.contacts.filter(c => c.name || c.phone || c.email) as unknown as import('@/integrations/supabase/types').Json,
        notes: addr.notes.trim() || null,
        is_default: addr.is_default,
        sort_order: i,
        lat: addr.lat ?? null,
        lng: addr.lng ?? null,
      };

      if (addr.id && !addr._isNew) {
        await supabase.from('customer_addresses').update(addrData).eq('id', addr.id);
        if (i === 0) firstAddressId = addr.id;
      } else {
        const { data: inserted } = await supabase.from('customer_addresses').insert(addrData).select('id').single();
        if (i === 0 && inserted) firstAddressId = inserted.id;
      }
    }
    return firstAddressId;
  };

  const handleCancelEdit = () => {
    if (isAddMode) {
      onClose();
    } else {
      setIsEditing(false);
      if (customer) {
        setEditName(customer.name);
        setEditPhone(customer.phone || '');
        setEditEmail(customer.email || '');
        setEditNotes(customer.notes || '');
        fetchAddresses(customer.id);
        setSelectedCategoryIds(customerCategoryMap?.get(customer.id) || []);

        setCompanyData({
          nip: customer.nip || '', company: customer.company || '',
          billingStreet: customer.billing_street || '', billingPostalCode: customer.billing_postal_code || '',
          billingCity: customer.billing_city || '',
        });
      }
    }
  };

  const handleClose = () => {
    setIsEditing(isAddMode);
    onClose();
  };

  // Shared form content for both add and edit modes
  const renderFormContent = (prefix: string) => (
    <div className="space-y-4">
      {/* === SECTION: Informacje podstawowe === */}
      <h3 className="text-sm font-semibold text-foreground">Informacje podstawowe</h3>
      <div>
        <Label className="mb-1.5 block">Imię i nazwisko *</Label>
        <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Imię i nazwisko" />
      </div>
      <div>
        <Label className="mb-1.5 block">Telefon *</Label>
        <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+48..." />
      </div>
      <div>
        <Label className="mb-1.5 block">Email</Label>
        <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" />
      </div>

      <CustomerAddressesSection
        addresses={addresses}
        onAddressesChange={setAddresses}
        isEditing={true}
      />

      {customerCategories.length > 0 && (
        <div>
          <Label className="mb-1.5 block">Kategorie</Label>
          <div className="space-y-1.5">
            {customerCategories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${prefix}-cat-${cat.id}`}
                  checked={selectedCategoryIds.includes(cat.id)}
                  onCheckedChange={(checked) => {
                    setSelectedCategoryIds(prev =>
                      checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id)
                    );
                  }}
                />
                <Label htmlFor={`${prefix}-cat-${cat.id}`} className="text-sm cursor-pointer font-normal">
                  {cat.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Notatki</Label>
        <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notatki..." rows={3} />
      </div>


      {/* === SECTION: Dane firmy === */}
      <Separator />
      <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
          <ChevronDown className={`w-4 h-4 transition-transform ${companyOpen ? 'rotate-180' : ''}`} />
          Dane firmy
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <NipLookupForm value={companyData} onChange={setCompanyData} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // View mode content
  const renderViewContent = () => (
    <div className="space-y-4 mt-4">
      {/* === Informacje podstawowe === */}
      <h3 className="text-sm font-semibold text-foreground">Informacje podstawowe</h3>
      <div className="space-y-1.5">
        <div className="text-[15px] font-medium text-foreground">{customer?.phone}</div>
        {customer?.email && (
          <div className="text-[15px] text-foreground">{customer.email}</div>
        )}
      </div>

      <CustomerAddressesSection
        addresses={addresses}
        onAddressesChange={setAddresses}
        isEditing={false}
      />

      {selectedCategoryIds.length > 0 && customerCategories.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1.5">Kategorie</h4>
          <div className="flex flex-wrap gap-1">
            {selectedCategoryIds.map(catId => {
              const cat = customerCategories.find(c => c.id === catId);
              return cat ? (
                <Badge key={catId} variant="secondary" className="text-xs">{cat.name}</Badge>
              ) : null;
            })}
          </div>
        </div>
      )}

      {customer?.notes && (
        <div>
          <h4 className="text-sm font-medium mb-2">Notatki</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}

      {/* === Dane firmy === */}
      {companyData.nip && (
        <>
          <Separator />
          <h3 className="text-sm font-semibold text-foreground">Dane firmy</h3>
          <NipLookupForm value={companyData} onChange={() => {}} readOnly />
        </>
      )}
    </div>
  );

  return (
    <>
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <SheetContent
        className="w-full sm:w-[550px] sm:max-w-[550px] h-full p-0 flex flex-col z-[1400]"
        hideCloseButton
        hideOverlay
        onFocusOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
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
                    <Button variant="ghost" size="icon" onClick={() => setNewOrderOpen(true)} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-primary/5">
                      <CalendarPlus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleSms} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-primary/5">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCall} className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-primary/5">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </SheetTitle>
              <button type="button" onClick={handleClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </SheetHeader>

          {isAddMode ? (
            <div className="mt-6">
              {renderFormContent('add')}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <LightTabsList>
                <LightTabsTrigger value="dane">Dane</LightTabsTrigger>
                <LightTabsTrigger value="zlecenia">Zlecenia</LightTabsTrigger>
              </LightTabsList>

              <TabsContent value="dane">
                {isEditing ? (
                  <div className="mt-4">
                    {renderFormContent('edit')}
                  </div>
                ) : (
                  renderViewContent()
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

      {(isAddMode || activeTab === 'dane') && (
        <div className="p-4 bg-card border-t shrink-0">
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
