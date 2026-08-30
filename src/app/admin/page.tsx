"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  buyerId: string;
  quantity: number;
  status: "reserved" | "payment_pending" | "confirmed" | "failed" | "expired";
  createdAt: string;
  product: { id: string; name: string; price: number; category: string };
}

interface StatusCounts {
  confirmed: number;
  payment_pending: number;
  reserved: number;
  failed: number;
  expired: number;
}

interface ProductStat {
  id: string;
  name: string;
  category: string;
  price: number;
  total: number;
  available: number;
  sold: number;
  failed: number;
}

interface RateLimitEntry {
  buyerId: string;
  tokens: number;
  totalAllowed: number;
  totalBlocked: number;
}

interface AdminData {
  orders: Order[];
  counts: StatusCounts;
  productStats: ProductStat[];
  rateLimitSummary: RateLimitEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  payment_pending: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  reserved: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  expired: "bg-slate-800 text-slate-400 border-slate-700",
};

function fmt(n: number) {
  return n.toLocaleString();
}

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(p);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<AdminData | null>(null);
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<
    "stock" | "orders" | "ratelimit"
  >("stock");

  // Persist passcode
  useEffect(() => {
    const saved = localStorage.getItem("rh_admin_pc");
    if (saved) { setPasscode(saved); tryAuth(saved); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function tryAuth(code: string) {
    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`/api/admin/orders?passcode=${code}`);
      if (res.ok) {
        setAuthed(true);
        localStorage.setItem("rh_admin_pc", code);
        const json = await res.json();
        setData(json);
      } else {
        setAuthError("Wrong passcode.");
        localStorage.removeItem("rh_admin_pc");
      }
    } catch {
      setAuthError("Server error.");
    } finally {
      setLoading(false);
    }
  }

  const fetchData = useCallback(async () => {
    if (!authed || !passcode) return;
    try {
      const statusParam = filter !== "all" ? `&status=${filter}` : "";
      const res = await fetch(
        `/api/admin/orders?passcode=${passcode}${statusParam}`
      );
      if (res.ok) setData(await res.json());
      else if (res.status === 401) {
        setAuthed(false);
        localStorage.removeItem("rh_admin_pc");
      }
    } catch {}
  }, [authed, passcode, filter]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Login Screen ───────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#0e1422] border border-white/5 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-black mx-auto">
              R
            </div>
            <h1 className="text-2xl font-bold text-white mt-3">Admin Access</h1>
            <p className="text-sm text-slate-500">
              Enter passcode to view the dashboard
            </p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); tryAuth(passcode); }}
            className="space-y-4"
          >
            <input
              id="admin-passcode"
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-center font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-600"
              required
            />
            {authError && (
              <p className="text-rose-500 text-xs text-center">{authError}</p>
            )}
            <button
              type="submit"
              id="admin-login-btn"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition"
            >
              {loading ? "Checking..." : "Login"}
            </button>
          </form>
          <p className="text-center text-xs text-slate-600">
            Default passcode: <code className="text-slate-400">admin123</code>
          </p>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────
  const counts = data?.counts;
  const totalOrders = counts
    ? Object.values(counts).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#080b14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#080b14]/80 backdrop-blur border-b border-white/5 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-black">
            R
          </div>
          <div>
            <span className="font-bold text-white">RushHour</span>
            <span className="ml-2 text-xs text-slate-500">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live — refreshes every 3s
          </div>
          <button
            id="admin-logout-btn"
            onClick={() => {
              setAuthed(false);
              setPasscode("");
              localStorage.removeItem("rh_admin_pc");
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 hover:bg-slate-800 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Confirmed", value: counts?.confirmed ?? 0, color: "text-emerald-400" },
            { label: "Pmt Pending", value: counts?.payment_pending ?? 0, color: "text-sky-400" },
            { label: "Reserved", value: counts?.reserved ?? 0, color: "text-amber-400" },
            { label: "Failed", value: counts?.failed ?? 0, color: "text-rose-400" },
            { label: "Expired", value: counts?.expired ?? 0, color: "text-slate-400" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-[#0e1422] border border-white/5 rounded-2xl p-4 text-center"
            >
              <p className={`text-3xl font-extrabold ${kpi.color}`}>
                {fmt(kpi.value)}
              </p>
              <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Total orders strip */}
        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl px-5 py-3 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Total orders processed (all statuses)
          </span>
          <span className="font-bold text-white text-lg">{fmt(totalOrders)}</span>
        </div>

        {/* ── Tab Nav ── */}
        <div className="flex gap-1 bg-[#0e1422] border border-white/5 rounded-xl p-1 w-fit">
          {(["stock", "orders", "ratelimit"] as const).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "ratelimit" ? "Rate Limits" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Stock Tab ── */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-300">
              Per-Product Stock — {data?.productStats?.reduce((s, p) => s + p.total, 0) ?? 0} units total
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data?.productStats ?? []).map((p) => {
                const soldPct = p.total > 0 ? (p.sold / p.total) * 100 : 0;
                const availPct = p.total > 0 ? (p.available / p.total) * 100 : 0;
                return (
                  <div
                    key={p.id}
                    className="bg-[#0e1422] border border-white/5 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white text-sm leading-snug">
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.category} · {formatPrice(p.price)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${
                          p.available === 0
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {p.available === 0 ? "Sold Out" : `${p.available} left`}
                      </span>
                    </div>

                    {/* Stock bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Sold {p.sold}/{p.total}</span>
                        <span>{soldPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                          style={{ width: `${soldPct}%` }}
                        />
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-emerald-500/60 rounded-full transition-all duration-700"
                          style={{ width: `${availPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Total", val: p.total, cls: "text-slate-300" },
                        { label: "Available", val: p.available, cls: "text-emerald-400" },
                        { label: "Confirmed", val: p.sold, cls: "text-indigo-400" },
                        { label: "Failed/Exp", val: p.failed, cls: "text-rose-400" },
                      ].map((s) => (
                        <div key={s.label} className="bg-slate-950/60 rounded-lg py-2">
                          <p className={`text-lg font-bold ${s.cls}`}>{s.val}</p>
                          <p className="text-[10px] text-slate-600">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              {["all", "confirmed", "payment_pending", "reserved", "failed", "expired"].map(
                (s) => (
                  <button
                    key={s}
                    id={`filter-${s}`}
                    onClick={() => setFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition ${
                      filter === s
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {s === "payment_pending" ? "Pending" : s}
                  </button>
                )
              )}
            </div>

            {/* Failures/Expired callout */}
            {(counts?.failed ?? 0) + (counts?.expired ?? 0) > 0 && (
              <div className="bg-rose-950/20 border border-rose-500/15 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  ⚠️ {(counts?.failed ?? 0) + (counts?.expired ?? 0)} orders failed or expired — stock returned to pool
                </span>
                <button
                  onClick={() => setFilter("failed")}
                  className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                >
                  View failures →
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-[#0e1422] border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">
                  Recent Orders
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    (max 100)
                  </span>
                </h3>
                <span className="text-xs text-slate-500">
                  {data?.orders?.length ?? 0} shown
                </span>
              </div>
              <div className="overflow-x-auto">
                {data?.orders && data.orders.length > 0 ? (
                  <table className="min-w-full divide-y divide-white/5">
                    <thead className="bg-slate-950/50">
                      <tr>
                        {["Order ID", "Product", "Buyer", "Qty", "Status", "Time"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.orders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-white/[0.02] transition"
                        >
                          <td className="px-5 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                            {order.id.substring(0, 8)}…
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="text-xs font-medium text-white max-w-[180px] truncate">
                              {order.product?.name ?? "—"}
                            </div>
                            <div className="text-[10px] text-slate-600">
                              {order.product?.category}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-400 whitespace-nowrap max-w-[120px] truncate">
                            {order.buyerId}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-300 text-center">
                            {order.quantity}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                                STATUS_STYLE[order.status] ?? STATUS_STYLE.expired
                              }`}
                            >
                              {order.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-16 text-center text-slate-600 text-sm">
                    No orders match this filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Rate Limits Tab ── */}
        {activeTab === "ratelimit" && (
          <div className="space-y-4">
            <div className="bg-amber-950/20 border border-amber-500/15 rounded-xl px-4 py-3 text-sm text-slate-400">
              🛡️ Token bucket: capacity <strong className="text-white">5</strong>, refill{" "}
              <strong className="text-white">3 tokens/s</strong> per buyer session.
              Blocked requests do not consume stock.
            </div>

            <div className="bg-[#0e1422] border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="font-semibold text-white">
                  Top Users by Blocked Requests
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (resets on server restart)
                  </span>
                </h3>
              </div>

              {data?.rateLimitSummary && data.rateLimitSummary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/5">
                    <thead className="bg-slate-950/50">
                      <tr>
                        {["Buyer ID", "Tokens Left", "Allowed", "Blocked", "Block Rate"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.rateLimitSummary.map((entry) => {
                        const total =
                          entry.totalAllowed + entry.totalBlocked;
                        const blockRate =
                          total > 0
                            ? ((entry.totalBlocked / total) * 100).toFixed(0)
                            : "0";
                        const isAbuser = entry.totalBlocked > 10;
                        return (
                          <tr
                            key={entry.buyerId}
                            className={`transition ${isAbuser ? "bg-rose-950/10" : "hover:bg-white/[0.02]"}`}
                          >
                            <td className="px-5 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                              {isAbuser && (
                                <span className="mr-2 text-rose-400">⚠</span>
                              )}
                              {entry.buyerId}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2.5 h-2.5 rounded-sm ${
                                        i < entry.tokens
                                          ? "bg-indigo-500"
                                          : "bg-slate-800"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-slate-400">
                                  {entry.tokens}/5
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-xs text-emerald-400 font-mono">
                              {fmt(entry.totalAllowed)}
                            </td>
                            <td className="px-5 py-3 text-xs text-rose-400 font-mono font-bold">
                              {fmt(entry.totalBlocked)}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-rose-500 rounded-full"
                                    style={{ width: `${blockRate}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500">
                                  {blockRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-600 text-sm">
                  No rate-limited sessions yet.
                  {" "}Run the load simulator to see activity here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
