import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { createIDBPersister } from "@/lib/idbPersister";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import PublicProtocolView from "./pages/PublicProtocolView";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRedirect from "./components/RoleBasedRedirect";
import EmployeeCalendarPage from "./pages/EmployeeCalendarPage";
import SmsNotificationTemplateEditPage from "./pages/SmsNotificationTemplateEditPage";

// Mutations fail immediately when offline
onlineManager.setEventListener((setOnline) => {
  const onlineHandler = () => setOnline(true);
  const offlineHandler = () => setOnline(false);
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);
  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 25, // 25h > persister maxAge (24h)
      retry: 1,
    },
    mutations: {
      networkMode: 'always', // don't pause — let mutations run and fail with network error
    },
  },
});

const persister = createIDBPersister();
const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24h
};

// Subdomain detection for n2service.com
const getSubdomainInfo = () => {
  const hostname = window.location.hostname;

  console.log('[Subdomain Detection] hostname:', hostname);

  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('[Subdomain Detection] → dev mode');
    return { type: 'dev', subdomain: null };
  }

  // n2service.com domain
  if (hostname.endsWith('.n2service.com')) {
    const subdomain = hostname.replace('.n2service.com', '');
    console.log('[Subdomain Detection] subdomain extracted:', subdomain);

    // Super admin: super.admin.n2service.com
    if (subdomain === 'super.admin') {
      console.log('[Subdomain Detection] → super_admin mode');
      return { type: 'super_admin', subdomain: 'super.admin' };
    }

    // Instance admin: instance.admin.n2service.com
    if (subdomain.endsWith('.admin')) {
      const instanceSlug = subdomain.replace('.admin', '');
      console.log('[Subdomain Detection] → instance_admin mode:', instanceSlug);
      return { type: 'instance_admin', subdomain: instanceSlug };
    }

    // Instance public: instance.n2service.com
    console.log('[Subdomain Detection] → instance_public mode:', subdomain);
    return { type: 'instance_public', subdomain };
  }

  // Lovable staging domain
  if (hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com')) {
    console.log('[Subdomain Detection] → dev mode (lovable staging)');
    return { type: 'dev', subdomain: null };
  }

  console.log('[Subdomain Detection] → unknown domain');
  return { type: 'unknown', subdomain: null };
};

// Super Admin Routes
const SuperAdminRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/"
      element={
        <ProtectedRoute requiredRole="super_admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Instance Admin Routes
const InstanceAdminRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    <Route path="/login" element={<Login subdomainSlug={subdomain} />} />
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    <Route
      path="/employee-calendars/:configId"
      element={
        <ProtectedRoute requiredRole="employee">
          <EmployeeCalendarPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/powiadomienia-sms/:shortId"
      element={
        <ProtectedRoute requiredRole="admin">
          <SmsNotificationTemplateEditPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/:view?"
      element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Instance Public Routes (placeholder)
const InstancePublicRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    <Route path="/" element={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Strona publiczna: {subdomain}</h1>
          <p className="text-muted-foreground">Wkrótce dostępna</p>
        </div>
      </div>
    } />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// Dev Routes - full access (same pattern as N2Wash)
const DevRoutes = () => (
  <Routes>
    {/* Instance-specific login: /pool-prestige/login */}
    <Route path="/:slug/login" element={<Login />} />
    {/* Default login without slug */}
    <Route path="/login" element={<Login subdomainSlug="pool-prestige" />} />
    {/* Role-based redirect after login */}
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    {/* Super admin */}
    <Route
      path="/super-admin"
      element={
        <ProtectedRoute requiredRole="super_admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
    {/* SMS notification template edit */}
    <Route
      path="/admin/powiadomienia-sms/:shortId"
      element={
        <ProtectedRoute requiredRole="admin">
          <SmsNotificationTemplateEditPage />
        </ProtectedRoute>
      }
    />
    {/* Admin dashboard with view param */}
    <Route
      path="/admin/:view?"
      element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
    {/* Employee calendar view */}
    <Route
      path="/employee-calendars/:configId"
      element={
        <ProtectedRoute requiredRole="employee">
          <EmployeeCalendarPage />
        </ProtectedRoute>
      }
    />
    {/* Root redirect to admin */}
    <Route path="/" element={<Navigate to="/admin" replace />} />
    <Route path="/protocols/:token" element={<PublicProtocolView />} />
    <Route path="/bulk-import" element={<BulkImportPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  const subdomainInfo = getSubdomainInfo();

  const renderRoutes = () => {
    switch (subdomainInfo.type) {
      case 'super_admin':
        return <SuperAdminRoutes />;
      case 'instance_admin':
        return <InstanceAdminRoutes subdomain={subdomainInfo.subdomain!} />;
      case 'instance_public':
        return <InstancePublicRoutes subdomain={subdomainInfo.subdomain!} />;
      case 'dev':
      default:
        return <DevRoutes />;
    }
  };

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            {renderRoutes()}
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
};

export default App;
