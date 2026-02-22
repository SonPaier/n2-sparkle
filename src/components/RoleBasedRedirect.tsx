import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const RoleBasedRedirect = () => {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Hall role -> halls view
  const hallRole = roles.find(r => r.role === 'hall');
  if (hallRole) {
    if (hallRole.hall_id) {
      return <Navigate to={`/halls/${hallRole.hall_id}`} replace />;
    }
    return <Navigate to="/halls/1" replace />;
  }

  // Super admin
  if (roles.some(r => r.role === 'super_admin')) {
    return <Navigate to="/super-admin" replace />;
  }

  // Sales-only
  const hasSalesRole = roles.some(r => r.role === 'sales');
  const hasStudioAccess = roles.some(r => r.role === 'admin' || r.role === 'employee');

  if (hasSalesRole && !hasStudioAccess) {
    return <Navigate to="/sales" replace />;
  }

  // Admin/employee -> dashboard
  if (hasStudioAccess) {
    // Use /admin for dev mode, / for subdomain mode
    const hostname = window.location.hostname;
    const isSubdomain = hostname.endsWith('.n2service.com');
    return <Navigate to={isSubdomain ? "/" : "/admin"} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default RoleBasedRedirect;
