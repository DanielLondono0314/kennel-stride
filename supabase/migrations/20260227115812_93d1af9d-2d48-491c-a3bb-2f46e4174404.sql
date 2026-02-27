
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'front_desk', 'trainer', 'manager');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Business profile (single row)
CREATE TABLE public.business_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Mi Centro',
  logo_url TEXT,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  opening_time TIME DEFAULT '07:00',
  closing_time TIME DEFAULT '19:00',
  timezone TEXT DEFAULT 'America/Mexico_City',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

-- Staff members table (for managing employees independent of auth)
CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role app_role NOT NULL DEFAULT 'trainer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  -- Auto-assign admin role to first user
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins can manage
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Business profile: admins can CRUD, all authenticated can read
CREATE POLICY "Authenticated can read business" ON public.business_profile
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage business" ON public.business_profile
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Staff: admins can CRUD, all authenticated can read
CREATE POLICY "Authenticated can read staff" ON public.staff_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage staff" ON public.staff_members
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Also allow anon read for demo purposes (no auth yet)
CREATE POLICY "Anon can read business" ON public.business_profile
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert business" ON public.business_profile
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update business" ON public.business_profile
  FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can read staff" ON public.staff_members
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert staff" ON public.staff_members
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update staff" ON public.staff_members
  FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can delete staff" ON public.staff_members
  FOR DELETE TO anon USING (true);
