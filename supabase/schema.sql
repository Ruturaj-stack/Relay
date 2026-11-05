-- ============================================================================
-- RELAY — Supabase schema, row-level security and storage
-- ============================================================================
-- Apply once to a fresh Supabase project (SQL editor or `supabase db push`).
-- The running app uses the local demo database until VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY are set. Demo rows are never migrated automatically.
--
-- Design notes
--   * Every tenant-owned row carries org_id. RLS is org-scoped first, then
--     narrowed by ownership or handoff participation.
--   * profiles.id == auth.users.id. A profile row is created by onboarding
--     after sign-up (see `create_organization` below).
--   * Handoff state transitions are enforced in the application layer today.
--     For a hardened deployment, move `confirm_handoff_receipt` into an RPC
--     and revoke direct UPDATEs on handoffs.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------- Enums --------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.team_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.item_condition as enum ('excellent', 'good', 'fair', 'worn', 'damaged');
create type public.item_status as enum ('available', 'in_handoff', 'unavailable');
create type public.item_category as enum (
  'Computing', 'Photo & Video', 'Audio', 'Access', 'Documents', 'Field Gear', 'Other'
);
create type public.handoff_status as enum (
  'draft', 'requested', 'awaiting_confirmation', 'in_transit', 'received', 'returned', 'cancelled'
);
create type public.event_type as enum (
  'created', 'requested', 'accepted', 'declined', 'qr_scanned', 'handed_over', 'received',
  'condition_updated', 'return_requested', 'returned', 'completed', 'cancelled', 'note',
  'issue_reported', 'proof_uploaded'
);
create type public.notification_type as enum (
  'handoff_request', 'confirmation', 'return_reminder', 'overdue', 'team_invite', 'system', 'issue'
);
create type public.proof_type as enum ('qr', 'manual', 'photo', 'signature');
create type public.invitation_status as enum ('pending', 'accepted', 'expired');

-- ------------------------------- Tables -------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  plan text not null default 'personal' check (plan in ('studio', 'team', 'personal')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text not null,
  handle text not null,
  title text not null default 'Workspace member',
  phone text,
  avatar text,
  accent text not null default '#d8f36c',
  timezone text not null default 'UTC',
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  unique (org_id, handle)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '',
  color text not null default '#d8f36c',
  icon text not null default 'users',
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  category public.item_category not null default 'Other',
  serial text not null,
  owner_id uuid not null references public.profiles (id),
  holder_id uuid not null references public.profiles (id),
  status public.item_status not null default 'available',
  condition public.item_condition not null default 'good',
  image text not null default '/img/studio.jpg',
  images text[] not null default '{}',
  tags text[] not null default '{}',
  location text not null default 'Studio · Unassigned',
  value numeric(12, 2),
  acquired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, serial)
);

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  token uuid not null default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete restrict,
  sender_id uuid not null references public.profiles (id),
  receiver_id uuid not null references public.profiles (id),
  team_id uuid references public.teams (id) on delete set null,
  status public.handoff_status not null default 'draft',
  description text not null default '',
  instructions text not null default '',
  condition_out public.item_condition not null default 'good',
  condition_in public.item_condition,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requested_at timestamptz,
  accepted_at timestamptz,
  received_at timestamptz,
  returned_at timestamptz,
  cancelled_at timestamptz,
  photos text[] not null default '{}',
  unique (org_id, code),
  unique (token),
  check (sender_id <> receiver_id)
);

create table public.handoff_events (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.handoffs (id) on delete cascade,
  type public.event_type not null,
  actor_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  note text,
  meta jsonb not null default '{}'::jsonb
);

create table public.handoff_proofs (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.handoffs (id) on delete cascade,
  type public.proof_type not null,
  submitted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  condition public.item_condition not null,
  note text,
  photo text,
  ip_hint text,
  unique (handoff_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text not null default '',
  href text not null default '/',
  read boolean not null default false,
  handoff_id uuid references public.handoffs (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  role public.team_role not null default 'member',
  invited_by uuid not null references public.profiles (id),
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (team_id, email)
);

-- ------------------------------- Indexes ------------------------------------

create index items_org_idx on public.items (org_id, updated_at desc);
create index items_owner_idx on public.items (owner_id);
create index items_holder_idx on public.items (holder_id);
create index handoffs_org_idx on public.handoffs (org_id, updated_at desc);
create index handoffs_item_idx on public.handoffs (item_id);
create index handoffs_sender_idx on public.handoffs (sender_id);
create index handoffs_receiver_idx on public.handoffs (receiver_id);
create index handoffs_due_idx on public.handoffs (due_at) where status in ('requested', 'awaiting_confirmation', 'in_transit', 'received');
create index handoff_events_handoff_idx on public.handoff_events (handoff_id, created_at desc);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read = false;
create index invitations_email_idx on public.invitations (lower(email));

-- --------------------------- Updated-at trigger -----------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger handoffs_touch before update on public.handoffs
  for each row execute function public.touch_updated_at();

-- --------------------------- Helper functions -------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_workspace_role()
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_workspace_role() in ('owner', 'admin'), false);
$$;

create or replace function public.shares_org(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.org_id = public.current_org_id()
  );
$$;

create or replace function public.can_access_handoff(handoff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.handoffs h
    where h.id = handoff_id
      and h.org_id = public.current_org_id()
      and (h.sender_id = auth.uid() or h.receiver_id = auth.uid() or public.is_org_admin())
  );
$$;

create or replace function public.is_team_admin(team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = is_team_admin.team_id
      and tm.profile_id = auth.uid()
      and tm.role in ('owner', 'admin')
  );
$$;

-- Creates the caller's organization and profile in one transaction.
-- Call after auth.signUp(): select * from create_organization('Fieldwork', 'Fieldwork Studio');
create or replace function public.create_organization(org_name text, full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org public.organizations;
  new_profile public.profiles;
  base_slug text;
  final_slug text;
  suffix int := 1;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile already exists';
  end if;

  user_email := coalesce(auth.jwt() ->> 'email', '');
  base_slug := trim(both '-' from regexp_replace(lower(org_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'workspace'; end if;
  final_slug := base_slug;
  while exists (select 1 from public.organizations where slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (name, slug, plan)
  values (org_name, final_slug, 'team')
  returning * into new_org;

  insert into public.profiles (id, org_id, name, email, handle, role)
  values (
    auth.uid(),
    new_org.id,
    full_name,
    user_email,
    trim(both '.' from regexp_replace(lower(full_name), '[^a-z0-9]+', '.', 'g')),
    'owner'
  )
  returning * into new_profile;

  return new_profile;
end;
$$;

-- ------------------------------- RLS ----------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.items enable row level security;
alter table public.handoffs enable row level security;
alter table public.handoff_events enable row level security;
alter table public.handoff_proofs enable row level security;
alter table public.notifications enable row level security;
alter table public.invitations enable row level security;

-- Organizations: members read; owners/admins update.
create policy "org members read" on public.organizations
  for select using (id = public.current_org_id());

create policy "org admins update" on public.organizations
  for update using (id = public.current_org_id() and public.is_org_admin())
  with check (id = public.current_org_id() and public.is_org_admin());

-- Profiles: everyone in the org can see colleagues; self can update.
create policy "profiles read org" on public.profiles
  for select using (org_id = public.current_org_id());

create policy "profiles update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and org_id = public.current_org_id());

create policy "profiles insert self" on public.profiles
  for insert with check (id = auth.uid() and org_id = public.current_org_id());

-- Teams: org-readable; admins create/update; team admins manage membership.
create policy "teams read org" on public.teams
  for select using (org_id = public.current_org_id());

create policy "teams insert admin" on public.teams
  for insert with check (org_id = public.current_org_id() and public.is_org_admin());

create policy "teams update admin" on public.teams
  for update using (org_id = public.current_org_id() and public.is_org_admin())
  with check (org_id = public.current_org_id() and public.is_org_admin());

create policy "teams delete admin" on public.teams
  for delete using (org_id = public.current_org_id() and public.is_org_admin());

create policy "team members read org" on public.team_members
  for select using (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.org_id = public.current_org_id()
    )
  );

create policy "team members insert admin" on public.team_members
  for insert with check (public.is_org_admin() or public.is_team_admin(team_id));

create policy "team members update admin" on public.team_members
  for update using (public.is_org_admin() or public.is_team_admin(team_id))
  with check (public.is_org_admin() or public.is_team_admin(team_id));

create policy "team members delete admin" on public.team_members
  for delete using (public.is_org_admin() or public.is_team_admin(team_id));

-- Items: org-readable; owners/holders/org admins write.
create policy "items read org" on public.items
  for select using (org_id = public.current_org_id());

create policy "items insert own" on public.items
  for insert with check (
    org_id = public.current_org_id()
    and (owner_id = auth.uid() or public.is_org_admin())
    and public.shares_org(owner_id)
    and public.shares_org(holder_id)
  );

create policy "items update owner holder" on public.items
  for update using (
    org_id = public.current_org_id()
    and (owner_id = auth.uid() or holder_id = auth.uid() or public.is_org_admin())
  )
  with check (org_id = public.current_org_id());

create policy "items delete admin" on public.items
  for delete using (org_id = public.current_org_id() and public.is_org_admin());

-- Handoffs: participants and org admins only.
create policy "handoffs read participants" on public.handoffs
  for select using (
    org_id = public.current_org_id()
    and (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_org_admin())
  );

create policy "handoffs insert sender" on public.handoffs
  for insert with check (
    org_id = public.current_org_id()
    and sender_id = auth.uid()
    and public.shares_org(receiver_id)
  );

create policy "handoffs update participants" on public.handoffs
  for update using (
    org_id = public.current_org_id()
    and (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_org_admin())
  )
  with check (org_id = public.current_org_id());

create policy "handoffs delete admin" on public.handoffs
  for delete using (org_id = public.current_org_id() and public.is_org_admin());

-- Events: readable by handoff participants; insert as yourself.
create policy "events read participants" on public.handoff_events
  for select using (public.can_access_handoff(handoff_id));

create policy "events insert self" on public.handoff_events
  for insert with check (actor_id = auth.uid() and public.can_access_handoff(handoff_id));

-- Proof: one proof per handoff, written by a participant.
create policy "proofs read participants" on public.handoff_proofs
  for select using (public.can_access_handoff(handoff_id));

create policy "proofs insert self" on public.handoff_proofs
  for insert with check (submitted_by = auth.uid() and public.can_access_handoff(handoff_id));

-- Notifications: strictly personal.
create policy "notifications read own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications update own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications delete own" on public.notifications
  for delete using (user_id = auth.uid());

-- Invitations: team admins manage; invitee can read and accept their own.
create policy "invitations read admin or invitee" on public.invitations
  for select using (
    org_id = public.current_org_id()
    and (public.is_org_admin() or lower(email) = lower(auth.jwt() ->> 'email'))
  );

create policy "invitations insert admin" on public.invitations
  for insert with check (
    org_id = public.current_org_id()
    and invited_by = auth.uid()
    and public.is_org_admin()
  );

create policy "invitations update invitee" on public.invitations
  for update using (
    org_id = public.current_org_id()
    and (public.is_org_admin() or lower(email) = lower(auth.jwt() ->> 'email'))
  )
  with check (org_id = public.current_org_id());

create policy "invitations delete admin" on public.invitations
  for delete using (org_id = public.current_org_id() and public.is_org_admin());

-- ------------------------------- Storage ------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relay-proofs',
  'relay-proofs',
  false,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "proof images read org" on storage.objects
  for select using (
    bucket_id = 'relay-proofs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "proof images insert self" on storage.objects
  for insert with check (
    bucket_id = 'relay-proofs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "proof images delete self" on storage.objects
  for delete using (
    bucket_id = 'relay-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
