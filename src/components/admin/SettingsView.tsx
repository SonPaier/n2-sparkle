import { useState, useRef, useEffect } from 'react';
import { Building2, Grid2X2, Monitor, Users, Loader2, Save, Upload, Trash2, Image as ImageIcon, ChevronDown, Plug, MessageSquare, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CalendarColumnsSettings from './CalendarColumnsSettings';
import WorkingHoursSettings from './WorkingHoursSettings';
import EmployeeCalendarsListView from './employee-calendars/EmployeeCalendarsListView';
import InstanceUsersTab from './users/InstanceUsersTab';
import AddressSearchInput from './AddressSearchInput';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { IntegrationsSettingsView } from '@/components/invoicing/IntegrationsSettingsView';
import SmsPaymentTemplatesView from './settings/SmsPaymentTemplatesView';
import { useInstanceFeature } from '@/hooks/useInstanceFeatures';
import type { AddressSearchResult } from '@/lib/addressSearch';

interface SettingsViewProps {
  instanceId: string | null;
}

type SettingsTab = 'company' | 'calendar' | 'employee-calendars' | 'users' | 'sms-templates' | 'integrations' | 'app';

const SettingsView = ({ instanceId }: SettingsViewProps) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { currentVersion } = useAppUpdate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyForm, setCompanyForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    address_lat: null as number | null,
    address_lng: null as number | null,
    contact_person: '',
    website: '',
    logo_url: '',
    bank_name: '',
    bank_account_number: '',
    blik_phone: '',
  });

  // Fetch instance data
  useEffect(() => {
    if (!instanceId) return;
    setInstanceLoading(true);
    supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching instance:', error);
        } else if (data) {
          setCompanyForm({
            name: data.name || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            address_street: (data as any).address_street || '',
            address_city: (data as any).address_city || '',
            address_postal_code: (data as any).address_postal_code || '',
            address_lat: (data as any).address_lat || null,
            address_lng: (data as any).address_lng || null,
            contact_person: (data as any).contact_person || '',
            website: (data as any).website || '',
            logo_url: data.logo_url || '',
            bank_name: (data as any).bank_name || '',
            bank_account_number: (data as any).bank_account_number || '',
            blik_phone: (data as any).blik_phone || '',
          });
        }
        setInstanceLoading(false);
      });
  }, [instanceId]);

  const { enabled: activitiesEnabled, loading: activitiesLoading, toggle: toggleActivities } = useInstanceFeature(instanceId, 'activities');
  const { enabled: employeesEnabled, loading: employeesLoading, toggle: toggleEmployees } = useInstanceFeature(instanceId, 'employees');
  const { enabled: protocolsEnabled, loading: protocolsLoading, toggle: toggleProtocols } = useInstanceFeature(instanceId, 'protocols');
  const { enabled: remindersEnabled, loading: remindersLoading, toggle: toggleReminders } = useInstanceFeature(instanceId, 'reminders');
  const { enabled: prioritiesEnabled, loading: prioritiesLoading, toggle: togglePriorities } = useInstanceFeature(instanceId, 'priorities');
  const { enabled: employeeCalendarViewEnabled, loading: employeeCalendarViewLoading, toggle: toggleEmployeeCalendarView } = useInstanceFeature(instanceId, 'employee_calendar_view');
  const { enabled: projectsEnabled, loading: projectsLoading, toggle: toggleProjects } = useInstanceFeature(instanceId, 'projects');

  const allTabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'company', label: 'Dane firmy', icon: <Building2 className="w-4 h-4" /> },
    { key: 'calendar', label: 'Kalendarz', icon: <Grid2X2 className="w-4 h-4" /> },
    { key: 'employee-calendars', label: 'Kalendarze pracowników', icon: <Monitor className="w-4 h-4" /> },
    { key: 'users', label: 'Użytkownicy', icon: <Users className="w-4 h-4" /> },
    { key: 'sms-templates', label: 'Szablony SMS', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'integrations', label: 'Integracje', icon: <Plug className="w-4 h-4" /> },
    { key: 'app', label: 'Aplikacja', icon: <Smartphone className="w-4 h-4" /> },
  ];

  const tabs = allTabs.filter(t => employeesEnabled || t.key !== 'employee-calendars');

  const handleInputChange = (field: string, value: string) => {
    setCompanyForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;
    if (!file.type.startsWith('image/')) { toast.error('Wybierz plik graficzny'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Maksymalny rozmiar pliku to 2MB'); return; }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${instanceId}/logo-${Date.now()}.${fileExt}`;

      if (companyForm.logo_url) {
        const urlParts = companyForm.logo_url.split('/instance-logos/');
        if (urlParts[1]) await supabase.storage.from('instance-logos').remove([urlParts[1]]);
      }

      const { error: uploadError } = await supabase.storage.from('instance-logos').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('instance-logos').getPublicUrl(fileName);
      setCompanyForm(prev => ({ ...prev, logo_url: publicUrl }));

      await supabase.from('instances').update({ logo_url: publicUrl }).eq('id', instanceId);
      queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
      toast.success('Logo przesłane');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Błąd przesyłania logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!companyForm.logo_url || !instanceId) return;
    try {
      const urlParts = companyForm.logo_url.split('/instance-logos/');
      if (urlParts[1]) await supabase.storage.from('instance-logos').remove([urlParts[1]]);
      setCompanyForm(prev => ({ ...prev, logo_url: '' }));
      await supabase.from('instances').update({ logo_url: null }).eq('id', instanceId);
      queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
      toast.success('Logo usunięte');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Błąd usuwania logo');
    }
  };

  const handleSaveCompany = async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('instances')
        .update({
          name: companyForm.name,
          phone: companyForm.phone || null,
          email: companyForm.email || null,
          address: companyForm.address || null,
          address_street: companyForm.address_street || null,
          address_city: companyForm.address_city || null,
          address_postal_code: companyForm.address_postal_code || null,
          address_lat: companyForm.address_lat || null,
          address_lng: companyForm.address_lng || null,
          logo_url: companyForm.logo_url || null,
          website: companyForm.website || null,
          contact_person: companyForm.contact_person || null,
          bank_name: companyForm.bank_name || null,
          bank_account_number: companyForm.bank_account_number || null,
          blik_phone: companyForm.blik_phone || null,
        } as any)
        .eq('id', instanceId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['instance_data', instanceId] });
      toast.success('Zapisano');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Błąd zapisu');
    } finally {
      setLoading(false);
    }
  };

  const currentTab = tabs.find(t => t.key === activeTab);

  const renderTabContent = () => {
    if (instanceLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (activeTab) {
      case 'company':
        return (
          <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : companyForm.logo_url ? (
                    <img src={companyForm.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                    <Upload className="w-4 h-4 mr-2" />
                    {companyForm.logo_url ? 'Zmień logo' : 'Prześlij logo'}
                  </Button>
                  {companyForm.logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Usuń logo
                    </Button>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nazwa firmy *</Label>
              <Input id="name" className="bg-white" value={companyForm.name} onChange={(e) => handleInputChange('name', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" type="tel" className="bg-white" value={companyForm.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" className="bg-white" value={companyForm.email} onChange={(e) => handleInputChange('email', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Adres siedziby</Label>
              <AddressSearchInput
                className="bg-white"
                placeholder="Szukaj adresu siedziby..."
                defaultValue={
                  [companyForm.address_street, companyForm.address_postal_code, companyForm.address_city]
                    .filter(Boolean)
                    .join(', ') || companyForm.address || ''
                }
                onSelect={(result: AddressSearchResult) => {
                  const label = [result.street, result.postal_code, result.city].filter(Boolean).join(', ');
                  setCompanyForm(prev => ({
                    ...prev,
                    address: label,
                    address_street: result.street,
                    address_city: result.city,
                    address_postal_code: result.postal_code,
                    address_lat: result.lat,
                    address_lng: result.lng,
                  }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Osoba kontaktowa</Label>
              <Input id="contact_person" className="bg-white" value={companyForm.contact_person} onChange={(e) => handleInputChange('contact_person', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Strona www</Label>
              <Input id="website" type="url" className="bg-white" value={companyForm.website} onChange={(e) => handleInputChange('website', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_name">Nazwa banku</Label>
              <Input id="bank_name" className="bg-white" value={companyForm.bank_name} onChange={(e) => handleInputChange('bank_name', e.target.value)} placeholder="np. mBank, PKO BP" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Numer konta bankowego</Label>
              <Input id="bank_account_number" className="bg-white" value={companyForm.bank_account_number} onChange={(e) => handleInputChange('bank_account_number', e.target.value)} placeholder="XX XXXX XXXX XXXX XXXX XXXX XXXX" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blik_phone">Numer telefonu do rozliczeń BLIK</Label>
              <Input id="blik_phone" type="tel" className="bg-white" value={companyForm.blik_phone} onChange={(e) => handleInputChange('blik_phone', e.target.value)} placeholder="np. 500 000 000" />
            </div>

            <Button onClick={handleSaveCompany} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Zapisz
            </Button>
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-8">
            <WorkingHoursSettings instanceId={instanceId} />
            <div className="border-t border-border" />
            <CalendarColumnsSettings instanceId={instanceId} />
          </div>
        );

      case 'employee-calendars':
        return <EmployeeCalendarsListView instanceId={instanceId} />;

      case 'users':
        return instanceId ? <InstanceUsersTab instanceId={instanceId} /> : null;

      case 'sms-templates':
        return <SmsPaymentTemplatesView instanceId={instanceId} />;

      case 'integrations':
        return <IntegrationsSettingsView instanceId={instanceId} />;

      case 'app':
        return (
          <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold mb-1">Moduły aplikacji</h3>
              <p className="text-sm text-muted-foreground">Włączaj i wyłączaj funkcjonalności dostępne w panelu.</p>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Aktywności</Label>
                <p className="text-xs text-muted-foreground">Moduł powiadomień i aktywności w aplikacji</p>
              </div>
              <Switch
                checked={activitiesEnabled}
                onCheckedChange={toggleActivities}
                disabled={activitiesLoading}
              />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Pracownicy</Label>
                <p className="text-xs text-muted-foreground">Moduł zarządzania pracownikami i przypisywania do zleceń</p>
              </div>
              <Switch
                checked={employeesEnabled}
                onCheckedChange={toggleEmployees}
                disabled={employeesLoading}
              />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Protokoły</Label>
                <p className="text-xs text-muted-foreground">Moduł protokołów serwisowych zakończenia prac</p>
              </div>
              <Switch
                checked={protocolsEnabled}
                onCheckedChange={toggleProtocols}
                disabled={protocolsLoading}
              />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Przypomnienia</Label>
                <p className="text-xs text-muted-foreground">Moduł przypomnień i śledzenia terminów</p>
              </div>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={toggleReminders}
                disabled={remindersLoading}
              />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Priorytety</Label>
                <p className="text-xs text-muted-foreground">Priorytetyzacja zleceń (krytyczny, wysoki, normalny, niski)</p>
              </div>
              <Switch
                checked={prioritiesEnabled}
                onCheckedChange={togglePriorities}
                disabled={prioritiesLoading}
              />
            </div>
            {employeesEnabled && (
              <div className="flex items-center justify-between py-3 border-t border-border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Widok kalendarza pracowników</Label>
                  <p className="text-xs text-muted-foreground">Widok kalendarza z podziałem na pracowników i detekcją konfliktów</p>
                </div>
                <Switch
                  checked={employeeCalendarViewEnabled}
                  onCheckedChange={toggleEmployeeCalendarView}
                  disabled={employeeCalendarViewLoading}
                />
              </div>
            )}
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Projekty</Label>
                <p className="text-xs text-muted-foreground">Grupuj zlecenia w wieloetapowe projekty</p>
              </div>
              <Switch
                checked={projectsEnabled}
                onCheckedChange={toggleProjects}
                disabled={projectsLoading}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 lg:space-y-0 lg:flex lg:flex-row lg:gap-6">
      {/* Sidebar / Mobile Dropdown */}
      {isMobile ? (
        <Collapsible open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} className="w-full">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between mb-4">
              <span className="flex items-center gap-2">
                {currentTab?.icon}
                {currentTab?.label}
              </span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", mobileMenuOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-4">
            <div className="flex flex-col gap-1 p-2 border border-border rounded-lg bg-card">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setMobileMenuOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left w-full",
                    activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="w-48 shrink-0">
          <nav className="flex flex-col gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left w-full",
                  activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          {currentVersion && (
            <p className="text-[10px] text-muted-foreground text-center mt-4">Panel Admina v{currentVersion}</p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-2xl">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
