# E2E Test Credentials

This document lists the credentials and seeded data created by the
contributor seed script. **Do not use these accounts in production.**

## How to seed

From `vivaideapad-api/`:

```bash
# 1. (One-time) Seed the base data: admins, default category, sample concept.
pnpm seed

# 2. Seed the E2E contributors and their submissions.
pnpm seed:contributors
```

Both scripts are idempotent — re-running them will refresh existing rows
instead of creating duplicates.

The script reads database connection details from the same `.env` /
environment variables as the API (`DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD`, `DB_NAME`).

## Seeded contributors

All accounts have `role = CONTRIBUTOR` and `password` listed below.

| # | Email | Display name | Password | Access status |
|---|---|---|---|---|
| 1 | `alice.e2e@viva.local` | Alice Rahman | `AliceE2E!2026` | active |
| 2 | `bob.e2e@viva.local` | Bob Hossain | `BobE2E!2026` | active |
| 3 | `carla.e2e@viva.local` | Carla Karim | `CarlaE2E!2026` | active |
| 4 | `dan.e2e@viva.local` | Dan Siddiqui | `DanE2E!2026` | active |
| 5 | `eva.e2e@viva.local` | Eva Akter | `EvaE2E!2026` | `pending_review` |

> `eva.e2e@viva.local` is intentionally seeded with `access_status =
> pending_review` to exercise the gated-access flow in E2E tests.

## Seeded category & concepts

Created under category slug `e2e-category` / name `E2E Testing`.

| Concept slug | Title | Status | Reward budget | Onboarding? |
|---|---|---|---:|---|
| `e2e-product-feedback` | Product feedback loops | active | 1500.00 | yes |
| `e2e-distributed-systems` | Distributed systems patterns | active | 2500.00 | no |
| `e2e-onboarding-paths` | Onboarding paths for new contributors | active | 1000.00 | yes |

## Seeded submissions

| Owner | Title (excerpt) | Concept | Status | Notes |
|---|---|---|---|---|
| Alice | Closing the loop with weekly customer interviews | e2e-product-feedback | `pending_review` | — |
| Alice | In-product micro-surveys after key moments | e2e-product-feedback | `draft` | — |
| Bob | Outbox pattern for cross-service consistency | e2e-distributed-systems | `pending_review` | has attachment |
| Bob | Idempotency keys on every mutating endpoint | e2e-distributed-systems | `approved` | already decided |
| Carla | A 14-day onboarding sprint for new contributors | e2e-onboarding-paths | `changes_requested` | — |
| Dan | A buddy system that scales | e2e-onboarding-paths | `pending_review` | — |
| Eva | — | — | — | no submissions |

## Suggested E2E coverage

- **Auth flow** — sign in with `alice.e2e@viva.local` / `AliceE2E!2026`,
  refresh, sign out.
- **Submission lifecycle** — Alice has a `draft` (editable), a
  `pending_review` one, and you can submit the draft to exercise the
  status transition.
- **Approved-state read** — Bob's approved submission is useful for
  read-only paths that filter by status.
- **Attachments** — Bob's outbox-pattern submission carries an attachment
  payload — use it to verify attachment rendering.
- **Access gating** — `eva.e2e@viva.local` has `pending_review` status
  to exercise any gated-endpoint paths.
- **Admin-side review** — Carla has a `changes_requested` submission;
  pair with the admin credentials from the base seed (`admin@viva.local`
  / `ChangeMe!123`) to flip it through the review queue.

## Cleanup

The seed does **not** delete any data. To reset:

```bash
# Hard reset the database, then re-run migrations and seeds.
pnpm migration:revert && pnpm migration:run
pnpm seed && pnpm seed:contributors
```
