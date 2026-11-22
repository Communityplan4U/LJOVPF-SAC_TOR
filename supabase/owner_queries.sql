-- Read-only SAC TOR owner queries. Run in this project's privileged SQL Editor.
-- The private views contain individual participant data; do not publish raw results.
select * from survey_private.v_participation order by source_version;
-- Current individual responses, including optional emails and comments:
select * from survey_private.v_responses order by created_at desc;
-- Current governance-area ranks and weights for each response:
select * from survey_private.v_governance_weights order by response_id,rank_position;
-- Weight distribution for the five governance areas:
select * from survey_private.v_governance_area_summary order by source_version,governance_area_id;
-- Historical rankings (without email addresses or comments):
select * from survey_private.v_rank_history order by response_id,revision;
-- Safe public aggregate:
select public.ljovsac_public_average();
