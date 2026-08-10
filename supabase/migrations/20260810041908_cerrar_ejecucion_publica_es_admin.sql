-- PostgreSQL concede EXECUTE a PUBLIC por defecto; este cierre es necesario
-- para que anon no pueda invocar la función SECURITY DEFINER.
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
