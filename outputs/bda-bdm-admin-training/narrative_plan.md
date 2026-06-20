## Audience

- BDA team members who create enrollments, share payment links, and track dues
- BDMs who monitor team performance, collections, recoveries, and exports
- Admin and operations users who manage payments, refunds, fulfilment, settings, and system governance

## Objective

Create a clear training deck that explains:
- what the LLW application is used for,
- how each role uses it today,
- the end-to-end customer journey from lead to fulfilment,
- and the current vs future payment-message behavior.

## Narrative Arc

1. Introduce the application as one shared workspace for revenue, webinars, payments, and fulfilment.
2. Explain access by role so trainees know where they are expected to work.
3. Walk through the customer journey in plain language.
4. Break down the day-to-day workflow for BDA, BDM, and Admin.
5. Clarify current payment-link and messaging usability.
6. Close with the planned future improvement around post-payment confirmation and welcome messaging.

## Slide List

1. Cover: LLW application training for BDA, BDM, and Admin
2. Platform overview: what the application manages today
3. Role access map: BDA vs BDM vs Admin
4. Customer journey: lead to payment to fulfilment
5. BDA workflow: onboarding, payment link, tracker, follow-up
6. BDM workflow: dashboards, leaderboard, team visibility, exports
7. Admin workflow: payment desk, refunds, operations queue, settings
8. Current usability: payment flow and AiSensy usage today
9. Future update note: post-payment AI Sensy confirmation and welcome message

## Source Plan

- App routes and module list from `src/App.tsx` and `src/components/Sidebar.tsx`
- Role restrictions from `src/lib/permissions.ts`
- Workflow copy from:
  - `src/pages/Onboarding.tsx`
  - `src/pages/Payments.tsx`
  - `src/pages/Tracker.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Team.tsx`
  - `src/pages/Operations.tsx`
  - `src/pages/Refunds.tsx`
  - `src/pages/Exports.tsx`
  - `src/pages/Webinars.tsx`
- Customer and order lifecycle clues from `db/schema.sql` and `server/data-store.mjs`
- AiSensy and payment verification behavior from `server/webinar-server.mjs`
- Product-specific support visuals from `admin.html`, `webinar.html`, and `database.html`

## Visual System

- 16:9 business-training deck
- Brand-led palette inspired by the product UI: deep navy, indigo, slate, soft gold, and white panels
- Strong sectional cards, process arrows, role badges, and clean status chips
- Use the LLW logo plus rendered static product overview pages as supporting visuals

## Asset Needs

- LLW logo from `src/assets/logo.png`
- Rendered previews of:
  - `admin.html`
  - `webinar.html`
  - `database.html`

## Editability Plan

- All titles, subtitles, role descriptions, steps, callouts, and future-state notes remain editable text
- Use PowerPoint shapes for process flow, role matrix, and training callouts
- Any embedded visual previews are supporting images only
- Speaker notes include source references for each slide
