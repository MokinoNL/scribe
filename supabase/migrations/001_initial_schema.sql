-- ============================================================
-- Scribe - Initial Schema
-- ============================================================

-- Households: a home that owns a printer and shares lists
create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null default upper(substring(gen_random_uuid()::text, 1, 8)),
  created_at  timestamptz default now()
);

-- Household members
create table if not exists household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member', -- 'owner' | 'member'
  joined_at    timestamptz default now(),
  unique (household_id, user_id)
);

-- Printers linked to a household
create table if not exists printers (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null default 'Scribe Printer',
  api_key      text unique not null default encode(gen_random_bytes(32), 'hex'),
  last_seen    timestamptz,
  created_at   timestamptz default now()
);

-- Named lists (Groceries, Birthday gifts, etc.)
create table if not exists lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Items within a list
create table if not exists list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  text       text not null,
  checked    boolean not null default false,
  position   integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Print job queue — everything to be printed goes here
-- The printer polls this table and picks up pending jobs
create table if not exists print_jobs (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id) on delete cascade,
  printer_id            uuid not null references printers(id) on delete cascade,
  type                  text not null,      -- 'list' | 'message'
  content               jsonb not null,     -- { title?, items?, message? }
  clear_list_after_print boolean not null default false,
  list_id               uuid references lists(id) on delete set null,
  status                text not null default 'pending', -- 'pending' | 'printing' | 'done' | 'failed'
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz default now(),
  printed_at            timestamptz
);

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_household_members_user_id    on household_members(user_id);
create index if not exists idx_household_members_household  on household_members(household_id);
create index if not exists idx_lists_household              on lists(household_id);
create index if not exists idx_list_items_list              on list_items(list_id);
create index if not exists idx_print_jobs_printer_status    on print_jobs(printer_id, status);
create index if not exists idx_print_jobs_household         on print_jobs(household_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table households        enable row level security;
alter table household_members enable row level security;
alter table printers          enable row level security;
alter table lists             enable row level security;
alter table list_items        enable row level security;
alter table print_jobs        enable row level security;

-- Helper: check if the current user belongs to a household
create or replace function is_household_member(hid uuid)
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  )
$$;

-- Helper: check if the current user owns a household
create or replace function is_household_owner(hid uuid)
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  )
$$;

-- Households: members can read; only owner can update/delete
create policy "members can view their household"
  on households for select
  using (is_household_member(id));

create policy "owner can update household"
  on households for update
  using (is_household_owner(id));

create policy "authenticated users can create a household"
  on households for insert
  with check (auth.uid() is not null);

-- Household members
create policy "members can view members of their household"
  on household_members for select
  using (is_household_member(household_id));

create policy "members can join a household"
  on household_members for insert
  with check (auth.uid() = user_id);

create policy "owner can remove members"
  on household_members for delete
  using (is_household_owner(household_id) or auth.uid() = user_id);

-- Printers: members can read; only owner can manage
create policy "members can view printers"
  on printers for select
  using (is_household_member(household_id));

create policy "owner can manage printers"
  on printers for all
  using (is_household_owner(household_id));

-- Lists: all members can read/write
create policy "members can manage lists"
  on lists for all
  using (is_household_member(household_id));

-- List items: all members can read/write
create policy "members can manage list items"
  on list_items for all
  using (is_household_member((select household_id from lists where id = list_id)));

-- Print jobs: members can create and view; printer handles completion via service role
create policy "members can view print jobs"
  on print_jobs for select
  using (is_household_member(household_id));

create policy "members can create print jobs"
  on print_jobs for insert
  with check (is_household_member(household_id));

-- ============================================================
-- Updated_at trigger for lists
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lists_updated_at
  before update on lists
  for each row execute function update_updated_at();
