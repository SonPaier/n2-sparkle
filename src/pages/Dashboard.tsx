import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Users, BadgeDollarSign, Settings } from 'lucide-react';
import DashboardLayout, { type ViewType } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import SettingsView from '@/components/admin/SettingsView';

const validViews: ViewType[] = ['kalendarz', 'klienci', 'uslugi', 'ustawienia'];

const viewConfig: Record<ViewType, { label: string; icon: React.ElementType; description: string }> = {
  kalendarz: { label: 'Kalendarz', icon: Calendar, description: 'Zarządzaj harmonogramem i rezerwacjami' },
  klienci: { label: 'Klienci', icon: Users, description: 'Przeglądaj i zarządzaj bazą klientów' },
  uslugi: { label: 'Usługi', icon: BadgeDollarSign, description: 'Konfiguruj usługi i cennik' },
  ustawienia: { label: 'Ustawienia', icon: Settings, description: 'Ustawienia systemu i konfiguracja' },
};

const Dashboard = () => {
  const { view } = useParams<{ view?: string }>();
  const navigate = useNavigate();
  const { roles } = useAuth();

  const currentView: ViewType = view && validViews.includes(view as ViewType) ? (view as ViewType) : 'kalendarz';

  // Get instanceId from user roles
  const adminRole = roles.find(r => (r.role === 'admin' || r.role === 'employee') && r.instance_id);
  const instanceId = adminRole?.instance_id ?? null;

  // Detect base path from current URL (handles both /admin/:view and /:view patterns)
  const basePath = window.location.pathname.includes('/admin') ? '/admin' : '';

  const handleViewChange = (newView: ViewType) => {
    navigate(newView === 'kalendarz' ? `${basePath || '/admin'}` : `${basePath || '/admin'}/${newView}`, { replace: true });
  };

  const renderContent = () => {
    if (currentView === 'ustawienia') {
      return <SettingsView instanceId={instanceId} />;
    }

    const { label, icon: Icon, description } = viewConfig[currentView];
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{label}</h2>
          <p className="text-muted-foreground max-w-md">{description}</p>
        </div>
        <div className="px-4 py-2 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground">Placeholder — wkrótce tu będzie pełna funkcjonalność</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout currentView={currentView} onViewChange={handleViewChange}>
      {renderContent()}
    </DashboardLayout>
  );
};

export default Dashboard;
