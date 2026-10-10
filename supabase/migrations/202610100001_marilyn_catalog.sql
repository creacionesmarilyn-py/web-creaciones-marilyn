-- Apply to the dedicated Marilyn project only after confirming its identity.
-- No users are granted access automatically. No Firebase data is modified.
begin;
create schema if not exists marilyn_private;
revoke all on schema marilyn_private from public, anon, authenticated;
-- Clients can resolve explicitly granted functions, but cannot access private tables.
-- Keep marilyn_private OUT of the Data API exposed schemas.
grant usage on schema marilyn_private to anon, authenticated;
alter default privileges in schema marilyn_private revoke execute on functions from public;

create table marilyn_private.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table marilyn_private.site_state (
  singleton boolean primary key default true check (singleton),
  writes_enabled boolean not null default false
);
insert into marilyn_private.site_state(singleton) values(true);
create table marilyn_private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  product_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
alter table marilyn_private.staff_members enable row level security;
alter table marilyn_private.site_state enable row level security;
alter table marilyn_private.audit_log enable row level security;
revoke all on all tables in schema marilyn_private from public, anon, authenticated;
revoke all on all sequences in schema marilyn_private from public, anon, authenticated;

create function marilyn_private.marilyn_staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from marilyn_private.staff_members where user_id = (select auth.uid()) and active
$$;
revoke all on function marilyn_private.marilyn_staff_role() from public,anon,authenticated;
grant execute on function marilyn_private.marilyn_staff_role() to anon, authenticated;

-- Exposed RPC uses caller privileges; only its checked private implementation is privileged.
create function public.marilyn_staff_role() returns text
language sql stable security invoker set search_path='' as $$
  select marilyn_private.marilyn_staff_role()
$$;
revoke all on function public.marilyn_staff_role() from public,anon,authenticated;
grant execute on function public.marilyn_staff_role() to anon, authenticated;

create function marilyn_private.marilyn_staff_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', marilyn_private.marilyn_staff_role(), 'writes_enabled',
    marilyn_private.marilyn_staff_role() is not null and coalesce((select writes_enabled from marilyn_private.site_state where singleton),false))
  where (select auth.uid()) is not null
$$;
revoke all on function marilyn_private.marilyn_staff_context() from public,anon,authenticated;
grant execute on function marilyn_private.marilyn_staff_context() to authenticated;

-- Exposed RPC uses caller privileges; only its checked private implementation is privileged.
create function public.marilyn_staff_context() returns jsonb
language sql stable security invoker set search_path='' as $$
  select marilyn_private.marilyn_staff_context()
$$;
revoke all on function public.marilyn_staff_context() from public,anon,authenticated;
grant execute on function public.marilyn_staff_context() to authenticated;

create table public.marilyn_stores (
  id uuid primary key,
  name text not null,
  approved boolean not null default false
);
insert into public.marilyn_stores values ('00000000-0000-4000-8000-000000000001','Creaciones Marilyn',true);
create table public.marilyn_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  category_key text not null unique,
  path text not null unique check (path ~ '^/categorias/[a-z0-9]+(-[a-z0-9]+)*$')
);
create table public.marilyn_products (
  id text primary key default gen_random_uuid()::text check (length(id) between 1 and 160),
  store_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.marilyn_stores(id),
  category_id uuid not null references public.marilyn_categories(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  price bigint not null check (price between 0 and 9999999999),
  available boolean not null default true,
  visibility text not null default 'hidden' check (visibility in ('published','hidden')),
  status text not null default 'normal' check (length(status) <= 40),
  featured boolean not null default false,
  popup boolean not null default false,
  images text[] not null default '{}' check (cardinality(images) <= 16),
  path text not null unique check (path ~ '^/productos/[a-z0-9]+(-[a-z0-9]+)*$'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create index marilyn_products_category_idx on public.marilyn_products(category_id);
create index marilyn_products_visibility_idx on public.marilyn_products(store_id,visibility);
create table public.marilyn_product_internal (
  product_id text primary key references public.marilyn_products(id),
  legacy_data jsonb not null default '{}'
);
alter table public.marilyn_stores enable row level security;
alter table public.marilyn_categories enable row level security;
alter table public.marilyn_products enable row level security;
alter table public.marilyn_product_internal enable row level security;
revoke all on public.marilyn_stores,public.marilyn_categories,public.marilyn_products,public.marilyn_product_internal from public,anon,authenticated;
grant select on public.marilyn_stores,public.marilyn_categories,public.marilyn_products to anon,authenticated;
grant select on public.marilyn_product_internal to authenticated;
create policy marilyn_stores_public on public.marilyn_stores for select to anon,authenticated using(approved);
create policy marilyn_categories_public on public.marilyn_categories for select to anon,authenticated using(true);
create policy marilyn_products_public on public.marilyn_products for select to anon,authenticated using(
  visibility='published' and exists(select 1 from public.marilyn_stores s where s.id=store_id and s.approved)
);
create policy marilyn_products_staff on public.marilyn_products for select to authenticated using(
  store_id='00000000-0000-4000-8000-000000000001' and (select public.marilyn_staff_role()) is not null
);
create policy marilyn_internal_owner on public.marilyn_product_internal for select to authenticated using(
  (select public.marilyn_staff_role())='owner' and exists(select 1 from public.marilyn_products p where p.id=product_id and p.store_id='00000000-0000-4000-8000-000000000001')
);

create function marilyn_private.require_writer() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or marilyn_private.marilyn_staff_role() is null then raise exception 'CATALOG_FORBIDDEN' using errcode='42501'; end if;
  if not coalesce((select writes_enabled from marilyn_private.site_state where singleton),false) then raise exception 'CATALOG_NOT_ACTIVE' using errcode='55000'; end if;
end $$;
revoke all on function marilyn_private.require_writer() from public,anon,authenticated;

create function marilyn_private.marilyn_save_product(p_id text, p_expected_version bigint, p_changes jsonb) returns public.marilyn_products
language plpgsql security definer set search_path='' as $$
declare before_row public.marilyn_products; saved public.marilyn_products; next_id text; next_path text; image_url text;
begin
  perform marilyn_private.require_writer();
  if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('name','price','category_id','available','visibility','featured','images')) then raise exception 'CATALOG_INVALID_FIELDS' using errcode='22023'; end if;
  if jsonb_typeof(p_changes->'name') is distinct from 'string' or length(btrim(p_changes->>'name')) not between 1 and 200
     or jsonb_typeof(p_changes->'price') is distinct from 'number' or (p_changes->>'price') !~ '^[0-9]{1,10}$'
     or jsonb_typeof(p_changes->'available') is distinct from 'boolean'
     or jsonb_typeof(p_changes->'featured') is distinct from 'boolean'
     or coalesce(p_changes->>'visibility','') not in ('published','hidden')
     or jsonb_typeof(p_changes->'images') is distinct from 'array' then raise exception 'CATALOG_INVALID_PRODUCT' using errcode='22023'; end if;
  if jsonb_array_length(p_changes->'images') > 16 then raise exception 'CATALOG_TOO_MANY_IMAGES' using errcode='22023'; end if;
  for image_url in select jsonb_array_elements_text(p_changes->'images') loop
    if image_url is null or image_url !~ '^https://[^/@[:space:]]+/[^[:space:]]*$' or length(image_url)>2048 then raise exception 'CATALOG_INVALID_IMAGE' using errcode='22023'; end if;
  end loop;
  if not exists(select 1 from public.marilyn_categories where id=(p_changes->>'category_id')::uuid) then raise exception 'CATALOG_INVALID_CATEGORY' using errcode='22023'; end if;
  if p_id is null then
    if p_expected_version is not null then raise exception 'CATALOG_INVALID_VERSION' using errcode='22023'; end if;
    next_id := gen_random_uuid()::text;
    next_path := '/productos/' || btrim(regexp_replace(lower(translate(p_changes->>'name','áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','-','g'),'-');
    if next_path='/productos/' then next_path := '/productos/producto'; end if;
    next_path := rtrim(left(next_path,115),'-') || '-' || replace(next_id,'-','');
    insert into public.marilyn_products(id,category_id,name,price,available,visibility,featured,images,path)
    values(next_id,(p_changes->>'category_id')::uuid,btrim(p_changes->>'name'),(p_changes->>'price')::bigint,(p_changes->>'available')::boolean,p_changes->>'visibility',(p_changes->>'featured')::boolean,array(select jsonb_array_elements_text(p_changes->'images')),next_path) returning * into saved;
  else
    select * into before_row from public.marilyn_products where id=p_id and store_id='00000000-0000-4000-8000-000000000001' for update;
    if not found then raise exception 'CATALOG_NOT_FOUND' using errcode='P0002'; end if;
    if before_row.version is distinct from p_expected_version then raise exception 'CATALOG_CONFLICT' using errcode='40001'; end if;
    update public.marilyn_products set name=btrim(p_changes->>'name'),category_id=(p_changes->>'category_id')::uuid,price=(p_changes->>'price')::bigint,
      available=(p_changes->>'available')::boolean,visibility=p_changes->>'visibility',featured=(p_changes->>'featured')::boolean,
      images=array(select jsonb_array_elements_text(p_changes->'images')),version=version+1,updated_at=now(),
      status=case when not (p_changes->>'available')::boolean then 'agotado' when status in ('agotado','sin stock') then 'normal' else status end
    where id=p_id returning * into saved;
  end if;
  insert into marilyn_private.audit_log(actor_id,product_id,action,before_data,after_data)
    values(auth.uid(),saved.id,case when p_id is null then 'create' else 'update' end,to_jsonb(before_row),to_jsonb(saved));
  return saved;
end $$;
revoke all on function marilyn_private.marilyn_save_product(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function marilyn_private.marilyn_save_product(text,bigint,jsonb) to authenticated;

-- Exposed RPC uses caller privileges; only its checked private implementation is privileged.
create function public.marilyn_save_product(p_id text, p_expected_version bigint, p_changes jsonb) returns public.marilyn_products
language sql security invoker set search_path='' as $$
  select * from marilyn_private.marilyn_save_product(p_id,p_expected_version,p_changes)
$$;
revoke all on function public.marilyn_save_product(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.marilyn_save_product(text,bigint,jsonb) to authenticated;

create function marilyn_private.marilyn_create_category(p_name text) returns public.marilyn_categories
language plpgsql security definer set search_path='' as $$
declare saved public.marilyn_categories; category_id uuid := gen_random_uuid(); path_slug text;
begin
  perform marilyn_private.require_writer();
  if length(btrim(p_name)) not between 1 and 120 or p_name is null then raise exception 'CATALOG_INVALID_CATEGORY' using errcode='22023'; end if;
  select * into saved from public.marilyn_categories where category_key=lower(btrim(p_name));
  if found then return saved; end if;
  path_slug := btrim(regexp_replace(lower(translate(p_name,'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','-','g'),'-');
  insert into public.marilyn_categories(id,name,category_key,path)
    values(category_id,btrim(p_name),lower(btrim(p_name)),'/categorias/'||coalesce(nullif(path_slug,''),'categoria')||'-'||replace(category_id::text,'-','')) returning * into saved;
  return saved;
end $$;
revoke all on function marilyn_private.marilyn_create_category(text) from public,anon,authenticated;
grant execute on function marilyn_private.marilyn_create_category(text) to authenticated;

-- Exposed RPC uses caller privileges; only its checked private implementation is privileged.
create function public.marilyn_create_category(p_name text) returns public.marilyn_categories
language sql security invoker set search_path='' as $$
  select * from marilyn_private.marilyn_create_category(p_name)
$$;
revoke all on function public.marilyn_create_category(text) from public,anon,authenticated;
grant execute on function public.marilyn_create_category(text) to authenticated;
commit;
