import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const RoleBasedRedirect = () => {
  const { user, roles, loading } = useAuth();
  const [employeeConfigId, setEmployeeConfigId] = useState<string | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(false);

  const isEmployeeOnly = roles.some(r => r.role === 'employee') &&
    !roles.some(r => r.role === 'admin' || r.role === 'super_admin');

  useEffect(() => {
    if (!user || !isEmployeeOnly) return;
    setCheckingConfig(true);
    supabase
      .from('employee_calendar_configs')
      .select('id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setEmployeeConfigId(data?.id || null);
        setCheckingConfig(false);
      });
  }, [user, isEmployeeOnly]);

  if (loading || checkingConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Employee-only -> employee calendar view
  if (isEmployeeOnly && employeeConfigId) {
    return <Navigate to={`/employee-calendars/${employeeConfigId}`} replace />;
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

  // Admin -> dashboard
  if (hasStudioAccess) {
    const hostname = window.location.hostname;
    const isSubdomain = hostname.endsWith('.n2service.com');
    return <Navigate to={isSubdomain ? "/" : "/admin"} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default RoleBasedRedirect;
