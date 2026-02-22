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
}

const SERVICE_TYPES = [
  { value: 'serwis', label: 'Serwis' },
  { value: 'kontrola', label: 'Kontrola' },
  { value: 'przeglad', label: 'Przegląd' },
];

const SMS_TEMPLATES: Record<string, string> = {
  serwis: '{short_name}: Zapraszamy na serwis. Kontakt: {reservation_phone}',
  kontrola: '{short_name}: Zapraszamy na kontrolę. Kontakt: {reservation_phone}',
  przeglad: '{short_name}: Zapraszamy na przegląd. Kontakt: {reservation_phone}',
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
  const [items, setItems] = useState<NotificationItem[]>([{ months: 12, service_type: 'serwis' }]);

  useEffect(() => {
    if (!authLoading && isNew) {
      setLoading(false);
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
        setItems(parsedItems.length > 0 ? parsedItems : [{ months: 12, service_type: 'serwis' }]);
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

    setSaving(true);
    try {
      const smsTemplate = SMS_TEMPLATES[items[0]?.service_type] || SMS_TEMPLATES.serwis;
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
            sms_template: smsTemplate,
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
            sms_template: smsTemplate,
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
    setItems([...items, { months: 12, service_type: 'serwis' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof NotificationItem, value: number | string) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const getSmsExample = () => {
    const serviceType = items[0]?.service_type || 'serwis';
    const template = SMS_TEMPLATES[serviceType] || SMS_TEMPLATES.serwis;
    return template
      .replace('{short_name}', 'N2Serwis')
      .replace('{reservation_phone}', '123456789');
  };

  const handleBack = () => {
    if (returnToService === 'true') {
      const servicesPath = isAdminPath ? '/admin/uslugi' : '/uslugi';
      navigate(servicesPath);
    } else {
      navigate(basePath);
    }
  };

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
                      {/* Months input */}
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

            {/* SMS Template Preview */}
            <div className="space-y-2">
              <Label>Szablon SMS</Label>
              <div className="p-3 bg-card rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Przykład:</p>
                <p className="text-sm font-mono">{getSmsExample()}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Szablon SMS jest generowany automatycznie na podstawie typu usługi
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
              disabled={saving}
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
