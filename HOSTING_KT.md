# LLW Webinar App Hosting KT

Last updated: 2026-04-22

## 1. What This Application Is

This project is a single-origin web application for Livelong Wealth that combines:

- An internal admin dashboard for webinars, payments, onboarding, links, refunds, settings, marketing, and operations.
- Public webinar host and attendee rooms.
- Public payment checkout pages.
- Public landing pages for masterclasses and bootcamps.

The app is built as:

- Frontend: React 19 + Vite + TypeScript.
- Backend: Node.js + Express + Socket.IO.
- Persistence: local JSON file at `DATA_FILE` with default path `data/app-data.json`.
- Integrations: Google Sign-In, Razorpay, PyMD, and AiSensy.

Important: this is not a static website deployment. The Node server is mandatory.

## 2. Critical Hosting Truths

Please read these first before deploying:

- Run this app as one Node service that serves both the SPA and the API.
- Use one public HTTPS domain for everything if possible.
- Do not deploy frontend and backend separately unless you also change the code.
- The live room currently uses Socket.IO plus browser WebRTC, not a managed LiveKit media pipeline.
- The active persistence layer is the JSON file at `DATA_FILE`, not PostgreSQL.
- Run only one app instance. Do not horizontally scale this app in its current form.
- The Node process must have read and write access to `DATA_FILE`.
- Reverse proxy must support WebSocket upgrades on `/socket.io/`.
- HTTPS is mandatory in production because Google Sign-In and Razorpay checkout are involved.

## 3. Current Runtime Architecture

### Backend entrypoint

- `server/webinar-server.mjs`

This file:

- loads environment variables
- starts the Express server
- starts Socket.IO on the same HTTP server
- exposes `/api/*` endpoints
- serves the built frontend from `dist/`
- persists changes back into `DATA_FILE`

### Frontend entrypoint

- `src/main.tsx`
- `src/App.tsx`

The frontend is a SPA. The backend serves `dist/index.html` for non-API routes.

### Data store

- `server/data-store.mjs`
- `server/data-store.mjs`
- `db/app-data.seed.json`

This app reads the JSON file at startup, keeps it in memory, and writes it back on changes. By default it uses `data/app-data.json`, but production should override that with `DATA_FILE`.

### Public routes

These routes must work on the final production domain:

- `/webinar/attend/:roomName`
- `/webinar/host/:roomName`
- `/payment/:id`
- `/masterclass/:slug`
- `/bootcamp/:slug`
- `/privacy-policy`
- `/:slug` for internal short links that begin with `livelong.wealth-...`

### Private routes

The admin SPA handles routes like:

- `/`
- `/sales`
- `/tracker`
- `/live`
- `/webinars`
- `/payments`
- `/operations`
- `/refunds`
- `/links`
- `/settings`

### Live room transport

The live classroom stack is:

- signaling and room state over Socket.IO
- browser-to-browser media over WebRTC
- STUN server: `stun:stun.l.google.com:19302`

There is no TURN server configured right now.

Important note: the codebase still uses names like `livekit_room_name`, and the settings page shows demo LiveKit values, but the actual running room experience is currently custom WebRTC + Socket.IO.

## 4. Data Persistence and Storage

### What is actually persisted

The app writes runtime data into:

- `DATA_FILE`

This includes items such as:

- team members
- webinars and sessions
- students
- orders
- payment records
- refunds
- short links
- settings
- attendance data

### Operational implications

- The disk holding `DATA_FILE` must be persistent.
- The file must survive redeploys and restarts.
- If using Docker, mount a persistent volume for the directory that contains `DATA_FILE`.
- Set `DATA_BACKUP_DIR` to persistent storage and back it up regularly.

### Very important clarification

The repository contains:

- `docker-compose.yml`
- `db/schema.sql`
- `db/seed.sql`
- a `pg` dependency

But the current Node server does not connect to PostgreSQL. Those files are not the active production storage path right now.

If you provision Postgres only and ignore `DATA_FILE`, the running app will still use the JSON file.

## 5. Access Model and Roles

### Supported roles

The code recognizes these roles:

- `SUPER_ADMIN`
- `ADMIN`
- `BDM`
- `OPERATIONS`
- `MARKETING`
- `BDA`

Role restrictions are enforced in the frontend and API for certain areas like:

- exports
- refunds
- team dashboard
- links desk
- settings
- operations
- marketing

### Where approved users come from

Google login is not open to every Google account. The user must already exist in the team dataset.

Approved users are resolved from:

- `store.data.team` inside the JSON store pointed to by `DATA_FILE`

Also note:

- `server/data-store.mjs` contains a `requiredTeamMembers` array.
- Those users are automatically re-inserted into the in-memory store if missing.

This means:

- adding a user can be done by updating the JSON file pointed to by `DATA_FILE` and restarting
- removing a user who exists in `requiredTeamMembers` requires a code change and redeploy, not just a JSON edit

### Write behavior on login

When a user logs in with Google, the app updates:

- name
- avatar
- auth provider
- updated timestamp

That login event writes back into `DATA_FILE`, so write access is required even for authentication.

## 6. Domain, DNS, and TLS

### Recommended production setup

Use one canonical HTTPS domain, for example:

- `https://app.your-domain.com`

Recommended DNS setup:

- create an `A` record to the server IP
- if using IPv6, add `AAAA`
- optionally create `www` and redirect it to the canonical host

### Public URL environment variable

Set:

- `PUBLIC_APP_URL=https://app.your-domain.com`

Rules:

- no trailing slash
- must match the public HTTPS origin users actually open
- must be correct if PyMD short links should resolve to the public domain

### TLS requirements

Use TLS from day one.

Reasons:

- Google Sign-In requires HTTPS in production
- Razorpay checkout should run on HTTPS
- users will open public payment links and webinar links
- WebRTC and browser permissions behave better on secure origins

## 7. External Network and Browser Allowlist

If the server, reverse proxy, WAF, CSP, or browser policy is locked down, allow these destinations:

- `https://accounts.google.com` for Google Sign-In script and identity flow
- `https://checkout.razorpay.com` for Razorpay checkout script
- `https://api.razorpay.com` for server-side Razorpay order APIs
- `https://py.md` for short-link generation
- `https://backend.aisensy.com` for outbound AiSensy messaging
- `stun:stun.l.google.com:19302` for WebRTC STUN

Optional external assets currently referenced in the frontend and seed data include:

- Google Fonts
- Unsplash-hosted images
- `https://livelongwealth-assets.s3.amazonaws.com`

If a strict Content Security Policy is added later, make sure Google Sign-In and Razorpay script sources are explicitly permitted.

## 8. Environment Variables

Use `.env.example` as the starting template.

### Required for production

- `PORT`
  - internal Node port
  - common choices: `4000` behind Nginx, or `8080` in Docker

- `PUBLIC_APP_URL`
  - public base URL of the deployed app
  - required if public short links should be generated correctly

- `SESSION_SECRET`
  - custom HMAC secret used for dashboard bearer tokens
  - set a long random production value

- `GOOGLE_CLIENT_ID`
  - Google Identity Services client id used by the login page

- `GOOGLE_CLIENT_SECRET`
  - read by the server
  - current flow is mainly GIS credential verification, but keep this set because the backend expects it as part of the auth client configuration

- `RAZORPAY_KEY_ID`
  - Razorpay public key identifier returned to the frontend during checkout initialization

- `RAZORPAY_KEY_SECRET`
  - server-side secret used to create orders and verify signatures

### Needed when using external short links

- `PYMD_API_KEY`
  - needed to create PyMD short links

- `PYMD_DOMAIN`
  - optional custom PyMD domain
  - only set if the PyMD account is configured for a custom domain

### Needed when using AiSensy

- `AISSENSY_API_KEY`
  - preferred env var name

- `AISENSY_API_KEY`
  - legacy alias also supported by the code

- `AISSENSY_PAYMENT_LINK_CAMPAIGN`
  - outgoing payment-link campaign name
  - defaults to `payment_link_onboarding_2` if omitted

- `AISSENSY_WEBHOOK_URL`
  - administrative reference value shown in settings and response payloads
  - note: there is no inbound AiSensy webhook handler implemented in this backend right now

### Variables that are declared but not used by current frontend code

- `VITE_SIGNALING_WS_URL`
- `VITE_SIGNALING_HTTP_URL`
- `VITE_SIGNALING_IO_URL`

These exist in type declarations and older docs, but the current frontend does not read them. The live room currently connects using `window.location.origin`, which is why same-origin hosting is strongly recommended.

## 9. Google Auth KT

### How Google auth works in this app

The login page:

- loads `https://accounts.google.com/gsi/client`
- fetches `/api/auth/config`
- reads `GOOGLE_CLIENT_ID`
- uses Google Identity Services callback credential flow

The backend:

- receives the credential at `POST /api/auth/google`
- verifies the ID token with `google-auth-library`
- checks that the Google email is verified
- checks that the email exists in the team allowlist
- creates a signed bearer token using `SESSION_SECRET`

### What to configure in Google Cloud

For the OAuth client used by this app:

- add the production JavaScript origin, for example `https://app.your-domain.com`
- add local origins if needed for development, for example `http://localhost:5173` and `http://localhost:4000`

Important:

- the current implementation does not use a redirect-based OAuth code flow
- it uses GIS callback credential flow
- so the main Google console item to get right is the authorized JavaScript origin

### Who can log in

A Google account is allowed only if its email already exists in the app team dataset.

This is not domain-only access. It is explicit-email access.

### Provisioning and deprovisioning users

To add a user:

1. add the user into the JSON store pointed to by `DATA_FILE` under the team collection with the correct role
2. restart the Node service
3. ask the user to sign in with that exact Google email

To remove a normal JSON-only user:

1. mark the user inactive or remove them from the JSON store pointed to by `DATA_FILE`
2. restart the service

To remove a user that is auto-added by `requiredTeamMembers` in `server/data-store.mjs`:

1. edit that code list
2. redeploy

## 10. Razorpay KT

### How payments work

The application creates Razorpay orders server-side and opens Razorpay Checkout in the browser.

Main flow:

- payment or enrollment is created in the app
- backend creates a Razorpay order
- frontend loads `https://checkout.razorpay.com/v1/checkout.js`
- frontend opens checkout
- backend verifies the returned Razorpay signature
- reconciliation endpoint can poll Razorpay order payments if checkout closes mid-flow

### Relevant endpoints

- `POST /api/payment-links`
- `POST /api/enrollments`
- `POST /api/orders/checkout-session`
- `POST /api/orders/verify-payment`
- `POST /api/orders/mark-payment-failed`
- `POST /api/orders/reconcile-payment`
- `GET /api/orders/:id`
- public checkout page: `/payment/:id`

### Important operational notes

- Use live keys in production only.
- Confirm the production domain is correctly registered inside the Razorpay business website settings if Razorpay asks for it.
- This backend does not currently implement a Razorpay webhook endpoint.
- Payment confirmation is handled through checkout callback plus reconciliation polling.

If Razorpay keys are missing or wrong:

- payment links may still be created in the app data
- checkout session initialization will fail
- public payment pages will not complete payment successfully

## 11. PyMD Short Links KT

### What PyMD is used for

PyMD is used for:

- webinar host short links
- webinar attendee short links
- payment links
- manually created short links

### Behavior if PyMD is available

If `PYMD_API_KEY` is configured and `PUBLIC_APP_URL` is correct:

- the app creates external short links through `https://py.md/api`

### Behavior if PyMD is unavailable

The app falls back to local URLs and local short paths where possible.

This means the app can still function without PyMD, but the short-link experience will be less polished.

### Important dependency on PUBLIC_APP_URL

Relative paths cannot be shortened correctly unless `PUBLIC_APP_URL` points at the real public domain.

If `PUBLIC_APP_URL` is missing or wrong:

- payment short-link generation can fail
- webinar short-link generation can fall back to local paths

## 12. AiSensy KT

### What the app does with AiSensy

The app can send outbound payment-link campaign messages through AiSensy.

Relevant endpoint:

- `POST /api/notifications/aisensy/payment-link`

### What is required

- `AISSENSY_API_KEY`
- a valid campaign name

### What the app does not do right now

The app does not currently expose an inbound webhook receiver for AiSensy.

`AISSENSY_WEBHOOK_URL` is stored and shown in settings, but the backend does not consume incoming webhook calls on that URL.

## 13. Live Webinar and Classroom KT

### Current live stack

The live room is not static content. It depends on:

- API routes for room join and room state
- Socket.IO for signaling and participant state
- WebRTC peer connections between browsers

### Required network behavior

- reverse proxy must allow WebSocket upgrades on `/socket.io/`
- long-lived connections must not be cut too aggressively
- browsers must be able to reach `stun.l.google.com:19302`

### Important limitation

There is no TURN server configured.

Implication:

- some users behind strict NAT, enterprise firewall, or restrictive mobile networks may connect to signaling but still have media quality or connectivity issues

If broad network reliability becomes important, adding TURN is the next thing to plan.

## 14. Recommended Production Topology

Recommended production layout:

- `Nginx` on ports `80/443`
- reverse proxy to Node on `127.0.0.1:4000`
- one Node app process
- persistent app directory or mounted volume for `DATA_FILE`

Do not:

- deploy the frontend alone to Netlify/Vercel as a static-only app
- run multiple replicas of the Node service
- put the JSON store on ephemeral disk

## 15. VPS Deployment Steps

### Recommended runtime

- Node.js 22.x
- npm matching the installed Node version

The repo Dockerfile also uses Node 22.

### App deploy steps

1. Clone the repository onto the server.
2. Create the production `.env` from `.env.example`.
3. Fill secrets securely.
4. Run `npm ci`.
5. Run `npm run build`.
6. Create a persistent data home such as `/var/lib/llw`, then make sure `DATA_FILE` and `DATA_BACKUP_DIR` there are writable by the app user.
7. Start the app with `node server/webinar-server.mjs`.
8. Put Nginx in front of it.
9. Install TLS.
10. Validate login, live room, payment flow, and persistence.

### Suggested systemd service

```ini
[Unit]
Description=LLW Webinar App
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/llw_webinare
EnvironmentFile=/var/www/llw_webinare/.env
Environment=DATA_FILE=/var/lib/llw/app-data.json
Environment=DATA_BACKUP_DIR=/var/lib/llw/backups
ExecStart=/usr/bin/node /var/www/llw_webinare/server/webinar-server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

After creating the service:

- `sudo mkdir -p /var/lib/llw/backups`
- `sudo chown -R www-data:www-data /var/lib/llw`
- `sudo systemctl daemon-reload`
- `sudo systemctl enable llw-webinar`
- `sudo systemctl start llw-webinar`
- `sudo systemctl status llw-webinar`

## 16. Recommended Nginx Config

Example config for same-origin hosting:

```nginx
server {
    listen 80;
    server_name app.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/app.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.your-domain.com/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
    }
}
```

Notes:

- keep the `Host` header intact
- keep long timeouts for live rooms
- WebSocket upgrade support is required for `/socket.io/`

## 17. Docker Notes

The repository Dockerfile builds and runs the app, but you still need persistent storage for `DATA_FILE` and `DATA_BACKUP_DIR`.

Example approach:

- mount a dedicated persistent volume for the directory that contains `DATA_FILE`
- mount or reuse persistent storage for `DATA_BACKUP_DIR`
- provide `.env` or environment variables securely
- publish the chosen internal port

Important:

- the existing `docker-compose.yml` in the repo only provisions PostgreSQL
- it is not a full app deployment definition for the current runtime architecture

## 18. Backup and Restore Strategy

At minimum back up:

- `.env`
- the live JSON file at `DATA_FILE`
- the rolling backup at `DATA_BACKUP_DIR/app-data.last.json`

Recommended:

- snapshot `DATA_FILE` before each deploy
- keep daily rolling backups
- sync nightly copies from `DATA_BACKUP_DIR` to external storage such as S3, Backblaze, or Drive
- verify restore by starting a staging copy with a restored JSON file

Because the app writes constantly to the JSON store, this file is the main business continuity artifact.

## 19. Post-Deploy Validation Checklist

After deployment, verify all of the following:

- `GET /health` returns `{"ok":true,...}`
- homepage loads over HTTPS
- Google Sign-In button renders
- an allowed Google user can log in
- a non-allowed Google user is denied
- admin pages load after login
- create a webinar from the admin panel
- open both host and attendee links
- confirm `/socket.io/` connections stay alive
- test microphone and camera join in the webinar room
- create a Razorpay checkout session and complete a real or test payment
- verify payment status updates in the dashboard
- create a PyMD short link if that integration is enabled
- send an AiSensy message if that integration is enabled
- restart the service and confirm previous data is still present
- confirm `DATA_FILE` keeps updating after writes
- confirm `DATA_BACKUP_DIR/app-data.last.json` is refreshed after writes

## 20. Known Risks and Hardening Notes

These are important for whoever is hosting this:

- `POST /api/auth/login` currently issues a session token using only an approved email address and is not used by the current frontend UI.
- If this app is internet-exposed, that endpoint should be disabled or protected before calling the system fully hardened.
- Session tokens are custom HMAC bearer tokens stored in localStorage and do not currently carry a normal expiry window.
- `cors()` is currently open on the backend. Same-origin hosting is strongly recommended, and tighter CORS would be safer.
- The JSON store means no horizontal scaling and no active-active multi-instance deployment.
- No TURN server is configured for WebRTC.
- Secrets must never be committed or emailed in plain text. Transfer them securely.

## 21. Most Important Files for Future Troubleshooting

- `server/webinar-server.mjs`
- `server/data-store.mjs`
- the live JSON file pointed to by `DATA_FILE`
- `src/lib/auth.tsx`
- `src/components/LoginGate.tsx`
- `src/pages/Live.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Settings.tsx`
- `vite.config.ts`

## 22. Short Summary for the Hosting Engineer

If you only remember ten things, remember these:

1. Host this as one Node app behind Nginx.
2. Use one HTTPS domain for everything.
3. Proxy `/socket.io/` with WebSocket upgrade support.
4. Keep `PUBLIC_APP_URL` correct.
5. Keep `DATA_FILE` and `DATA_BACKUP_DIR` writable and persistent.
6. Run only one instance of the app.
7. Google login is email-allowlist based, not open OAuth.
8. Razorpay is required for real payment flows.
9. PyMD and AiSensy are optional but feature-linked integrations.
10. The repo contains Postgres artifacts, but the active runtime is still JSON-file based.
