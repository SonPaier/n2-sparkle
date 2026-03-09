import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ChevronDown, Info, Trash2, Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ServiceCategory {
  id: string;
  name: string;
}

interface SmsTemplateItem {
  months: number;
  service_type: string;
}

interface SmsTemplateOption {
  id: string;
  name: string;
  items?: SmsTemplateItem[];
}

export interface ServiceData {
  id?: string;
  name: string;
  short_name: string | null;
  description: string | null;
  price: number | null;
  prices_are_net: boolean;
  duration_minutes: number | null;
  category_id: string | null;
  sort_order?: number | null;
  is_popular?: boolean | null;
  unit?: string;
  notification_template_id?: string | null;
}

interface ExistingService {
  id?: string;
  name: string;
  short_name: string | null;
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  service?: ServiceData | null;
  categories: ServiceCategory[];
  onSaved: () => void;
  defaultCategoryId?: string;
  totalServicesCount?: number;
  onDelete?: () => void;
  existingServices?: ExistingService[];
}

function FieldInfo({ tooltip }: { tooltip: string }) {
  const [open, setOpen] = useState(false);
  
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button 
            type="button" 
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open);
            }}
            onFocus={(e) => e.preventDefault()}
          >
            <Info className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ServiceFormContent = ({
  service,
  categories,
  instanceId,
  onSaved,
  onClose,
  defaultCategoryId,
  totalServicesCount = 0,
  isMobile = false,
  onDelete,
  existingServices = [],
  onRegisterSave,
}: {
  service?: ServiceData | null;
  categories: ServiceCategory[];
  instanceId: string;
  onSaved: () => void;
  onClose: () => void;
  defaultCategoryId?: string;
  totalServicesCount?: number;
  isMobile?: boolean;
  onDelete?: () => void;
  existingServices?: ExistingService[];
  onRegisterSave?: (saveFn: () => void, saving: boolean) => void;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [shortNameError, setShortNameError] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplateOption[]>([]);

   const hasAdvancedValues = !!(
    service?.is_popular ||
    service?.notification_template_id
  );
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedValues);

  const [formData, setFormData] = useState({
    name: service?.name || '',
    short_name: service?.short_name || '',
    description: service?.description || '',
    price: service?.price ?? null,
    prices_are_net: service?.prices_are_net ?? true,
    duration_minutes: service?.duration_minutes ?? null,
    category_id: service?.category_id || defaultCategoryId || '',
    is_popular: service?.is_popular ?? false,
    unit: service?.unit || 'szt',
    notification_template_id: service?.notification_template_id || '__none__',
  });

  // Fetch SMS templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('sms_notification_templates' as any)
        .select('id, name, items')
        .eq('instance_id', instanceId);
      if (data) setSmsTemplates(data as any);
    };
    fetchTemplates();
  }, [instanceId]);

  const selectedSmsTemplate = smsTemplates.find(t => t.id === formData.notification_template_id);
  const smsTemplateItems: SmsTemplateItem[] = (selectedSmsTemplate?.items as SmsTemplateItem[]) || [];

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const minHeight = 6 * 24;
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(minHeight, scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.description]);

  const initializedServiceIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (service?.id === initializedServiceIdRef.current) return;
    initializedServiceIdRef.current = service?.id || null;
    
    if (service) {
      setFormData({
        name: service.name || '',
        short_name: service.short_name || '',
        description: service.description || '',
        price: service.price ?? null,
        prices_are_net: service.prices_are_net ?? true,
        duration_minutes: service.duration_minutes ?? null,
        category_id: service.category_id || defaultCategoryId || '',
        is_popular: service.is_popular ?? false,
        unit: service.unit || 'szt',
        notification_template_id: service.notification_template_id || '__none__',
      });
    }
  }, [service?.id, defaultCategoryId]);

  const handleSave = async () => {
    setNameError(false);
    setShortNameError(false);
    
    if (!formData.name.trim()) {
      setNameError(true);
      toast.error('Nazwa usługi jest wymagana');
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => nameInputRef.current?.focus(), 300);
      return;
    }

    const nameExists = existingServices.some(
      s => s.id !== service?.id && 
           s.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );
    if (nameExists) {
      setNameError(true);
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => nameInputRef.current?.focus(), 300);
      return;
    }

    if (formData.short_name?.trim()) {
      const shortNameExists = existingServices.some(
        s => s.id !== service?.id && 
             s.short_name?.toLowerCase().trim() === formData.short_name.toLowerCase().trim()
      );
      if (shortNameExists) {
        setShortNameError(true);
        return;
      }
    }

    setSaving(true);
    try {
      const serviceData = {
        instance_id: instanceId,
        name: formData.name.trim(),
        short_name: formData.short_name.trim() || null,
        description: formData.description.trim() || null,
        price: formData.price,
        prices_are_net: formData.prices_are_net,
        duration_minutes: formData.duration_minutes,
        category_id: formData.category_id || null,
        is_popular: formData.is_popular,
        unit: formData.unit,
        notification_template_id: formData.notification_template_id === '__none__' ? null : formData.notification_template_id,
        active: true,
      };

      if (service?.id) {
        const { error } = await (supabase
          .from('unified_services') as any)
          .update(serviceData)
          .eq('id', service.id);
        
        if (error) throw error;
        toast.success('Usługa zaktualizowana');
      } else {
        const { error } = await (supabase
          .from('unified_services') as any)
          .insert({ ...serviceData, sort_order: totalServicesCount });
        
        if (error) throw error;
        toast.success('Usługa dodana');
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Błąd zapisywania usługi');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    onRegisterSave?.(handleSave, saving);
  });

  const priceLabel = formData.prices_are_net ? 'Cena netto' : 'Cena brutto';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Row 1: Full Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm leading-5">Pełna nazwa usługi *</Label>
            <FieldInfo tooltip="Nazwa wyświetlana klientom w ofercie i cenniku" />
          </div>
          <Input
            ref={nameInputRef}
            value={formData.name}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, name: e.target.value }));
              if (nameError && e.target.value.trim()) setNameError(false);
            }}
            className={cn("bg-white", nameError && "border-destructive focus-visible:ring-destructive")}
          />
          {nameError && (
            <p className="text-sm text-destructive">
              {existingServices.some(s => s.id !== service?.id && s.name.toLowerCase().trim() === formData.name.toLowerCase().trim())
                ? 'Nazwa jest już używana'
                : 'Nazwa usługi jest wymagana'}
            </p>
          )}
        </div>

        {/* Row 2: Short Name + Category */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "grid-cols-2"
        )}>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">Nazwa skrócona</Label>
              <FieldInfo tooltip="Wewnętrzna nazwa robocza widoczna tylko dla Ciebie" />
            </div>
            <Input
              value={formData.short_name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, short_name: e.target.value.toUpperCase() }));
                if (shortNameError) setShortNameError(false);
              }}
              maxLength={10}
              className={cn("bg-white", shortNameError && "border-destructive focus-visible:ring-destructive")}
            />
            {shortNameError && (
              <p className="text-sm text-destructive">Skrót jest już używany</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm leading-5">Kategoria</Label>
              <FieldInfo tooltip="Grupowanie usług w cenniku" />
            </div>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v === 'none' ? '' : v }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez kategorii</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Price section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm leading-5">Ustal, czy cena jest netto czy brutto</Label>
            <RadioGroup
              value={formData.prices_are_net ? 'net' : 'gross'}
              onValueChange={(v) => setFormData(prev => ({ ...prev, prices_are_net: v === 'net' }))}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="gross" id="price-gross" />
                <Label htmlFor="price-gross" className="text-sm font-normal cursor-pointer">Cena brutto</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="net" id="price-net" />
                <Label htmlFor="price-net" className="text-sm font-normal cursor-pointer">Cena netto</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Label className="text-sm leading-5">{priceLabel}</Label>
            <FieldInfo tooltip="Cena bazowa usługi" />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={formData.price ?? ''}
              onChange={(e) => {
                const numValue = e.target.value === '' ? null : parseFloat(e.target.value);
                setFormData(prev => ({ ...prev, price: numValue }));
              }}
              step="0.01"
              min="0"
              className="w-40 bg-white"
            />
            <Select
              value={formData.unit}
              onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="szt">szt.</SelectItem>
                <SelectItem value="m2">m²</SelectItem>
                <SelectItem value="mb">mb.</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 3: Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm">Opis</Label>
            <FieldInfo tooltip="Opis wyświetlany klientom" />
          </div>
          <Textarea
            ref={textareaRef}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-[144px] resize-none overflow-hidden bg-white"
            style={{ height: 'auto' }}
          />
        </div>

        {/* Advanced Section */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-primary font-semibold hover:text-primary/80 w-full py-2"
            >
              <ChevronDown className={cn(
                "w-4 h-4 transition-transform",
                advancedOpen && "rotate-180"
              )} />
              Zaawansowane właściwości
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">




            {/* Is Popular */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="is_popular"
                checked={formData.is_popular}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_popular: !!checked }))
                }
              />
              <div className="flex items-center gap-1.5">
                <Label htmlFor="is_popular" className="text-sm cursor-pointer">
                  Popularna usługa
                </Label>
                <FieldInfo tooltip="Usługa będzie wyświetlana jako skrót przy tworzeniu zleceń" />
              </div>
            </div>

            {/* SMS Notification Template */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm">Powiadomienie SMS</Label>
                <FieldInfo tooltip="Automatyczne powiadomienia SMS po wykonaniu usługi" />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={formData.notification_template_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, notification_template_id: v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Brak</SelectItem>
                    {smsTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('returnToService', 'true');
                    if (service?.id) params.set('serviceId', service.id);
                    navigate(`/admin/powiadomienia-sms/new?${params.toString()}`);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {smsTemplateItems.length > 0 && (
                <div className="border-l-2 border-primary/30 pl-3 space-y-1 mt-2">
                  {smsTemplateItems.map((item, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground">
                      {item.months} mies. → {item.service_type}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Footer - rendered by parent */}
    </div>
  );
};

export const ServiceFormDialog = ({
  open,
  onOpenChange,
  instanceId,
  service,
  categories,
  onSaved,
  defaultCategoryId,
  totalServicesCount = 0,
  onDelete,
  existingServices = [],
}: ServiceFormDialogProps) => {
  const isMobile = useIsMobile();
  const saveRef = useRef<{ save: () => void; saving: boolean }>({ save: () => {}, saving: false });

  const title = service?.id ? 'Edytuj usługę' : 'Dodaj usługę';

  const handleClose = () => onOpenChange(false);

  const handleRegisterSave = (saveFn: () => void, saving: boolean) => {
    saveRef.current = { save: saveFn, saving };
  };

  const footerContent = (
    <div className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
      {service?.id && onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 mr-auto"
        >
          <Trash2 className="w-4 h-4" />
          Usuń
        </Button>
      )}
      <Button variant="outline" onClick={handleClose} className="flex-1">
        Anuluj
      </Button>
      <Button onClick={() => saveRef.current.save()} disabled={saveRef.current.saving} className="flex-1">
        {saveRef.current.saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Zapisz
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" hideCloseButton className="flex flex-col p-0 gap-0 z-[1000] w-full h-full bg-white">
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          </div>
          <div className="px-4 flex-1 overflow-y-auto py-4">
            <ServiceFormContent
              service={service}
              categories={categories}
              instanceId={instanceId}
              onSaved={onSaved}
              onClose={handleClose}
              defaultCategoryId={defaultCategoryId}
              totalServicesCount={totalServicesCount}
              isMobile={true}
              onDelete={onDelete}
              existingServices={existingServices}
              onRegisterSave={handleRegisterSave}
            />
          </div>
          {footerContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton
        hideOverlay
        className="flex flex-col p-0 gap-0 z-[1000] w-full sm:w-[550px] sm:max-w-[550px] h-full bg-white"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-primary/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ServiceFormContent
            service={service}
            categories={categories}
            instanceId={instanceId}
            onSaved={onSaved}
            onClose={handleClose}
            defaultCategoryId={defaultCategoryId}
            totalServicesCount={totalServicesCount}
            isMobile={false}
            onDelete={onDelete}
            existingServices={existingServices}
            onRegisterSave={handleRegisterSave}
          />
        </div>

        {/* Footer */}
        {footerContent}
      </SheetContent>
    </Sheet>
  );
};