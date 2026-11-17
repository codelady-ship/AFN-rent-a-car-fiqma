# AFN rent a car API

Base URL: `https://<your-render-service>.onrender.com/api` (locally `http://localhost:4000/api`).
JSON in, JSON out. Errors are `{ "error": "message", "details"?: [{ "field", "message" }] }` and never include stack traces.

Auth: `Authorization: Bearer <token>` from `/auth/login` or `/auth/register` (customer tokens last 7 days, admin tokens 8 hours). No cookies are used.

Dates are calendar days `YYYY-MM-DD` in Baku time. A booking covers `[from, to)`: the return day is free for the next pick-up, so 20 → 23 is 3 days.

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Health check for Render |
| GET | `/slides`, `/categories`, `/locations`, `/extras` | Catalogue data; only active locations |
| GET | `/cars` | Filters: `category`, `available`, `featured`, `minPrice`, `maxPrice`, `seats` (minimum), `transmission`, `fuel`, `q` (model search), `from` + `to` (only cars free on those days), `sort` (`price`, `-price`, `year`, `-year`) |
| GET | `/cars/:id` | Car with average `rating` |
| GET | `/cars/:id/busy` | `{ days: ["YYYY-MM-DD", …] }` booked days |
| GET | `/cars/:id/reviews` | Reviews of the car |
| POST | `/bookings/quote` | `{ car, from, to, extras?, location?, place? }` → price breakdown computed on the server |
| POST | `/reservations` | Guest booking: quote fields + `name`, `phone`, `email?`, `note?`. Rate limited |
| POST | `/contact` | `{ name, phone?, email?, message, website: "" }` (`website` is a honeypot). Rate limited |

## Auth (rate limited per IP, default 10 per 15 min)

| Method | Path | Body |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password (8+), phone? }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | Current user |

## Customer (Bearer token)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/bookings` | Same body as `/reservations`; linked to the account |
| GET | `/bookings/mine` | Only the caller's bookings |
| PATCH | `/bookings/:id/cancel` | Own booking only (others get 404), before the pick-up day, while `pending` or `confirmed` |
| POST | `/cars/:id/reviews` | `{ rating 1–5, comment }`, only after a completed booking of that car, one per car |

## Admin (Bearer token with role `admin`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/stats` | Cars, customers, new messages, bookings by status, revenue of confirmed/completed bookings, booked days |
| GET | `/admin/bookings?status=` | Latest 200 bookings (`/reservations` is the legacy alias from #4) |
| PATCH | `/admin/bookings/:id` | `{ status }`: `pending → confirmed → completed`, `pending/confirmed → cancelled`; other moves get 409 |
| POST / PUT / DELETE | `/cars`, `/cars/:id` | Car CRUD; delete is refused (409) while the car has open bookings |
| GET | `/admin/locations` | Including inactive ones |
| POST / PUT / DELETE | `/locations`, `/locations/:id` | Location CRUD |
| GET / PATCH / DELETE | `/admin/messages`, `/admin/messages/:id` | Contact messages, status `new`, `read` or `archived` |
| GET / DELETE | `/admin/reviews`, `/admin/reviews/:id` | Moderation |

## Booking rules

- `from` must not be in the past, `to` must be after `from`, at most 60 days. Impossible dates such as `2026-02-30` are rejected (400, field `from`/`to`).
- The price is always computed on the server: `days × pricePerDay + Σ extras × days + delivery fee`. Any price sent by the client is ignored.
- No double booking, even for parallel requests: each booked car-day is a `BookingSlot` document with a unique `{ car, day }` index. A booking claims all its days in one `insertMany`; if any day is taken the request gets **409** and its own claimed days are removed. Cancelling frees the days.
- Status changes are conditional updates on the current status, so two admins cannot apply conflicting moves.

## Environment

See [`backend/.env.example`](../backend/.env.example): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, `SEED_ON_START`, `AUTH_RATE_LIMIT`, `PUBLIC_RATE_LIMIT`.
