# Little Jamaica SAC Terms of Reference comparison

A separate, four-step Community in Public web application, built from the approved Little Jamaica Planning Framework tool's interface patterns and the submitted **12-component, TOR-only component map**.

## Build status

**Application and server-side code: built and tested. Public launch: not yet authorized or configured.**

The `data/assessment.json` file deliberately has **no numerical comparative judgments**. The user requires the *user-approved* TOR-only judgments, which have not yet been supplied for the consolidated 12 components. The application's scores therefore remain **unrated** and cannot be published from placeholder data. Nine comparators require 12 verified ratings each (108 total). **Weston in Gear must stay unrated until its own written TOR is verified**; another committee's TOR cannot be substituted.

This delivery does not create or modify the existing LJOVPF Planning Framework repository, production Vercel project, Supabase schema, or any existing responses. A new isolated Supabase project and separate Vercel project remain to be connected for live use. Creating a new Supabase project may incur a cost; confirm the intended Supabase organization before provisioning.

## Four-step user experience

1. **Compare the TORs.** Overall relative net-score rankings, eleven advisory bodies, five governance-area comparisons, and twelve collapsible assessment criteria.
2. **Rank governance areas.** Reorder five areas; positions retain weights **30%, 25%, 20%, 15%, 10%**. The original Planning Framework survey's optional neighbourhood-connection questions, email field and separate communication opt-ins appear here.
3. **See updated comparison.** Compare starting and personalized weighted net scores, with **weighted area contributions**, criteria and optional comments about the SAC TORs.
4. **Compare with respondents.** Side-by-side bars for the participant's own weights and the average across saved responses, shown starting with the **first** completed submission. It includes a private return-link copy control and the ability to remove the response.

The G5-02 component includes Background & origin; **there is no fixed or separate score** for that subject.

### Scoring, direction and evidence limits

- Each comparison uses ONLY commitments explicitly contained in the actual written TORs. No meeting attendance, staff correspondence or subsequent practice can support a judgment.
- `+1` = comparator's TOR provides stronger written commitments than LJOVPF; `0` = comparable provisions; `-1` = LJOVPF provides stronger written commitments.
- Each of the five area weights is shared equally among that area's approved components. There are 12 components altogether.
- **Weighted net score** = `12 × sum( area_weight × mean(component judgments in area) )`, where area weights are proportions (e.g. 0.30). A higher net score favours the comparator's written commitments. LJOVPF has reference score 0.
- Step 1 uses the adopted starting weights; Step 3 uses participant-reassigned area weights. The same approved judgments are held constant.
- Scores/ranks are **null** unless all 12 judgments for that comparator are approved. Weston remains included but unrated. Rank is the position among *rated* bodies; ties share rank.
- Source evidence in `assessment.json` must include rationale, TOR section and LJOVPF/comparator clause excerpts or an explicit notice that a provision is absent.
- **Never** publish or reconstruct the 12-component baseline from the old 21- or 23-component scores. The old scoring is a different methodology.

## Source layout

```text
public/index.html             Original-design HTML shell
public/css/style.css          Style system retained from reviewed mock-up
public/js/app.js              Four-step public interface and response workflows
public/js/scoring.js          Tested area weighting and net-score functions
data/assessment.json   Exact 12 criteria, 11 bodies, no fabricated judgments
api/response.js              Create, private retrieval, revision, deletion
api/community.js             Aggregate average weights, no identifiable results
api/admin/export.js          Administrator-only CSV export
api/health.js                Non-sensitive readiness information
lib/handlers.mjs             Input validation and private token authentication
lib/repository.mjs           Server-only Supabase REST access
server/dev.mjs               Local ephemeral memory development server
supabase/schema.sql   Dedicated tables, RLS, grants, aggregate RPC
scripts/validate-assessment.mjs    Publication gate
```

## Run locally

Install **Node.js 22 or later**. No npm dependencies are required.

```bash
npm run validate:assessment
npm test
npm run dev
```

Open `http://127.0.0.1:4177/`. The local server intentionally stores test responses **in memory only**. They disappear when it stops; it does not connect to or alter existing Supabase data.

For a standalone *design review*, open the companion `LJOVPF_SAC_TOR_Full_Build_Design_Preview.html`. That file clearly identifies its temporary browser-tab-only mock API; do **not** publish it as the real application. The complete deployable application is the project directory.

## Publish approved assessment data

1. Fill `docs/review/assessment_review_template.xlsx` (120 rows covering all ten comparators; Weston remains on hold). For each of the **108 verified-comparator rows**, supply the rating `-1`, `0`, or `1`, both exact TOR excerpts (or an explicit statement of silence), the TOR sections and your rationale. Mark each fully source-checked row `Approved`. The original LJOVPF TOR is the common reference.
2. Run `python scripts/import-approved-review.py docs/review/assessment_review_template.xlsx` to import only the approved rows into `data/assessment.json`. Install `openpyxl` locally for this one-time import script if needed. To release an entirely approved matrix, run the same script with `--publish`. This fails until all 108 verified rows are approved.
3. Keep all Weston in Gear values `null` and its source unverified until its actual TOR is obtained. Do not count Weston as tied or zero.
4. Run `npm run validate:assessment`; it checks structure, 12 components, citations, and Weston restrictions.
5. The `--publish` import flag sets `assessment_status` to `approved` and `published` to `true` only when the complete approved matrix validates.
6. Run `npm run validate:publication` (requires complete, justified judgments for all nine verified comparators).
7. Build/test a non-production deployment before enabling a public URL. The client also checks the validation rules and suppresses scores if the approved file is malformed.

## Separate database setup (required for live saving)

Provision a **dedicated Supabase project** in the intended organization, preferably Canada Central. This is an isolated project, not a schema in the existing Little Jamaica Planning Framework survey project. Supabase creation may add cost and requires the user's confirmation where applicable. Apply `supabase/schema.sql` to the new project's SQL Editor and confirm the following before deploying:

- `public.ljovsac_responses` has RLS enabled and no access for `anon` or `authenticated` roles.
- `public.ljovsac_rank_revisions` stores append-only ranking revision history; it does **not** duplicate contact details or comments. Deleting a response deletes its rank revisions.
- `public.ljovsac_public_average()` is executable only by server-side service role, and returns only `{count, averages}`.
- The server stores a **SHA-256 hash** of each high-entropy private token, never the token itself. Read/revision/deletion require the private token; old revisions cannot silently overwrite newer ones.
- The public app never receives a Supabase key. Only Vercel's server functions hold the service-role JWT.

## Deploy the separate Vercel project

Create a new GitHub repository for this project, separately from `Communityplan4U/little-jamaica-framework-tool`, and connect it to a **new Vercel project** under Community in Public. Keep preview deployments restricted while the baseline review and privacy/security checks are incomplete.

Set the following server-side environment variables in **Vercel Project Settings** (do not paste secrets into chats or source code):

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EXPORT_KEY
PUBLIC_ORIGINS=https://communityinpublic.ca,https://www.communityinpublic.ca
```

`PUBLIC_ORIGINS` lists allowed public website origins for submissions forwarded through the `/ljovsac` reverse proxy. Keep it limited to the actual website and any trusted preview origins. Set `ADMIN_EXPORT_KEY` to a randomly generated secret of at least 32 characters. Create it using your password manager or a local cryptographic random generator. Do not use `NEXT_PUBLIC_` or public build variables for any of these.

The build uses `public/` static assets, `api/` Node.js serverless handlers and the included `vercel.json`; no build step or third-party packages are required. Test `GET /api/health`, a created response, private resume/revision, and `GET /api/community` after applying the SAC schema. Confirm that unauthenticated raw requests to the database tables are denied.

### Proposed `communityinpublic.ca/ljovsac` path

This app recognizes both a standalone Vercel domain root (`/`) and a reverse-proxied `/ljovsac/` prefix. To serve it under the established Community in Public domain, integrate **these rewrites into the EXISTING main-site configuration only after its current routing has been reviewed**:

```json
{"rewrites": [
  {"source": "/ljovsac", "destination": "https://NEW-SAC-PROJECT.vercel.app/"},
  {"source": "/ljovsac/:path*", "destination": "https://NEW-SAC-PROJECT.vercel.app/:path*"}
]}
```

Do not overwrite the main site's existing rewrites. The `public/index.html` and frontend API requests are prefix-aware. Validate CSS, JS, data and API paths at the final domain before publishing. The Vercel domain and project connection have not been created in this package.

## Administrator response export

An administrator with the `ADMIN_EXPORT_KEY` may request a CSV from `GET /api/admin/export` with an `Authorization: Bearer` header. The CSV includes optional email/opt-ins and comments. The endpoint is not exposed by the public UI, uses constant-time admin key comparison, avoids public caching and prefixes potentially executable CSV formulas. Restrict use to authorized staff and store exports securely.

## Security, privacy and release checklist

- Confirm the Community in Public privacy notice, lawful basis/consent copy, retention period, access controls and withdrawal process before accepting public information.
- Put appropriate anti-abuse protections and edge rate limiting around the anonymous response creation endpoint before a public outreach campaign. No CAPTCHA or edge limiter has been activated by this source package.
- Test the actual isolated Supabase database with server-side keys, not only the local memory adapter.
- Confirm every published TOR source URL is publicly accessible and citations support the exact judgment. Weston remains unranked until verified.
- Check that scores only reflect documented TOR commitments; keep the approval gate in place.
- Configure deployment protection and release management before attaching the public path.
- Confirm optional emails and the two subscriptions are never displayed or exposed by public results.
- The community mean is across completed *saved responses*, **not proven unique persons**. Return-link revisions count only once per saved response; one person can create multiple links. The interface does not claim statistical representativeness.
- Under the accepted first-response rule, the first published average may equal one person's choice. This is disclosed prominently in Step 4.
- The existing Planning Framework application and its data stay untouched.
