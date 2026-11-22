# Build status — November 22, 2026

## Implemented and locally verified
- Exact latest approved four-step interface and original design vocabulary.
- Exact 12-component TOR-only criteria, five areas and 30/25/20/15/10 rank weights.
- Both Step 1/Step 3 per-area tables; Step 3 values are weighted contributions.
- The original Planning Framework survey's seven neighbourhood-connection choices, optional email and independent update consents.
- Step 3 optional SAC-specific comment submission.
- Step 4 side-by-side weight comparison cards; community average appears from first completed submission.
- Server-only storage implementation, private token hashes, optimistic response revisions, private deletion and admin CSV export.
- Dedicated SQL table isolation (new project required), RLS, explicit grants and server-only aggregate function.
- 13+ automated tests and desktop/mobile browser interface checks using temporary local mock data.

## Not yet live / dependent on approval
- No user-approved 12-component comparative judgments were supplied; all 108 applicable comparator cells intentionally remain unrated.
- Weston TOR missing; Weston cannot be included in rankings until verified.
- Dedicated Supabase project not created (its organization and possible billing must be confirmed).
- New GitHub/Vercel projects and public /ljovsac routing not created or modified.
- No real responses, consented emails or community averages have been collected.
- Security/privacy/go-live controls (data retention, edge rate limiting, live database verification) need release review.

The standalone design-preview HTML uses temporary browser-tab-only responses. It is NOT the live survey and must never be published as such.
