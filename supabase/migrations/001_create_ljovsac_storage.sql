-- Dedicated SAC TOR tables. Can be installed in a separately provisioned Supabase
-- project. These tables do not touch the LJOVPF Framework survey's tables.
-- All access is through authenticated server-side Vercel API handlers.
create extension if not exists pgcrypto;

create table if not exists public.ljovsac_responses (
  id uuid primary key,
  token_hash text not null unique check (length(token_hash)=64),
  version text not null default 'tor12-v1',
  ranking jsonb not null check (jsonb_typeof(ranking)='array' and jsonb_array_length(ranking)=5),
  connections jsonb not null default '[]'::jsonb check (jsonb_typeof(connections)='array'),
  email text,
  newsletter_opt_in boolean not null default false,
  planning_opt_in boolean not null default false,
  feedback text,
  revision integer not null default 1 check (revision>=1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_consent_needs_email check (not (newsletter_opt_in or planning_opt_in) or email is not null),
  constraint feedback_limit check (feedback is null or char_length(feedback)<=1500),
  constraint email_limit check (email is null or char_length(email)<=254)
);
create index if not exists ljovsac_responses_updated on public.ljovsac_responses(updated_at desc);
alter table public.ljovsac_responses enable row level security;
revoke all on table public.ljovsac_responses from anon,authenticated;
grant select,insert,update,delete on public.ljovsac_responses to service_role;
-- No policies for anon or authenticated. Private token verified by API server only.

-- Service-role-only aggregate avoids exposing responses or contact information.
create or replace function public.ljovsac_public_average()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with expanded as (
    select j.value::text as area_id,
      case j.ordinality when 1 then 30 when 2 then 25 when 3 then 20 when 4 then 15 when 5 then 10 end as weight
    from public.ljovsac_responses r,
    lateral jsonb_array_elements_text(r.ranking) with ordinality j(value,ordinality)
  ), means as (
    select area_id,round(avg(weight)::numeric,2) as average_weight from expanded group by area_id
  )
  select jsonb_build_object(
    'count',(select count(*) from public.ljovsac_responses),
    'averages',coalesce((select jsonb_object_agg(area_id, average_weight) from means),'{}'::jsonb)
  )
$$;
revoke all on function public.ljovsac_public_average() from public, anon,authenticated;
grant execute on function public.ljovsac_public_average() to service_role;

-- Append-only rank revision history. Contact details and comments are not
-- duplicated; current private response fields remain only in the main table.
create table if not exists public.ljovsac_rank_revisions (
  response_id uuid not null references public.ljovsac_responses(id) on delete cascade,
  revision integer not null,
  ranking jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key(response_id,revision)
);
alter table public.ljovsac_rank_revisions enable row level security;
revoke all on table public.ljovsac_rank_revisions from anon,authenticated;
grant select,insert on public.ljovsac_rank_revisions to service_role;
create schema if not exists ljovsac_internal;
create or replace function ljovsac_internal.record_rank_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 insert into public.ljovsac_rank_revisions(response_id,revision,ranking)
 values(new.id,new.revision,new.ranking)
 on conflict(response_id,revision) do nothing;
 return new;
end;
$$;
drop trigger if exists ljovsac_record_rank_revision on public.ljovsac_responses;
create trigger ljovsac_record_rank_revision
 after insert or update of revision,ranking on public.ljovsac_responses
 for each row execute function ljovsac_internal.record_rank_revision();

revoke all on function ljovsac_internal.record_rank_revision() from public, anon, authenticated;
