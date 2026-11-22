# Little Jamaica SAC — Terms of Reference Assessment

A four-step Community in Public application comparing the written Terms of Reference (TORs) of the Little Jamaica and Oakwood Vaughan Stakeholder Advisory Committee with ten other Toronto advisory bodies. It follows the [Planning Framework Tool](https://github.com/Communityplan4U/little-jamaica-framework-tool)'s build, stylesheet, status and owner-reporting patterns, adapted to SAC's five governance areas and twelve criteria.

## Current status

Development takes place directly on `main` in [Communityplan4U/LJOVPF-SAC_TOR](https://github.com/Communityplan4U/LJOVPF-SAC_TOR). The dedicated [SAC Supabase project](https://supabase.com/dashboard/project/rwrvsuheybpqelbtjaha) is hosted in **Canada Central (`ca-central-1`)**. Its SAC tables, private reporting views and `survey-storage` Edge Function are installed.

The checked-in assessment is still marked `published: false` and its comparative ratings are `null`. Approved workbook evidence has not been imported into this source file. The current source marks Weston in Gear as unverified; it remains unrated until that source record and its evidence are verified. Missing judgments are never treated as zero. The tool is not yet connected to the public website; production gateway credentials and a live save/resume/revise/delete check remain required before launch.

## Four-step participant flow

1. **Compare the TORs.** Explore eleven advisory bodies, five governance-area comparisons and twelve assessment criteria.
2. **Rank governance areas.** Reorder the five areas. Positions receive **30%, 25%, 20%, 15% and 10%**. Neighbourhood connections, email and the two communication opt-ins are optional.
3. **See the updated comparison.** Compare starting and personalized weighted net scores, inspect the evidence, and optionally comment on the SAC TORs.
4. **Compare with respondents.** Compare the participant's weights with averages across saved responses, starting with the first completed submission. Copy a private return link to revise or delete the response later.

### Assessment method

Only commitments explicitly written in each TOR support a judgment. Meeting conduct, correspondence and later practice do not form part of this assessment.

- `+1`: the comparator has stronger written commitments than LJOVPF.
- `0`: the written provisions are comparable.
- `-1`: LJOVPF has stronger written commitments.

Each area's weight is shared equally among its criteria. The weighted net score is `12 × sum(area weight × mean of the area's judgments)`, with weights expressed as proportions. Higher scores favour the comparator's written commitments; LJOVPF is the reference at zero once the assessment is published. Participant ranking changes the weights, while approved documentary judgments stay fixed. Ties share rank and incomplete comparators remain unrated.

Background and origin are included in `G5-02`, without a separate fixed score. The twelve-criterion assessment must not be reconstructed from historical 21- or 23-component scores. See [the assessment method](docs/assessment-method.md).

## Data structure and compatibility

| File | Role |
| --- | --- |
| `data/assessment.json` | Authoritative SAC criteria, comparators, written-TOR evidence and approved judgments |
| `data/methodology.json` | SAC source version, governance areas and 30/25/20/15/10 position weights |
| `public/css/survey.css` | Single stylesheet, including the reviewed SAC interface rules |
| `public/index.html` | HTML shell; loads generated `js/data.js` before the application module |
| `public/js/app.js` | Four-step interface, saving and private return links |
| `public/js/scoring.js` | Assessment validation, weighting and net scores |
| `scripts/build.mjs` | Validates source data, copies `public/` into `dist/`, and generates `dist/js/data.js` |
| `api/status.js` | GET-only configuration and storage-readiness status |
| `api/response.js` | Create, privately retrieve, revise and delete a response |
| `api/checkpoint.js`, `api/resume.js` | Framework-style entry points to the SAC response handler |
| `api/community.js` | Counts and average governance-area weights |
| `server/lib/handlers.mjs` | Input validation and private participant-token authentication |
| `server/gateway.cjs` | Server-to-Edge adapter and local development memory store |
| `supabase/functions/survey-storage/index.ts` | Restricted SAC database operations |
| `supabase/schema.sql` | SAC tables, RLS, aggregate function, rank-history trigger and private reporting views |
| `supabase/owner_queries.sql` | Owner reporting and CSV export through the Supabase SQL Editor |

As in the Framework Tool, the build produces `window.LJOV_ASSESSMENT` and `window.LJOV_METHODOLOGY` in `dist/js/data.js`. The data comes from the canonical files in `data/`; generated assets are not edited or committed. `public/` is the source asset directory and `dist/` is the deployment output. There is no second public assessment JSON to synchronize.

SAC retains its own `tor12-v1` data shape, five areas, twelve criteria, rank history and response tokens. Framework-specific collection rounds, deadlines, topic allocations and response data are not imported into this tool.

## Run locally and validate

Install **Node.js 22 or later**. There are no runtime npm dependencies.

```bash
npm ci --ignore-scripts
npm run validate:assessment
npm test
npm run dev
```

Open `http://127.0.0.1:4177/`. Development builds and serves `dist/`. The local server uses memory storage: test responses disappear when it stops. `/api/status` identifies this development storage separately from a verified Supabase connection.

To build deployment output alone, run `npm run build`.

### Publish approved evidence

Edit only `data/assessment.json` when importing approved evidence. Every rated comparator/criterion needs a rating, exact LJOVPF and comparator excerpts (or an explicit statement of absence), TOR sections and a rationale. Keep incomplete judgments as `null` and the assessment unpublished while review is underway.

The optional `scripts/import-approved-review.py` accepts an existing workbook whose **Assessment Approval** sheet has headers in row 5 and data from row 6, in this column order: comparator ID, comparator name, area, component ID, component title, LJOVPF excerpt, comparator excerpt, TOR sections, rating, rationale, review status and source URL. It imports rows marked `Approved`; it does not generate a workbook or assume one is bundled with the repository. Install `openpyxl` only if using this optional importer.

```bash
python scripts/import-approved-review.py /path/to/approved-review.xlsx
npm run validate:assessment
```

The importer's `--publish` option requires the complete evidence matrix for the currently verified comparators. After an approved import, run:

```bash
npm run validate:publication
npm test
npm run build
```

The publication validator intentionally fails for the current unapproved source. A successful build of a draft is not approval to publish its comparative judgments.

## Survey privacy and operations

Participant email and the newsletter and Little Jamaica planning-update permissions are separate and optional. Private return-link tokens are stored as SHA-256 hashes in the database; private retrieval, revision and deletion require the original token. Revision checks prevent an older browser tab from silently overwriting a newer response. Deleting a response also removes its rank history.

Both SAC tables have RLS enabled. The `anon` and `authenticated` roles have no table access, and owner reporting is restricted to `survey_private`. Only the Supabase Edge Function holds the database service credential. The browser receives neither that credential nor the server gateway token.

Public community results contain counts and average weights only. They represent saved responses, not verified unique people or a representative sample. A revision replaces the same response's previous weighting in the average. Under the accepted first-response rule, a one-response average equals that respondent's choices; this is disclosed in Step 4.

Owners review and export results through their existing Supabase accounts, following [the SAC results guide](docs/SUPABASE_RESULTS_GUIDE.md). The first query in `supabase/owner_queries.sql` provides a CSV-ready response export that protects free-text fields against spreadsheet formula interpretation. Contact information and comments remain private owner data.

Return-link email is optional and disabled by default. Enable it only after configuring a verified sender and the optional variables in `.env.example`. Public launch also requires the agreed privacy notice, retention arrangements, withdrawal process and abuse controls; the source package does not activate an external rate limiter.

## Connect the SAC deployment

Connect this repository's `main` branch to the SAC Vercel project, separate from the Framework deployment. The checked-in `vercel.json` sets `npm run build` and output directory `dist`.

Configure these values as **server-side** environment variables:

| Location | Variable | Value |
| --- | --- | --- |
| SAC Vercel project | `SUPABASE_URL` | `https://rwrvsuheybpqelbtjaha.supabase.co` |
| SAC Vercel project | `SURVEY_GATEWAY_TOKEN` | A dedicated randomly generated base64url token, 64–128 characters |
| SAC Vercel project | `PUBLIC_ORIGINS` | `https://communityinpublic.ca,https://www.communityinpublic.ca` when using the main-site proxy |
| SAC Supabase Edge secrets | `SAC_GATEWAY_TOKEN_SHA256` | Hex SHA-256 digest of that same gateway token |
| Supabase-managed Edge environment | `SUPABASE_SECRET_KEYS` or `SUPABASE_SERVICE_ROLE_KEY` | Database service credential; keep it inside Supabase |

`.env.example` documents the configuration; changing that file does not set the live Vercel variables. Never place secrets in GitHub or public build variables. Owner exports use Supabase account permissions and do not require a separate export key or administrator gateway token.

The function's `verify_jwt = false` setting is limited to `survey-storage`, which authenticates the custom gateway token itself before accepting its allowed operations. Missing or incorrect gateway credentials are rejected. After configuring the deployment, check `/api/status`, create a test response, resume and revise it through its private link, verify the community average, delete the test response, and confirm owner views reflect the deletion.

### Proposed website path

The frontend supports both a standalone domain root and the `/ljovsac/` prefix. When connecting the main website, merge the following into its existing routing configuration, replacing the example destination with the actual SAC deployment:

```json
{"rewrites": [
  {"source": "/ljovsac", "destination": "https://YOUR-SAC-DEPLOYMENT.vercel.app/"},
  {"source": "/ljovsac/:path*", "destination": "https://YOUR-SAC-DEPLOYMENT.vercel.app/:path*"}
]}
```

Verify the stylesheet, generated data script, JavaScript modules and API requests at the final path before public release.
