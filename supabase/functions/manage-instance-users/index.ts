import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageUserRequest {
  action: 'list' | 'create' | 'update' | 'delete' | 'block' | 'unblock' | 'reset-password';
  instanceId: string;
  userId?: string;
  username?: string;
  password?: string;
  role?: 'admin' | 'employee' | 'hall';
  employeeId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Brak autoryzacji' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Nieprawidłowy token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerRoles } = await supabase
      .from('user_roles')
      .select('role, instance_id')
      .eq('user_id', caller.id);

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin');

    const body: ManageUserRequest = await req.json();
    const { action, instanceId, userId, username, password, role, employeeId } = body;

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'Brak ID instancji' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isInstanceAdmin = callerRoles?.some(
      r => r.role === 'admin' && r.instance_id === instanceId
    );

    if (!isSuperAdmin && !isInstanceAdmin) {
      return new Response(
        JSON.stringify({ error: 'Brak uprawnień do zarządzania użytkownikami w tej instancji' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'list': {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, email, is_blocked, created_at')
          .eq('instance_id', instanceId)
          .order('created_at', { ascending: false });

        if (profilesError) {
          return new Response(
            JSON.stringify({ error: 'Nie udało się pobrać listy użytkowników' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userIds = profiles?.map((p: any) => p.id) || [];

        const { data: roles, error: rolesError } = userIds.length
          ? await supabase
              .from('user_roles')
              .select('user_id, role')
              .eq('instance_id', instanceId)
              .in('user_id', userIds)
          : { data: [], error: null };

        if (rolesError) {
          return new Response(
            JSON.stringify({ error: 'Nie udało się pobrać ról użytkowników' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const users = (profiles || []).map((profile: any) => {
          const userRoles = (roles || []).filter((r: any) => r.user_id === profile.id).map((r: any) => r.role);
          let userRole = 'employee';
          if (userRoles.includes('admin')) userRole = 'admin';
          else if (userRoles.includes('hall')) userRole = 'hall';
          return {
            id: profile.id,
            username: profile.username || '',
            email: profile.email || '',
            is_blocked: !!profile.is_blocked,
            created_at: profile.created_at || new Date().toISOString(),
            role: userRole,
          };
        });

        return new Response(
          JSON.stringify({ success: true, users }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        if (!username || !password || !role) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: username, password, role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (role !== 'admin' && role !== 'employee' && role !== 'hall') {
          return new Response(
            JSON.stringify({ error: 'Nieprawidłowa rola. Dozwolone: admin, employee, hall' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('username', username)
          .maybeSingle();

        if (existingUser) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik o tej nazwie już istnieje w tej instancji' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${instanceId.slice(0, 8)}@internal.local`;

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError || !newUser.user) {
          return new Response(
            JSON.stringify({ error: 'Nie udało się utworzyć użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username, instance_id: instanceId, is_blocked: false })
          .eq('id', newUser.user.id);

        if (profileError) {
          await supabase.auth.admin.deleteUser(newUser.user.id);
          return new Response(
            JSON.stringify({ error: 'Nie udało się skonfigurować profilu użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: newUser.user.id, role, instance_id: instanceId });

        if (roleError) {
          await supabase.auth.admin.deleteUser(newUser.user.id);
          return new Response(
            JSON.stringify({ error: 'Nie udało się przypisać roli użytkownikowi' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Auto-create employee calendar config when creating employee
        if (role === 'employee') {
          // Link employee record if employeeId provided
          if (employeeId) {
            await supabase
              .from('employees')
              .update({ linked_user_id: newUser.user.id })
              .eq('id', employeeId)
              .eq('instance_id', instanceId);
          }

          // Get all active calendar columns for this instance
          const { data: allColumns } = await supabase
            .from('calendar_columns')
            .select('id')
            .eq('instance_id', instanceId)
            .eq('active', true);

          const columnIds = (allColumns || []).map((c: any) => c.id);

          // Get next sort_order
          const { count } = await supabase
            .from('employee_calendar_configs')
            .select('*', { count: 'exact', head: true })
            .eq('instance_id', instanceId);

          await supabase
            .from('employee_calendar_configs')
            .insert({
              instance_id: instanceId,
              user_id: newUser.user.id,
              name: username,
              column_ids: columnIds,
              sort_order: (count || 0),
              visible_fields: { customer_name: true, customer_phone: true, admin_notes: true, price: true, address: true },
              allowed_actions: { add_item: true, edit_item: true, delete_item: true, change_time: true, change_column: true },
            });
        }

        return new Response(
          JSON.stringify({ success: true, userId: newUser.user.id, message: 'Użytkownik utworzony pomyślnie' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (username) {
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('instance_id', instanceId)
            .eq('username', username)
            .neq('id', userId)
            .maybeSingle();

          if (existingUser) {
            return new Response(
              JSON.stringify({ error: 'Użytkownik o tej nazwie już istnieje w tej instancji' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ username })
            .eq('id', userId);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: 'Nie udało się zaktualizować nazwy użytkownika' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (role) {
          if (role !== 'admin' && role !== 'employee' && role !== 'hall') {
            return new Response(
              JSON.stringify({ error: 'Nieprawidłowa rola. Dozwolone: admin, employee, hall' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId)
            .eq('instance_id', instanceId);

          if (roleError) {
            return new Response(
              JSON.stringify({ error: 'Nie udało się zaktualizować roli użytkownika' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Użytkownik zaktualizowany' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'block':
      case 'unblock': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (userId === caller.id) {
          return new Response(
            JSON.stringify({ error: 'Nie możesz zablokować samego siebie' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isBlocked = action === 'block';
        const { error: blockError } = await supabase
          .from('profiles')
          .update({ is_blocked: isBlocked })
          .eq('id', userId);

        if (blockError) {
          return new Response(
            JSON.stringify({ error: `Nie udało się ${isBlocked ? 'zablokować' : 'odblokować'} użytkownika` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: isBlocked ? 'Użytkownik zablokowany' : 'Użytkownik odblokowany' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset-password': {
        if (!userId || !password) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId, password' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, { password });

        if (passwordError) {
          return new Response(
            JSON.stringify({ error: 'Nie udało się zresetować hasła' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Hasło zostało zresetowane' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Wymagane: userId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('id, instance_id')
          .eq('id', userId)
          .eq('instance_id', instanceId)
          .maybeSingle();

        if (!targetProfile) {
          return new Response(
            JSON.stringify({ error: 'Użytkownik nie należy do tej instancji' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (userId === caller.id) {
          return new Response(
            JSON.stringify({ error: 'Nie możesz usunąć samego siebie' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: targetRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('instance_id', instanceId);

        const isTargetAdmin = targetRoles?.some(r => r.role === 'admin');

        if (isTargetAdmin) {
          const { count: adminCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('instance_id', instanceId)
            .eq('role', 'admin');

          if (adminCount === 1) {
            return new Response(
              JSON.stringify({ error: 'Nie można usunąć ostatniego administratora instancji' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: 'Nie udało się usunąć użytkownika' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Użytkownik usunięty' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Nieznana akcja' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Wystąpił nieoczekiwany błąd' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
