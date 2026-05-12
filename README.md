# OrcaRede APK — Manager App (Bloco 3)

React Native + Expo app for the manager persona of the OrcaRede platform. See [APK_SCOPE.md](./APK_SCOPE.md) for the full product scope.

## Stack

- Expo SDK 55 + React Native + TypeScript strict
- Expo Router (file-based navigation)
- Supabase JS SDK (Auth + PostgREST + Storage + Realtime)
- TanStack Query (server state)
- Zustand (UI state)
- expo-sqlite (offline outbox queue)
- expo-secure-store + AsyncStorage (auth persistence)
- Sentry React Native (crash reporting)
- Jest + jest-expo (unit tests)

## First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the dev project keys (Supabase anon key, optional Sentry DSN). The Supabase URL is already pre-filled. **The `.env` file must never be committed.**
3. Type-check:
   ```bash
   npm run typecheck
   ```
4. Run unit tests:
   ```bash
   npm test
   ```

## Development

This project requires **Dev Client** from Bloco 1 onward (native libs like Sentry and, in later blocks, react-native-pdf, expo-camera).

```bash
# First time only: build the dev client APK on EAS and install on device
npx eas build --platform android --profile development

# Subsequent runs: start the JS bundler and connect from the Dev Client app
npm run start
```

## What is in this build (Bloco 3)

- Everything from Blocos 1–2 (auth, obras, outbox infra, chat, realtime, media upload)
- **Pole marking on PDF** — tap the project blueprint to record installed poles
- PDF rendering via `react-native-pdf` with pan/zoom (cached locally for offline)
- Tap-to-coordinate conversion (screen → logical 6000x6000 grid)
- Mandatory photo capture per pole installation via `expo-image-picker`
- Optional GPS capture via `expo-location` (never blocking)
- Offline-first: pole installations and removals go through the outbox queue
- Strong idempotency (`client_event_id` NOT NULL UNIQUE) via `rpc_record_pole_installation`
- Soft-delete pole removal (PostgREST direct, also queued offline)
- Planned poles overlay (read-only reference from `work_project_posts`)
- Realtime updates via `work:{workId}:events` channel
- Unit tests for coordinates, pole-handler, pole-remove-handler

## What is **not** in this build

Audio recording (DEBT-019), inline video preview (DEBT-020), pole editing (remove + reinstall as workaround), multi-page PDF marking, diario, marcos, checklists, alertas, push, dark mode. Those land in blocos 4–10.

## Repository layout

See [APK_SCOPE.md](./APK_SCOPE.md) section 11 for the canonical folder tree.

## Migrations pendentes

Before testing, apply these SQL migrations in the **Supabase Dashboard > SQL Editor** of the dev project (`ubqyjbtjkzxlexbuxoum`):

1. **`migrations/rpc_send_work_message.sql`** (Bloco 2) — Creates the `rpc_send_work_message` RPC used by the chat feature. Validates membership, inserts message + attachments atomically, idempotent by `client_event_id`.

2. **`migrations/rpc_record_pole_installation.sql`** (Bloco 3) — Creates the `rpc_record_pole_installation` RPC used by the pole marking feature. Validates membership, inserts pole installation + media atomically, strong idempotency by `client_event_id` NOT NULL UNIQUE. Validates coordinate ranges (0–6000) and GPS bounds.

**Validation step (T1 — Bloco 3):** After applying the migration, run this in SQL Editor:

```sql
SELECT rpc_record_pole_installation('{
  "work_id": "<a valid work_id>",
  "client_event_id": "test-pole-001",
  "x_coord": 3000,
  "y_coord": 3000,
  "installed_at": "2026-05-11T14:00:00.000Z",
  "media": []
}'::jsonb);
```

Expected result: `{ "installationId": "<uuid>", "isNew": true }`.

## Dev Client rebuild required (Bloco 3)

Bloco 3 adds native dependencies (`react-native-pdf`, `react-native-blob-util`, `expo-location`) that require a **new Dev Client build**:

```bash
npx eas build --platform android --profile development
```

Install the new APK on the device before testing PDF rendering or GPS features.

## Contracts and known debt

- [docs/apk-contracts/13-rpc-conventions.md](./docs/apk-contracts/13-rpc-conventions.md): RPC SQL conventions used from Bloco 2 onward.
- [docs/known-debt.md](./docs/known-debt.md): tracked technical debt for the APK.
