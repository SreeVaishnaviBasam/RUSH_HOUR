import pptxgen from 'pptxgenjs';

const prs = new pptxgen();

// ─── Theme ───────────────────────────────────────────────────────────────────
const BG       = '07090f';
const SURFACE  = '0e1422';
const INDIGO   = '6366f1';
const VIOLET   = '8b5cf6';
const EMERALD  = '10b981';
const ROSE     = 'f43f5e';
const AMBER    = 'f59e0b';
const SKY      = '0ea5e9';
const MUTED    = '64748b';
const TEXT     = 'f1f5f9';
const SLATE    = '94a3b8';
const CODE_BG  = '060912';
const BORDER   = '1e293b';

prs.layout = 'LAYOUT_WIDE';
prs.theme = { headFontFace: 'Inter', bodyFontFace: 'Inter' };

function addBg(slide: pptxgen.Slide) {
  slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: BG } });
}

function chip(slide: pptxgen.Slide, text: string, x: number, y: number, color = INDIGO) {
  slide.addShape(prs.ShapeType.roundRect, { x, y, w: 3.5, h: 0.28, fill: { color: '0a0f1e' }, line: { color: color, width: 0.5 }, rectRadius: 0.06 });
  slide.addText(text, { x, y: y + 0.02, w: 3.5, h: 0.28, fontSize: 8, color: 'a5b4fc', fontFace: 'JetBrains Mono', align: 'center' });
}

function codeBox(slide: pptxgen.Slide, filename: string, lines: string, x: number, y: number, w: number, h: number) {
  // box
  slide.addShape(prs.ShapeType.rect, { x, y, w, h, fill: { color: CODE_BG }, line: { color: BORDER, width: 0.5 }, shadow: { type: 'outer', color: '000000', opacity: 0.4, blur: 8, offset: 2, angle: 45 } });
  // top bar
  slide.addShape(prs.ShapeType.rect, { x, y, w, h: 0.3, fill: { color: '0b0f1c' }, line: { color: BORDER, width: 0.5 } });
  // dots
  slide.addShape(prs.ShapeType.ellipse, { x: x + 0.15, y: y + 0.1, w: 0.1, h: 0.1, fill: { color: ROSE } });
  slide.addShape(prs.ShapeType.ellipse, { x: x + 0.3,  y: y + 0.1, w: 0.1, h: 0.1, fill: { color: AMBER } });
  slide.addShape(prs.ShapeType.ellipse, { x: x + 0.45, y: y + 0.1, w: 0.1, h: 0.1, fill: { color: EMERALD } });
  slide.addText(filename, { x: x + 0.6, y: y + 0.06, w: w - 0.7, h: 0.18, fontSize: 8, color: MUTED, fontFace: 'JetBrains Mono' });
  // code
  slide.addText(lines, { x: x + 0.18, y: y + 0.36, w: w - 0.28, h: h - 0.46, fontSize: 9, color: '94a3b8', fontFace: 'JetBrains Mono', valign: 'top', wrap: true });
}

function reqSlide(
  num: string, title: string,
  problem: string, solution: string,
  files: string[], codeFile: string, code: string,
  accentColor = INDIGO
) {
  const slide = prs.addSlide();
  addBg(slide);

  // Left column
  // Req number
  slide.addText(`REQUIREMENT  ${num}`, { x: 0.5, y: 0.35, w: 5.2, h: 0.2, fontSize: 9, color: MUTED, bold: true, charSpacing: 3 });

  // Title
  slide.addText(title, { x: 0.5, y: 0.6, w: 5.2, h: 1.0, fontSize: 28, bold: true, color: TEXT, charSpacing: -0.5 });

  // Problem box
  slide.addShape(prs.ShapeType.rect, { x: 0.5, y: 1.7, w: 5.2, h: 1.1, fill: { color: '1a0810' }, line: { color: '7f1d35', width: 0.5 } });
  slide.addText('THE PROBLEM', { x: 0.65, y: 1.78, w: 5.0, h: 0.18, fontSize: 7.5, color: ROSE, bold: true, charSpacing: 2 });
  slide.addText(problem, { x: 0.65, y: 1.98, w: 4.95, h: 0.75, fontSize: 11, color: SLATE, wrap: true, valign: 'top' });

  // Solution box
  slide.addShape(prs.ShapeType.rect, { x: 0.5, y: 2.92, w: 5.2, h: 1.5, fill: { color: '071a12' }, line: { color: '065f46', width: 0.5 } });
  slide.addText('THE SOLUTION', { x: 0.65, y: 3.0, w: 5.0, h: 0.18, fontSize: 7.5, color: EMERALD, bold: true, charSpacing: 2 });
  slide.addText(solution, { x: 0.65, y: 3.2, w: 4.95, h: 1.15, fontSize: 11, color: SLATE, wrap: true, valign: 'top' });

  // File chips
  let cy = 4.55;
  for (const f of files) {
    chip(slide, f, 0.5, cy, accentColor);
    cy += 0.36;
  }

  // Right column — code
  codeBox(slide, codeFile, code, 5.95, 0.3, 7.55, 5.15);

  return slide;
}

// ── SLIDE 1: COVER ────────────────────────────────────────────────────────────
const cover = prs.addSlide();
addBg(cover);

// Gradient accent bar
cover.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.06, fill: { type: 'solid', color: INDIGO } });

cover.addText('HACKATHON PROJECT  ·  RUSHHOUR', {
  x: 1.5, y: 0.8, w: 10.5, h: 0.3,
  fontSize: 10, color: '818cf8', bold: true, align: 'center', charSpacing: 4,
});

cover.addText('500 Units.\n5,000 Buyers.\n60 Seconds.', {
  x: 1.5, y: 1.2, w: 10.5, h: 2.6,
  fontSize: 56, bold: true, color: TEXT, align: 'center', charSpacing: -1.5,
  lineSpacingMultiple: 1.1,
});

cover.addText('A high-concurrency product checkout system that sells exactly 500 units,\ncharges nobody twice, and tells every buyer the truth — in real time.', {
  x: 2, y: 3.9, w: 9.5, h: 0.8,
  fontSize: 14, color: SLATE, align: 'center',
});

// Stat boxes
const stats = [
  { num: '500',   lbl: 'Units on sale',      col: '818cf8' },
  { num: '5,000', lbl: 'Concurrent buyers',  col: 'c084fc' },
  { num: '0',     lbl: 'Oversells',          col: EMERALD },
  { num: '47/47', lbl: 'Audit checks passed',col: AMBER   },
];
stats.forEach((s, i) => {
  const x = 1.2 + i * 3.0;
  cover.addShape(prs.ShapeType.rect, { x, y: 4.9, w: 2.5, h: 1.0, fill: { color: SURFACE }, line: { color: BORDER, width: 0.5 } });
  cover.addText(s.num, { x, y: 4.98, w: 2.5, h: 0.5, fontSize: 28, bold: true, color: s.col, align: 'center' });
  cover.addText(s.lbl, { x, y: 5.48, w: 2.5, h: 0.3, fontSize: 9,  color: MUTED, align: 'center' });
});

// ── SLIDE 2: NO OVERSELL ─────────────────────────────────────────────────────
reqSlide(
  '01', 'Never sell\nthe 501st unit',
  '5,000 requests arrive simultaneously. All read "1 unit left". All try to buy. Without protection: -4,999 stock.',
  'An async Mutex forces all checkouts through a single lane. Inside the lock, a single SQLite transaction checks AND decrements stock atomically. By the time request #101 gets in, stock is already 0 and it receives a 409 Sold Out.',
  ['📁  src/lib/mutex.ts', '📁  src/app/api/checkout/route.ts'],
  'checkout/route.ts',
`// Mutex: only 1 checkout at a time
const result = await checkoutMutex
  .runExclusive(async () => {
    return await prisma.$transaction(
      async (tx) => {

      // ① Check available stock
      const product = await tx.product
        .findUnique({ where: { id: productId }});

      if (product.available < quantity) {
        return { error: 'Sold out', status: 409 };
      }

      // ② Atomically decrement — no gap
      await tx.product.update({
        where: { id: product.id },
        data: { available: { decrement: qty }},
      });

      // ③ Create reserved order
      await tx.order.create({
        data: { productId, buyerId,
                status: 'reserved' }
      });
    });
  });`,
  INDIGO
);

// ── SLIDE 3: IDEMPOTENCY ─────────────────────────────────────────────────────
reqSlide(
  '02', 'Same request twice\n= one order',
  'Double-click, network retry, browser re-submit. Without protection: same buyer gets charged multiple times and stock drops twice.',
  'Every Buy click generates a UUID idempotency key. The database has a @unique constraint on it. If the same key arrives again, we return the existing order — no new charge, no stock decrement.',
  ['📁  prisma/schema.prisma', '📁  src/app/api/checkout/route.ts'],
  'schema.prisma + checkout/route.ts',
`// schema.prisma — DB-level constraint
model Order {
  idempotencyKey  String  @unique
  // DB rejects any duplicate insert
}


// checkout/route.ts — check before creating
const existing = await tx.order.findUnique({
  where: { idempotencyKey },
});

if (existing) {
  // Return original order — do NOT
  // touch stock or create anything new
  return {
    orderId: existing.id,
    status:  existing.status,
    alreadyExists: true,
    statusCode: 200,   // not 201
  };
}

// Only reaches here on first request
const order = await tx.order.create({...});`,
  VIOLET
);

// ── SLIDE 4: HOLD & RELEASE ──────────────────────────────────────────────────
reqSlide(
  '03', 'Hold stock,\nrelease if stall',
  'A buyer starts checkout, payment hangs, browser closes. Without recovery, that stock is permanently locked — unsellable to anyone else.',
  'On checkout, we stamp expiresAt = now + 90 seconds. A background Expiry Sweeper runs every 500ms, finds expired orders, marks them expired/failed, and returns stock to the pool — all in one atomic transaction.',
  ['📁  src/lib/worker.ts → runExpirySweeper()'],
  'src/lib/worker.ts',
`async function runExpirySweeper() {
  try {
    const expired = await prisma.order.findMany({
      where: {
        status: { in: ['reserved','payment_pending'] },
        expiresAt: { lte: new Date() }, // past deadline
      },
    });

    await prisma.$transaction(async (tx) => {
      // Mark orders expired
      await tx.order.updateMany({
        where: { id: { in: ids } },
        data:  { status: 'expired' },
      });

      // Return stock per product
      for (const [productId, qty] of byProduct) {
        await tx.product.update({
          where: { id: productId },
          data:  { available: { increment: qty } },
        });
      }
    }); // atomic — both or neither
  } finally {
    setTimeout(runExpirySweeper, 500); // recursive
  }
}`,
  AMBER
);

// ── SLIDE 5: PAYMENT FAIL ────────────────────────────────────────────────────
reqSlide(
  '04 + 05', 'Payments fail & hang.\nState recovers cleanly.',
  'Real payment gateways fail 20% of the time and hang indefinitely another 20%. Both must result in clean stock recovery — never corrupted state.',
  'chargePayment() returns success 60%, failure 20%, hangs 10s (20%). The Batch Writer refunds stock AND marks order failed in the same DB transaction. Hangs are caught by the Expiry Sweeper after 90s.',
  ['📁  src/lib/worker.ts → chargePayment()', '📁  src/lib/worker.ts → runBatchWriter()'],
  'src/lib/worker.ts',
`// Mock payment gateway
async function chargePayment() {
  const rand = Math.random();
  if (rand < 0.6) return 'success'; // 60%
  if (rand < 0.8) return 'failure'; // 20%
  await sleep(10000); // 20% hang → sweeper resolves
}


// Batch Writer — failure path
if (failedItems.length > 0) {
  // ① mark failed
  await tx.order.updateMany({
    where: { id: { in: failedIds } },
    data:  { status: 'failed' },
  });

  // ② refund stock per product
  for (const [productId, qty] of byProduct) {
    await tx.product.update({
      where: { id: productId },
      data:  { available: { increment: qty } },
    });
  }
  // Both in same transaction → atomic
  // Can never fail halfway
}`,
  ROSE
);

// ── SLIDE 6: ASYNC WORKERS ──────────────────────────────────────────────────
reqSlide(
  '06', 'Slow work off\nthe request path',
  'Payment takes 200–700ms (or 10 seconds if it hangs). Making the buyer wait for that blocks the server and kills the experience.',
  'Checkout returns in <100ms with a reserved order ID. Three recursive background loops handle everything else — expiry, payment, and batch writes. All use setTimeout (not setInterval) so slow DB writes never stack up.',
  ['📁  src/lib/worker.ts', '📁  src/instrumentation.ts'],
  'background loop architecture',
`POST /api/checkout response path:
  ① mutex lock
  ② check + decrement stock
  ③ create order (status: reserved)
  ④ create background job
  ⑤ return orderId    ← <100ms


Background loops (never block API):

  Expiry Sweeper   [every 500ms]
    finds expired holds → refunds stock

  Payment Processor  [every 300ms]
    picks pending jobs → fires chargePayment()

  Batch Writer  [every 200ms]
    drains in-memory queue → bulk DB writes


Key: all use setTimeout (recursive)
} finally {
  setTimeout(runPaymentProcessor, 300);
  // waits for DB before next cycle
}`,
  SKY
);

// ── SLIDE 7: LIVE UI ────────────────────────────────────────────────────────
reqSlide(
  '07', 'Live buyer screen\nwith honest status',
  'The buyer needs real-time feedback. Status changes happen in the background. How does the UI stay honest without lying or going stale?',
  'Stock bars poll /api/stock every 2 seconds. After checkout, an order status card polls /api/orders/[id] every 1 second until a terminal state. All reads are direct DB queries — no cache, never stale. A hold countdown timer shows seconds until expiry.',
  ['📁  src/app/page.tsx', '📁  src/app/api/orders/[id]/route.ts'],
  'src/app/page.tsx',
`// Stock polling — all 8 products every 2s
useEffect(() => {
  fetchStock();
  const id = setInterval(fetchStock, 2000);
  return () => clearInterval(id);
}, [fetchStock]);


// Order status — 1s until terminal state
const terminals = new Set([
  'confirmed', 'failed', 'expired'
]);

if (!terminals.has(order.status)) {
  intervals[productId] = setInterval(async () => {
    const res  = await fetch(
      \`/api/orders/\${order.orderId}\`
    );
    const data = await res.json();
    // Update immediately — direct DB read
    setActiveOrders(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        status: data.status,
      }
    }));
  }, 1000);
}`,
  EMERALD
);

// ── SLIDE 8: RATE LIMIT ─────────────────────────────────────────────────────
reqSlide(
  '08', 'Rate limit\nper user',
  'A bot or angry buyer spams Buy 1,000 times a second, clogging the mutex queue and potentially gaming the system.',
  'Token Bucket per buyerId. Capacity 5 tokens (burst), refilling at 3/second. Each checkout costs 1 token. Empty bucket → HTTP 429 with exact retryAfterMs so the UI shows a live countdown. Admin sees who has been blocked most.',
  ['📁  src/lib/rateLimiter.ts', 'Capacity: 5 tokens  ·  Refill: 3/sec'],
  'src/lib/rateLimiter.ts',
`const CAPACITY    = 5;
const REFILL_RATE = 3 / 1000; // 3 tokens/sec

export function checkRateLimit(buyerId) {
  const now = Date.now();
  let bucket = rateLimiterMap.get(buyerId);

  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    rateLimiterMap.set(buyerId, bucket);
  } else {
    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(
      CAPACITY,
      bucket.tokens + elapsed * REFILL_RATE
    );
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;   // ✅ request allowed
  }
  return false;    // 🚫 → HTTP 429
}`,
  VIOLET
);

// ── SLIDE 9: ADMIN ──────────────────────────────────────────────────────────
reqSlide(
  '09', 'Admin view:\norders, failures, stock',
  'The team needs real-time visibility — how much stock is left per product, which orders failed, and is anyone abusing the system?',
  'Passcode-gated dashboard at /admin (passcode: admin123) auto-refreshing every 3 seconds. One API call returns orders + status counts + per-product stock stats + rate-limit abuse table. Three tabs: Stock, Orders, Rate Limits.',
  ['📁  src/app/admin/page.tsx', '📁  src/app/api/admin/orders/route.ts', '🔑  passcode: admin123'],
  'Admin dashboard — 3 tabs',
`STOCK TAB
  Nike Air Max 270
  ████████████░░░  84 sold / 100 total
  Available: 16   Confirmed: 84   Failed: 12

  Sony WH-1000XM5
  ██░░░░░░░░░░░░░  12 sold / 80 total
  Available: 68   Confirmed: 12   Failed: 4

  ... (all 8 products)


ORDERS TAB
  Filter: all / confirmed / failed / expired
  ┌───────────┬──────────┬───────────┐
  │ Product   │ Buyer    │ Status    │
  │ Nike Air… │ buyer_x  │ confirmed │
  │ MacBook…  │ buyer_y  │ failed    │
  └───────────┴──────────┴───────────┘


RATE LIMITS TAB
  buyer_abc  blocked: 47  tokens: ██░░░
  buyer_xyz  blocked: 31  tokens: █░░░░`,
  AMBER
);

// ── SLIDE 10: PROOF ─────────────────────────────────────────────────────────
const proof = prs.addSlide();
addBg(proof);

proof.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.06, fill: { color: EMERALD } });

proof.addText('THE PROOF', { x: 1.5, y: 0.4, w: 10.5, h: 0.25, fontSize: 10, color: MUTED, bold: true, align: 'center', charSpacing: 4 });
proof.addText('5,000 requests.\nNot one oversell.', { x: 1.5, y: 0.7, w: 10.5, h: 1.4, fontSize: 42, bold: true, color: TEXT, align: 'center', charSpacing: -1 });

// Terminal box
proof.addShape(prs.ShapeType.rect, { x: 1.8, y: 2.15, w: 9.9, h: 3.5, fill: { color: CODE_BG }, line: { color: BORDER, width: 0.5 } });
proof.addShape(prs.ShapeType.rect, { x: 1.8, y: 2.15, w: 9.9, h: 0.28, fill: { color: '0b0f1c' }, line: { color: BORDER, width: 0.5 } });
proof.addShape(prs.ShapeType.ellipse, { x: 1.95, y: 2.24, w: 0.1, h: 0.1, fill: { color: ROSE } });
proof.addShape(prs.ShapeType.ellipse, { x: 2.10, y: 2.24, w: 0.1, h: 0.1, fill: { color: AMBER } });
proof.addShape(prs.ShapeType.ellipse, { x: 2.25, y: 2.24, w: 0.1, h: 0.1, fill: { color: EMERALD } });
proof.addText('terminal', { x: 2.4, y: 2.2, w: 3, h: 0.2, fontSize: 8, color: MUTED, fontFace: 'JetBrains Mono' });

proof.addText(
`$ npx tsx scripts/simulate-load.ts

🎯 Target: "Nike Air Max 270" — 100 units / 100 total
   Firing 5,000 requests at concurrency 150...

✅ Simulation completed in 109.58s
   Orders created (200/201):    167
   Sold out (409):             4,833
   Server errors:                  0

   Confirmed:           91
   Payment pending:      9        ← still processing
   Reserved hold:        0
   Failed (refunded):   67        ← stock returned to pool

   Total allocated:    100        ← exactly 100, never 101
   Is system correct? ✅ YES — NO OVERSELL`,
  { x: 2.0, y: 2.5, w: 9.5, h: 3.1, fontSize: 10.5, color: '94a3b8', fontFace: 'JetBrains Mono', valign: 'top' }
);

// Verdict
proof.addShape(prs.ShapeType.rect, { x: 3.5, y: 5.8, w: 6.5, h: 0.5, fill: { color: '071a12' }, line: { color: EMERALD, width: 0.8 } });
proof.addText('Backend audit: 47 / 47 checks passed  ✓', { x: 3.5, y: 5.88, w: 6.5, h: 0.3, fontSize: 13, bold: true, color: EMERALD, align: 'center' });

// ── SLIDE 11: TECH STACK ────────────────────────────────────────────────────
const stack = prs.addSlide();
addBg(stack);

stack.addText('TECH STACK', { x: 1, y: 0.3, w: 11.5, h: 0.25, fontSize: 10, color: MUTED, bold: true, align: 'center', charSpacing: 4 });
stack.addText('Every choice was deliberate', { x: 1, y: 0.6, w: 11.5, h: 0.6, fontSize: 32, bold: true, color: TEXT, align: 'center' });

const cards = [
  { icon: '⚡', name: 'Next.js 16', why: 'App Router + API routes + server instrumentation to start background workers on boot' },
  { icon: '🗄️', name: 'SQLite + WAL Mode', why: 'connection_limit=1 eliminates database busy errors under concurrent writes' },
  { icon: '🔒', name: 'Async Mutex', why: 'Serialises the check-and-decrement. Only way to guarantee no oversell in a single process' },
  { icon: '🔑', name: 'Idempotency Keys', why: 'UUID per click + DB UNIQUE constraint. No double charge — guaranteed at the database layer' },
  { icon: '♻️', name: 'setTimeout Loops', why: 'Not setInterval. Each loop waits for the previous DB operation — no backpressure buildup' },
  { icon: '🛡️', name: 'Token Bucket', why: 'In-memory per-user rate limiter with retryAfterMs. Fast, zero-dependency, visible in admin' },
];

cards.forEach((c, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.5 + col * 4.4;
  const y = 1.5 + row * 2.3;

  stack.addShape(prs.ShapeType.rect, { x, y, w: 4.1, h: 2.0, fill: { color: SURFACE }, line: { color: BORDER, width: 0.5 } });
  stack.addText(c.icon, { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.4, fontSize: 20 });
  stack.addText(c.name, { x: x + 0.2, y: y + 0.62, w: 3.7, h: 0.3, fontSize: 13, bold: true, color: TEXT });
  stack.addText(c.why, { x: x + 0.2, y: y + 0.95, w: 3.7, h: 0.9, fontSize: 10, color: SLATE, wrap: true, valign: 'top' });
});

// ── Save ─────────────────────────────────────────────────────────────────────
await prs.writeFile({ fileName: 'RushHour_Presentation.pptx' });
console.log('✅  RushHour_Presentation.pptx created successfully!');
