begin;
create index marilyn_audit_actor_idx on marilyn_private.audit_log(actor_id);
-- One SELECT policy per role retains the public/staff union without duplicate evaluation.
drop policy marilyn_products_public on public.marilyn_products;
drop policy marilyn_products_staff on public.marilyn_products;
create policy marilyn_products_public on public.marilyn_products for select to anon using (
  visibility='published' and exists(select 1 from public.marilyn_stores s where s.id=store_id and s.approved)
);
create policy marilyn_products_authenticated on public.marilyn_products for select to authenticated using (
  (visibility='published' and exists(select 1 from public.marilyn_stores s where s.id=store_id and s.approved))
  or (store_id='00000000-0000-4000-8000-000000000001' and (select public.marilyn_staff_role()) is not null)
);
commit;
