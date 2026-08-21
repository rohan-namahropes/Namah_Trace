# Namah Trace Developer Guide

This guide explains how to run Namah Trace locally, connect it to Supabase, publish the code to GitHub, deploy it to Vercel, and verify the deployment.

Namah Trace is a React/Vite internal application for recording a batch's journey through a flexible manufacturing workflow.

## 1. What you need

Install or create these accounts before starting:

- Node.js 20 or newer: https://nodejs.org/
- Git: https://git-scm.com/downloads
- A GitHub account and repository
- A Supabase account and project: https://supabase.com/
- A Vercel account connected to GitHub: https://vercel.com/

An administrator can create or invite users in Supabase Authentication. Users sign in with their own Supabase Auth credentials.

## 2. Configure Supabase Authentication

Namah Trace requires both environment variables and uses Supabase Authentication as the only identity provider. The login screen also supports account creation with a name, email, and password. The name is stored as `user.user_metadata.full_name`.

Environment variables beginning with `VITE_` are exposed to the browser. The anon key is designed for browser use when Row Level Security is enabled. Never put a Supabase service-role key in `.env.local`, GitHub, or Vercel browser environment variables.

## 3. Download and install the project

Open PowerShell and run:

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/namah-trace.git
cd namah-trace
npm install
```

If the project is already open in VS Code, open its folder in the integrated terminal and run only:

```powershell
npm install
```

## 4. Create the Supabase project

1. Sign in to Supabase.
2. Select **New project**.
3. Choose the organization for Namah Ropes.
4. Name the project, for example `namah-trace-production`.
5. Choose a secure database password and store it in a password manager.
6. Select a region close to the factory or main users.
7. Wait for the project to finish provisioning.

Keep the Supabase project password private. The frontend does not need it.

## 5. Create the database and Storage bucket

The project contains the complete first migration at [supabase/schema.sql](supabase/schema.sql).

1. In Supabase, open **SQL Editor**.
2. Select **New query**.
3. Open `supabase/schema.sql` in VS Code and copy the complete file.
4. Paste it into the Supabase SQL Editor.
5. Select **Run**.
6. Confirm that the query finishes without an error.
7. Open **Table Editor** and confirm that these tables exist:
   - `profiles`
   - `workflow_stages`
   - `batches`
   - `batch_stages`
   - `stage_measurements`
   - `evidence`
   - `batch_history`
8. Open **Storage** and confirm that the private `evidence` bucket exists.

The SQL file also enables Row Level Security and creates authenticated-user policies. Do not disable RLS to make a query work. Fix the policy or query instead.

## 6. Create an administrator account

1. In Supabase, open **Authentication** → **Users**.
2. Select **Add user** or **Create user**.
3. Enter the administrator's email address.
4. Set a temporary strong password.
5. Choose whether to require email confirmation according to the Namah Ropes access policy.
6. Create the user.
7. Share the temporary password through a private channel.
8. Change or rotate the password after the first sign-in if required by your internal policy.

Users may also register from the login screen when email confirmation settings allow it.

## 7. Configure local environment variables

From the project root, copy the example file:

```powershell
Copy-Item .env.example .env.local
```

In `.env.local`, replace the placeholder values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Find these values in Supabase under **Project Settings** → **API**:

- **Project URL** becomes `VITE_SUPABASE_URL`.
- **Publishable/anon key** becomes `VITE_SUPABASE_ANON_KEY`.

Do not add quotes unless the value itself contains quotes. Do not commit `.env.local`; it is ignored by Git.

## 8. Run and test locally

Start the development server:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`.

Sign in with the Supabase administrator credentials. Check these workflows:

1. The login screen accepts the administrator account.
2. The dashboard loads batches from Supabase.
3. Search filters the visible batch list.
4. **Create new batch** opens the form.
5. A batch opens its pipeline page.
6. Clicking a stage opens the stage record panel.
7. Measurements can be added as arbitrary key/value pairs.
8. Stage status, person, notes, and evidence can be recorded.
9. The history section displays recorded actions.
10. **Download report** opens a printable report.

Stop Vite with `Ctrl+C` in the terminal.

For a production-like local check, run:

```powershell
npm run build
npm run preview
```

The build must finish without errors before deployment. The preview command serves the generated `dist` folder.

If `npm run dev` reports that the port is already in use, close the existing Vite terminal with `Ctrl+C` or start another port:

```powershell
npm run dev -- --port 5174
```

## 9. Project structure

- [src/main.jsx](src/main.jsx): Supabase login/signup/session handling, dashboard, batch page, pipeline, stage record UI, seeded development data, and report generation.
- [src/style.css](src/style.css): typography, colors, layout, responsive behavior, tables, pipeline, modals, and login screen.
- [src/lib/supabase.js](src/lib/supabase.js): Supabase client creation and environment-variable detection.
- [src/lib/api.js](src/lib/api.js): Supabase queries and Storage upload helper functions.
- [supabase/schema.sql](supabase/schema.sql): tables, starter workflow stages, RLS policies, and the evidence bucket.
- [.env.example](.env.example): names of the required environment variables.
- [index.html](index.html): browser title and Vite entrypoint.

## 10. Change or extend the workflow

The workflow is stored as data in `workflow_stages`. Each stage has a name, position, active flag, and JSON field configuration.

To change the initial stages before creating a Supabase project, edit the starter `insert` rows in [supabase/schema.sql](supabase/schema.sql), then run the migration in a fresh project.

For an existing project, edit the rows in Supabase Table Editor or run SQL such as:

```sql
update public.workflow_stages
set name = 'Final Rope Inspection'
where name = 'Rope Testing';

update public.workflow_stages
set position = 3
where name = 'Braiding';
```

To hide a stage without deleting its history:

```sql
update public.workflow_stages
set is_active = false
where name = 'Packaging';
```

The local `defaultStages` and `seedBatches` values provide initial UI data until the authenticated batch query returns. They are not an authentication fallback.

## 11. Change stage fields

The `field_config` column accepts JSON. A stage can define fields without a React code change:

```json
[
  { "key": "BS", "label": "Breaking strength" },
  { "key": "Elongation", "label": "Elongation" },
  { "key": "TPM", "label": "Twists per metre" }
]
```

Use the `stage_measurements` table for saved values. The stage record UI also supports adding a new key/value pair while recording a stage, which keeps the process flexible while manufacturing requirements are still being finalized.

## 12. How evidence uploads work

Evidence files belong in the private Supabase Storage bucket named `evidence`.

The helper in [src/lib/api.js](src/lib/api.js) creates a path like:

```text
batch-id/stage-id/random-id-file-name
```

It uploads the file to Storage and then writes the file name, path, MIME type, user, and related batch/stage IDs to the `evidence` table.

When displaying a private file later, generate a temporary signed URL with Supabase `createSignedUrl`. Do not make the bucket public just to display files. Keep file-size and file-type validation close to the upload control when those production rules are agreed.

## 13. Push the project to GitHub

Create an empty GitHub repository named `namah-trace`, then run from the project root:

```powershell
git init
git add .
git commit -m "Build Namah Trace MVP"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/namah-trace.git
git push -u origin main
```

Before pushing, check that secrets are not staged:

```powershell
git status
git check-ignore .env.local
```

The second command should print `.env.local`. If it does not, stop and add it to `.gitignore` before pushing any environment values.

For future changes:

```powershell
git add .
git commit -m "Describe the change"
git push
```

## 14. Deploy to Vercel

1. Sign in to Vercel with GitHub.
2. Select **Add New** → **Project**.
3. Import the `namah-trace` GitHub repository.
4. Confirm the framework is **Vite**.
5. Leave the build command as `npm run build`.
6. Leave the output directory as `dist`.
7. Open **Environment Variables**.
8. Add `VITE_SUPABASE_URL` with the Supabase Project URL.
9. Add `VITE_SUPABASE_ANON_KEY` with the Supabase anon/publishable key.
10. Add the variables to **Production**, **Preview**, and **Development** where appropriate.
11. Select **Deploy**.

Vercel builds the repository and publishes the `dist` output. Every push to the connected production branch can trigger a new deployment.

## 15. Configure Supabase for the Vercel URL

After Vercel gives you a deployment URL:

1. In Supabase, open **Authentication** → **URL Configuration**.
2. Set **Site URL** to the production Vercel URL, for example `https://namah-trace.vercel.app`.
3. Add the Vercel URL to the allowed redirect URLs if Supabase requests it.
4. Save the settings.
5. Redeploy in Vercel after changing environment variables or authentication URLs.

For a custom domain, use the custom domain in Supabase instead of the temporary Vercel URL.

## 16. Production verification checklist

After deployment, open the Vercel URL in a private browser window and verify:

- The page loads over HTTPS.
- The administrator can sign in.
- No Supabase URL or key is hardcoded in source files.
- The dashboard loads without a browser console error.
- A batch can be opened and its pipeline is visible.
- Supabase-backed batch reads work after a page refresh.
- Evidence files are private and accessible only to authenticated users.
- The report opens in a new printable window.
- The layout works on desktop and mobile widths.
- A second browser session cannot access the app without authentication.

Check **Vercel → Deployments → Build Logs** for build errors and **Supabase → Logs** for authentication, database, or Storage errors.

## 17. Current MVP data-wiring note

The current client has Supabase authentication, batch loading, Storage upload helpers, schema, and RLS prepared. The demo create/edit controls update the in-memory client state so the workflow can be reviewed immediately. Before production operations begin, wire the create and stage-save handlers in `src/main.jsx` to `createBatch`, `updateStageRecord`, `addMeasurement`, and `batch_history` inserts in `src/lib/api.js`, then verify that changes survive a refresh. This keeps the UI prototype useful while the final manufacturing workflow is being agreed.

## 18. Common problems

### The app always shows sample batches

The Vite environment variables are missing or misspelled. Confirm `.env.local` contains both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart Vite. Vite only reads environment changes after a restart.

### Login fails

Confirm that the user exists in Supabase Authentication and that the email/password are correct. Also check that the browser is using the same Supabase project whose URL is in the environment file.

### A table query returns a permission error

Confirm that the SQL migration ran completely and that the user is authenticated. Review the relevant RLS policy rather than disabling Row Level Security.

### Evidence upload fails

Confirm that the `evidence` Storage bucket exists, is private, and has the authenticated-user policy from [supabase/schema.sql](supabase/schema.sql). Check the browser console and Supabase Storage logs for the exact response.

### Vercel still uses old environment values

Environment variables are applied during a build. Update the variable in Vercel, then trigger a new deployment or redeploy the latest deployment.

## 19. Deployment architecture in one view

```text
User browser
    |
    | HTTPS / React Vite app
    v
Vercel (builds and serves dist)
    |
    | Supabase URL + anon key
    v
Supabase Auth ---- Postgres tables ---- Private evidence Storage
```

The browser talks to Supabase using the authenticated user's session. Row Level Security is the boundary that protects database records, and Storage policies protect uploaded files.
