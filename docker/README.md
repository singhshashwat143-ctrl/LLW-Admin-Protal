# Docker Hosting Setup

This folder is a separate Docker hosting setup for the app. It does not replace or modify the existing root-level `Dockerfile` or `docker-compose.yml`.

## What it runs

- one Node 22 container for the React + Express + Socket.IO app
- a named Docker volume for `/app/db` so `db/app-data.json` stays persistent

## Files

- `Dockerfile` builds the frontend and runs `server/webinar-server.mjs`
- `docker-compose.yml` starts the production container
- `app.env.example` is the runtime env template

## First-time setup

1. Copy `docker/app.env.example` to `docker/app.env`.
2. Fill in the real production values, especially `PUBLIC_APP_URL` and `SESSION_SECRET`.
3. Start the container:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

4. Check health:

```bash
curl http://localhost:8080/health
```

## Stop the stack

```bash
docker compose -f docker/docker-compose.yml down
```

## Persistence

- The named volume `llw_webinar_db` stores `/app/db`.
- On the first run, Docker copies the current repo `db/` contents into that volume.
- Future restarts and rebuilds keep the saved JSON data in the volume.

If you intentionally want a fresh seeded database again, remove the volume:

```bash
docker compose -f docker/docker-compose.yml down -v
```

## Notes

- This app should stay as one service. Do not split frontend and backend unless the code changes too.
- For production, put HTTPS and a reverse proxy in front of port `8080` if you are hosting on a public domain.
- The current root `docker-compose.yml` remains untouched and still only describes PostgreSQL.
