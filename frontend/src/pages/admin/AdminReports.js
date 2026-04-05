import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api from "../../api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtKES(n) {
  const v = toNum(n, 0);
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `KES ${Math.round(v).toLocaleString()}`;
  }
}

function safeDateLabel(d) {
  try {
    const date = new Date(d);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
      });
    }
  } catch {}
  return String(d || "");
}

function dateKeyToTime(d) {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  const d = startOfDay(date);
  return d.toISOString().slice(0, 10);
}

function orderDateOf(order) {
  return (
    order?.createdAt ||
    order?.created_at ||
    order?.updatedAt ||
    order?.updated_at ||
    null
  );
}

function isRevenueOrder(order) {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const status = String(order?.status || "").toLowerCase();

  if (paymentStatus === "confirmed") return true;
  if (["paid", "processing", "shipped", "delivered"].includes(status)) return true;

  return false;
}

function normalizeProductMap(products) {
  const map = {};
  (Array.isArray(products) ? products : []).forEach((p) => {
    const id = p?._id || p?.id || p?.productId || null;
    if (id) map[id] = p;
  });
  return map;
}

function getErrorMessage(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;
  const message = err?.response?.data?.message;

  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof message === "string" && message.trim()) return message;

  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const loc = Array.isArray(item.loc) ? item.loc.join(" > ") : "";
          const msg = item.msg || "Validation error";
          return loc ? `${loc}: ${msg}` : msg;
        }
        return "";
      })
      .filter(Boolean)
      .join(" | ");

    if (joined) return joined;
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  if (err?.message) return err.message;
  return fallback;
}

function extractList(data, preferredKey) {
  if (Array.isArray(data)) return data;

  if (preferredKey && Array.isArray(data?.[preferredKey])) {
    return data[preferredKey];
  }

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function extractTotalPages(data) {
  return (
    toNum(data?.pages, 0) ||
    toNum(data?.totalPages, 0) ||
    toNum(data?.total_pages, 0) ||
    toNum(data?.pagination?.pages, 0) ||
    toNum(data?.meta?.pages, 0) ||
    0
  );
}

async function fetchAllPaginated({
  endpoint,
  preferredKey,
  extraParams = {},
  maxPages = 200,
  pageSize = 100,
}) {
  const all = [];
  let page = 1;

  while (page <= maxPages) {
    const res = await api.get(endpoint, {
      params: {
        page,
        limit: pageSize,
        ...extraParams,
      },
    });

    const data = res?.data;
    const batch = extractList(data, preferredKey);
    const totalPages = extractTotalPages(data);

    all.push(...batch);

    if (totalPages > 0) {
      if (page >= totalPages) break;
    } else {
      if (batch.length < pageSize) break;
    }

    if (batch.length === 0) break;
    page += 1;
  }

  return all;
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [revenue, setRevenue] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    series: [],
  });
  const [bestsellers, setBestsellers] = useState([]);

  const requestSeq = useRef(0);

  const days = useMemo(() => {
    if (range === "7d") return 7;
    if (range === "90d") return 90;
    return 30;
  }, [range]);

  const loadReports = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      const [rawOrders, rawProducts] = await Promise.all([
        fetchAllPaginated({
          endpoint: "/orders",
          preferredKey: "orders",
          extraParams: { includeArchived: true },
          maxPages: 200,
          pageSize: 100,
        }),
        fetchAllPaginated({
          endpoint: "/products",
          preferredKey: "products",
          extraParams: {},
          maxPages: 50,
          pageSize: 100,
        }),
      ]);

      if (seq !== requestSeq.current) return;

      const productMap = normalizeProductMap(rawProducts);

      const now = new Date();
      const from = new Date();
      from.setDate(now.getDate() - (days - 1));
      const fromStart = startOfDay(from);

      const bucketMap = new Map();
      for (let i = 0; i < days; i++) {
        const d = new Date(fromStart);
        d.setDate(fromStart.getDate() + i);
        bucketMap.set(dayKey(d), {
          date: dayKey(d),
          revenue: 0,
          orders: 0,
        });
      }

      const bestsellerMap = new Map();

      let totalRevenue = 0;
      let totalOrders = 0;

      rawOrders.forEach((order) => {
        const rawDate = orderDateOf(order);
        if (!rawDate) return;

        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;
        if (d < fromStart) return;

        totalOrders += 1;

        const orderTotal = toNum(
          order?.total ?? order?.grandTotal ?? order?.amountTotal,
          0
        );

        const revenueEligible = isRevenueOrder(order);
        if (revenueEligible) {
          totalRevenue += orderTotal;
        }

        const key = dayKey(d);
        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.orders += 1;
          if (revenueEligible) {
            bucket.revenue += orderTotal;
          }
        }

        const items = Array.isArray(order?.items)
          ? order.items
          : Array.isArray(order?.cartItems)
          ? order.cartItems
          : Array.isArray(order?.products)
          ? order.products
          : [];

        items.forEach((item) => {
          const pid =
            item?.productId ||
            item?.id ||
            item?._id ||
            item?.product?._id ||
            item?.product?.id ||
            null;

          const fallbackName =
            item?.name || item?.title || item?.productName || "Unnamed";
          const qty = toNum(item?.qty ?? item?.quantity, 1);
          const unitPrice = toNum(item?.price ?? item?.unitPrice, 0);
          const lineRevenue = qty * unitPrice;

          const existing = bestsellerMap.get(pid || fallbackName) || {
            id: pid || fallbackName,
            name: fallbackName,
            slug: "",
            purchases: 0,
            revenue: 0,
            price: unitPrice,
            image: "",
          };

          const product = pid ? productMap[pid] : null;

          existing.name = product?.name || existing.name || fallbackName;
          existing.slug = product?.slug || existing.slug || "";
          existing.image =
            product?.primaryImage ||
            (Array.isArray(product?.images) ? product.images[0] : "") ||
            existing.image ||
            "";
          existing.price = toNum(product?.basePrice, unitPrice) || existing.price;

          existing.purchases += qty;
          if (revenueEligible) {
            existing.revenue += lineRevenue;
          }

          bestsellerMap.set(pid || fallbackName, existing);
        });
      });

      const series = Array.from(bucketMap.values()).sort(
        (a, b) => dateKeyToTime(a.date) - dateKeyToTime(b.date)
      );

      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const bestsellerList = Array.from(bestsellerMap.values())
        .sort((a, b) => b.purchases - a.purchases)
        .slice(0, 10);

      setRevenue({
        totalRevenue,
        totalOrders,
        averageOrderValue,
        series,
      });

      setBestsellers(bestsellerList);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to load reports"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const kpis = useMemo(() => {
    const aov =
      revenue.averageOrderValue ||
      (revenue.totalOrders > 0 ? revenue.totalRevenue / revenue.totalOrders : 0);

    const top = bestsellers?.[0];
    return {
      totalRevenue: revenue.totalRevenue,
      totalOrders: revenue.totalOrders,
      aov,
      topProduct: top ? top.name : "—",
      topProductPurchases: top ? toNum(top.purchases, 0) : 0,
    };
  }, [revenue, bestsellers]);

  const chartData = useMemo(() => {
    return (revenue.series || []).map((p) => ({
      ...p,
      label: safeDateLabel(p.date),
    }));
  }, [revenue.series]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Reports</h1>
          <p className="mt-2 text-sm text-[#666666]">
            Revenue, order volume, and best-selling products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-[18px] border border-[#e7e7e2] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.02)]">
            {[
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`border-r border-[#e7e7e2] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition last:border-r-0 ${
                  range === opt.key
                    ? "bg-[#111111] text-white"
                    : "bg-white text-[#555555] hover:bg-[#f8f8f6] hover:text-[#111111]"
                }`}
                disabled={loading}
                title={`Last ${opt.label}`}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadReports}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
            disabled={loading}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Total revenue
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {fmtKES(kpis.totalRevenue)}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">Last {days} days</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Orders
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {toNum(kpis.totalOrders, 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">Last {days} days</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Avg order value
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {fmtKES(kpis.aov)}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">Last {days} days</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Top product
          </p>
          <p className="mt-3 line-clamp-2 font-serif text-xl text-[#111111]">
            {kpis.topProduct}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">
            Purchases:{" "}
            <span className="font-medium text-[#111111]">
              {kpis.topProductPurchases}
            </span>
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div>
          <h2 className="mb-1 font-serif text-2xl text-[#111111]">Revenue trend</h2>
          <p className="text-xs text-[#777777]">
            Daily revenue for the last {days} days.
          </p>
        </div>

        <div className="mt-6" style={{ width: "100%", height: 260 }}>
          {loading ? (
            <p className="text-[#777777]">Loading chart…</p>
          ) : chartData.length === 0 ? (
            <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-[#777777]">
              No revenue series data available yet.
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtKES(v)} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "revenue"
                      ? [fmtKES(value), "Revenue"]
                      : [toNum(value, 0), "Orders"]
                  }
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <h2 className="mb-5 font-serif text-2xl text-[#111111]">Bestsellers</h2>

        {loading ? (
          <p className="text-[#777777]">Loading…</p>
        ) : bestsellers.length === 0 ? (
          <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-[#777777]">
            No bestseller data available yet.
          </div>
        ) : (
          <div className="overflow-auto rounded-[24px] border border-[#e7e7e2] bg-white">
            <table className="w-full text-left">
              <thead className="border-b border-[#ecece8] bg-[#fafaf8]">
                <tr>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Product
                  </th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Purchases
                  </th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Revenue
                  </th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Unit price
                  </th>
                </tr>
              </thead>
              <tbody>
                {bestsellers.map((p) => (
                  <tr key={p.id} className="border-t border-[#ecece8]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-10 w-10 rounded-xl border border-[#e7e7e2] object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl border border-[#e7e7e2] bg-[#f4f4f2]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#111111]">{p.name}</p>
                          {p.slug ? (
                            <p className="truncate text-xs text-[#777777]">/{p.slug}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-[#111111]">
                      {p.purchases.toLocaleString()}
                    </td>
                    <td className="p-4 font-medium text-[#111111]">
                      {fmtKES(p.revenue)}
                    </td>
                    <td className="p-4 text-[#555555]">{fmtKES(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}