-- SAC TOR access controls and owner reporting. Run in privileged SQL Editor.
select
 has_table_privilege('anon','public.ljovsac_responses','SELECT') as anonymous_can_read,
 has_table_privilege('authenticated','public.ljovsac_responses','SELECT') as signed_in_can_read,
 has_schema_privilege('anon','survey_private','USAGE') as anonymous_reporting_access,
 has_schema_privilege('authenticated','survey_private','USAGE') as signed_in_reporting_access;
-- Aggregate priority weights and participation:
select * from survey_private.v_participation order by source_version;
select * from survey_private.v_governance_area_summary order by source_version,governance_area_id;
-- Record-level history integrity check:
select r.id,r.revision,count(h.revision) as stored_rank_versions
from public.ljovsac_responses r left join public.ljovsac_rank_revisions h on h.response_id=r.id
group by r.id,r.revision order by r.id;
-- Owner-only contact preferences, not for public export:
select response_id,email,newsletter,planning_updates
from survey_private.v_responses where email is not null order by created_at desc;
