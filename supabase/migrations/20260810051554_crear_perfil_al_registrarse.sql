create function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (usuario_id, rol, nombre)
  values (new.id, 'cliente', nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''))
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
after insert on auth.users
for each row execute function public.crear_perfil_al_registrarse();

revoke all on function public.crear_perfil_al_registrarse() from public, anon, authenticated;
