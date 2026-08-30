interface TokenBucket {
  tokens: number;
  lastRefill: number;
  totalAllowed: number;
  totalBlocked: number;
}

// In-memory rate limiting map.
// Note: This resets on server restart and does not scale across multiple instances.
// In production, replace with a distributed store like Redis.
const globalForRateLimiter = global as unknown as { rateLimiterMap: Map<string, TokenBucket> };

export const rateLimiterMap =
  globalForRateLimiter.rateLimiterMap || new Map<string, TokenBucket>();

if (process.env.NODE_ENV !== 'production') globalForRateLimiter.rateLimiterMap = rateLimiterMap;

const CAPACITY = 5;             // Max burst tokens per user
const REFILL_RATE = 3 / 1000;  // 3 tokens per second (0.003 tokens/ms)

function getBucket(buyerId: string): TokenBucket {
  const now = Date.now();
  let bucket = rateLimiterMap.get(buyerId);

  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now, totalAllowed: 0, totalBlocked: 0 };
    rateLimiterMap.set(buyerId, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_RATE);
    bucket.lastRefill = now;
  }

  return bucket;
}

/**
 * Checks if a request from a given buyer is allowed under the rate limit.
 * Returns true if permitted, false if rate-limited.
 */
export function checkRateLimit(buyerId: string): boolean {
  const bucket = getBucket(buyerId);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    bucket.totalAllowed += 1;
    return true;
  }

  bucket.totalBlocked += 1;
  return false;
}

/**
 * Returns current rate-limit status and estimated retry time for a buyer.
 */
export function getRateLimitStatus(buyerId: string): {
  tokens: number;
  capacity: number;
  totalAllowed: number;
  totalBlocked: number;
  retryAfterMs: number;
} {
  const bucket = getBucket(buyerId);
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfterMs = tokensNeeded > 0 ? Math.ceil(tokensNeeded / REFILL_RATE) : 0;

  return {
    tokens: Math.floor(bucket.tokens),
    capacity: CAPACITY,
    totalAllowed: bucket.totalAllowed,
    totalBlocked: bucket.totalBlocked,
    retryAfterMs,
  };
}

/**
 * Returns a summary of all rate-limited users — for the admin dashboard.
 */
export function getRateLimitSummary(): Array<{
  buyerId: string;
  tokens: number;
  totalAllowed: number;
  totalBlocked: number;
}> {
  const result: ReturnType<typeof getRateLimitSummary> = [];
  const now = Date.now();

  for (const [buyerId, bucket] of rateLimiterMap.entries()) {
    const elapsed = now - bucket.lastRefill;
    const currentTokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_RATE);
    result.push({
      buyerId,
      tokens: Math.floor(currentTokens),
      totalAllowed: bucket.totalAllowed,
      totalBlocked: bucket.totalBlocked,
    });
  }

  // Sort by most blocked descending
  return result.sort((a, b) => b.totalBlocked - a.totalBlocked).slice(0, 50);
}
