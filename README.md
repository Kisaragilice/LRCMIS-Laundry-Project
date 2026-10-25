# LRCMIS — Laundry Reservation & Customer Management Information System

A full-stack academic implementation of the LRCMIS requirements: customer reservations with
concurrency-safe slot capacity, an operations workflow from weighing to delivery, auditable
payments, promotions, reports, and role-based dashboards.

- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS, React Router, Zod, Recharts, Lucide
- **Backend:** Node.js, Express 4, TypeScript, Prisma 6, PostgreSQL 17, Zod, Vitest + Supertest
- **Auth:** HttpOnly JWT cookie, double-submit CSRF token, bcrypt hashes, backend RBAC + ownership checks
- **Locale:** Indonesian UI, IDR currency, `Asia/Jakarta` business timezone

---

## 1. Quick start (local)

### Prerequisites

- Node.js 20+ (tested with Node 24)
- PostgreSQL 15+ (tested with PostgreSQL 17)

### Steps

```bash
# 1. Install dependencies for both workspaces
npm install

# 2. Create the databases
createdb -U postgres lrcmis_dev
createdb -U postgres lrcmis_test

# 3. Configure environment
copy server/.env.example server/.env      # Windows
# cp server/.env.example server/.env      # macOS/Linux
# Edit DATABASE_URL and JWT_SECRET

# 4. Generate Prisma client, migrate, and seed reference data
npm run db:generate
npm run db:deploy
npm run db:seed

# 5. Create the protected primary administrator (prints the password once)
npm run db:setup-admin -- --email admin@lrcmis.id

# 6. Start API (http://localhost:4000) and web app (http://localhost:5173)
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

API docs: <http://localhost:4000/api/docs>  
OpenAPI JSON: <http://localhost:4000/api/docs.json>  
Health check: <http://localhost:4000/api/v1/health>

### Primary administrator and demo cleanup

The normal seed is idempotent and creates **no user accounts**. It only upserts roles,
services, future time slots, and promotions.

Create or verify the single protected primary administrator:

```bash
npm run db:setup-admin -- --email admin@lrcmis.id
# Add --reset-password to rotate the password. It is printed once.
```

The account is marked `is_primary_admin` in the database. A unique partial index ensures only
one primary administrator can exist; database triggers prevent deleting it, deactivating it,
removing its admin role, or clearing its designation.

Accounts created by the old demo seed can be soft-deleted once with:

```bash
npm run db:cleanup-demo
```

That command is explicitly limited to the previous demo email allowlist. It preserves orders,
payments, reservations, and audit logs, and it never touches the primary administrator or
legitimate accounts.

The account-management screen is at **Admin → Kelola akun** (`/admin/akun`). Only the `admin`
role can access it; owner permissions are unchanged. Deletion is a soft delete: the account can
no longer sign in, existing sessions are rejected on the next request, and business history is
retained.


---

## 2. Docker Compose

```bash
# Optional: choose a strong secret
set JWT_SECRET=...            # Windows cmd
# export JWT_SECRET=...       # bash

docker compose up --build
```

- Web UI: <http://localhost:8080>
- API: <http://localhost:4000>
- PostgreSQL: `localhost:5433`

The API container runs `prisma migrate deploy` on start and, with `RUN_SEED=true` (default in
Compose), seeds reference data only. Create the primary administrator once:

```bash
docker compose run --rm seed
```

> `COOKIE_SECURE=false` is used for local HTTP. Set it to `true` and serve over HTTPS in
> production. The API refuses to start in production with example secrets, exposed reset tokens, or
> missing Resend email credentials.

> **Verification note:** the Compose files, Dockerfiles, and Nginx config are provided and internally
> consistent, but Docker was not available on the development machine, so `docker compose up --build`
> has not been executed here. The native npm workflow above is fully tested. Validate the Compose
> build once in your environment before relying on it for deployment.

---

## 3. Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | required |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | required |
| `JWT_EXPIRES_IN` | Session lifetime | `8h` |
| `PORT` | API port | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma-separated | `http://localhost:5173` |
| `COOKIE_SECURE` | Secure cookie flag | `false` |
| `BUSINESS_TIMEZONE` | Business calendar timezone | `Asia/Jakarta` |
| `MIN_WEIGHT_KG` | Minimum billable weight | `3` |
| `WEIGHT_ROUNDING_KG` | Weight rounding increment (up) | `0.5` |
| `DEFAULT_DELIVERY_FEE` | Pickup/delivery fee (IDR) | `5000` |
| `RESERVATION_CANCEL_CUTOFF_HOURS` | Customer cancellation cutoff | `2` |
| `EXPOSE_RESET_TOKEN` | Return password-reset token in dev | `false` |
| `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM` | Resend email adapter (required in production) | disabled in dev |
| `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` | Optional WhatsApp adapter | disabled |
| `PAYMENT_GATEWAY_KEY` | Reserved for gateway integration | disabled |

See `.env.example` at the repository root and `server/.env.example`.

---

## 4. Project structure

```text
.
├── client/
│   ├── src/
│   │   ├── components/        # UI primitives, tables, layout, shared widgets
│   │   ├── lib/               # API client, auth context, hooks, formats, Zod schemas, DTOs
│   │   ├── pages/
│   │   │   ├── public/        # Landing, services, how-it-works, contact, auth
│   │   │   ├── customer/      # Dashboard, reservations, orders, payments, vouchers, reviews, profile
│   │   │   ├── admin/         # Operations, catalog, slots, promos, complaints, reports, audit
│   │   │   ├── staff/         # Production board
│   │   │   ├── courier/       # Delivery task list and execution
│   │   │   └── shared/        # Role-aware order detail, notifications
│   │   ├── test/              # Vitest + Testing Library tests
│   │   └── App.tsx            # Route map with role guards
│   ├── nginx.conf
│   └── Dockerfile
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/            # env, constants, Prisma, OpenAPI
│   │   ├── controllers/       # HTTP layer
│   │   ├── middlewares/       # auth, RBAC, CSRF, validation, errors, rate limiting
│   │   ├── routes/            # /api/v1 route modules
│   │   ├── services/          # business rules and transactions
│   │   ├── validators/        # Zod request schemas
│   │   └── utils/             # money, datetime, codes, serializers, auth
│   ├── tests/                 # Vitest + Supertest integration suite
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 5. Functional coverage

### Public

- Landing page with services, process, featured reviews, and contact CTA
- Service catalog, how-it-works, contact
- Register, login, forgot/reset password (Resend email delivery; dev token display only when enabled)

### Customer

- Dashboard summary and active order tracking
- Reservation wizard: services → pickup method/address → slot → confirmation
- Reservation list with cancellation window enforcement
- Orders, order detail, price breakdown, payment status, timeline
- Payment history and instructions
- Promotion listing and voucher validation
- Reviews for completed orders, complaints with follow-ups
- Profile, address book, password change, notifications

### Admin

- Operational dashboard with revenue trend, queue widgets, quick reservation confirmation
- Reservations: filter, confirm, cancel, convert to order
- Orders: receive/weigh, apply voucher, assign staff, status transitions, internal notes, delivery tasks
- Payments: record cash/transfer, verify, reject, refund
- Delivery task assignment to couriers
- Customers: search, activate/deactivate, detail history
- Services, time slots, promotions
- Complaints and reviews
- Reports: revenue, orders, services, customers, operations, CSV export
- Audit log

### Staff

- Assigned production orders grouped by stage
- Status updates limited to authorized targets and assigned orders
- Order detail access is ownership-scoped

### Courier

- Assigned pickup/delivery tasks
- Accept → start → complete/fail transitions
- Handover recipient confirmation; order status auto-updates to `delivering`/`completed`
- Address snapshot and phone navigation link

### Owner

- Read-only business dashboard, reports, and CSV exports

---

## 6. Business rules implemented

1. **Slot capacity is concurrency-safe.** Reservation creation runs in a transaction with
   `SELECT ... FOR UPDATE` on the slot row, then counts pending/confirmed reservations. Concurrent
   requests cannot overbook the last seat (covered by an integration test).
2. **Price snapshots are immutable.** Order items store `serviceNameSnapshot` and `priceSnapshot`
   when the order is created from a reservation. Later service price edits do not change existing
   orders or billing after weighing.
3. **Weighing policy.** kg-based services require actual weight; billable weight is at least
   `MIN_WEIGHT_KG` and rounded **up** to `WEIGHT_ROUNDING_KG`. Non-kg quantities can be adjusted
   at reception. Pickup orders add the configured delivery fee.
4. **Payment idempotency.** Payment creation requires `Idempotency-Key`; repeated requests with the
   same key and payload return the original payment with `duplicate: true`. Cash is paid
   immediately; bank transfer is pending until admin verification. Overpayment is rejected.
5. **Order state machine.** Only defined transitions are accepted. `received` is reachable only
   through the reception/weighing endpoint; staff can only move assigned orders through production
   stages. Every change writes a history row.
6. **Reservation lifecycle.** Pending → confirmed → order, or cancelled/expired. Customers may not
   cancel inside the configured cutoff. Slots in the past rejected; expired reservations are swept
   by a background job and lazily at read time.
7. **Promotions.** Percentage/fixed discounts, minimum purchase, optional maximum discount, total
   quota, per-user limit, active window. Redemption is recorded in the same transaction as
   reception to avoid race conditions; expired/ineligible vouchers are rejected.
8. **RBAC and ownership.** Admin-only writes; owner read-only analytics; customer access scoped to
   own reservations/orders/payments/complaints; staff scoped to assigned orders; courier scoped to
   assigned tasks.
9. **Auditability.** Sensitive mutations write audit logs with actor, action, entity, metadata, IP,
   and timestamp. CSV exports are audited too.
10. **Timezone consistency.** Business dates and report buckets are computed in `Asia/Jakarta`.

---

## 7. API overview

Base path: `/api/v1`

| Area | Representative endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/csrf`, `POST /auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` |
| Public | `GET /services`, `/config`, `/reviews/featured` |
| Customer | `GET/POST /reservations`, `GET /reservations/me`, `PATCH /reservations/:id/cancel`, `GET /time-slots`, `GET /orders/me`, `GET /orders/:id`, `GET /payments/me`, `GET /promotions`, `POST /promotions/validate`, `GET/POST /complaints`, `GET /notifications/me` |
| Admin | `/dashboard`, `/reservations`, `/orders`, `/orders/:id/receive`, `/orders/:id/status`, `/orders/:id/payments`, `/payments`, `/delivery-tasks`, `/customers`, `/services`, `/time-slots`, `/promotions`, `/complaints`, `/reviews`, `/reports/*`, `/audit-logs` |
| Staff | `GET /staff/orders`, `GET /staff/orders/:id`, `PATCH /staff/orders/:id/status`, `POST /staff/orders/:id/notes` |
| Courier | `GET /courier/tasks`, `GET /courier/tasks/:id`, `PATCH /courier/tasks/:id/status` |

Responses use:

```json
{ "success": true, "data": {}, "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 1 } }
```

Errors use:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Input tidak valid", "details": [] } }
```

### Security model

- `lrcmis_token` HttpOnly JWT cookie (also accepts Bearer for tooling)
- `lrcmis_csrf` readable cookie + `X-CSRF-Token` header on unsafe methods (double submit)
- Login/register/password-reset bootstrap endpoints are exempt only before a CSRF cookie exists
- Helmet, CORS allow-list, JSON size limit, rate limiting on general/auth/reset endpoints
- Zod validation on params, query, and body; centralized error mapping
- Password hashes are bcrypt cost 12 and never serialized to clients

---

## 8. Database and extensions

Core entities: users/roles, addresses, services, time slots, reservations, orders, order items,
status history, payments, delivery tasks, promotions/redemptions, notifications, reviews, audit
logs.

The provided design document omits some tables required by its own workflows. These additions are
marked `EXT:` in `server/prisma/schema.prisma`:

- `reservation_items` — services selected during reservation
- `order_notes` — operational notes distinct from status history
- `complaint` / `complaint_follow_ups` — complaint module had no data-dictionary entity
- `password_reset_tokens` — secure reset workflow
- Payment `idempotency_key`, verification, and refund fields
- Order `assigned_staff_id` and notes
- Delivery task address/contact snapshots and handover fields
- Promotion `max_discount` and `per_user_limit`
- `UNIQUE(order_id, reference_code)` to prevent duplicate transfer references

Money uses `NUMERIC(12,2)`, primary keys use UUIDs, timestamps use `TIMESTAMPTZ`, and `@db.Date`
/`@db.Time` are used for slots.

---

## 9. Testing

Tests use a **real PostgreSQL test database** (`lrcmis_test`), not mocks.

```bash
# One-time
createdb -U postgres lrcmis_test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lrcmis_test?schema=public" npm run db:deploy -w server

# Run all tests
npm test

# Individual suites
npm run test -w server
npm run test -w client
```

Backend integration tests cover:

- wrong password / no hash leakage
- unauthenticated and forbidden access
- owner analytics vs. owner write denial
- field-level validation errors
- cross-customer order and payment access
- concurrent last-seat reservation capacity
- immutable price snapshots after changing service price
- invalid order transitions and unassigned staff writes
- duplicate payment idempotency and missing idempotency key
- revenue report period, CSV export, and empty-period structures
- expired/minimum-purchase voucher rules
- empty paginated results
- role-scoped courier/staff dashboards and audit-log access

Frontend tests cover IDR/date formatting, Zod validation schemas, and design-system rendering.

**Latest result:** backend **24 passed**, frontend **14 passed**.

Test configuration lives in `server/vitest.config.ts` and `client/vite.config.ts`; the backend
suite resets and seeds the test database itself.

---

## 10. Build and production notes

```bash
npm run build        # builds server and client
npm start            # runs the compiled API (server/dist/src/index.js)
```

Client output is `client/dist`. The API serves only `/api/*`; serve the SPA separately (Nginx
configuration is included) or via the Compose `web` service.

For production:

1. Use a strong random `JWT_SECRET` and `COOKIE_SECURE=true` behind HTTPS.
2. Set `EXPOSE_RESET_TOKEN=false` and configure a real email provider for reset delivery.
3. Restrict `CLIENT_ORIGIN` to the deployed web origin.
4. Run `prisma migrate deploy` as part of deployment.
5. Back up PostgreSQL and rotate credentials.

---

## 11. Ambiguities, assumptions, and limitations

- **Payment gateway:** bank transfer is recorded and manually verified; there is no live gateway
  integration or payment-proof upload. `PAYMENT_GATEWAY_KEY` is reserved.
- **Refunds:** recorded as an accounting state change; no external money movement is performed.
- **Notifications:** in-app notifications are persisted. Email (Resend) and WhatsApp adapters are
  optional and only dispatch when credentials are configured; notification channels are not
  retried by a background worker.
- **Delivery logistics:** address is free text with optional coordinates; the UI links to Google
  Maps search rather than performing route optimization.
- **Reservation vs. order:** reservation captures requested services; the actual bill is computed
  at reception/weighing because kg services cannot be priced before weighing. Non-kg services are
  snapshotted at order creation.
- **Cancellation cutoff** applies to customers only; admins may cancel reservations outside the
  window when no order exists.
- **Timezone:** `Asia/Jakarta` is treated as the single business timezone, as specified.
- **Reports** are scoped to the requested date range; “upcoming slots” and a few dashboard widgets
  intentionally look beyond the selected range to remain operationally useful.
- **No file storage:** the application does not accept image uploads; profile/address data and
  payment references are text fields.
- **Concurrency** is enforced for slot capacity, payment idempotency, reception, and task/order
  transitions through row locks. Other entities rely on Prisma transactions and unique constraints.

---

## 12. Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and web dev servers together |
| `npm run dev:server` / `dev:client` | Run one side |
| `npm run build` | Compile server and build client |
| `npm test` | Run backend and frontend tests |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply existing migrations |
| `npm run db:seed` | Seed reference data (idempotent, no demo users) |
| `npm run db:setup-admin` | Create/verify the protected primary administrator |
| `npm run db:cleanup-demo` | Soft-delete the old demo account allowlist |
| `npm run db:reset` | Reset database (destructive) |

---

## 13. Troubleshooting

- **`P1001` database unreachable:** confirm PostgreSQL is running and the port/credentials in
  `server/.env` are correct.
- **`Environment variable not found: DATABASE_URL`:** Prisma commands must run from `server/` or
  via the root scripts that set the workspace.
- **Cookies not stored:** use the frontend origin (`localhost:5173` or `localhost:8080`) rather than
  calling the API from a different site; check `CLIENT_ORIGIN` and `COOKIE_SECURE`.
- **`Token CSRF tidak valid`:** reload the app so the CSRF cookie is refreshed; unsafe requests must
  send the matching `X-CSRF-Token` header (the client API helper does this automatically).
- **Tests fail on a dirty database:** the backend suite truncates the `lrcmis_test` database at the
  start; never point `DATABASE_URL` at development data when running tests.
