# Deployment Notes

This application must run as a single Node service that serves:

- the React SPA from `dist/`
- the backend API under `/api/*`
- Socket.IO on `/socket.io/`
- public webinar and payment routes

## Recommended production flow

1. Create `.env` from `.env.example`.
2. Fill production secrets securely.
3. Run `npm ci`.
4. Run `npm run build`.
5. Run `node server/webinar-server.mjs`.
6. Put Nginx in front of the Node process.
7. Enable HTTPS.

## Git Push -> Deploy automation

This repo includes [`.github/workflows/render-deploy.yml`](./.github/workflows/render-deploy.yml).

To make every GitHub push trigger a site deploy:

1. In Render, open the `webinar-classroom` service.
2. Go to `Settings -> Deploy Hook`.
3. Copy the service deploy hook URL.
4. In GitHub, open `Settings -> Secrets and variables -> Actions`.
5. Add a repository secret named `RENDER_DEPLOY_HOOK_URL`.
6. Paste the Render deploy hook URL as the secret value.

The workflow sends Render the exact pushed commit SHA with `?ref=<sha>`, so branch names like `codex/post-deploy-webinar-admin-updates` work too.

Important:

- This workflow deploys every pushed branch to the same Render site.
- The most recently pushed branch wins and becomes the live site.
- If you want safer production behavior later, restrict the workflow trigger to `main` only.

## Important

- Do not deploy this as static-only hosting.
- Same-origin hosting is strongly recommended.
- Reverse proxy must support WebSocket upgrades on `/socket.io/`.
- Keep `PUBLIC_APP_URL` aligned with the real public domain.
- Keep `db/app-data.json` writable and persistent across restarts.
- Do not run multiple app replicas with the current JSON-file store.

## Docker

The Dockerfile can run the app, but remember:

- persist the `db/` directory
- provide production environment variables
- the repo's `docker-compose.yml` is only for PostgreSQL and is not the active runtime path for this app

## Full handoff

See [HOSTING_KT.md](./HOSTING_KT.md) for the detailed server handoff covering:

- domain and DNS
- Google auth
- Razorpay
- PyMD
- AiSensy
- Nginx
- systemd
- storage
- backups
- validation checklist
- hardening notes
