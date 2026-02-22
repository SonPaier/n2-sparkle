import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRedirect from "./components/RoleBasedRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

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
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

// Instance Admin Routes
const InstanceAdminRoutes = ({ subdomain }: { subdomain: string }) => (
  <Routes>
    <Route path="/login" element={<Login subdomainSlug={subdomain} />} />
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    <Route
      path="/:view?"
      element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
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
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// Dev Routes - full access
const DevRoutes = () => (
  <Routes>
    {/* Instance-specific login */}
    <Route path="/:slug/login" element={<Login />} />
    {/* Default login - use demo slug for dev */}
    <Route path="/login" element={<Login subdomainSlug="demo" />} />
    {/* Role-based redirect after login */}
    <Route path="/dashboard" element={<RoleBasedRedirect />} />
    {/* Protected dashboard */}
    <Route
      path="/"
      element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/:view"
      element={
        <ProtectedRoute requiredRole="admin">
          <Dashboard />
        </ProtectedRoute>
      }
    />
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {renderRoutes()}
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
