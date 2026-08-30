import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const count = await prisma.order.count();
  const confirmed = await prisma.order.count({ where: { status: 'confirmed' } });
  const reserved = await prisma.order.count({ where: { status: 'reserved' } });
  const pending = await prisma.order.count({ where: { status: 'payment_pending' } });
  const failed = await prisma.order.count({ where: { status: 'failed' } });
  const expired = await prisma.order.count({ where: { status: 'expired' } });

  console.log('--- GLOBAL COUNTS ---');
  console.log(`Total Orders: ${count}`);
  console.log(`Confirmed:    ${confirmed}`);
  console.log(`Reserved:     ${reserved}`);
  console.log(`Pending:      ${pending}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Expired:      ${expired}`);
  console.log('');

  console.log('--- PRODUCT STOCK ---');
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  for (const p of products) {
    const prodConfirmed = await prisma.order.count({ where: { productId: p.id, status: 'confirmed' } });
    const prodReserved = await prisma.order.count({ where: { productId: p.id, status: 'reserved' } });
    const prodPending = await prisma.order.count({ where: { productId: p.id, status: 'payment_pending' } });
    const totalAllocated = prodConfirmed + prodReserved + prodPending;
    
    console.log(`- ${p.name} (${p.category}):`);
    console.log(`  Stock: ${p.available} available / ${p.total} total (Allocated: ${totalAllocated})`);
  }
}

run().finally(() => prisma.$disconnect());
