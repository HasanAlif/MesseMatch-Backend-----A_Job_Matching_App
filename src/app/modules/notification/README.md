# Push Notification System

The MesseMatch backend uses Firebase Cloud Messaging (FCM) to deliver push notifications to fitters and companies on Android, iOS, and web. This document explains how it is architected, how each piece fits together, and how to add new notifications safely.

---

## 1. Overview

The system delivers notifications in response to specific business events (job request accepted, rating received, swipe-limit warnings, job-creation-limit warnings, plan-expiry reminders, and a daily new-jobs digest for fitters). Every notification is:

- Persisted to MongoDB as a `Notification` document (so the user can see it in-app even when push delivery fails).
- Pushed to the user's registered devices via Firebase Admin SDK multicast.
- Fire-and-forget from the caller's perspective — a notification failure NEVER blocks the business transaction that triggered it.

**What this system does NOT do (intentionally):**

- No ad-hoc admin broadcasts. There is no API for an admin or operator to compose and send a free-form push.
- No chat / message push (Socket.IO handles online users; offline-fallback push for chat is deferred).
- No localization yet. All notification copy is English; the `user.language` field is read but not branched on.
- No retries on FCM delivery failure. Permanent token errors are pruned; transient errors are logged. The next event triggers a fresh send.

---

## 2. High-Level Architecture

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ Business Event (HTTP request OR scheduled cron tick)                │
 │   e.g. "company accepts a job request" / "19:00 Europe/Berlin"      │
 └─────────────────────────────────┬──────────────────────────────────┘
                                   │
                   ┌───────────────▼────────────────┐
                   │ Business service                │
                   │ (matching / subscription /      │
                   │  job / dailyNotifications cron) │
                   └───────────────┬────────────────┘
                                   │ void notifyXxx(...)
                                   │ (fire-and-forget)
                   ┌───────────────▼────────────────┐
                   │ Per-module notification helper  │
                   │ <module>.notifications.ts       │
                   │ • Builds title/body/data        │
                   │ • Optional dedup lookup         │
                   │ • try/catch + console.error     │
                   └───────────────┬────────────────┘
                                   │ notificationService.sendToUser({...})
                   ┌───────────────▼────────────────┐
                   │ notificationService.sendToUser  │
                   │ (the single core send path)     │
                   └─┬────────────┬──────────────────┘
                     │            │
       ┌─────────────▼─┐      ┌───▼──────────────────┐
       │ MongoDB        │      │ Firebase Admin SDK   │
       │ notifications  │      │ (multicast to all    │
       │ collection     │      │  active device       │
       │ • status flow  │      │  tokens of the user) │
       │ • read state   │      └───┬──────────────────┘
       └────────────────┘          │
                                   ▼
                        ┌──────────────────────┐
                        │ User devices (iOS,   │
                        │ Android, Web)        │
                        └──────────────────────┘
```

Two important parallel flows happen inside `sendToUser`:

1. **DB-first persistence** — a `Notification` row is created with `status=PENDING` BEFORE Firebase is called. If Firebase isn't initialized, or the user has no active tokens, or every device fails, the row is updated to `status=FAILED` with an `errorMessage`. The user still sees the notification in their notification list (because notification persistence and push delivery are decoupled).
2. **Invalid token cleanup** — permanent FCM errors (unregistered token, invalid token, invalid argument) are auto-pruned from `user.fcmTokens` after the multicast call. Transient errors are left alone.

---

## 3. Components (file map)

| File | Role |
|---|---|
| [notification.model.ts](notification.model.ts) | Mongoose `Notification` schema, `NotificationType` and `NotificationStatus` enums, indexes (including the dedup-friendly `{ userId, type, createdAt }`) |
| [notification.service.ts](notification.service.ts) | FCM token register/remove, the single `sendToUser` send path, list/read/unread-count helpers used by user-facing endpoints |
| [notification.controller.ts](notification.controller.ts) | Express handlers — user-facing only (no admin sender) |
| [notification.routes.ts](notification.routes.ts) | Routes mounted at `/api/notifications` |
| [notification.validation.ts](notification.validation.ts) | Zod schemas for FCM token register/remove |
| [notification.daily.helpers.ts](notification.daily.helpers.ts) | Helpers used only by the daily cron: `notifyDailyJobMatches`, `notifyPlanExpiring`, plus a shared `hasNotificationOfTypeSince` dedup util |
| [../matching/matching.notifications.ts](../matching/matching.notifications.ts) | `notifyJobRequestAccepted`, `notifyRatingReceived` |
| [../subscription/subscription.notifications.ts](../subscription/subscription.notifications.ts) | `notifySwipeThreshold`, `notifySwipeLimitReached` (with `swipeCountResetAt`-scoped dedup) |
| [../subscription/subscription.constants.ts](../subscription/subscription.constants.ts) | Single source of truth: `PLAN_DURATION_DAYS`, `JOB_CREATION_LIMITS`, `JOB_CREATION_WARN_AT`, `SWIPE_LIMITS`, `SWIPE_WARN_AT`, `getPlanDurationMs` |
| [../job/job.notifications.ts](../job/job.notifications.ts) | `notifyJobLimitWarning`, `notifyJobLimitReached` |
| [../../cron/dailyNotifications.cron.ts](../../cron/dailyNotifications.cron.ts) | The 19:00 Europe/Berlin scheduled job that does (a) plan-expiry checks and (b) the per-fitter daily job-match digest |
| [../../../shared/firebase.ts](../../../shared/firebase.ts) | Firebase Admin singleton init (`initializeFirebase`, `getMessaging`, `isFirebaseInitialized`) |

---

## 4. Notification Types

`NotificationType` is defined in [notification.model.ts](notification.model.ts) and mirrored in [notification.validation.ts](notification.validation.ts).

### Active types — fired by current business triggers

| Type | Recipient | What it means |
|---|---|---|
| `JOB_REQUEST_ACCEPTED` | fitter | Company has accepted the fitter's job application |
| `JOB_RATING_RECEIVED` | fitter | Company has rated the fitter for a completed job |
| `DAILY_JOB_MATCHES` | fitter | The 19:00 daily digest: ≥1 newly posted job today matches this fitter at >30% |
| `SWIPE_THRESHOLD` | fitter (FREE) | Fitter has used 20 of 30 monthly swipes |
| `SWIPE_LIMIT_REACHED` | fitter (FREE) | Fitter has hit the 30-swipe cap |
| `JOB_LIMIT_WARNING` | company | Active job count just reached the warn threshold (3 for BASIC/LAUNCH_PREMIUM, 10 for PREMIUM family) |
| `JOB_LIMIT_REACHED` | company | Active job count just hit the hard cap (5 or 12) |
| `PLAN_EXPIRING_30D` | company | LAUNCH_PREMIUM expires in ~30 days |
| `PLAN_EXPIRING_14D` | company | LAUNCH_PREMIUM expires in ~14 days |
| `PLAN_EXPIRING_7D` | any paid plan | Plan expires in ~7 days (BASIC, PREMIUM, PREMIUM_DE, PREMIUM_EU, LAUNCH_PREMIUM) |

The enum is **closed** — every value above is fired by a wired trigger. There are no reserved / unused / "future" enum values. `type` is required on every notification (no `SYSTEM` default). If a new event is added, follow the recipe in §13 to extend the enum and wire the trigger together.

---

## 5. Trigger Map (event → who → where wired)

| Event | Recipient | Notification type | Wired in |
|---|---|---|---|
| Company sets a job request status to ACCEPTED | fitter | `JOB_REQUEST_ACCEPTED` | [matching.service.ts:1160](../matching/matching.service.ts#L1160) (inside `updateRequestStatusForCompany`) |
| Company rates a fitter for a completed job | fitter | `JOB_RATING_RECEIVED` | [matching.service.ts:1511](../matching/matching.service.ts#L1511) (inside `giveRatingAndReviewToFitterForCompletedJob`) |
| FREE-plan fitter's swipe count reaches 20 | fitter | `SWIPE_THRESHOLD` | [subscription.service.ts:117](../subscription/subscription.service.ts#L117) (post-increment branch) |
| FREE-plan fitter's swipe count hits 30 (limit) | fitter | `SWIPE_LIMIT_REACHED` | [subscription.service.ts:87](../subscription/subscription.service.ts#L87) (before the throw) |
| Company creates a job that brings active count to warn threshold (3 / 10) | company | `JOB_LIMIT_WARNING` | [job.service.ts:141 → 172](../job/job.service.ts#L141) (`notifyJobLimitProgress` runs post-create) |
| Company creates a job that brings active count to hard cap (5 / 12) | company | `JOB_LIMIT_REACHED` | [job.service.ts:141 → 167](../job/job.service.ts#L141) |
| LAUNCH_PREMIUM company has plan expiring in ~30 days | company | `PLAN_EXPIRING_30D` | [dailyNotifications.cron.ts](../../cron/dailyNotifications.cron.ts) `processPlanExpirations` |
| LAUNCH_PREMIUM company has plan expiring in ~14 days | company | `PLAN_EXPIRING_14D` | same |
| Any paid plan expiring in ~7 days | user | `PLAN_EXPIRING_7D` | same |
| ≥1 newly posted job today matches a fitter at >30% | fitter | `DAILY_JOB_MATCHES` | [dailyNotifications.cron.ts](../../cron/dailyNotifications.cron.ts) `processDailyJobMatches` |

---

## 6. The Daily Cron (`dailyNotifications.cron.ts`)

**Schedule:** `0 19 * * *` — every day at 19:00 Europe/Berlin (DST-aware via node-cron timezone option). Registered in [src/server.ts](../../../server.ts) via `initDailyNotificationsCron()`.

**`runDailyNotificationsOnce`** is exported for manual testing — you can import and call it directly to fire the cron's body without waiting until 19:00.

### Phase A — Plan expiration warnings (`processPlanExpirations`)

Three buckets are processed in order:

| Bucket | Filter |
|---|---|
| 30-day | `plan === LAUNCH_PREMIUM` AND `premiumPlanExpiry ∈ (now+29d, now+30d]` |
| 14-day | `plan === LAUNCH_PREMIUM` AND `premiumPlanExpiry ∈ (now+13d, now+14d]` |
| 7-day  | `plan !== FREE`               AND `premiumPlanExpiry ∈ (now+6d,  now+7d]`  |

Each window is exactly 24 hours wide, so a given user enters each window on exactly one cron firing. As a defensive backstop in case the cron fires twice (e.g., process restart at 19:00), `notifyPlanExpiring` dedupes against any prior notification of the same `PLAN_EXPIRING_*` type in the last 7 days.

### Phase B — Daily job-match digest (`processDailyJobMatches`)

1. Load all jobs created in the last 24 hours where `jobStatus === ACTIVE` — **one query, once**.
2. Load the companies that posted those jobs (for country + coordinates) — **one query**.
3. Load all REQUESTED/REJECTED `JobRequest` rows for those new jobs — **one query** — used to skip jobs a fitter has already applied to.
4. Stream all active fitters via a Mongoose cursor in batches of 100 (avoids loading 10k+ users into memory).
5. For each fitter:
   - Skip jobs whose company.country isn't Germany if the fitter is not on `PREMIUM_EU`.
   - Skip jobs the fitter has already applied to.
   - Compute `computeMatchScore(fitter, job, company)` — the **single source of truth** for fitter↔job scoring, used both by the cron and by the runtime `matchingForFitter` / `matchingForCompany` endpoints in [matching.service.ts](../matching/matching.service.ts). It produces a 0–100 score using the `0.45/0.25/0.30` skill/language/distance weighting. (The `searchAndFilterJobs` endpoint uses a different formula by design — skills + distance only — and is not affected.)
   - Count jobs scoring above `MATCHING_CONFIG.MINIMUM_SCORE_PERCENT` (= 30).
   - If count ≥ 1 → send `DAILY_JOB_MATCHES` via `notificationService.sendToUserWithDocument` (passes the already-loaded fitter with `fcmTokens`, saving one `User.findById` round trip per fitter at scale).
   - If count = 0 → silently skip; the fitter receives no notification that day.

Complexity is **O(F × J)** in-memory score calculations where F = active fitters and J = today's new jobs. With ~10k fitters and ~50 jobs/day this is well under one second of CPU; FCM delivery dominates wall time.

---

## 7. Per-Module Helper Pattern

Every notification trigger lives in a `<module>.notifications.ts` file next to its business service. A helper looks like this:

```ts
// matching.notifications.ts
import { notificationService } from "../notification/notification.service";
import { NotificationType } from "../notification/notification.model";

export const notifyJobRequestAccepted = async (
  fitterId: string,
  jobTitle: string,
  companyName: string,
  jobId: string,
  requestId: string,
): Promise<void> => {
  try {
    await notificationService.sendToUser({
      userId: fitterId,
      type: NotificationType.JOB_REQUEST_ACCEPTED,
      title: "Application accepted 🎉",
      body: `${companyName} accepted your application for "${jobTitle}". Get ready to start!`,
      data: { kind: NotificationType.JOB_REQUEST_ACCEPTED, jobId, requestId },
    });
  } catch (err) {
    console.error("[notify] notifyJobRequestAccepted failed:", (err as Error).message);
  }
};
```

The business service calls it with `void` — explicit fire-and-forget — so the function is awaited internally only for the try/catch but the caller doesn't `await`:

```ts
// matching.service.ts
void notifyJobRequestAccepted(
  existingRequest.fitterId.toString(),
  job?.projectName ?? "your job",
  company?.companyName ?? "The company",
  existingRequest.jobId.toString(),
  updatedRequest._id.toString(),
);
```

**Why this pattern:**

- The try/catch lives INSIDE the helper. If `sendToUser` throws (Firebase not initialized, invalid user, etc.), the error is logged and swallowed. The business path keeps running.
- `void` at the call site makes the fire-and-forget intent obvious in code review — there is no danger of someone accidentally `await`ing it and tying the response time to FCM latency.
- All copy strings live in one place per helper, so changing wording is a single-file edit.

---

## 8. Dedup Strategy

The `Notification` collection IS the dedup store. There is no separate cache.

| Trigger | Dedup window | Why |
|---|---|---|
| `SWIPE_THRESHOLD` | Since `user.swipeCountResetAt` | A new month resets the swipe count; the user should receive a new threshold warning in each new month |
| `SWIPE_LIMIT_REACHED` | Since `user.swipeCountResetAt` | Same — fresh quota = fresh warning eligibility |
| `PLAN_EXPIRING_30D / 14D / 7D` | Last 7 days | Each window is a 24-hour band; the 7-day dedup window catches accidental double-fires (restart at 19:00, manual `runDailyNotificationsOnce`, etc.) |
| `DAILY_JOB_MATCHES` | 12 hours | Defends against server restarts at 19:00 firing the cron twice within the same calendar day; legitimate next-day fires are >24h apart |
| `JOB_LIMIT_WARNING` | Last 30 days | Race-safe: uses `count >= warnAt` not `=== warnAt`, dedup via persisted `Notification` prevents duplicates when concurrent job creations race past the threshold. Delete-then-recreate past 30 days re-triggers — sane billing-cycle behavior |
| `JOB_LIMIT_REACHED` | Last 30 days | Same pattern as `JOB_LIMIT_WARNING` |
| `JOB_REQUEST_ACCEPTED` | None | Each acceptance is a one-shot state transition; the source code only allows REQUESTED → ACCEPTED once |
| `JOB_RATING_RECEIVED` | None | The service rejects rating an already-rated request — natural one-shot |

All dedup checks use the shared `hasNotificationOfTypeSince` helper in [notification.daily.helpers.ts](notification.daily.helpers.ts). The compound index `{ userId: 1, type: 1, createdAt: -1 }` on `Notification` (in [notification.model.ts](notification.model.ts)) makes these lookups cheap.

**A note on swipe counter races:** the swipe path uses an atomic `$inc` and reads the post-increment value for the threshold check, so the at-20 notification fires correctly even under concurrent calls. The at-30 limit check happens BEFORE the increment (to fail-fast with `PAYMENT_REQUIRED`), so under heavy concurrency two calls at swipeCount=29 may both pass the pre-check and increment to 30/31. The `SWIPE_LIMIT_REACHED` notification then fires on the next swipe attempt — a one-swipe delay, not a missed notification. This is an acceptable trade-off for the simpler code path.

---

## 9. FCM Token Lifecycle

Defined on the `User` model as `fcmTokens: IFcmTokenEntry[]`. Config in [`src/app/models/user.model.ts`](../../../app/models/user.model.ts):

```ts
FCM_TOKEN_CONFIG = {
  MAX_DEVICES_PER_USER: 10,
  STALE_TOKEN_DAYS: 30,
};
```

### Registration (`POST /api/notifications/fcm-token`)

- Identifies a device by its `deviceId` (client-generated, stable per install).
- If a token already exists for that `deviceId`, the entry is updated in place (new token, new `lastActiveAt`).
- If it's a new `deviceId` AND the user is already at `MAX_DEVICES_PER_USER`, the **oldest** device (by `lastActiveAt`) is evicted before the new one is pushed.

### Removal (`POST /api/notifications/fcm-token/remove`)

Deletes by `deviceId`. Used on logout.

### Send time

- `getActiveTokens()` in [notification.service.ts](notification.service.ts) filters out tokens whose `lastActiveAt` is older than 30 days. Stale tokens are never sent to.
- After every multicast, tokens that returned a **permanent** error code are pruned from the user's `fcmTokens` (`messaging/registration-token-not-registered`, `messaging/invalid-registration-token`, `messaging/invalid-argument`). Transient errors are not pruned.

---

## 10. Notification Persistence (the `notifications` collection)

### Schema

| Field | Notes |
|---|---|
| `userId` | Indexed, FK to `User` |
| `title` / `body` | The push title/body (trim, max 200 / 1000) |
| `data` | Plain object (`Schema.Types.Mixed`). Always includes `notificationId`. Helpers add `kind` (= the `NotificationType`) plus event-specific IDs (`jobId`, `requestId`, `plan`, `daysRemaining`, etc.) for mobile deep-linking. |
| `type` | `NotificationType` (required — no default) |
| `status` | `PENDING → SENT | FAILED → READ` |
| `fcmMessageId` | Summary token after a successful send (e.g., `sent_to_2_devices`). Not a Firebase message ID per se, but useful for logs. |
| `errorMessage` | First 500 chars of any error |
| `readAt` | Set when the user calls `PATCH /:id/read` or `PATCH /mark-all-read` |
| `createdAt` / `updatedAt` | Auto via timestamps |

### Status flow

```
   sendToUser called
        │
   PENDING (row created)
        │
   ┌────┴────────────────────────┐
   │ Firebase init? user exists? │
   │ user has active tokens?     │
   │   no  →  FAILED (with msg)  │
   │   yes →  multicast          │
   └─────┬───────────────────────┘
         │
   ┌─────┴──────────────┐
   │ successCount > 0?  │
   │   yes → SENT       │
   │   no  → FAILED     │
   └─────┬──────────────┘
         │
   user reads it in-app
         │
   READ (via markAsRead / markAllAsRead)
```

### Indexes

```ts
{ userId: 1, createdAt: -1 }            // list "my notifications" newest first
{ userId: 1, status: 1 }                // unread count
{ status: 1, createdAt: 1 }             // ops queries
{ userId: 1, type: 1, createdAt: -1 }   // dedup lookups
```

---

## 11. Configuration

### Required environment variables

| Var | Used by |
|---|---|
| `FIREBASE_PROJECT_ID` | [shared/firebase.ts](../../../shared/firebase.ts) |
| `FIREBASE_PRIVATE_KEY` | same |
| `FIREBASE_CLIENT_EMAIL` | same |

If any is missing, `initializeFirebase()` logs a warning and the server continues running. Every notification call still creates a `Notification` row (with `status=FAILED`, `errorMessage="Firebase not initialized"`), so the app never 500s due to a missing Firebase config. This is intentional graceful degradation — the in-app notification feed keeps working even if push delivery is offline.

---

## 12. User-Facing API Endpoints

All endpoints are under `/api/notifications` and require authentication (`auth(...)`). Roles allowed: `ADMIN`, `FITTER`, `COMPANY`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/fcm-token` | Register or update an FCM token for a device |
| POST | `/fcm-token/remove` | Unregister a device's FCM token |
| GET  | `/my-devices` | List the caller's registered devices |
| GET  | `/my-notifications` | Paginated list of the caller's notifications (`?page&limit`) |
| GET  | `/unread-count` | Count of `SENT` + `PENDING` notifications |
| PATCH | `/mark-all-read` | Mark all unread notifications as `READ` |
| PATCH | `/:id/read` | Mark a single notification as `READ` |

> Note: There are no admin-only push-sending endpoints. The system never sends notifications on behalf of an admin — only in response to coded business events.

---

## 13. Adding a New Notification Trigger

Follow this recipe to wire a new event into the system. The whole flow should take under 30 minutes.

1. **Add a new enum value.** In [notification.model.ts](notification.model.ts), append a `SCREAMING_SNAKE_CASE` value to `NotificationType`.
2. **No validation update needed.** Validation schemas don't enumerate types anymore (admin send endpoint is removed). If you ever re-add an inbound endpoint that accepts `type`, mirror the enum there.
3. **Pick the right helper file.** Put the new helper in the `<module>.notifications.ts` that matches the event's domain. Create the file if the module doesn't have one yet. Use the shape from [matching.notifications.ts](../matching/matching.notifications.ts) as a template:
   - Take typed parameters (no `any`).
   - Build a concise English `title` and a friendly `body`.
   - Include a `data: { kind: NotificationType.X, ...ids }` payload — the mobile app reads `data.kind` to choose the right deep-link.
   - Wrap the `sendToUser` call in `try/catch` and log via `console.error("[notify] notifyXxx failed:", ...)`.
4. **Call the helper from the business service.** Use `void notifyXxx(...)` so the call is fire-and-forget. Make sure you call it AFTER the database mutation succeeds — never before.
5. **Decide if dedup is needed.**
   - If the trigger is a single-shot state change (creation, transition, one-time action) → no dedup needed.
   - If the trigger can fire repeatedly (cron tick, threshold counter, periodic check) → dedup via the `Notification.findOne({ userId, type, createdAt: { $gte: sinceDate } })` pattern. See `hasNotificationOfTypeSince` in [notification.daily.helpers.ts](notification.daily.helpers.ts) for a reusable implementation.
6. **If it's a scheduled trigger**, integrate into `processPlanExpirations` or `processDailyJobMatches` in [dailyNotifications.cron.ts](../../cron/dailyNotifications.cron.ts), or add a third phase function called from `runDailyNotificationsOnce`. Don't create a new cron file unless the schedule fundamentally differs.
7. **Update this README's trigger map.**

---

## 14. Manual Testing Checklist

With at least one real FCM token registered on a test device per account:

### Per-event smoke tests

- **Job request accepted** → `PATCH /api/matches/:id/status { requestStatus: "ACCEPTED" }` — fitter receives push; `notifications` row created with `type=JOB_REQUEST_ACCEPTED`, `status=SENT`.
- **Rating received** → `POST /api/matches/:id/rating` — fitter receives push; `notifications` row `type=JOB_RATING_RECEIVED`.
- **Swipe threshold (20)** → on a FREE-plan fitter, swipe 20 times. The 20th call returns 200 AND fires `SWIPE_THRESHOLD`. Calls 21-29 do NOT re-notify (dedup since `swipeCountResetAt`).
- **Swipe limit (30)** → call 30 returns 200 + push. Call 31 throws `PAYMENT_REQUIRED` + sends `SWIPE_LIMIT_REACHED` (only the first time within the month — dedup applies on retries).
- **Job limit warn / reached (BASIC company, limit 5)** → create jobs 1, 2 (silent). Create 3rd → `JOB_LIMIT_WARNING`. Create 4th (silent). Create 5th → `JOB_LIMIT_REACHED`. 6th call throws CONFLICT (no notify).
- **Plan upgrade sets expiry** → `PATCH /api/subscriptions/...` to `PREMIUM` → `user.premiumPlanExpiry` = now + 30 days. To `LAUNCH_PREMIUM` → now + 180 days. To `FREE` → field unset.
- **Daily cron (manual)** → import `runDailyNotificationsOnce` from `dailyNotifications.cron.ts` and invoke it from a one-off script. Seed:
  - A LAUNCH_PREMIUM company with `premiumPlanExpiry = now + 30 days` → receives `PLAN_EXPIRING_30D`.
  - A PREMIUM company with `premiumPlanExpiry = now + 7 days` → receives `PLAN_EXPIRING_7D`.
  - A FREE user → silently skipped.
  - Post a new job matching a test fitter (within the last 24 hours) → that fitter receives `DAILY_JOB_MATCHES` ("New job for you"). Post 3 more matching jobs → that fitter receives a SINGLE push ("4 new jobs posting for you"), not 4.

### Graceful-degradation test

Unset `FIREBASE_PROJECT_ID` (or any other Firebase env var), restart, and trigger any event above. The HTTP endpoint should still return success; the `Notification` row should exist with `status=FAILED`, `errorMessage="Firebase not initialized"`. No 500s.

### Typecheck

```
npx tsc --noEmit
```

must exit 0.
