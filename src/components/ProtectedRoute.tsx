import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'super_admin' | 'admin' | 'user' | 'employee' | 'hall' | 'sales';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  requiredInstanceId?: string;
}

const ProtectedRoute = ({ children, requiredRole, requiredInstanceId }: ProtectedRouteProps) => {
  const { user, loading, hasRole, hasInstanceRole, roles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Employee-only users should never reach admin routes — redirect them to /dashboard
  // which triggers RoleBasedRedirect to send them to their employee calendar
  const isEmployeeOnly = roles.some(r => r.role === 'employee') &&
    !roles.some(r => r.role === 'admin' || r.role === 'super_admin');
  
  if (isEmployeeOnly && requiredRole === 'admin') {
    // Allow employee-calendar routes through
    if (!location.pathname.startsWith('/employee-calendars')) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requiredRole) {
    if (requiredInstanceId) {
      if (!hasInstanceRole(requiredRole, requiredInstanceId) && !hasRole('super_admin')) {
        return <Navigate to="/" replace />;
      }
    } else {
      if (requiredRole === 'employee') {
        // Employee routes: accessible by employee, admin, and super_admin
        const hasAccess = hasRole('employee') || hasRole('admin') || hasRole('super_admin');
        if (!hasAccess) {
          return <Navigate to="/" replace />;
        }
      } else if (requiredRole === 'admin') {
        const hasAccess = hasRole('admin') || hasRole('super_admin') || hasRole('employee') || hasRole('hall') || hasRole('sales');
        if (!hasAccess) {
          return <Navigate to="/" replace />;
        }
      } else if (!hasRole(requiredRole)) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
