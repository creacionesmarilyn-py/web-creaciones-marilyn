-- Supabase's automatic RLS event trigger is infrastructure, not a public RPC.
-- Keep the trigger enabled while removing API roles' ability to execute it.
begin;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
commit;
