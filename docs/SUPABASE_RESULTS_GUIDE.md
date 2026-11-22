# Review SAC TOR assessment results in Supabase

**Project:** [LJOVPF-SAC_TOR](https://supabase.com/dashboard/project/rwrvsuheybpqelbtjaha).
This database is independent of the Little Jamaica Planning Framework and Mapping projects.

**Data residency:** The SAC project is hosted in Canada Central (`ca-central-1`), matching the Planning Framework Assessment database region.

## Owner reporting

In the SAC project, open **SQL Editor** using your authorized project account. Run the read-only queries from [supabase/owner_queries.sql](../supabase/owner_queries.sql). The restricted `survey_private` views expose the following only to privileged operators:

- **v_participation:** submitted and revised response counts by source version
- **v_responses:** response records with optional email, comments, opt-ins, and governance-area ranking
- **v_governance_weights:** the five governance areas, each response's rank, and 30/25/20/15/10 position weights
- **v_governance_area_summary:** mean, minimum, and maximum assigned weight by area
- **v_rank_history:** appended ranking revisions without emails or comments

The public community-comparison endpoint returns counts and average weights only, including the first completed submission. A later revision replaces the prior ranking in the average. One individual may still complete more than one independent response.

## Privacy and security

Both SAC tables use RLS with no `anon` or `authenticated` access policies. The private reporting schema is not granted to those roles. The Edge Function uses separate, randomly generated service-to-service gateway tokens with SHA-256 digests configured as Supabase Edge secrets; the database service-role key remains inside Supabase.

The administrator CSV route requires both an administrator key and the dedicated administrator gateway token. Do not share raw exports publicly. Run [supabase/reporting.sql](../supabase/reporting.sql) to check permissions.

**Deployment status:** Schema, reporting views, and the survey-storage Edge Function are installed. Gateway tokens and matching Supabase digest secrets still require configuration; until then, the Edge Function rejects unauthorized requests. Live end-to-end Vercel integration has not been tested.

**Safety:** Do not paste private credentials into GitHub, chat, or a public website. The SAC tool remains separate from the established Planning Framework database.
