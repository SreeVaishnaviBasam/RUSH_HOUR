import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    // Aggregate confirmed sold quantity per product
    const confirmedByProduct = await prisma.order.groupBy({
      by: ['productId'],
      where: { status: 'confirmed' },
      _sum: { quantity: true },
    });

    const soldMap = new Map(
      confirmedByProduct.map((r) => [r.productId, r._sum.quantity ?? 0])
    );

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
      total: p.total,
      available: p.available,
      sold: soldMap.get(p.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API Stock] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
