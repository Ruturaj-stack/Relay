# RELAY

**Handoffs, without the guesswork.**

RELAY is a smart handoff ledger for the things people pass between each other — cameras, laptops, keys, drives, access cards, documents. It replaces “did you get it?” with a code, a condition record, and a trust trail that both people can see.

Built as a production-quality, mobile-first web app with a fully working local demo backend. No account, server, or configuration is required to try it.

![RELAY](public/img/studio.jpg)

---

## Try it

```bash
npm install
npm run dev
```

Open the printed URL. Any of these demo accounts signs in with **any password of 6+ characters** (the form is prefilled with `relay-demo`):

| Account | Person | Role |
| --- | --- | --- |
| `maya@fieldwork.studio` | Maya Chen | Owner · Design Ops |
| `elias@fieldwork.studio` | Elias Ward | Admin · Product Design |
| `priya@fieldwork.studio` | Priya Nair | Admin · Studio Ops |

Or choose **Create account** on the sign-in screen to add a local profile and workspace. Nothing is sent anywhere.

> **Demo mode is labelled everywhere.** Every screen that shows seeded records carries a demo badge or footnote. QR scans validate against real handoff records stored on this device — there is no simulated success path.

---

## What is actually implemented

### Handoff lifecycle

`draft → requested → awaiting_confirmation → in_transit → received → returned` (plus `declined` / `cancelled`)

- Sender creates a handoff with item, receiver, condition out, due date, instructions, and photos.
- Receiver accepts or declines with an optional note.
- Handoff QR encodes a real deep link: `/scan?code=H-XXXX&token=…`.
- Receipt is confirmed by QR scan **or** manual code entry, with condition-in and optional note/photo proof.
- Return is started by the receiver and confirmed by the sender, closing the chain and releasing the item back to its owner.
- Every action writes an immutable event to the handoff timeline and the workspace activity feed.
- Overdue is computed at read time, never stored as a mutable status.

### QR and camera handling

- Camera permission is requested only after an explicit tap.
- Uses the native `BarcodeDetector` when available, with `jsQR` frame decoding as a fallback.
- Handles denied permission, missing camera, insecure context, and unsupported browsers with a clear manual-code fallback.
- A scanned code is looked up in the local database and checked against the handoff token and status. Invalid, cancelled, draft, completed, and mismatched tokens each produce a distinct error.
- The camera stream is stopped when the scanner closes or the route unmounts.

### Offline mode

- New handoffs, item creation, status changes, proof attachments, and issue reports are queued in IndexedDB when `navigator.onLine` is false.
- Each queued operation carries an idempotency key. Sync deduplicates by key, retries with a cap, and reconciles the local record instead of creating a duplicate.
- Pending records are marked in the UI; an offline banner shows queue depth and manual retry.
- The service worker caches the app shell in production, so the installed app opens without a network connection.

### Condition, trust, and return risk

- Before/after condition comparison is shown side by side on every completed handoff.
- Condition changes are recorded as events, not overwritten silently.
- Each person has a trust record derived from their actual handoff history (on-time returns, condition changes, completed chains).
- **Return risk is an estimate, never a measurement.** The score is derived from due date pressure, recorded condition, and workspace history, and is labelled “Estimate only” in the UI and in analytics exports.

### Workspace

- **Overview** — attention queue, active handoffs, recent activity, team pulse.
- **Handoffs** — search, status/person filters, sorting, list/grid views, inline actions.
- **Items** — inventory with categories, condition, holder, location, value estimates, image drop zones, and handoff creation.
- **People & teams** — profiles, workspace roles, team roles, invitations, member management.
- **Activity** — full filterable trust record across handoffs, items, people, and issues.
- **Analytics** — real charts computed from local records, CSV export, and explicit estimate disclaimers.
- **Notifications** — grouped, filterable, mark-read, clear-read.
- **Settings** — profile, notification preferences, appearance, data export/reset, offline queue, install instructions.
- **Quick actions** — scan, new handoff, add item, invite, report issue, open the command palette.
- **Command palette** — `Ctrl/Cmd + K` searches handoffs, items, people, and actions.

### Interface

- Custom dark “ink” theme and warm light theme, both persisted and applied before first paint.
- Geist + Instrument Serif + Geist Mono, custom RELAY mark, hand-built components rather than a generic dashboard kit.
- Desktop collapsible sidebar, mobile bottom navigation, full-screen mobile sheets.
- Framer Motion page/section transitions, reduced-motion support, visible focus states, keyboard-dismissable overlays.
- Responsive at 320, 375, 390, 430, 768, 1024, and 1440+.
- Loading skeletons, empty states, and error states with retry.
- PWA manifest, shortcuts, install prompt, and offline shell.

---

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # TypeScript build + production bundle
npm run typecheck  # tsc -b only
npm run lint       # Oxlint
npm run preview    # serve the production build
```

Node 20.19+ is required by Vite 8.

---

## Architecture

```
src/
  App.tsx                  providers, auth gate, routes
  main.tsx                 theme bootstrap, production service-worker registration
  components/
    layout/                shell, sidebar, header, mobile nav, offline banner, notifications
    ui/                    primitives, forms, overlays, QR, tabs
    handoff/               timeline, condition comparison, risk, people panels
    items/ people/         focused dialogs
  hooks/                   React Query hooks, debounce, viewport
  lib/
    api.ts                 the single mutation/query boundary (demo adapter)
    demoDb.ts              localStorage database, seed/reset/export
    seed.ts                deterministic demo workspace
    selectors.ts           enrichment, analytics, reliability, return risk
    offline.ts             IndexedDB queue
    validation.ts          Zod schemas
    supabase.ts            lazy, env-gated Supabase client scaffold
    utils.ts               formatting, status metadata, colors
  pages/                   one file per route
  services/sync.ts         queue replay and reconciliation
  store/                   Zustand app + sync stores
  types/                   domain model
public/
  manifest.webmanifest     PWA manifest and shortcuts
  sw.js                    app-shell caching
  icons/ img/              icons and demo imagery
supabase/
  schema.sql               tables, enums, triggers, RLS, storage policies
```

### Data flow

React Query owns server-shaped state; the demo API writes through `demoDb.ts` to `localStorage` and emits a `relay:data` event. Mutations invalidate the workspace query and show optimistic UI where the flow benefits from it. The offline queue lives in IndexedDB and is independent of React state.

The API boundary is deliberately centralized in `src/lib/api.ts`. A hosted adapter only needs to implement the same functions — components do not talk to storage directly.

---

## Supabase activation

The repository ships with a complete schema and an env-gated client, but **the runtime data layer still uses the local demo adapter**. This is intentional: the deployed demo must work with zero configuration, and demo records are not silently uploaded.

To move toward a hosted backend:

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor. It creates:
   - enums and tables for organizations, profiles, teams, members, items, handoffs, events, proofs, notifications, and invitations;
   - org-scoped RLS policies for every table;
   - a private `relay-proofs` storage bucket with folder-scoped policies;
   - `create_organization(org_name, full_name)` for post-sign-up onboarding;
   - indexes and `updated_at` triggers.
3. Copy `.env.example` to `.env.local` and set:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Sign a user up through Supabase Auth, then call `create_organization('Fieldwork Studio', 'Maya Chen')` once to create the tenant and owner profile.
5. Implement the hosted adapter behind the existing `src/lib/api.ts` functions. `src/lib/supabase.ts` exposes `getSupabase()` and `isSupabaseConfigured`; the SDK is loaded lazily and is not part of the demo bundle.
6. Move receipt confirmation into a Postgres RPC if you need state-transition enforcement that cannot be bypassed by a direct table update. The schema comments call this out.

Until step 5 is done, the app continues to show the demo badge and local data even if env vars are present. `isSupabaseConfigured` is not a claim that the backend is live.

---

## PWA and native wrapping

`npm run build && npm run preview` serves the installable app. The service worker registers only in production. On Chrome/Edge use the install icon or the prompt surfaced in Settings → Data & offline; on iOS use Share → Add to Home Screen.

The output is a static SPA, so it can be wrapped with Capacitor later (`webDir: "dist"`). Native projects, push credentials, and store assets are not included in this repository and are not claimed to be.

---

## Demo limitations

These are deliberate, and the interface says so:

- Authentication is local. Any 6+ character password works for seeded accounts; no password is checked against a server.
- Notifications are generated locally. Email and push delivery are not sent.
- Values, analytics, trust scores, and return risk are derived from seed data or estimates, and are labelled.
- Data lives in `localStorage` (`relay.demo.db`) and IndexedDB (`relay-offline`) on one browser/device. Resetting restores the seed; clearing site storage removes it.
- Demo images are real photographs served from `public/img/`, not stock placeholders.
- There is no git repository initialized in this workspace and no deployment configuration included.

---

## Accessibility

- Skip link, semantic landmarks, labelled controls, and visible focus rings.
- Dialogs and sheets trap focus, close on Escape, and restore focus.
- Status is conveyed with text as well as color.
- `prefers-reduced-motion` disables non-essential transitions.
- Camera permission is never requested without a user gesture; the manual path is always available.
