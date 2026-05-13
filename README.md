# OrcaRede APK — Field App (Bloco 10 — Final)

React Native + Expo app for the field/mobile flows of the OrcaRede platform. The APK supports `manager` as the primary mobile persona and also accepts `engineer` login. See [APK_SCOPE.md](./APK_SCOPE.md) for the full product scope.

## Stack

- Expo SDK 55 + React Native + TypeScript strict
- Expo Router (file-based navigation)
- Supabase JS SDK (Auth + PostgREST + Storage + Realtime)
- TanStack Query (server state)
- Zustand (UI state)
- expo-sqlite (offline outbox queue)
- expo-secure-store + AsyncStorage (auth persistence)
- expo-notifications (push via Expo Push API + FCM)
- Sentry React Native (crash reporting + sync telemetry)
- Jest + jest-expo (unit tests)
- `@react-navigation/drawer` + `react-native-reanimated` / `react-native-gesture-handler` (drawer shell)
- `@gorhom/bottom-sheet` (modals e.g. troca de senha)
- `lucide-react-native` + `expo-linear-gradient` + `react-native-svg` (UI)

## Design system

Shared UI lives under `src/design-system/`:

- **`tokens/`** — colors, spacing, typography, radius, shadows (no raw hex in screens; use tokens).
- **`primitives/`** — `Text`, `Button`, `TextInput`, `Card`, etc.
- **`composed/`** — patterns like `EmptyState`, `ListItemRow`, `FAB`, bottom sheets.
- **`layouts/`** — `ScreenContainer`, `ScreenHeader`, `FormSection`.

Import from `@/design-system/...` paths (see `tsconfig` paths).

## Drawer navigation

The authenticated shell `app/(main)/_layout.tsx` uses **Expo Router’s Drawer** (`expo-router/drawer`). Custom menu content is in `src/components/navigation/DrawerContent.tsx` (profile, links to Obras / Notificações / Fila / Configurações / Sobre, connectivity, logout). Obra detail routes remain a **nested stack** under `obra/[workId]` (Agent B).

## First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the dev project keys. The Supabase URL is already pre-filled. **The `.env` file must never be committed.**
3. Type-check:
   ```bash
   npm run typecheck
   ```
4. Run unit tests:
   ```bash
   npm test
   ```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (pre-filled in `.env.example`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `EXPO_PUBLIC_SENTRY_DSN` | No | Sentry DSN for crash reporting (if empty, Sentry does not initialize) |
| `EAS_PROJECT_ID` | Yes (for build) | EAS project ID, populated by `eas init` |

## Development

This project requires **Dev Client** (native libs: Sentry, react-native-pdf, expo-camera, expo-notifications).

```bash
# Build the dev client APK on EAS and install on device
npx eas build --platform android --profile development

# Start the JS bundler and connect from the Dev Client app
npm run start
```

### Dev Client rebuild triggers

A new Dev Client build is required whenever a **native dependency** is added or updated:

| Bloco | Native dep added | Rebuild? |
| --- | --- | --- |
| 1 | `@sentry/react-native` | Yes |
| 3 | `react-native-pdf`, `react-native-blob-util`, `expo-location` | Yes |
| 8 | `expo-notifications` | Yes |
| Foundation (UI shell) | `@react-navigation/drawer`, `react-native-reanimated`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `react-native-svg`, `expo-linear-gradient` | **Yes** — run a new EAS **development** build after pulling these deps. |

## What is in this build (Bloco 8+9+10 — Final)

Everything from Blocos 1–7 plus:

### Bloco 8a — Push Notifications (APK)
- Device token registration in `device_tokens` table with upsert on conflict
- Android notification channel setup (HIGH importance)
- Foreground notification handling (increments unread badge)
- Tap-to-navigate via deep link resolution (all notification `kind` types mapped)
- Notifications feed screen with unread badge, mark-as-read, mark-all-as-read
- Realtime subscription to `user:{userId}:notifications` for live feed updates
- Token `last_seen_at` refresh on app foreground
- Token cleanup on logout (per-device, preserves multi-device)
- Defensive deep link resolver that normalizes bank `link_path` to Expo Router paths

### Bloco 8b — Push Backend (Supabase)
- **Already applied in the database** via `pg_net` trigger (`notify_push_on_notification`)
- `AFTER INSERT ON notifications` dispatches push to all device tokens via Expo Push API
- Receipt-based token cleanup is **not implemented** (DEBT-016 remains open)
- No Edge Function in this repo — push dispatch is entirely server-side SQL

### Bloco 9 — Offline Hardening
- Outbox schema extended with `status_updated_at` (backward-compatible ALTER TABLE migration)
- Stuck item recovery on app boot: items in `uploading_media`/`calling_rpc` for >10 minutes reset to `pending`
- Queue review screen (`app/(main)/fila.tsx`): list all pending/failed items, retry, discard
- Rich Sentry breadcrumbs with `client_event_id`, attempt count, and error codes
- Global query invalidation on network reconnect (v1 resync strategy)
- Pending count banner on home now navigates to queue detail

### Bloco 10 — Build and Distribution
- App icon and splash screen (placeholder assets)
- Complete `app.config.ts` with all required fields
- `eas.json` profiles: `development`, `preview` (internal APK), `production` (AAB)
- Distribution via EAS Internal Distribution (preview) and Play Store testing track (production)

## Build and distribution

### Preview (Internal Distribution)
```bash
npx eas build --platform android --profile preview
```
Generates an APK for internal testing. Share the install link with testers.

### Production (Play Store)
```bash
npx eas build --platform android --profile production
```
Generates an AAB for Play Store upload. Use with `eas submit` or manual upload.

### Play Store testing track
1. Create an internal testing track in Google Play Console
2. Upload the AAB from the production build
3. Add testers via Google Group or email list
4. Testers install via Play Store opt-in link

## Push notification architecture

```
Supabase triggers (AFTER INSERT/UPDATE on feature tables)
  → INSERT into notifications table
  → pg_net trigger (notify_push_on_notification)
  → POST to https://exp.host/--/api/v2/push/send
  → FCM → Android device
  → expo-notifications listener
  → Tap → resolveDeepLink() → router.push()
```

**Operational assumption:** the push backend runs via `pg_net` trigger in the Supabase project. This APK repo does not contain Edge Functions or server-side push logic. Any changes to push dispatch behavior must be made directly in the Supabase SQL Editor or via migrations applied to the project.

**Token cleanup:** invalid tokens (DeviceNotRegistered) are **not automatically cleaned up** in v1. See DEBT-016 in [docs/known-debt.md](./docs/known-debt.md).

## Migrations

Before testing, apply these SQL migrations in the **Supabase Dashboard > SQL Editor** of the dev project (`ubqyjbtjkzxlexbuxoum`):

1. **`migrations/rpc_send_work_message.sql`** (Bloco 2) — Chat RPC
2. **`migrations/rpc_record_pole_installation.sql`** (Bloco 3) — Pole installation RPC
3. **`migrations/rpc_publish_daily_log.sql`** (Bloco 4) — Daily log RPC
4. **`migrations/rpc_report_milestone.sql`** (Bloco 5) — Milestone RPC
5. **`migrations/rpc_mark_checklist_item.sql`** (Bloco 6) — Checklist RPC
6. **`migrations/rpc_open_alert.sql`** (Bloco 7) — Open alert RPC
7. **`migrations/rpc_resolve_alert_in_field.sql`** (Bloco 7) — Resolve alert RPC
8. **`migrations/rpc_add_alert_comment.sql`** (Bloco 7) — Alert comment RPC

The `notifications`, `device_tokens` tables and the `notify_push_on_notification` trigger are assumed to already exist in the Supabase project (applied outside this repo).

## Contracts and known debt

- [docs/apk-contracts/13-rpc-conventions.md](./docs/apk-contracts/13-rpc-conventions.md): RPC SQL conventions used from Bloco 2 onward.
- [docs/known-debt.md](./docs/known-debt.md): tracked technical debt for the APK.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Push notifications not arriving | Verify `EAS_PROJECT_ID` is set. Rebuild Dev Client after adding `expo-notifications`. Check `device_tokens` table for token row. |
| Deep link opens home instead of target screen | Check `link_path` in `notifications` table matches expected format (`/obra/{workId}/chat`). The resolver normalizes to `/(main)/...`. |
| Items stuck in "uploading_media" | App crash during upload. Reopen app — stuck recovery runs on boot and resets items older than 10 minutes. |
| Queue shows "failed" items | Open the queue screen (tap pending count banner). Review error, then retry or discard. |
| EAS build fails | Ensure `eas.json` profiles are correct. Run `eas whoami` to verify auth. Check that `EAS_PROJECT_ID` matches the project. |
| Sentry not reporting | `EXPO_PUBLIC_SENTRY_DSN` must be set. If empty, Sentry does not initialize (by design). |
