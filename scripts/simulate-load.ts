/**
 * RushHour Load Simulation
 * Fires 5,000 concurrent checkout requests at a single product
 * and verifies no overselling occurred.
 */

const TOTAL_REQUESTS = 5000;
const CONCURRENCY    = 150;
const BASE_URL       = "http://localhost:3000";

async function runSimulation() {
  // 1. Discover products and pick the highest-stock one to stress-test
  const stockRes = await fetch(`${BASE_URL}/api/stock`);
  if (!stockRes.ok) {
    console.error("Cannot reach /api/stock — is the server running?");
    process.exit(1);
  }
  const products: Array<{ id: string; name: string; total: number; available: number }> =
    await stockRes.json();

  const target = products.reduce((best, p) => (p.total > best.total ? p : best), products[0]);
  console.log(`\n🎯 Target product: "${target.name}" — ${target.available} available / ${target.total} total`);
  console.log(`Starting load simulation: ${TOTAL_REQUESTS} requests, concurrency ${CONCURRENCY}\n`);

  let completedRequests = 0;
  let index = 0;

  const results = { success: 0, rateLimited: 0, soldOut: 0, errors: 0, other: 0 };
  const startTime = Date.now();

  const runNext = async (): Promise<void> => {
    if (index >= TOTAL_REQUESTS) return;
    const currentId = index++;

    const buyerId       = `sim_buyer_${currentId}`;
    const idempotencyKey = `sim_key_${currentId}_${Math.random().toString(36).substring(2)}`;

    try {
      const res = await fetch(`${BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId, productId: target.id, idempotencyKey, quantity: 1 }),
      });

      if (res.status === 201 || res.status === 200) results.success++;
      else if (res.status === 429) results.rateLimited++;
      else if (res.status === 409) results.soldOut++;
      else results.other++;
    } catch {
      results.errors++;
    } finally {
      completedRequests++;
      if (completedRequests % 500 === 0)
        console.log(`  Progress: ${completedRequests}/${TOTAL_REQUESTS}...`);
      await runNext();
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, runNext);
  await Promise.all(workers);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Simulation completed in ${duration}s`);
  console.log(`   Orders created (200/201):  ${results.success}`);
  console.log(`   Sold out (409):            ${results.soldOut}`);
  console.log(`   Rate limited (429):        ${results.rateLimited}`);
  console.log(`   Server errors:             ${results.errors}`);
  console.log(`   Other:                     ${results.other}`);

  // 2. Verify DB integrity
  console.log("\n🔍 Verifying database integrity...");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const product = await prisma.product.findUnique({ where: { id: target.id } });
  const confirmed      = await prisma.order.count({ where: { productId: target.id, status: "confirmed" } });
  const reserved       = await prisma.order.count({ where: { productId: target.id, status: "reserved" } });
  const paymentPending = await prisma.order.count({ where: { productId: target.id, status: "payment_pending" } });
  const failed         = await prisma.order.count({ where: { productId: target.id, status: "failed" } });
  const expired        = await prisma.order.count({ where: { productId: target.id, status: "expired" } });

  await prisma.$disconnect();

  const totalAllocated = confirmed + reserved + paymentPending;
  const isCorrect      = totalAllocated <= target.total;

  console.log(`\n   Product: ${product?.name}`);
  console.log(`   Stock available: ${product?.available} / ${product?.total}`);
  console.log(`   ── Order breakdown ──`);
  console.log(`   Confirmed:       ${confirmed}`);
  console.log(`   Reserved hold:   ${reserved}`);
  console.log(`   Payment pending: ${paymentPending}`);
  console.log(`   Failed:          ${failed}`);
  console.log(`   Expired:         ${expired}`);
  console.log(`\n   Total allocated (confirmed + reserved + pending): ${totalAllocated}`);
  console.log(`   Is system correct? ${isCorrect ? "✅ YES — NO OVERSELL" : "❌ NO — OVERSELL DETECTED!"}`);
  if (!isCorrect) process.exit(1);
}

runSimulation().catch((e) => { console.error(e); process.exit(1); });
