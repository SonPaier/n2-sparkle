import { useState, useEffect } from 'react';
import { Calendar, Users, BadgeDollarSign, Settings, LogOut, Menu, PanelLeftClose, PanelLeft, ChevronUp, X, HardHat, ClipboardCheck, MessageSquare, Receipt, Bell, LayoutDashboard } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { UpdateBanner } from '@/components/pwa/UpdateBanner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewType = 'dashboard' | 'kalendarz' | 'klienci' | 'uslugi' | 'pracownicy' | 'protokoly' | 'rozliczenia' | 'przypomnienia' | 'powiadomienia-sms' | 'ustawienia' | 'aktywnosci';

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Mój dzień', icon: LayoutDashboard },
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'rozliczenia', label: 'Zlecenia', icon: Receipt },
  { id: 'klienci', label: 'Klienci', icon: Users },
  { id: 'pracownicy', label: 'Pracownicy', icon: HardHat },
  { id: 'protokoly', label: 'Protokoły', icon: ClipboardCheck },
  { id: 'przypomnienia', label: 'Przypomnienia', icon: Bell },
  { id: 'uslugi', label: 'Usługi', icon: BadgeDollarSign },
  { id: 'aktywnosci', label: 'Aktywności', icon: Bell },
  { id: 'powiadomienia-sms', label: 'Powiadomienia SMS', icon: MessageSquare },
  { id: 'ustawienia', label: 'Ustawienia', icon: Settings },
];

// Bottom bar items for mobile
const bottomBarItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Mój dzień', icon: LayoutDashboard },
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'rozliczenia', label: 'Zlecenia', icon: Receipt },
  { id: 'aktywnosci', label: 'Aktywności', icon: Bell },
];

interface DashboardLayoutProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  children: React.ReactNode;
  instanceId?: string | null;
}

const DashboardLayout = ({ currentView, onViewChange, children, instanceId }: DashboardLayoutProps) => {
  const { signOut, username, user } = useAuth();
  const { settings: dashboardSettings } = useDashboardSettings(instanceId ?? null);
  const { unreadCount } = useNotifications(instanceId ?? null);
  const { currentVersion } = useAppUpdate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('n2service-sidebar-collapsed') === 'true';
  });
  const [instanceLogo, setInstanceLogo] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const dashboardLabel = dashboardSettings.viewMode === 'week' ? 'Mój tydzień' : 'Mój dzień';

  useEffect(() => {
    if (!instanceId) return;
    supabase
      .from('instances')
      .select('logo_url, name')
      .eq('id', instanceId)
      .single()
      .then(({ data }) => {
        if (data) {
          setInstanceLogo(data.logo_url);
          setInstanceName(data.name);
        }
      });
  }, [instanceId]);

  useEffect(() => {
    localStorage.setItem('n2service-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleNavClick = (view: ViewType) => {
    onViewChange(view);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
  };

  const displayName = username || user?.email || 'Użytkownik';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[115] bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 inset-y-0 left-0 z-[120] h-screen bg-card border-r border-border/50 transition-all duration-300 flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "lg:w-16" : "w-64"
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className={cn("border-b border-border/50 flex items-center", sidebarCollapsed ? "p-3 justify-center" : "px-4 py-4 justify-start gap-3 relative")}>
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              {instanceLogo ? (
                <img src={instanceLogo} alt={instanceName || 'Logo'} className={cn("object-contain", sidebarCollapsed ? "h-8" : "h-8")} />
              ) : (
                <div className="rounded-xl bg-primary flex items-center justify-center w-10 h-10 shrink-0">
                  <span className="text-primary-foreground font-bold text-lg">N2</span>
                </div>
              )}
              {!sidebarCollapsed && instanceName && (
                <h3 className="text-base font-semibold text-foreground truncate">{instanceName}</h3>
              )}
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn("flex-1 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const displayLabel = id === 'dashboard' ? dashboardLabel : label;
              return (
                <Button
                  key={id}
                  variant={currentView === id ? 'secondary' : 'ghost'}
                  className={cn("w-full gap-3", currentView === id ? "hover:bg-secondary" : "hover:bg-primary/5", sidebarCollapsed ? "justify-center px-2" : "justify-start")}
                  onClick={() => handleNavClick(id)}
                  title={displayLabel}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && displayLabel}
                </Button>
              );
            })}
          </nav>

          {/* Collapse toggle & User menu */}
          <div className={cn(sidebarCollapsed ? "p-2 space-y-2" : "p-4 space-y-3")}>
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-foreground hidden lg:flex gap-3",
                sidebarCollapsed ? "justify-center px-2" : "justify-start"
              )}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Rozwiń menu" : "Zwiń menu"}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 shrink-0" />
                  Zwiń menu
                </>
              )}
            </Button>

            {!sidebarCollapsed && <Separator className="my-3 -mx-4 w-[calc(100%+2rem)] bg-border/30" />}

            {sidebarCollapsed ? (
              <Button
                variant="ghost"
                className="w-full justify-center px-2 text-muted-foreground"
                onClick={handleLogout}
                title="Wyloguj się"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-muted-foreground px-3 h-auto py-2">
                    <span className="text-sm truncate">{displayName}</span>
                    <ChevronUp className="w-4 h-4 shrink-0 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={handleLogout} className="gap-2">
                    <LogOut className="w-4 h-4" />
                    Wyloguj się
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-[100]">
        <main className={cn("flex-1 overflow-auto p-4 lg:p-6", isMobile && "pb-20")}>
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-[110] bg-card border-t border-border/50 flex items-center justify-around h-16 px-2 pb-2.5">
          {bottomBarItems.map(({ id, label, icon: Icon }) => {
            const displayLabel = id === 'dashboard' ? dashboardLabel : label;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer transition-colors relative",
                  currentView === id ? "text-primary font-semibold" : "text-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {id === 'aktywnosci' && unreadCount > 0 && (
                  <span className="absolute top-1 right-1/2 translate-x-3 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                <span className="text-[10px] font-medium">{displayLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer text-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Więcej</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
export type { ViewType };

