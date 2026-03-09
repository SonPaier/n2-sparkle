import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CustomerSearchInput, { type SelectedCustomer } from '../CustomerSearchInput';
import CustomerAddressSelect from '../CustomerAddressSelect';
import CustomerEditDrawer from '../CustomerEditDrawer';

interface EditingProject {
  id: string;
  title: string;
  description: string | null;
  customer_id: string | null;
  customer_address_id: string | null;
  status: string;
  notes: string | null;
}

interface AddEditProjectDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  editingProject?: EditingProject | null;
  onSuccess: () => void;
}

const AddEditProjectDrawer = ({ open, onClose, instanceId, editingProject, onSuccess }: AddEditProjectDrawerProps) => {
  const isEditMode = !!editingProject?.id;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddressId, setCustomerAddressId] = useState<string | null>(null);
  const [status, setStatus] = useState('not_started');
  const [notes, setNotes] = useState('');

  // Add new customer drawer state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addCustomerPrefilledName, setAddCustomerPrefilledName] = useState('');

  useEffect(() => {
    if (!open) return;
    if (isEditMode && editingProject) {
      setTitle(editingProject.title);
      setDescription(editingProject.description || '');
      setCustomerId(editingProject.customer_id);
      setCustomerAddressId(editingProject.customer_address_id);
      setStatus(editingProject.status);
      setNotes(editingProject.notes || '');
      if (editingProject.customer_id) {
        supabase.from('customers').select('name, phone, email').eq('id', editingProject.customer_id).single()
          .then(({ data }) => {
            if (data) {
              setCustomerName(data.name);
              setCustomerPhone(data.phone);
              setCustomerEmail(data.email || '');
            }
          });
      } else {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
      }
    } else {
      setTitle('');
      setDescription('');
      setCustomerId(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setCustomerAddressId(null);
      setStatus('not_started');
      setNotes('');
    }
  }, [open, isEditMode, editingProject]);

  const handleSelectCustomer = (customer: SelectedCustomer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerEmail(customer.email || '');
  };

  const handleClearCustomer = () => {
    setCustomerId(null);
    setCustomerAddressId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Podaj tytuł projektu'); return; }
    setLoading(true);
    try {
      const data: any = {
        instance_id: instanceId,
        title: title.trim(),
        description: description.trim() || null,
        customer_id: customerId || null,
        customer_address_id: customerAddressId || null,
        status,
        notes: notes.trim() || null,
      };

      if (isEditMode) {
        const { error } = await (supabase.from('projects' as any) as any).update(data).eq('id', editingProject!.id);
        if (error) throw error;
        toast.success('Projekt zaktualizowany');
      } else {
        const { error } = await (supabase.from('projects' as any) as any).insert(data);
        if (error) throw error;
        toast.success('Projekt dodany');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error('Błąd podczas zapisywania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent
          side="right"
          hideCloseButton
          hideOverlay
          className="flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {isEditMode ? 'Edytuj projekt' : 'Nowy projekt'}
              </SheetTitle>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Tytuł projektu *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white" placeholder="np. Montaż klimatyzacji — Kowalski" />
            </div>

            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-white" placeholder="Opis projektu..." />
            </div>

            <div className="space-y-2">
              <Label>Klient</Label>
              <CustomerSearchInput
                instanceId={instanceId}
                selectedCustomer={customerId ? { id: customerId, name: customerName, phone: customerPhone, email: customerEmail || null, company: null } : null}
                onSelect={handleSelectCustomer}
                onClear={handleClearCustomer}
                onAddNew={(q) => { setAddCustomerPrefilledName(q); setAddCustomerOpen(true); }}
              />
            </div>

            <CustomerAddressSelect
              instanceId={instanceId}
              customerId={customerId}
              value={customerAddressId}
              onChange={setCustomerAddressId}
              onCustomerResolved={(customer, addressId) => {
                setCustomerId(customer.id);
                setCustomerName(customer.name);
                setCustomerPhone(customer.phone);
                setCustomerEmail(customer.email || '');
                setCustomerAddressId(addressId);
              }}
            />

            {isEditMode && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[1200]">
                    <SelectItem value="not_started">Nierozpoczęty</SelectItem>
                    <SelectItem value="in_progress">W trakcie</SelectItem>
                    <SelectItem value="completed">Zakończony</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-white" />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? 'Zapisz zmiany' : 'Dodaj projekt'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add New Customer Drawer */}
      <CustomerEditDrawer
        customer={null}
        instanceId={instanceId}
        open={addCustomerOpen}
        onClose={() => setAddCustomerOpen(false)}
        isAddMode
        prefilledName={addCustomerPrefilledName}
        onCustomerCreated={(newCustomer, firstAddressId) => {
          setCustomerId(newCustomer.id);
          setCustomerName(newCustomer.name);
          setCustomerPhone(newCustomer.phone);
          setCustomerEmail(newCustomer.email || '');
          if (firstAddressId) {
            setCustomerAddressId(firstAddressId);
          }
          setAddCustomerOpen(false);
        }}
      />
    </>
  );
};

export default AddEditProjectDrawer;
