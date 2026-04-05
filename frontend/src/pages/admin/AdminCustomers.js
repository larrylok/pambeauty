import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "../../api";

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

function parseISODate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function niceDate(s) {
  const d = parseISODate(s);
  return d ? d.toLocaleString() : "—";
}

function orderIdOf(o) {
  return o?.id || o?._id || o?.orderId || o?.order_id || null;
}

function keyForCustomer(customer, fallbackSeed = "") {
  const email = (customer?.email || "").trim().toLowerCase();
  const phone = (customer?.phone || "").trim();
  return email || phone || `unknown:${(customer?.name || "").trim().toLowerCase()}:${fallbackSeed}`;
}

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

export default function AdminCustomers() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [customers, setCustomers] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(0);

  const [selected, setSelected] = useState(null);

  const requestSeq = useRef(0);

  const loadCustomers = async () => {
    const seq = ++requestSeq.current;

    setLoading(true);
    setOrdersLoaded(0);
    setSelected(null);

    try {
      const pageSize = 100;
      const maxPages = 20;
      let page = 1;

      const allOrders = [];

      while (page <= maxPages) {
        const res = await api.get(`/orders`, {
          params: { page, limit: pageSize },
        });

        if (seq !== requestSeq.current) return;

        const data = res.data;

        const batch = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const totalPages =
          toNum(data?.pages, 0) ||
          toNum(data?.totalPages, 0) ||
          toNum(data?.total_pages, 0) ||
          1;

        allOrders.push(...batch);
        setOrdersLoaded(allOrders.length);

        if (page >= totalPages) break;
        if (batch.length === 0) break;
        page += 1;
      }

      const map = new Map();

      for (let i = 0; i < allOrders.length; i++) {
        const o = allOrders[i];
        const c = o?.customer || o?.buyer || o?.user || {};

        const oid = orderIdOf(o) || `row:${i}`;
        const key = keyForCustomer(c, String(oid));

        const createdAt = o?.createdAt || o?.created_at || o?.updatedAt || o?.updated_at;
        const d = parseISODate(createdAt);

        const total = toNum(o?.total ?? o?.grandTotal ?? o?.amountTotal, 0);

        if (!map.has(key)) {
          map.set(key, {
            key,
            name: c?.name || c?.fullName || "Unknown",
            email: c?.email || "",
            phone: c?.phone || c?.phoneNumber || "",
            isGuest: !!c?.isGuest,
            ordersCount: 0,
            totalSpend: 0,
            firstOrderAt: createdAt || null,
            lastOrderAt: createdAt || null,
            statuses: {},
            recentOrders: [],
          });
        }

        const entry = map.get(key);

        entry.ordersCount += 1;
        entry.totalSpend += total;

        const st = String(o?.status || "unknown").toLowerCase();
        entry.statuses[st] = (entry.statuses[st] || 0) + 1;

        const firstD = parseISODate(entry.firstOrderAt);
        const lastD = parseISODate(entry.lastOrderAt);

        if (d) {
          if (!firstD || d < firstD) entry.firstOrderAt = createdAt;
          if (!lastD || d > lastD) entry.lastOrderAt = createdAt;
        }

        entry.recentOrders.push({
          id: oid,
          orderNumber: o?.orderNumber || o?.ref || o?.reference,
          total,
          status: o?.status || "unknown",
          createdAt: o?.createdAt || o?.created_at,
        });

        if (i > 0 && i % 400 === 0) {
          await tick();
          if (seq !== requestSeq.current) return;
        }
      }

      const list = Array.from(map.values())
        .map((c) => ({
          ...c,
          totalSpend: Math.round(c.totalSpend),
          recentOrders: c.recentOrders
            .filter((x) => x?.id)
            .sort((a, b) => {
              const da = parseISODate(a.createdAt)?.getTime() || 0;
              const db = parseISODate(b.createdAt)?.getTime() || 0;
              return db - da;
            })
            .slice(0, 8),
        }))
        .sort((a, b) => {
          const spend = toNum(b.totalSpend) - toNum(a.totalSpend);
          if (spend !== 0) return spend;
          return toNum(b.ordersCount) - toNum(a.ordersCount);
        });

      if (seq !== requestSeq.current) return;
      setCustomers(list);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load customers";
      toast.error(msg);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    return () => {
      requestSeq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(s) || email.includes(s) || phone.includes(s);
    });
  }, [customers, q]);

  const kpis = useMemo(() => {
    const total = customers.length;
    const repeat = customers.filter((c) => toNum(c.ordersCount) >= 2).length;

    if (customers.length === 0) return { total: 0, repeat: 0, vip: 0 };

    const sorted = customers
      .slice()
      .sort((a, b) => toNum(b.totalSpend) - toNum(a.totalSpend));

    const vipCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const vipThreshold = sorted[vipCount - 1]?.totalSpend ?? 0;

    const vip = customers.filter((c) => toNum(c.totalSpend) >= toNum(vipThreshold)).length;

    return { total, repeat, vip };
  }, [customers]);

  const openCustomer = (c) => setSelected(c);
  const closeCustomer = () => setSelected(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Customers</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#666666]">
            Derived from your orders — customer profiles, spend, and purchase history.
          </p>
        </div>

        <button
          onClick={loadCustomers}
          className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
          disabled={loading}
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Total customers
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {kpis.total.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">
            Based on unique email/phone from orders
          </p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Repeat customers
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {kpis.repeat.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">2+ orders</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            VIP segment
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {kpis.vip.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">Top ~10% by spend</p>
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
        <Search className="h-4 w-4 text-[#777777]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, phone…"
          className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#9a9a94]"
        />
        <div className="text-xs text-[#777777]">
          {loading ? "Loading…" : `${filtered.length} shown`}
        </div>
      </div>

      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <h2 className="font-serif text-2xl text-[#111111]">Customer list</h2>
          <p className="text-xs text-[#777777]">
            Orders scanned: <span className="font-medium text-[#111111]">{ordersLoaded}</span>
          </p>
        </div>

        <div className="mt-4 overflow-auto rounded-[24px] border border-[#e7e7e2] bg-white">
          <table className="w-full text-left">
            <thead className="border-b border-[#ecece8] bg-[#fafaf8]">
              <tr>
                <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Customer
                </th>
                <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Orders
                </th>
                <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Total spend
                </th>
                <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Last order
                </th>
                <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Status mix
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-[#777777]" colSpan={5}>
                    Building customers from orders…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="p-4 text-[#777777]" colSpan={5}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.key}
                    className="cursor-pointer border-t border-[#ecece8] transition hover:bg-[#fafaf8]"
                    onClick={() => openCustomer(c)}
                    title="Open customer"
                  >
                    <td className="p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-[#111111]">{c.name}</p>
                          {c.isGuest ? (
                            <span className="inline-flex rounded-full border border-[#e7e7e2] bg-[#fcfcfa] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                              Guest
                            </span>
                          ) : null}
                          {toNum(c.ordersCount) >= 2 ? (
                            <span className="inline-flex rounded-full bg-[#111111] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-white">
                              Repeat
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-[#777777]">
                          {c.email || "—"} {c.phone ? `• ${c.phone}` : ""}
                        </p>
                      </div>
                    </td>

                    <td className="p-4 font-medium text-[#111111]">
                      {toNum(c.ordersCount).toLocaleString()}
                    </td>
                    <td className="p-4 font-medium text-[#111111]">
                      {fmtKES(c.totalSpend)}
                    </td>
                    <td className="p-4 text-[#555555]">{niceDate(c.lastOrderAt)}</td>

                    <td className="p-4 text-xs text-[#777777]">
                      {Object.keys(c.statuses || {}).length === 0
                        ? "—"
                        : Object.entries(c.statuses)
                            .sort((a, b) => toNum(b[1]) - toNum(a[1]))
                            .slice(0, 3)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(" • ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={closeCustomer}
        >
          <div
            className="w-full max-w-3xl rounded-[32px] border border-[#e7e7e2] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate font-serif text-2xl text-[#111111]">
                  {selected.name}
                </h2>
                <p className="mt-1 text-xs text-[#777777]">
                  {selected.email || "—"} {selected.phone ? `• ${selected.phone}` : ""}
                </p>
              </div>

              <button
                onClick={closeCustomer}
                className="rounded-2xl border border-[#e7e7e2] p-2 text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                title="Close"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-[#e7e7e2] bg-[#fcfcfa] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Orders
                </p>
                <p className="mt-3 font-serif text-2xl text-[#111111]">
                  {toNum(selected.ordersCount).toLocaleString()}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#e7e7e2] bg-[#fcfcfa] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Total spend
                </p>
                <p className="mt-3 font-serif text-2xl text-[#111111]">
                  {fmtKES(selected.totalSpend)}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#e7e7e2] bg-[#fcfcfa] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                  Last order
                </p>
                <p className="mt-3 text-base font-medium text-[#111111]">
                  {niceDate(selected.lastOrderAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Timeline
              </p>
              <p className="mt-3 text-sm text-[#666666]">
                First order:{" "}
                <span className="font-medium text-[#111111]">
                  {niceDate(selected.firstOrderAt)}
                </span>
                {" • "}
                Last order:{" "}
                <span className="font-medium text-[#111111]">
                  {niceDate(selected.lastOrderAt)}
                </span>
              </p>
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <h3 className="font-serif text-xl text-[#111111]">Recent orders</h3>
                <p className="text-xs text-[#777777]">Showing up to 8</p>
              </div>

              <div className="mt-3 overflow-auto rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa]">
                <table className="w-full text-left">
                  <thead className="border-b border-[#ecece8] bg-white">
                    <tr>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Order
                      </th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Date
                      </th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Status
                      </th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Total
                      </th>
                      <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Open
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.recentOrders?.length ? (
                      selected.recentOrders.map((o) => (
                        <tr key={o.id} className="border-t border-[#ecece8]">
                          <td className="p-4">
                            <p className="font-medium text-[#111111]">
                              {o.orderNumber || o.id}
                            </p>
                            <p className="text-xs text-[#777777]">{o.id}</p>
                          </td>
                          <td className="p-4 text-[#555555]">{niceDate(o.createdAt)}</td>
                          <td className="p-4">
                            <span className="inline-flex rounded-full border border-[#e7e7e2] bg-white px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                              {String(o.status || "unknown")}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-[#111111]">
                            {fmtKES(o.total)}
                          </td>
                          <td className="p-4">
                            <Link
                              to={`/admin/orders/${o.id}`}
                              className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                              onClick={closeCustomer}
                              title="Open order"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-4 text-[#777777]" colSpan={5}>
                          No orders available for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 text-xs text-[#8a8a84]">
              Note: Customers are generated from orders. If you want full CRM
              support later, that would need a dedicated customer collection and endpoints.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}