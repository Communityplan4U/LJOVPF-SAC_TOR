# Review SAC TOR assessment results in Supabase

Use your existing Supabase account and open the [Canadian SAC project, LJOVPF-SAC_TOR](https://supabase.com/dashboard/project/rwrvsuheybpqelbtjaha). Its project reference is `rwrvsuheybpqelbtjaha` and its region is Canada Central (`ca-central-1`). Owner reporting follows the Framework Tool's Supabase dashboard workflow, using the SAC's own data and views.

## View individual responses and summaries

In **Table Editor**, choose the `survey_private` schema. The following views are available to authorized project operators:

| View | Contents |
| --- | --- |
| `v_responses` | Current responses, optional email and comments, separate opt-ins, neighbourhood connections and governance-area rankings |
| `v_governance_weights` | Each response's five governance-area positions and 30/25/20/15/10 weights |
| `v_participation` | Submitted and revised-response counts by source version |
| `v_governance_area_summary` | Mean, minimum and maximum assigned weight for each area |
| `v_rank_history` | Previous ranking revisions, without emails or comments |

Alternatively, open **SQL Editor** and run a selected query from [supabase/owner_queries.sql](../supabase/owner_queries.sql).

## Export responses to CSV

1. Open **SQL Editor** in the SAC project.
2. Copy the first query under **CSV-ready response export** in `supabase/owner_queries.sql`.
3. Run that query, then export its results as CSV.

The export includes the same response information as the former administrator endpoint: response ID, creation/update times, revision, ranking, neighbourhood connections, optional email, newsletter and planning-update preferences, and comments. It excludes private-token hashes. Email or comments that begin like spreadsheet formulas are prefixed with an apostrophe, preserving the previous export's spreadsheet protection. Other owner queries provide participation, weight distribution and ranking history.

Access is controlled by your Supabase project account. There is no separate application administrator login or export password. The public app's gateway cannot request bulk response exports. Raw `v_responses` exports do not apply the CSV query's formula protection; use the CSV-ready query for spreadsheet files.

## Privacy and operation

Both SAC tables use row-level security and deny table access to `anon` and `authenticated`. The `survey_private` schema is also restricted. Privileged Supabase collaborators can access owner reports according to their project permissions. Optional contact information and comments should remain in authorized owner reports.

The public community-comparison endpoint returns counts and average weights, starting with the first completed response. A one-response average equals that person's choices. Revisions replace the same response's previous weighting in the current average; independent responses are not proof of unique people. Deleting a response also deletes its rank history.

Run [supabase/reporting.sql](../supabase/reporting.sql) to inspect grants and reporting integrity. The Edge Function authenticates the server's gateway token against the `SAC_GATEWAY_TOKEN_SHA256` secret. The database service credential remains inside Supabase.

The schema, reporting views and `survey-storage` Edge Function are installed. Production gateway configuration and live end-to-end saving still need verification before launch. See [README — Connect the SAC deployment](../README.md#connect-the-sac-deployment) and `.env.example` for the current configuration.
