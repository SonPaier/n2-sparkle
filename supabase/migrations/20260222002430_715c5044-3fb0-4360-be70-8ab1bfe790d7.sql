
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user', 'employee', 'hall', 'sales');

-- Instances table
CREATE TABLE public.instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  email TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#7c3aed',
  active BOOLEAN NOT NULL DEFAULT true,
  working_hours JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  username TEXT,
  instance_id UUID REFERENCES public.instances(id),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  instance_id UUID REFERENCES public.instances(id),
  hall_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, instance_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Employee permissions table
CREATE TABLE public.employee_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, user_id, feature_key)
);

ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_instance_role(_user_id UUID, _role public.app_role, _instance_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND instance_id = _instance_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.has_employee_permission(_user_id UUID, _instance_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_permissions
    WHERE user_id = _user_id AND instance_id = _instance_id AND feature_key = _feature_key AND enabled = true
  )
$$;

-- Trigger: handle new user (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_instances_updated_at BEFORE UPDATE ON public.instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employee_permissions_updated_at BEFORE UPDATE ON public.employee_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies: instances
CREATE POLICY "Instances are publicly readable" ON public.instances FOR SELECT USING (true);
CREATE POLICY "Super admins can manage instances" ON public.instances FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view instance profiles" ON public.profiles FOR SELECT USING (
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);
CREATE POLICY "Anyone can lookup by username" ON public.profiles FOR SELECT USING (username IS NOT NULL);

-- RLS Policies: user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies: employee_permissions
CREATE POLICY "Admins can manage instance permissions" ON public.employee_permissions FOR ALL USING (
  public.has_instance_role(auth.uid(), 'admin', instance_id)
);
CREATE POLICY "Users can view own permissions" ON public.employee_permissions FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE UNIQUE INDEX idx_profiles_instance_username ON public.profiles(instance_id, username) WHERE username IS NOT NULL;
CREATE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
