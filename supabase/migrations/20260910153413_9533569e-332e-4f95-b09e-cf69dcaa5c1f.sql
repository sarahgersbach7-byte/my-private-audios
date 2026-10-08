-- Rollen
CREATE TYPE public.app_role AS ENUM ('admin', 'listener');

-- Profile
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

-- Freischaltungen
CREATE TABLE public.access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_grants TO authenticated;
GRANT ALL ON public.access_grants TO service_role;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email = lower(trim(NEW.email));
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER access_grants_normalize
BEFORE INSERT OR UPDATE ON public.access_grants
FOR EACH ROW EXECUTE FUNCTION public.normalize_email();

CREATE OR REPLACE FUNCTION public.has_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.access_grants g ON g.email = lower(trim(p.email))
    WHERE p.id = _user_id AND g.active
  ) OR public.has_role(_user_id, 'admin')
$$;

-- Audios
CREATE TABLE public.audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  group_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audios TO authenticated;
GRANT ALL ON public.audios TO service_role;
ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER audios_touch_updated_at
BEFORE UPDATE ON public.audios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Wiedergabe-Protokoll
CREATE TABLE public.play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_id UUID REFERENCES public.audios(id) ON DELETE SET NULL,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.play_events TO authenticated;
GRANT ALL ON public.play_events TO service_role;
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX play_events_user_idx ON public.play_events (user_id, created_at DESC);

-- Policies
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "access_grants_admin_all" ON public.access_grants
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audios_select_granted" ON public.audios
FOR SELECT TO authenticated USING (
  (published AND public.has_access(auth.uid())) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "audios_admin_insert" ON public.audios
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audios_admin_update" ON public.audios
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audios_admin_delete" ON public.audios
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "play_events_select" ON public.play_events
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "play_events_insert_own" ON public.play_events
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Profil automatisch bei Registrierung anlegen
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, lower(trim(NEW.email)), NULLIF(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'listener')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Speicher-Policies für den privaten Audio-Bucket (nur Verwaltung)
CREATE POLICY "audios_bucket_admin_read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'audios' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audios_bucket_admin_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audios' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audios_bucket_admin_update" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'audios' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audios_bucket_admin_delete" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'audios' AND public.has_role(auth.uid(), 'admin'));