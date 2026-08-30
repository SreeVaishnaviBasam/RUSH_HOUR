import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkoutMutex } from '@/lib/mutex';
import { checkRateLimit, getRateLimitStatus } from '@/lib/rateLimiter';

const checkoutSchema = z.object({
  buyerId: z.string().min(1, 'buyerId is required'),
  productId: z.string().min(1, 'productId is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  quantity: z.number().int().positive().max(10).optional().default(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validate request body with Zod
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { buyerId, productId, idempotencyKey, quantity } = parsed.data;

    // 2. Token-bucket rate limiting per buyerId
    const allowed = checkRateLimit(buyerId);
    if (!allowed) {
      const status = getRateLimitStatus(buyerId);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please slow down.',
          retryAfterMs: status.retryAfterMs,
        },
        { status: 429 }
      );
    }

    // 3. Acquire per-product mutex and run stock-reservation transaction
    const result = await checkoutMutex.runExclusive(async () => {
      return await prisma.$transaction(async (tx) => {
        // Idempotency: return existing order if key already used
        const existingOrder = await tx.order.findUnique({
          where: { idempotencyKey },
          include: { product: true },
        });

        if (existingOrder) {
          return {
            success: true,
            orderId: existingOrder.id,
            status: existingOrder.status,
            productName: existingOrder.product.name,
            alreadyExists: true,
            statusCode: 200,
          };
        }

        // Fetch the specific product by ID
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          return { success: false, error: 'Product not found', statusCode: 404 };
        }

        // Check available stock
        if (product.available < quantity) {
          return { success: false, error: 'Sold out', statusCode: 409 };
        }

        // Atomically decrement available stock
        await tx.product.update({
          where: { id: product.id },
          data: { available: { decrement: quantity } },
        });

        // Reserve for 90 seconds
        const expiresAt = new Date(Date.now() + 90 * 1000);

        const order = await tx.order.create({
          data: {
            productId: product.id,
            buyerId,
            quantity,
            status: 'reserved',
            idempotencyKey,
            expiresAt,
          },
        });

        await tx.job.create({
          data: { orderId: order.id, status: 'pending' },
        });

        return {
          success: true,
          orderId: order.id,
          status: order.status,
          productName: product.name,
          alreadyExists: false,
          statusCode: 201,
        };
      });
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json(
      {
        orderId: result.orderId,
        status: result.status,
        productName: result.productName,
      },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error('[API Checkout] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
