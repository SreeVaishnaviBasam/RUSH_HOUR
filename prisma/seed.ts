import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Total: 500 units across 8 products — matching the flash-sale scenario exactly
const PRODUCTS = [
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Industry-leading noise cancellation with 30-hour battery life and crystal-clear call quality.',
    price: 349.99,
    imageUrl: '',
    category: 'Electronics',
    total: 80,   // 80
  },
  {
    name: 'Nike Air Max 270',
    description: 'Maximum cushioning with the tallest Air unit yet for all-day comfort and bold style.',
    price: 149.95,
    imageUrl: '',
    category: 'Sneakers',
    total: 100,  // +100 = 180
  },
  {
    name: 'MacBook Pro 14" M4',
    description: 'Supercharged by the M4 chip. Up to 22 hours of battery life. Built for pros.',
    price: 1999.00,
    imageUrl: '',
    category: 'Electronics',
    total: 30,   // +30 = 210
  },
  {
    name: 'Lego Technic Bugatti Chiron',
    description: 'A masterpiece in Lego engineering — 3,599 pieces, full suspension, detailed W16 engine.',
    price: 449.99,
    imageUrl: '',
    category: 'Collectibles',
    total: 40,   // +40 = 250
  },
  {
    name: 'Dyson V15 Detect Vacuum',
    description: 'Laser dust detection and intelligent reporting. The most powerful cordless vacuum ever built.',
    price: 749.99,
    imageUrl: '',
    category: 'Home & Kitchen',
    total: 60,   // +60 = 310
  },
  {
    name: 'PlayStation 5 Slim',
    description: 'Experience lightning-fast loading, breathtaking immersive gaming, and next-gen haptics.',
    price: 449.99,
    imageUrl: '',
    category: 'Gaming',
    total: 50,   // +50 = 360
  },
  {
    name: 'Patagonia Down Sweater',
    description: 'Premium 800-fill-power down for warmth in a lightweight, packable design. Recycled materials.',
    price: 229.00,
    imageUrl: '',
    category: 'Apparel',
    total: 80,   // +80 = 440
  },
  {
    name: 'Kindle Paperwhite Signature',
    description: 'The thinnest, lightest Kindle. Auto-adjusting front light with wireless charging.',
    price: 189.99,
    imageUrl: '',
    category: 'Electronics',
    total: 60,   // +60 = 500 ✓
  },
];

async function main() {
  console.log('Clearing existing data...');
  await prisma.job.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  console.log('Seeding products...');
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: { ...p, available: p.total },
    });
    console.log(`  ✓ ${product.name} — ${product.total} units @ $${product.price}`);
  }

  console.log(`\nSeeded ${PRODUCTS.length} products successfully.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
