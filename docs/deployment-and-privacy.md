# Deployment and privacy

Deploy this code as a new GitHub repository and separate Vercel project. The production frontend keeps secrets server-side in Vercel functions. Use an isolated Supabase project in Canada Central and apply the dedicated SAC setup script `supabase/schema.sql` to the new project through its SQL Editor. Do not add access policies for anon/authenticated. Test database RLS before launch. Replace the assessment JSON only with the authorized 12-component review. Enable Resend email only after verifying the sender domain and configuring a dedicated environment variable.

Review privacy notice, deletion, retention and anti-bot protections before accepting submissions from the public. Results link contains a secret bearer token; do not send it to third parties. This repository includes a private administrator CSV export; limit the export secret to authorized team members.
