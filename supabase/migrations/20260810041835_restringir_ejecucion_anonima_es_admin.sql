-- es_admin() solo se evalúa desde policies de usuarios autenticados.
revoke execute on function public.es_admin() from anon;
