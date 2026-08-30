"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  total: number;
  available: number;
  sold: number;
}

interface ActiveOrder {
  orderId: string;
  productId: string;
  productName: string;
  status: "reserved" | "payment_pending" | "confirmed" | "failed" | "expired";
  expiresAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Electronics: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Sneakers: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Collectibles: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Gaming: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Home & Kitchen": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Apparel: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  General: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const CATEGORY_ICON: Record<string, string> = {
  Electronics: "🎧",
  Sneakers: "👟",
  Collectibles: "🧩",
  Gaming: "🎮",
  "Home & Kitchen": "🏠",
  Apparel: "🧥",
  General: "📦",
};

function statusConfig(status: ActiveOrder["status"]) {
  switch (status) {
    case "reserved":
      return {
        label: "Reserved",
        desc: "Stock secured — processing payment...",
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "bg-amber-950/30",
        dot: "bg-amber-400",
        pulse: true,
      };
    case "payment_pending":
      return {
        label: "Payment Pending",
        desc: "Connecting to payment gateway...",
        color: "text-sky-400",
        border: "border-sky-500/30",
        bg: "bg-sky-950/30",
        dot: "bg-sky-400",
        pulse: true,
      };
    case "confirmed":
      return {
        label: "Confirmed",
        desc: "Payment successful — it's yours! 🎉",
        color: "text-emerald-400",
        border: "border-emerald-500/30",
        bg: "bg-emerald-950/30",
        dot: "bg-emerald-400",
        pulse: false,
      };
    case "failed":
      return {
        label: "Payment Failed",
        desc: "Payment declined. Stock has been released.",
        color: "text-rose-400",
        border: "border-rose-500/30",
        bg: "bg-rose-950/30",
        dot: "bg-rose-400",
        pulse: false,
      };
    case "expired":
      return {
        label: "Expired",
        desc: "Hold timed out. Stock returned to pool.",
        color: "text-slate-400",
        border: "border-slate-600/30",
        bg: "bg-slate-900/50",
        dot: "bg-slate-500",
        pulse: false,
      };
  }
}

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(p);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuyerPage() {
  const [buyerId, setBuyerId] = useState("");

  // Generate client-only ID after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    setBuyerId("buyer_" + Math.random().toString(36).substring(2, 9));
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Map of productId → active order
  const [activeOrders, setActiveOrders] = useState<
    Record<string, ActiveOrder>
  >({});
  // Map of productId → in-flight
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});
  // Map of productId → error
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Map of productId → rate limit retry countdown ms
  const [rateLimitMs, setRateLimitMs] = useState<Record<string, number>>({});

  const countdownRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ── Stock polling (all products, every 2s) ──────────────────────────────
  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch("/api/stock");
      if (res.ok) {
        const data: Product[] = await res.json();
        setProducts(data);
        setLoadingProducts(false);
      }
    } catch {
      // silent — will retry
    }
  }, []);

  useEffect(() => {
    fetchStock();
    const id = setInterval(fetchStock, 2000);
    return () => clearInterval(id);
  }, [fetchStock]);

  // ── Active order polling (per order, every 1s until terminal) ──────────
  useEffect(() => {
    const terminals = new Set(["confirmed", "failed", "expired"]);
    const intervals: Record<string, NodeJS.Timeout> = {};

    for (const [productId, order] of Object.entries(activeOrders)) {
      if (terminals.has(order.status)) continue;

      intervals[productId] = setInterval(async () => {
        try {
          const res = await fetch(`/api/orders/${order.orderId}`);
          if (res.ok) {
            const data = await res.json();
            setActiveOrders((prev) => ({
              ...prev,
              [productId]: {
                ...prev[productId],
                status: data.status,
                expiresAt: data.expiresAt,
              },
            }));
          }
        } catch {
          // silent
        }
      }, 1000);
    }

    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [activeOrders]);

  // ── Rate-limit countdown ────────────────────────────────────────────────
  const startRateLimitCountdown = (productId: string, ms: number) => {
    setRateLimitMs((prev) => ({ ...prev, [productId]: ms }));
    if (countdownRef.current[productId])
      clearInterval(countdownRef.current[productId]);

    countdownRef.current[productId] = setInterval(() => {
      setRateLimitMs((prev) => {
        const remaining = (prev[productId] ?? 0) - 200;
        if (remaining <= 0) {
          clearInterval(countdownRef.current[productId]);
          const next = { ...prev };
          delete next[productId];
          return next;
        }
        return { ...prev, [productId]: remaining };
      });
    }, 200);
  };

  // ── Checkout handler ────────────────────────────────────────────────────
  const handleBuy = async (product: Product) => {
    if (inFlight[product.id]) return;

    setErrors((p) => { const n = { ...p }; delete n[product.id]; return n; });
    setInFlight((p) => ({ ...p, [product.id]: true }));

    const idempotencyKey =
      "key_" + product.id + "_" + Math.random().toString(36).substring(2) + Date.now();

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          productId: product.id,
          idempotencyKey,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        startRateLimitCountdown(product.id, data.retryAfterMs ?? 2000);
        setErrors((p) => ({
          ...p,
          [product.id]: "Too many requests — slow down.",
        }));
        return;
      }

      if (!res.ok) {
        setErrors((p) => ({
          ...p,
          [product.id]: data.error ?? "Checkout failed.",
        }));
        return;
      }

      setActiveOrders((prev) => ({
        ...prev,
        [product.id]: {
          orderId: data.orderId,
          productId: product.id,
          productName: data.productName ?? product.name,
          status: data.status,
          expiresAt: new Date(Date.now() + 90_000).toISOString(),
        },
      }));
    } catch {
      setErrors((p) => ({ ...p, [product.id]: "Network error. Try again." }));
    } finally {
      setInFlight((p) => ({ ...p, [product.id]: false }));
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const totalAvailable = products.reduce((s, p) => s + p.available, 0);
  const totalUnits = products.reduce((s, p) => s + p.total, 0);
  const totalSold = products.reduce((s, p) => s + p.sold, 0);

  const terminalStatuses = new Set(["confirmed", "failed", "expired"]);

  return (
    <div className="min-h-screen bg-[#080b14] text-white">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-20 bg-[#080b14]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-black">
              R
            </div>
            <span className="text-lg font-bold tracking-tight">
              Rush<span className="text-indigo-400">Hour</span>
            </span>
            <span className="hidden sm:inline text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">
              Flash Sale
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            {loadingProducts ? (
              <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
            ) : (
              <>
                <div className="text-center hidden sm:block">
                  <p className="text-white font-bold">{totalAvailable}</p>
                  <p className="text-xs text-slate-500">Available</p>
                </div>
                <div className="text-center hidden sm:block">
                  <p className="text-indigo-400 font-bold">{totalSold}</p>
                  <p className="text-xs text-slate-500">Sold</p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 font-bold">{totalUnits}</p>
                  <p className="text-xs text-slate-500">Total Units</p>
                </div>
                {/* Live dot */}
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              </>
            )}
          </div>
        </div>

        {/* Global stock bar */}
        {!loadingProducts && (
          <div className="h-0.5 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
              style={{ width: `${(totalSold / totalUnits) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Live Flash Sale
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            500 Units.{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              First come, first served.
            </span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-base">
            Every order is guaranteed or your stock is released. No double
            charges. No overselling. Ever.
          </p>
          <p className="text-xs text-slate-600 font-mono">
            Your session: <span className="text-indigo-500">{buyerId}</span>
          </p>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => {
              const soldOut = product.available <= 0;
              const flying = inFlight[product.id] ?? false;
              const order = activeOrders[product.id];
              const err = errors[product.id];
              const rlMs = rateLimitMs[product.id];
              const isTerminal = order && terminalStatuses.has(order.status);
              const catColor =
                CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.General;
              const catIcon =
                CATEGORY_ICON[product.category] ?? CATEGORY_ICON.General;
              const pct =
                product.total > 0
                  ? ((product.total - product.available) / product.total) * 100
                  : 100;

              return (
                <div
                  key={product.id}
                  className="flex flex-col bg-[#0e1422] border border-white/5 rounded-2xl overflow-hidden hover:border-indigo-500/20 transition-all duration-300 group"
                >
                  {/* Image placeholder */}
                  <div className="relative h-44 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
                    <span className="text-6xl opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-500">
                      {catIcon}
                    </span>
                    <div className="absolute top-3 left-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catColor}`}
                      >
                        {product.category}
                      </span>
                    </div>
                    {soldOut && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold text-sm uppercase tracking-widest bg-rose-600/80 px-3 py-1 rounded-full">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1 gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">
                        {product.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {product.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold text-white">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {product.available}/{product.total} left
                      </span>
                    </div>

                    {/* Stock bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pct > 80
                            ? "bg-rose-500"
                            : pct > 50
                              ? "bg-amber-500"
                              : "bg-indigo-500"
                          }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    {/* Error / rate-limit */}
                    {(err || rlMs) && (
                      <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-500/20 rounded-lg px-3 py-2">
                        {rlMs
                          ? `Rate limited — retry in ${(rlMs / 1000).toFixed(1)}s`
                          : err}
                      </div>
                    )}

                    {/* Order status card */}
                    {order && (
                      <OrderStatusCard
                        order={order}
                        onDismiss={
                          isTerminal
                            ? () =>
                              setActiveOrders((prev) => {
                                const next = { ...prev };
                                delete next[product.id];
                                return next;
                              })
                            : undefined
                        }
                      />
                    )}

                    {/* Buy button */}
                    {(!order || isTerminal) && (
                      <button
                        id={`buy-${product.id}`}
                        onClick={() => handleBuy(product)}
                        disabled={soldOut || flying || !!rlMs}
                        className={`mt-auto w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200
                          ${soldOut
                            ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                            : rlMs
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                              : flying
                                ? "bg-indigo-800 text-indigo-300 cursor-wait"
                                : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-lg shadow-indigo-900/40"
                          }`}
                      >
                        {soldOut
                          ? "Sold Out"
                          : flying
                            ? "Reserving..."
                            : rlMs
                              ? `Wait ${(rlMs / 1000).toFixed(1)}s`
                              : "Buy Now"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Order Status Card ────────────────────────────────────────────────────────

function OrderStatusCard({
  order,
  onDismiss,
}: {
  order: ActiveOrder;
  onDismiss?: () => void;
}) {
  const cfg = statusConfig(order.status);
  const [secsLeft, setSecsLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(
        0,
        Math.round((new Date(order.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecsLeft(diff);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [order.expiresAt]);

  const isActive = ["reserved", "payment_pending"].includes(order.status);

  return (
    <div
      className={`rounded-xl border p-3 text-xs space-y-2 ${cfg.border} ${cfg.bg}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`}
          />
          <span className={`font-bold uppercase tracking-wide ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-600 hover:text-slate-400 text-[10px] transition"
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-slate-400">{cfg.desc}</p>

      {isActive && secsLeft > 0 && (
        <div className="flex items-center justify-between text-slate-500">
          <span>Hold expires in</span>
          <span className="font-mono text-amber-400 font-bold">
            {secsLeft}s
          </span>
        </div>
      )}

      <p className="font-mono text-slate-600 truncate">
        #{order.orderId.substring(0, 16)}…
      </p>
    </div>
  );
}
