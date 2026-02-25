import { useState, useEffect } from 'react';
import { Calendar, Users, BadgeDollarSign, Settings, LogOut, Menu, PanelLeftClose, PanelLeft, ChevronUp, X, HardHat, ClipboardCheck, MessageSquare, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewType = 'kalendarz' | 'klienci' | 'uslugi' | 'pracownicy' | 'protokoly' | 'rozliczenia' | 'powiadomienia-sms' | 'ustawienia';

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'rozliczenia', label: 'Zlecenia', icon: Receipt },
  { id: 'klienci', label: 'Klienci', icon: Users },
  { id: 'pracownicy', label: 'Pracownicy', icon: HardHat },
  { id: 'protokoly', label: 'Protokoły', icon: ClipboardCheck },
  { id: 'uslugi', label: 'Usługi', icon: BadgeDollarSign },
  { id: 'powiadomienia-sms', label: 'Powiadomienia SMS', icon: MessageSquare },
  { id: 'ustawienia', label: 'Ustawienia', icon: Settings },
];

interface DashboardLayoutProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  children: React.ReactNode;
  instanceId?: string | null;
}

const DashboardLayout = ({ currentView, onViewChange, children, instanceId }: DashboardLayoutProps) => {
  const { signOut, username, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('n2service-sidebar-collapsed') === 'true';
  });
  const [instanceLogo, setInstanceLogo] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);

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
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 inset-y-0 left-0 z-50 h-screen bg-card border-r border-border/50 transition-all duration-300 flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "lg:w-16" : "w-64"
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className={cn("border-b border-border/50 flex items-center", sidebarCollapsed ? "p-3 justify-center" : "p-6 justify-center relative")}>
            <button
              onClick={() => handleNavClick('kalendarz')}
              className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
            >
              {instanceLogo ? (
                <img src={instanceLogo} alt={instanceName || 'Logo'} className={cn("object-contain", sidebarCollapsed ? "h-8" : "h-10 max-w-[180px]")} />
              ) : (
                <div className="rounded-xl bg-primary flex items-center justify-center w-10 h-10 shrink-0">
                  <span className="text-primary-foreground font-bold text-lg">N2</span>
                </div>
              )}
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn("flex-1 space-y-2", sidebarCollapsed ? "p-2" : "p-4")}>
            {navItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={currentView === id ? 'secondary' : 'ghost'}
                className={cn("w-full gap-3", sidebarCollapsed ? "justify-center px-2" : "justify-start")}
                onClick={() => handleNavClick(id)}
                title={label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && label}
              </Button>
            ))}
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 p-4 border-b border-border/50 bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          {instanceLogo ? (
            <img src={instanceLogo} alt={instanceName || 'Logo'} className="h-8 object-contain" />
          ) : (
            <h1 className="font-semibold text-foreground">N2Service</h1>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
export type { ViewType };
