import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRateLimitSummary } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;

    // Authorization
    const expectedPasscode = process.env.ADMIN_PASSCODE || 'admin123';
    const providedPasscode =
      req.headers.get('x-admin-passcode') || searchParams.get('passcode');

    if (providedPasscode !== expectedPasscode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Recent orders with product info
    const orders = await prisma.order.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        product: { select: { id: true, name: true, price: true, category: true } },
      },
    });

    // Status counts
    const countGroups = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusCounts = {
      confirmed: 0,
      failed: 0,
      expired: 0,
      reserved: 0,
      payment_pending: 0,
    };

    countGroups.forEach((item) => {
      if (item.status in statusCounts) {
        statusCounts[item.status as keyof typeof statusCounts] = item._count.id;
      }
    });

    // Per-product stock summary
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    const confirmedByProduct = await prisma.order.groupBy({
      by: ['productId'],
      where: { status: 'confirmed' },
      _sum: { quantity: true },
    });

    const failedByProduct = await prisma.order.groupBy({
      by: ['productId'],
      where: { status: { in: ['failed', 'expired'] } },
      _count: { id: true },
    });

    const soldMap = new Map(confirmedByProduct.map((r) => [r.productId, r._sum.quantity ?? 0]));
    const failedMap = new Map(failedByProduct.map((r) => [r.productId, r._count.id]));

    const productStats = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      total: p.total,
      available: p.available,
      sold: soldMap.get(p.id) ?? 0,
      failed: failedMap.get(p.id) ?? 0,
    }));

    // Rate limit abuse summary
    const rateLimitSummary = getRateLimitSummary();

    return NextResponse.json({
      orders,
      counts: statusCounts,
      productStats,
      rateLimitSummary,
    });
  } catch (error) {
    console.error('[API Admin Orders] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
