CREATE TABLE public.book_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  user_id uuid UNIQUE,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.book_codes TO service_role;
ALTER TABLE public.book_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN newsletter boolean NOT NULL DEFAULT false,
  ADD COLUMN newsletter_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'listener')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.has_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.book_codes c WHERE c.user_id = _user_id)
    OR app_private.has_role(_user_id, 'admin')
$$;

INSERT INTO public.book_codes (code) VALUES ('004637'),('007463'),('030617'),('050295'),('050605'),('075676'),('076462'),('084007'),('094505'),('101303'),('107636'),('112885'),('144775'),('150481'),('159038'),('170421'),('174437'),('199085'),('209894'),('225244'),('230504'),('250088'),('256170'),('260111'),('264766'),('269814'),('272793'),('289915'),('294532'),('298228'),('305470'),('305739'),('307078'),('313168'),('323797'),('335298'),('336602'),('344387'),('351375'),('376097'),('382964'),('387474'),('439054'),('445726'),('473372'),('487079'),('494806'),('496109'),('497016'),('509538'),('516408'),('522213'),('540576'),('564408'),('567450'),('583192'),('585971'),('607610'),('617000'),('629309'),('640159'),('640412'),('645726'),('651555'),('658630'),('659610'),('666655'),('683835'),('687557'),('690124'),('691089'),('696201'),('703009'),('733491'),('738838'),('750949'),('753366'),('791249'),('798969'),('812175'),('838713'),('842218'),('844009'),('861122'),('875145'),('879377'),('886895'),('886898'),('894560'),('896581'),('926601'),('935929'),('951034'),('954616'),('955041'),('970552'),('975018'),('975567'),('979451'),('983806')
ON CONFLICT (code) DO NOTHING;