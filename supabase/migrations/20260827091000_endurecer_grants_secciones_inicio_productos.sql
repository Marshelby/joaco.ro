-- Supabase concede privilegios de tabla amplios por defecto en este entorno.
-- RLS no protege TRUNCATE, por lo que los grants se restringen explícitamente.

begin;

revoke all on table public.secciones_inicio_productos from public, anon, authenticated;

grant select on table public.secciones_inicio_productos to anon, authenticated;
grant insert, update, delete on table public.secciones_inicio_productos to authenticated;

commit;
