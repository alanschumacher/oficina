-- =============================================================================
-- Oficina Mecânica: E-commerce B2C + Agendamento + Capacidade de Boxes
-- Banco: PostgreSQL (Supabase) com RLS, Storage e Trava Anti-Overbooking (GiST)
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- 1. Tipos Enumerados
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.appointment_type as enum ('preventive', 'corrective', 'installation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_order_status as enum ('open', 'diagnosing', 'awaiting_approval', 'in_service', 'ready', 'delivered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending_payment', 'paid', 'preparing', 'shipped', 'ready_for_pickup', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfillment_mode as enum ('delivery', 'pickup', 'install_at_shop');
exception when duplicate_object then null; end $$;

-- Helper para ler role RBAC do JWT (definida em app_metadata pelo servidor/admin)
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'driver');
$$;

-- -----------------------------------------------------------------------------
-- 2. Perfis e Garagem Digital (Veículos)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  document_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null,
  brand text not null,
  model text not null,
  year int not null check (year between 1950 and 2035),
  engine text,
  current_km int not null default 0 check (current_km >= 0),
  next_revision_date date,
  created_at timestamptz not null default now(),
  unique (owner_id, plate)
);

-- -----------------------------------------------------------------------------
-- 3. Catálogo de Serviços, Boxes e Técnicos
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category public.appointment_type not null default 'preventive',
  required_specialty text not null,
  duration_min int not null check (duration_min >= 30),
  buffer_min int not null default 15 check (buffer_min >= 0),
  base_price_cents int not null check (base_price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_bays (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  supported_specialties text[] not null default '{}',
  active boolean not null default true
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  specialties text[] not null default '{}',
  shift_start time not null default '08:00',
  shift_end time not null default '18:00',
  active boolean not null default true
);

-- -----------------------------------------------------------------------------
-- 4. Agendamentos (com trava anti-overbooking GiST) e Ordens de Serviço (OS)
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  bay_id uuid not null references public.service_bays(id) on delete restrict,
  technician_id uuid not null references public.technicians(id) on delete restrict,
  type public.appointment_type not null,
  status public.appointment_status not null default 'confirmed',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  symptom_notes text,
  evidence_path text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint no_bay_overlap exclude using gist (
    bay_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed', 'in_progress')),
  constraint no_technician_overlap exclude using gist (
    technician_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed', 'in_progress'))
);

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.appointments(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  technician_id uuid references public.technicians(id) on delete set null,
  status public.service_order_status not null default 'open',
  odometer_km int,
  diagnosis_summary text,
  total_cents int not null default 0 check (total_cents >= 0),
  report_pdf_path text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. E-commerce B2C de Peças e Compatibilidade Veicular
-- -----------------------------------------------------------------------------
create table if not exists public.parts_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  brand text not null,
  category text not null,
  description text,
  price_cents int not null check (price_cents > 0),
  stock_qty int not null default 0 check (stock_qty >= 0),
  is_installable boolean not null default true,
  install_service_id uuid references public.services(id) on delete set null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_parts_name_trgm on public.parts_catalog using gin (name gin_trgm_ops);

create table if not exists public.vehicle_compatibility (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts_catalog(id) on delete cascade,
  brand text not null,
  model text not null,
  year_from int not null,
  year_to int not null
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status public.order_status not null default 'pending_payment',
  fulfillment_mode public.fulfillment_mode not null default 'delivery',
  appointment_id uuid references public.appointments(id) on delete set null,
  subtotal_cents int not null check (subtotal_cents >= 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  shipping_address jsonb,
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  part_id uuid not null references public.parts_catalog(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents > 0)
);

create table if not exists public.payment_webhook_events (
  event_id text primary key,
  provider text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6. Funções RPC Atômicas (Capacidade de Boxes e Checkout Seguro)
-- -----------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date date
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  bay_id uuid,
  bay_name text,
  technician_id uuid,
  technician_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_total_interval interval;
begin
  select * into v_service from public.services where id = p_service_id and active = true;
  if not found then
    return;
  end if;

  v_total_interval := make_interval(mins => v_service.duration_min + v_service.buffer_min);

  return query
  with candidate_times as (
    select gs as t_start, gs + v_total_interval as t_end
    from generate_series(
      (p_date::timestamp + time '08:00') at time zone 'America/Sao_Paulo',
      (p_date::timestamp + time '17:00') at time zone 'America/Sao_Paulo',
      interval '30 minutes'
    ) gs
    where not (
      (gs at time zone 'America/Sao_Paulo')::time < time '13:00'
      and ((gs + v_total_interval) at time zone 'America/Sao_Paulo')::time > time '12:00'
    )
    and ((gs + v_total_interval) at time zone 'America/Sao_Paulo')::time <= time '18:00'
  ),
  free_pairs as (
    select
      c.t_start,
      c.t_end,
      b.id as b_id,
      b.name as b_name,
      t.id as tech_id,
      t.full_name as tech_name,
      row_number() over (partition by c.t_start order by b.code, t.full_name) as rn
    from candidate_times c
    join public.service_bays b
      on b.active = true
      and v_service.required_specialty = any(b.supported_specialties)
    join public.technicians t
      on t.active = true
      and v_service.required_specialty = any(t.specialties)
    where not exists (
      select 1 from public.appointments a
      where a.bay_id = b.id
        and a.status in ('confirmed', 'in_progress')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.t_start, c.t_end, '[)')
    )
    and not exists (
      select 1 from public.appointments a
      where a.technician_id = t.id
        and a.status in ('confirmed', 'in_progress')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.t_start, c.t_end, '[)')
    )
  )
  select t_start, t_end, b_id, b_name, tech_id, tech_name
  from free_pairs
  where rn = 1
  order by t_start;
end;
$$;

create or replace function public.reserve_and_create_order(
  p_owner_id uuid,
  p_fulfillment_mode public.fulfillment_mode,
  p_items jsonb,
  p_shipping_cents int default 0,
  p_appointment_id uuid default null,
  p_shipping_address jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_part public.parts_catalog%rowtype;
  v_qty int;
  v_subtotal int := 0;
  v_order_id uuid;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select * into v_part
    from public.parts_catalog
    where id = (v_item ->> 'part_id')::uuid and active = true
    for update;

    if not found then
      raise exception 'Peça não encontrada: %', v_item ->> 'part_id';
    end if;

    if v_part.stock_qty < v_qty then
      raise exception 'Estoque insuficiente para % (disponível: %)', v_part.name, v_part.stock_qty;
    end if;

    update public.parts_catalog
    set stock_qty = stock_qty - v_qty
    where id = v_part.id;

    v_subtotal := v_subtotal + (v_part.price_cents * v_qty);
  end loop;

  insert into public.orders (
    owner_id, status, fulfillment_mode, appointment_id,
    subtotal_cents, shipping_cents, total_cents, shipping_address
  )
  values (
    p_owner_id, 'pending_payment', p_fulfillment_mode, p_appointment_id,
    v_subtotal, p_shipping_cents, v_subtotal + p_shipping_cents, p_shipping_address
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_part from public.parts_catalog where id = (v_item ->> 'part_id')::uuid;
    insert into public.order_items (order_id, part_id, quantity, unit_price_cents)
    values (v_order_id, v_part.id, (v_item ->> 'quantity')::int, v_part.price_cents);
  end loop;

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.service_bays enable row level security;
alter table public.technicians enable row level security;
alter table public.appointments enable row level security;
alter table public.service_orders enable row level security;
alter table public.parts_catalog enable row level security;
alter table public.vehicle_compatibility enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_webhook_events enable row level security;

-- Profiles
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (id = auth.uid() or public.current_app_role() in ('admin', 'technician'));
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- Vehicles
create policy "vehicles_select_own_or_staff" on public.vehicles
  for select using (owner_id = auth.uid() or public.current_app_role() in ('admin', 'technician'));
create policy "vehicles_insert_own" on public.vehicles
  for insert with check (owner_id = auth.uid());
create policy "vehicles_update_own_or_admin" on public.vehicles
  for update using (owner_id = auth.uid() or public.current_app_role() = 'admin');
create policy "vehicles_delete_own" on public.vehicles
  for delete using (owner_id = auth.uid());

-- Catálogo público (leitura aberta, escrita apenas admin)
create policy "services_public_read" on public.services for select using (active = true or public.current_app_role() = 'admin');
create policy "services_admin_write" on public.services for all using (public.current_app_role() = 'admin');

create policy "bays_staff_read" on public.service_bays for select using (public.current_app_role() in ('admin', 'technician'));
create policy "bays_admin_write" on public.service_bays for all using (public.current_app_role() = 'admin');

create policy "techs_staff_read" on public.technicians for select using (public.current_app_role() in ('admin', 'technician'));
create policy "techs_admin_write" on public.technicians for all using (public.current_app_role() = 'admin');

create policy "parts_public_read" on public.parts_catalog for select using (active = true or public.current_app_role() = 'admin');
create policy "parts_admin_write" on public.parts_catalog for all using (public.current_app_role() = 'admin');

create policy "compat_public_read" on public.vehicle_compatibility for select using (true);
create policy "compat_admin_write" on public.vehicle_compatibility for all using (public.current_app_role() = 'admin');

-- Appointments & Service Orders
create policy "appointments_select_own_or_staff" on public.appointments
  for select using (owner_id = auth.uid() or public.current_app_role() in ('admin', 'technician'));
create policy "appointments_insert_own_or_admin" on public.appointments
  for insert with check (owner_id = auth.uid() or public.current_app_role() = 'admin');
create policy "appointments_update_staff" on public.appointments
  for update using (public.current_app_role() in ('admin', 'technician') or (owner_id = auth.uid() and status = 'confirmed'));

create policy "os_select_own_or_staff" on public.service_orders
  for select using (owner_id = auth.uid() or public.current_app_role() in ('admin', 'technician'));
create policy "os_write_staff" on public.service_orders
  for all using (public.current_app_role() in ('admin', 'technician'));

-- Orders & Order Items
create policy "orders_select_own_or_admin" on public.orders
  for select using (owner_id = auth.uid() or public.current_app_role() = 'admin');
create policy "order_items_select_own_or_admin" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.owner_id = auth.uid() or public.current_app_role() = 'admin'))
  );

-- Realtime para atualização ao vivo no Painel Admin
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.service_orders;

-- -----------------------------------------------------------------------------
-- 8. Storage Buckets & Políticas
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('parts-images', 'parts-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('service-evidences', 'service-evidences', false)
on conflict (id) do nothing;

create policy "parts_images_public_select" on storage.objects
  for select using (bucket_id = 'parts-images');
create policy "parts_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'parts-images' and public.current_app_role() = 'admin');

create policy "evidences_owner_or_staff_select" on storage.objects
  for select using (
    bucket_id = 'service-evidences'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_app_role() in ('admin', 'technician'))
  );
create policy "evidences_owner_or_staff_insert" on storage.objects
  for insert with check (
    bucket_id = 'service-evidences'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.current_app_role() in ('admin', 'technician'))
  );
