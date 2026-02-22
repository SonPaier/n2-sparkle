import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AdminTabsList, AdminTabsTrigger } from '@/components/admin/AdminTabsList';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { TemplateAssignedCustomers } from '@/components/admin/TemplateAssignedCustomers';
import type { Json } from '@/integrations/supabase/types';

interface NotificationItem {
  months: number;
  service_type: string;
  trigger_type: 'scheduled' | 'immediate';
}

const SERVICE_TYPES = [
  { value: 'serwis', label: 'Serwis' },
  { value: 'kontrola', label: 'Kontrola' },
  { value: 'przeglad', label: 'Przegląd' },
];

const TRIGGER_TYPES = [
  { value: 'scheduled', label: 'Po X miesiącach' },
  { value: 'immediate', label: 'Natychmiast' },
];

const POLISH_CHARS_REGEX = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const DEFAULT_SMS_TEMPLATES: Record<string, string> = {
  serwis: 'Zapraszamy na serwis. Kontakt: {reservation_phone}',
  kontrola: 'Zapraszamy na kontrole. Kontakt: {reservation_phone}',
  przeglad: 'Zapraszamy na przeglad. Kontakt: {reservation_phone}',
};

export default function SmsNotificationTemplateEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shortId } = useParams<{ shortId: string }>();
  const [searchParams] = useSearchParams();
  const { user, roles, loading: authLoading } = useAuth();
  
  const instanceId = roles.find(r => r.instance_id)?.instance_id || null;
  
  const returnToService = searchParams.get('returnToService');
  const serviceId = searchParams.get('serviceId');
  
  const isNew = shortId === 'new' || location.pathname.endsWith('/powiadomienia-sms/new');
  
  const isAdminPath = location.pathname.startsWith('/admin');
  const basePath = isAdminPath ? '/admin/powiadomienia-sms' : '/powiadomienia-sms';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'template' | 'customers'>('template');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<NotificationItem[]>([{ months: 12, service_type: 'serwis', trigger_type: 'scheduled' }]);
  const [smsTemplate, setSmsTemplate] = useState('');
  
  // Instance data for preview
  const [instanceShortName, setInstanceShortName] = useState('');
  const [instancePhone, setInstancePhone] = useState('');

  // Fetch instance short_name and phone
  useEffect(() => {
    if (!instanceId) return;
    const fetchInstance = async () => {
      const { data } = await (supabase
        .from('instances') as any)
        .select('short_name, phone, reservation_phone')
        .eq('id', instanceId)
        .single();
      if (data) {
        setInstanceShortName(data.short_name || data.name || '');
        setInstancePhone(data.reservation_phone || data.phone || '');
      }
    };
    fetchInstance();
  }, [instanceId]);

  useEffect(() => {
    if (!authLoading && isNew) {
      setLoading(false);
      // Set default SMS template
      const defaultTemplate = DEFAULT_SMS_TEMPLATES['serwis'];
      setSmsTemplate(defaultTemplate);
    }
  }, [authLoading, isNew]);

  useEffect(() => {
    if (!authLoading && !isNew && instanceId && shortId) {
      fetchTemplate();
    }
  }, [authLoading, isNew, instanceId, shortId]);

  const fetchTemplate = async () => {
    if (!instanceId || !shortId) return;
    
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('sms_notification_templates') as any)
        .select('*')
        .eq('instance_id', instanceId);

      if (error) throw error;
      
      const template = data?.find((t: any) => t.id.startsWith(shortId));
      
      if (template) {
        setTemplateId(template.id);
        setName(template.name);
        setDescription(template.description || '');
        const parsedItems = Array.isArray(template.items) 
          ? (template.items as unknown as NotificationItem[])
          : [];
        // Ensure trigger_type exists for backward compatibility
        const itemsWithTriggerType = parsedItems.map(item => ({
          ...item,
          trigger_type: item.trigger_type || 'scheduled' as const,
        }));
        setItems(itemsWithTriggerType.length > 0 ? itemsWithTriggerType : [{ months: 12, service_type: 'serwis', trigger_type: 'scheduled' as const }]);
        
        // Load sms_template - strip {short_name}: prefix if present
        const rawTemplate = template.sms_template || '';
        const stripped = rawTemplate.replace(/^\{short_name\}:\s*/, '');
        setSmsTemplate(stripped || DEFAULT_SMS_TEMPLATES[parsedItems[0]?.service_type || 'serwis']);
      } else {
        toast.error('Nie znaleziono szablonu');
        navigate(basePath);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Błąd pobierania szablonu');
      navigate(basePath);
    } finally {
      setLoading(false);
    }
  };

  const getFullTemplate = () => {
    return `{short_name}: ${smsTemplate}`;
  };

  const getSmsPreview = () => {
    const shortName = instanceShortName || 'FirmaSMS';
    const phone = instancePhone || '123456789';
    return `${shortName}: ${smsTemplate.replace('{reservation_phone}', phone)}`;
  };

  const smsValidationErrors = (): string[] => {
    const errors: string[] = [];
    const fullLength = getFullTemplate().length;
    if (fullLength > 160) {
      errors.push(`Szablon SMS przekracza 160 znaków (${fullLength}/160)`);
    }
    if (POLISH_CHARS_REGEX.test(smsTemplate)) {
      errors.push('Szablon SMS nie może zawierać polskich znaków (ą, ć, ę, ł, ń, ó, ś, ź, ż)');
    }
    return errors;
  };

  const handleSave = async () => {
    if (!instanceId) return;
    
    if (!name.trim()) {
      toast.error('Nazwa szablonu jest wymagana');
      return;
    }

    if (items.length === 0) {
      toast.error('Dodaj przynajmniej jedno przypomnienie');
      return;
    }

    const errors = smsValidationErrors();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const fullTemplate = getFullTemplate();
      const itemsJson = items as unknown as Json;
      
      let newTemplateId: string | null = null;
      
      if (isNew) {
        const { data, error } = await (supabase
          .from('sms_notification_templates') as any)
          .insert({
            instance_id: instanceId!,
            name: name.trim(),
            description: description.trim() || null,
            items: itemsJson,
            sms_template: fullTemplate,
          })
          .select('id')
          .single();

        if (error) throw error;
        newTemplateId = data?.id || null;
        toast.success('Szablon utworzony');
      } else if (templateId) {
        const { error } = await (supabase
          .from('sms_notification_templates') as any)
          .update({
            name: name.trim(),
            description: description.trim() || null,
            items: itemsJson,
            sms_template: fullTemplate,
          })
          .eq('id', templateId);

        if (error) throw error;
        newTemplateId = templateId;
        toast.success('Szablon zaktualizowany');
      }

      if (returnToService === 'true' && serviceId && newTemplateId) {
        const servicesPath = isAdminPath ? '/admin/uslugi' : '/uslugi';
        navigate(`${servicesPath}?serviceId=${serviceId}&assignedNotificationId=${newTemplateId}`);
      } else {
        navigate(basePath);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Błąd zapisywania szablonu');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setItems([...items, { months: 12, service_type: 'serwis', trigger_type: 'scheduled' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof NotificationItem, value: number | string) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      // When switching to immediate, set months to 0
      if (field === 'trigger_type' && value === 'immediate') {
        updated.months = 0;
      }
      // When switching back to scheduled, set months to default
      if (field === 'trigger_type' && value === 'scheduled' && updated.months === 0) {
        updated.months = 12;
      }
      return updated;
    }));
  };

  const handleBack = () => {
    if (returnToService === 'true') {
      const servicesPath = isAdminPath ? '/admin/uslugi' : '/uslugi';
      navigate(servicesPath);
    } else {
      navigate(basePath);
    }
  };

  const validationErrors = smsValidationErrors();
  const fullTemplateLength = getFullTemplate().length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {isNew ? 'Dodaj szablon SMS' : 'Edytuj szablon SMS'}
            </h1>
          </div>
        </div>
      </div>

      {/* Tabs - only for existing templates */}
      {!isNew && (
        <div className="container max-w-2xl mx-auto px-4 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'customers')}>
            <AdminTabsList columns={2}>
              <AdminTabsTrigger value="template">
                Szablon
              </AdminTabsTrigger>
              <AdminTabsTrigger value="customers">
                Przypisani klienci
              </AdminTabsTrigger>
            </AdminTabsList>
          </Tabs>
        </div>
      )}

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'template' | 'customers')}>
        {/* Template Form Tab */}
        <TabsContent value="template" className="mt-0">
          <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa szablonu *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Przypomnienie o serwisie rocznym"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcjonalny opis szablonu..."
                rows={2}
              />
            </div>

            {/* Notification Schedule */}
            <div className="space-y-3">
              <Label>Harmonogram powiadomień</Label>
              
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border rounded-lg bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Powiadomienie #{index + 1} (SMS)
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Trigger type dropdown */}
                      <Select
                        value={item.trigger_type || 'scheduled'}
                        onValueChange={(value) => updateItem(index, 'trigger_type', value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRIGGER_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Months input - only for scheduled */}
                      {(item.trigger_type || 'scheduled') === 'scheduled' && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={item.months}
                            onChange={(e) => updateItem(index, 'months', parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">mies. po usłudze</span>
                        </div>
                      )}
                      
                      {/* Service type dropdown */}
                      <Select
                        value={item.service_type}
                        onValueChange={(value) => updateItem(index, 'service_type', value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addItem}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                {items.length > 0 ? 'Dodaj kolejne powiadomienie' : 'Dodaj powiadomienie'}
              </Button>
            </div>

            {/* SMS Template - editable */}
            <div className="space-y-2">
              <Label>Treść SMS</Label>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                    {instanceShortName || '{short_name}'}:
                  </span>
                  <span className="text-xs">(stały prefix — nie można edytować)</span>
                </div>
                <Textarea
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  placeholder="Zapraszamy na serwis. Kontakt: {reservation_phone}"
                  rows={3}
                  className={validationErrors.length > 0 ? 'border-destructive' : ''}
                />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                  <p className={`text-xs ${fullTemplateLength > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {fullTemplateLength} / 160
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Podgląd SMS:</p>
                <p className="text-sm font-mono">{getSmsPreview()}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Dostępne zmienne: {'{reservation_phone}'} — telefon kontaktowy firmy
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Assigned Customers Tab */}
        <TabsContent value="customers" className="mt-0">
          <div className="container max-w-2xl mx-auto px-4 py-6">
            <TemplateAssignedCustomers
              templateId={templateId}
              instanceId={instanceId}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky Footer Buttons - only show in template tab */}
      {activeTab === 'template' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
          <div className="container max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
              disabled={saving}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={saving || validationErrors.length > 0}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zapisz
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
