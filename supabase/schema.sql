-- Dedicated Little Jamaica SAC Terms of Reference project only.
-- Do not run this against the Little Jamaica Planning Framework or Mapping project.
-- Fresh-project setup, organized like the Framework Tool's supabase/schema.sql.
-- Keep the SAC Vercel Data API contracts: /ljovsac_responses and
-- /rpc/ljovsac_public_average. Only server-side service_role may access them.
begin;
create extension if not exists pgcrypto;
create schema if not exists ljovsac_internal;
revoke all on schema ljovsac_internal from public,anon,authenticated;
grant usage on schema ljovsac_internal to service_role;

create table if not exists public.ljovsac_responses(
 id uuid primary key,
 token_hash text not null unique check(length(token_hash)=64),
 version text not null default 'tor12-v1',
 ranking jsonb not null check(jsonb_typeof(ranking)='array' and jsonb_array_length(ranking)=5),
 connections jsonb not null default '[]'::jsonb check(jsonb_typeof(connections)='array'),
 email text,
 newsletter_opt_in boolean not null default false,
 planning_opt_in boolean not null default false,
 feedback text,
 revision integer not null default 1 check(revision>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint contact_consent_needs_email check(not(newsletter_opt_in or planning_opt_in) or email is not null),
 constraint feedback_limit check(feedback is null or char_length(feedback)<=1500),
 constraint email_limit check(email is null or char_length(email)<=254)
);
create table if not exists public.ljovsac_rank_revisions(
 response_id uuid not null references public.ljovsac_responses(id) on delete cascade,
 revision integer not null,
 ranking jsonb not null,
 recorded_at timestamptz not null default now(),
 primary key(response_id,revision)
);
alter table public.ljovsac_responses enable row level security;
alter table public.ljovsac_rank_revisions enable row level security;
revoke all on table public.ljovsac_responses from public,anon,authenticated;
revoke all on table public.ljovsac_rank_revisions from public,anon,authenticated;
grant select,insert,update,delete on public.ljovsac_responses to service_role;
grant select,insert on public.ljovsac_rank_revisions to service_role;
-- No anon/authenticated policies: Vercel authenticates private return-link tokens.
create index if not exists ljovsac_responses_updated on public.ljovsac_responses(updated_at desc);

-- Service-role-only aggregate: no individual responses or contacts are exposed.
-- The existing SAC implementation assigns 30/25/20/15/10 by rank position.
create or replace function public.ljovsac_public_average()
returns jsonb language sql stable security invoker set search_path='' as $$
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
  'averages',coalesce((select jsonb_object_agg(area_id,average_weight) from means),'{}'::jsonb)
 )
$$;

-- Append-only record of rank revisions; contact details and feedback stay only
-- in the private responses table and are not duplicated in revision history.
create or replace function ljovsac_internal.record_rank_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.ljovsac_rank_revisions(response_id,revision,ranking)
 values(new.id,new.revision,new.ranking)
 on conflict(response_id,revision) do nothing;
 return new;
end;$$;
drop trigger if exists ljovsac_record_rank_revision on public.ljovsac_responses;
create trigger ljovsac_record_rank_revision
 after insert or update of revision,ranking on public.ljovsac_responses
 for each row execute function ljovsac_internal.record_rank_revision();

revoke all on function public.ljovsac_public_average() from public,anon,authenticated;
revoke all on function ljovsac_internal.record_rank_revision() from public,anon,authenticated;
grant execute on function public.ljovsac_public_average() to service_role;
grant execute on function ljovsac_internal.record_rank_revision() to service_role;

-- Owner-only, security-invoker reporting views (Framework-style).
create schema if not exists survey_private;
revoke all on schema survey_private from public,anon,authenticated;
grant usage on schema survey_private to service_role;
create or replace view survey_private.v_responses with (security_invoker=true) as
select id as response_id,version as source_version,created_at,updated_at,revision as last_revision,email,
 newsletter_opt_in as newsletter,planning_opt_in as planning_updates,connections as neighbourhood_connections,
 feedback as comments,ranking as governance_area_ranking,true as survey_completed
from public.ljovsac_responses;
create or replace view survey_private.v_governance_weights with (security_invoker=true) as
select r.id as response_id,r.version as source_version,j.value as governance_area_id,
 j.ordinality::integer as rank_position,
 (case j.ordinality when 1 then 30 when 2 then 25 when 3 then 20 when 4 then 15 when 5 then 10 end)::numeric as area_weight,r.updated_at
from public.ljovsac_responses r
cross join lateral jsonb_array_elements_text(r.ranking) with ordinality as j(value,ordinality);
create or replace view survey_private.v_participation with (security_invoker=true) as
select version as source_version,count(*)::bigint as completed,
 count(*) filter (where revision>1)::bigint as revised,
 min(created_at) as first_response_at,max(updated_at) as latest_response_at
from public.ljovsac_responses group by version;
create or replace view survey_private.v_rank_history with (security_invoker=true) as
select response_id,revision,ranking,recorded_at from public.ljovsac_rank_revisions;
create or replace view survey_private.v_governance_area_summary with (security_invoker=true) as
select source_version,governance_area_id,count(*)::bigint as responses,round(avg(area_weight),2) as average_weight,
 min(area_weight) as minimum_weight,max(area_weight) as maximum_weight
from survey_private.v_governance_weights group by source_version,governance_area_id;
revoke all on all tables in schema survey_private from public,anon,authenticated;
grant select on all tables in schema survey_private to service_role;

commit;
