# Webinar Deployment (Frontend + Signaling Together)

This app must run as one Node service so the browser can access:

- `GET /health`
- `WS /ws` (primary)
- `WS /api/ws` (fallback)
- `socket.io /socket.io` (automatic fallback if WS upgrades are blocked)
- static frontend from `dist/`

## Local production-style run

1. `npm install`
2. `npm run build`
3. `node server/webinar-server.mjs`
4. Open `http://localhost:8080`

## Render

Use `render.yaml` in this repo.

- Build command: `npm install && npm run build`
- Start command: `node server/webinar-server.mjs`

## Generic VPS / Docker

1. Build image: `docker build -t webinar-classroom .`
2. Run: `docker run -p 8080:8080 webinar-classroom`

## Important

- Do not deploy this as static-only hosting.
- Netlify/Vercel static output alone will fail because WebSocket signaling is required.
- Confirm your host supports WebSocket upgrades on `/ws`.
- If a host/proxy blocks raw websocket upgrades, the app will fallback to socket.io long-polling on `/socket.io`.
- If you split domains, set:
  - `VITE_SIGNALING_WS_URL`
  - `VITE_SIGNALING_HTTP_URL`
  - `VITE_SIGNALING_IO_URL`
- If deploying on one domain, do not set `VITE_SIGNALING_*` to localhost.
- On deployed environments, stale `VITE_SIGNALING_*` values pointing to localhost are a common cause of `Failed to reach webinar server`.