import { prisma } from './db';

// Mock payment: 60% success, 20% failure, 20% hang (simulates gateway timeout)
export async function chargePayment(): Promise<'success' | 'failure' | 'hang'> {
  const delay = Math.random() * 500 + 200;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const rand = Math.random();
  if (rand < 0.6) return 'success';
  if (rand < 0.8) return 'failure';

  // Hang path — will be caught by expiry sweeper after hold expires
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return 'hang';
}

interface ResolvedPayment {
  jobId: string;
  orderId: string;
  productId: string;
  quantity: number;
  result: 'success' | 'failure';
}

const resolvedPaymentsQueue: ResolvedPayment[] = [];

let sweeperStarted = false;
let processorStarted = false;
let writerStarted = false;

export function startBackgroundWorker() {
  console.log('[Background Worker] Starting recursive background loops...');
  if (!sweeperStarted) { sweeperStarted = true; runExpirySweeper(); }
  if (!processorStarted) { processorStarted = true; runPaymentProcessor(); }
  if (!writerStarted) { writerStarted = true; runBatchWriter(); }
}

// ─── 1. Expiry Sweeper ───────────────────────────────────────────────────────
async function runExpirySweeper() {
  try {
    const now = new Date();
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: { in: ['reserved', 'payment_pending'] },
        expiresAt: { lte: now },
      },
    });

    if (expiredOrders.length > 0) {
      const byStatus = {
        reserved: expiredOrders.filter(o => o.status === 'reserved'),
        payment_pending: expiredOrders.filter(o => o.status === 'payment_pending'),
      };

      await prisma.$transaction(async (tx) => {
        for (const [status, orders] of Object.entries(byStatus)) {
          if (orders.length === 0) continue;

          const ids = orders.map(o => o.id);
          const newStatus = status === 'reserved' ? 'expired' : 'failed';

          const updated = await tx.order.updateMany({
            where: { id: { in: ids }, status },
            data: { status: newStatus },
          });

          if (updated.count > 0) {
            // Refund stock per product (orders may span multiple products)
            const byProduct = new Map<string, number>();
            for (const o of orders) {
              byProduct.set(o.productId, (byProduct.get(o.productId) ?? 0) + o.quantity);
            }
            for (const [productId, qty] of byProduct.entries()) {
              await tx.product.update({
                where: { id: productId },
                data: { available: { increment: qty } },
              });
            }

            await tx.job.updateMany({
              where: { orderId: { in: ids } },
              data: { status: 'done' },
            });

            console.log(`[Expiry Sweeper] ${newStatus} ${updated.count} orders (${status}). Refunded stock.`);
          }
        }
      });
    }
  } catch (err) {
    console.error('[Expiry Sweeper] Error:', err);
  } finally {
    setTimeout(runExpirySweeper, 500);
  }
}

// ─── 2. Payment Processor ────────────────────────────────────────────────────
async function runPaymentProcessor() {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'pending' },
      take: 15,
      include: { order: true },
    });

    const pendingJobs = jobs.filter(j => j.order.status === 'reserved');

    if (pendingJobs.length > 0) {
      const jobIds = pendingJobs.map(j => j.id);
      const orderIds = pendingJobs.map(j => j.orderId);

      await prisma.$transaction(async (tx) => {
        await tx.job.updateMany({
          where: { id: { in: jobIds }, status: 'pending' },
          data: { status: 'processing', attempts: { increment: 1 } },
        });
        await tx.order.updateMany({
          where: { id: { in: orderIds }, status: 'reserved' },
          data: { status: 'payment_pending' },
        });
      });

      for (const job of pendingJobs) {
        handlePayment(job.id, job.orderId, job.order.productId, job.order.quantity);
      }
    }
  } catch (err) {
    console.error('[Payment Processor] Error:', err);
  } finally {
    setTimeout(runPaymentProcessor, 300);
  }
}

// ─── 3. Batch Writer ─────────────────────────────────────────────────────────
async function runBatchWriter() {
  try {
    if (resolvedPaymentsQueue.length > 0) {
      const batch = resolvedPaymentsQueue.splice(0, resolvedPaymentsQueue.length);
      console.log(`[Payment Writer] Writing batch of ${batch.length}...`);

      try {
        await prisma.$transaction(async (tx) => {
          const orderIds = batch.map(b => b.orderId);
          const orders = await tx.order.findMany({ where: { id: { in: orderIds } } });
          const orderMap = new Map(orders.map(o => [o.id, o]));

          const confirmedIds: string[] = [];
          const failedItems: ResolvedPayment[] = [];
          const jobsToComplete: string[] = [];

          for (const item of batch) {
            const order = orderMap.get(item.orderId);
            if (order && order.status === 'payment_pending') {
              jobsToComplete.push(item.jobId);
              if (item.result === 'success') {
                confirmedIds.push(item.orderId);
              } else {
                failedItems.push(item);
              }
            } else {
              jobsToComplete.push(item.jobId);
            }
          }

          if (confirmedIds.length > 0) {
            await tx.order.updateMany({
              where: { id: { in: confirmedIds } },
              data: { status: 'confirmed' },
            });
            console.log(`[Payment Writer] Confirmed ${confirmedIds.length} orders.`);
          }

          if (failedItems.length > 0) {
            const failedIds = failedItems.map(i => i.orderId);
            await tx.order.updateMany({
              where: { id: { in: failedIds } },
              data: { status: 'failed' },
            });

            // Refund stock per product
            const byProduct = new Map<string, number>();
            for (const item of failedItems) {
              byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
            }
            for (const [productId, qty] of byProduct.entries()) {
              await tx.product.update({
                where: { id: productId },
                data: { available: { increment: qty } },
              });
            }
            console.log(`[Payment Writer] Failed ${failedIds.length} orders. Stock refunded.`);
          }

          if (jobsToComplete.length > 0) {
            await tx.job.updateMany({
              where: { id: { in: jobsToComplete } },
              data: { status: 'done' },
            });
          }
        });
      } catch (err) {
        console.error('[Payment Writer] Batch write error, re-queuing:', err);
        resolvedPaymentsQueue.unshift(...batch);
      }
    }
  } catch (err) {
    console.error('[Payment Writer] Loop error:', err);
  } finally {
    setTimeout(runBatchWriter, 200);
  }
}

async function handlePayment(
  jobId: string,
  orderId: string,
  productId: string,
  quantity: number
) {
  try {
    const result = await chargePayment();
    if (result === 'hang') {
      console.log(`[Payment Processor] Order ${orderId} hung. Sweeper will resolve.`);
      return;
    }
    resolvedPaymentsQueue.push({ jobId, orderId, productId, quantity, result });
  } catch (err) {
    console.error(`[Payment Processor] Error for order ${orderId}:`, err);
  }
}
