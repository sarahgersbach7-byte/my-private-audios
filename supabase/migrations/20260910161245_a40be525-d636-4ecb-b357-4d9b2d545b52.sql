create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to postgres, service_role, authenticated;

create or replace function app_private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function app_private.has_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.access_grants g on g.email = lower(trim(p.email))
    where p.id = _user_id and g.active
  ) or app_private.has_role(_user_id, 'admin')
$$;

revoke all on function app_private.has_role(uuid, public.app_role) from public, anon;
revoke all on function app_private.has_access(uuid) from public, anon;
grant execute on function app_private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function app_private.has_access(uuid) to authenticated, service_role;

-- public tables
drop policy if exists access_grants_admin_all on public.access_grants;
create policy access_grants_admin_all on public.access_grants for all to authenticated
  using (app_private.has_role(auth.uid(), 'admin')) with check (app_private.has_role(auth.uid(), 'admin'));

drop policy if exists audios_admin_delete on public.audios;
create policy audios_admin_delete on public.audios for delete to authenticated
  using (app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_admin_insert on public.audios;
create policy audios_admin_insert on public.audios for insert to authenticated
  with check (app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_admin_update on public.audios;
create policy audios_admin_update on public.audios for update to authenticated
  using (app_private.has_role(auth.uid(), 'admin')) with check (app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_select_granted on public.audios;
create policy audios_select_granted on public.audios for select to authenticated
  using ((published and app_private.has_access(auth.uid())) or app_private.has_role(auth.uid(), 'admin'));

drop policy if exists play_events_select on public.play_events;
create policy play_events_select on public.play_events for select to authenticated
  using (user_id = auth.uid() or app_private.has_role(auth.uid(), 'admin'));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or app_private.has_role(auth.uid(), 'admin'));

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = auth.uid() or app_private.has_role(auth.uid(), 'admin'));

-- storage policies
drop policy if exists audios_bucket_admin_delete on storage.objects;
create policy audios_bucket_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'audios' and app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_bucket_admin_insert on storage.objects;
create policy audios_bucket_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'audios' and app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_bucket_admin_update on storage.objects;
create policy audios_bucket_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'audios' and app_private.has_role(auth.uid(), 'admin'));
drop policy if exists audios_bucket_admin_read on storage.objects;
create policy audios_bucket_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'audios' and app_private.has_role(auth.uid(), 'admin'));

drop policy if exists audios_bucket_granted_read on storage.objects;
create policy audios_bucket_granted_read on storage.objects for select to authenticated
  using (
    bucket_id = 'audios'
    and app_private.has_access(auth.uid())
    and exists (
      select 1 from public.audios a
      where a.storage_path = storage.objects.name and a.published
    )
  );

-- drop the now unused public wrappers and lock down the trigger function
drop function if exists public.has_access(uuid);
drop function if exists public.has_role(uuid, public.app_role);
revoke all on function public.handle_new_user() from public, anon, authenticated;
