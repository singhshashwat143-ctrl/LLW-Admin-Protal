# Moving LLW Webinar Runtime Data to Postgres

This repo already uses a Postgres-backed runtime persistence layer in
[`server/runtime-persistence.mjs`](/Users/shashwatsingh/Desktop/llw_webinare/server/runtime-persistence.mjs:1).
The app still keeps a local `db/app-data.json` snapshot for bootstrap and local
development, but when `DATABASE_URL` is present the live runtime state is
persisted in Postgres.

## What Changed

- `server/data-store.mjs` loads the local JSON snapshot, then hydrates and saves
  runtime state through Postgres when `DATABASE_URL` is configured.
- `server/webinar-server.mjs` already awaits `createDashboardStore()`, so server
  startup is compatible with async persistence initialization.
- `render.yaml` now provisions a managed Postgres database and injects
  `DATABASE_URL`.
- `.gitignore` now includes `db/app-data.json` so the file stays out of future
  commits once it is untracked.

## Ship Order

1. Deploy the updated `render.yaml`.
2. Set `PUBLIC_APP_URL` and the rest of the required secrets on Render.
3. Let the app boot once with `DATABASE_URL` present.
4. If you want to seed Postgres from the current JSON snapshot, run:

```bash
npm run db:bootstrap-runtime
```

5. Optional: install the SQL helper views used for inspection/reporting:

```bash
npm run db:install-runtime-views
```

## Verification

After deploy:

1. Create or update an order in the live app.
2. Redeploy the service.
3. Confirm the order is still present after the restart.

## Important Note

`db/app-data.json` contains live customer data. After you have verified the
database-backed flow, the safer follow-up is:

1. `git rm --cached db/app-data.json`
2. Commit the removal
3. Scrub the file from git history if it was pushed publicly
