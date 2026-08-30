# RushHour — High-Concurrency Product Checkout System

RushHour is a local, high-concurrency product checkout system built as a single runnable Next.js App Router project. It models a flash sale scenario: **500 units across 8 products go on sale simultaneously**. Up to 5,000 buyers may attempt checkout in the same window. The system guarantees exactly 500 units are sold — never 501 — with zero double-charging, zero overselling, per-user rate limiting, and a fully async payment flow.

---

## Core Correctness Properties

1. **No Overselling** — Under peak concurrent load, available stock will never drop below zero. The 501st unit can never be sold, even if 5,000 requests hit the checkout endpoint at the exact same moment.
2. **Idempotency (No Double Charging)** — Multiple requests with the same `idempotencyKey` return the original order without creating a new one or decrementing stock again.
3. **Optimistic Holds with Automatic Release** — Checkout atomically reserves stock and sets a 90-second expiry. If payment fails or hangs past 90 seconds, the expiry sweeper transitions the order to `failed`/`expired` and refunds stock back to the pool — per product.
4. **Decoupled Request Path** — Checkout returns immediately with a `reserved` order ID. Payment execution is offloaded to a background job queue processed by recursive in-process workers.
5. **Per-User Rate Limiting** — A token-bucket rate limiter (capacity 5, refill 3/s) per `buyerId` rejects excessive burst requests with HTTP 429 and a `retryAfterMs` field so the buyer UI can show a real countdown.

---

## Technical Architecture

- **Next.js 16 & TypeScript**: App Router, API route handlers, server instrumentation for background workers.
- **SQLite (WAL Mode) & Prisma**: File-based database with Write-Ahead Logging (`connection_limit=1`, `busy_timeout=30000`) for serialized writes under concurrency.
- **Zod**: Request body validation on all POST endpoints.
- **In-process Async Mutex**: Wraps the check-and-decrement transaction so concurrent requests are serialised per product.
- **In-memory Token Bucket Rate Limiter**: Per `buyerId` — tracks `totalAllowed` and `totalBlocked` counts visible in the admin dashboard.
- **Background Worker Loops** (all use recursive `setTimeout`, never `setInterval`):
  - **Expiry Sweeper (500ms)** — Bulk-expires stalled `reserved`/`payment_pending` orders past `expiresAt`, refunds stock per `productId`, marks jobs done.
  - **Payment Processor (300ms)** — Batches 15 pending jobs, transitions orders to `payment_pending`, fires `chargePayment()` async (60% success / 20% fail / 20% 10s hang).
  - **Batch Writer (200ms)** — Drains in-memory result queue, writes confirmed/failed updates in one transaction, refunds stock per `productId` on failure.

---

## Product Catalogue

8 products, exactly **500 units total**:

| Product | Category | Price | Units |
|---|---|---|---|
| Sony WH-1000XM5 Headphones | Electronics | $349.99 | 80 |
| Nike Air Max 270 | Sneakers | $149.95 | 100 |
| MacBook Pro 14" M4 | Electronics | $1,999.00 | 30 |
| Lego Technic Bugatti Chiron | Collectibles | $449.99 | 40 |
| Dyson V15 Detect Vacuum | Home & Kitchen | $749.99 | 60 |
| PlayStation 5 Slim | Gaming | $449.99 | 50 |
| Patagonia Down Sweater | Apparel | $229.00 | 80 |
| Kindle Paperwhite Signature | Electronics | $189.99 | 60 |
| **Total** | | | **500** |

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Push Schema & Seed Products
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 3. Start Dev Server
```bash
npm run dev
```

| URL | Description |
|---|---|
| http://localhost:3000 | Buyer storefront — product grid with live stock |
| http://localhost:3000/admin | Admin dashboard (passcode: `admin123`) |

---

## Admin Dashboard

Passcode-gated at `/admin`. Auto-refreshes every 3 seconds. Three tabs:

- **Stock** — Per-product panel: available / confirmed sold / failed+expired / total, with fill bars.
- **Orders** — Filterable order log with product name, buyer ID, status badge, timestamp.
- **Rate Limits** — Top users by blocked requests; shows token balance, total allowed, total blocked, and block rate per buyer.

---

## Concurrency Load Simulation

Fires 5,000 checkout requests against the highest-stock product with concurrency 150. Then verifies DB integrity.

```bash
# Reset to fresh state first
npx tsx prisma/seed.ts

# Run simulation (server must be running)
npx tsx scripts/simulate-load.ts
```

### Verified Result (Nike Air Max 270 — 100 units, 5,000 requests):

```
✅ Simulation completed in 109.58s
   Orders created (200/201):  167
   Sold out (409):            4833
   Rate limited (429):        0
   Server errors:             0

   Total allocated (confirmed + reserved + pending): 100
   Is system correct? ✅ YES — NO OVERSELL
```

### What the simulation verifies:
- `confirmed + reserved + payment_pending` ≤ product stock total — always.
- Available stock never goes below `0`.
- Zero server errors under sustained concurrent load.

---

## Utility Scripts

| Script | Purpose |
|---|---|
| `npx tsx prisma/seed.ts` | Reset DB and reseed all 8 products (500 units total) |
| `npx tsx scripts/simulate-load.ts` | 5,000-request concurrency stress test |
| `npx tsx scripts/count.ts` | Quick DB inventory snapshot per product |
| `npx tsx scripts/audit-backend.ts` | 47-check backend API verification suite |
