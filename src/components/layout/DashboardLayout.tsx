import { useState, useEffect } from 'react';
import { Calendar, Users, BadgeDollarSign, Settings, LogOut, Menu, PanelLeftClose, PanelLeft, ChevronUp, X, HardHat } from 'lucide-react';
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

type ViewType = 'kalendarz' | 'klienci' | 'uslugi' | 'pracownicy' | 'ustawienia';

const navItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'kalendarz', label: 'Kalendarz', icon: Calendar },
  { id: 'klienci', label: 'Klienci', icon: Users },
  { id: 'pracownicy', label: 'Pracownicy', icon: HardHat },
  { id: 'uslugi', label: 'Usługi', icon: BadgeDollarSign },
  { id: 'ustawienia', label: 'Ustawienia', icon: Settings },
];

interface DashboardLayoutProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  children: React.ReactNode;
}

const DashboardLayout = ({ currentView, onViewChange, children }: DashboardLayoutProps) => {
  const { signOut, username, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('n2serwis-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('n2serwis-sidebar-collapsed', String(sidebarCollapsed));
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
          <div className={cn("border-b border-border/50 flex items-center justify-between", sidebarCollapsed ? "p-3" : "p-6")}>
            <button
              onClick={() => handleNavClick('kalendarz')}
              className={cn("flex items-center cursor-pointer hover:opacity-80 transition-opacity", sidebarCollapsed ? "justify-center" : "gap-3")}
            >
              <div className={cn("rounded-xl bg-primary flex items-center justify-center shrink-0", "w-10 h-10")}>
                <span className="text-primary-foreground font-bold text-lg">N2</span>
              </div>
              {!sidebarCollapsed && (
                <div className="text-left min-w-0 flex-1">
                  <h1 className="font-bold text-foreground truncate">N2Serwis</h1>
                </div>
              )}
            </button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
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
          <h1 className="font-semibold text-foreground">N2Serwis</h1>
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
