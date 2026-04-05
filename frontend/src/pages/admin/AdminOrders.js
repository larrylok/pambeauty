import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Eye, Package, RefreshCw, Archive } from "lucide-react";
import { toast } from "sonner";
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

function safeDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function normalizeOrder(o) {
  const id = o?.id || o?._id || o?.orderId || o?.order_id || "";
  const orderNumber = pick(o, ["orderNumber", "ref", "reference"], id || "—");

  const customer = o?.customer || o?.buyer || {};
  const customerName = pick(customer, ["name", "fullName"], "—");
  const customerEmail = pick(customer, ["email"], "—");
  const customerPhone = pick(customer, ["phone", "tel"], "—");

  const items = Array.isArray(o?.items)
    ? o.items
    : Array.isArray(o?.cartItems)
    ? o.cartItems
    : Array.isArray(o?.products)
    ? o.products
    : [];

  const total = toNum(pick(o, ["total", "grandTotal", "amountTotal"], 0), 0);
  const createdAt = pick(o, ["createdAt", "created_at"], null);

  const status = String(pick(o, ["status"], "pending")).toLowerCase();

  const payment = o?.payment || o?.mpesa || o?.transaction || {};
  const paymentMethod = pick(
    payment,
    ["method", "type"],
    pick(o, ["paymentMethod"], "—")
  );

  const archived = Boolean(o?.archived);

  return {
    raw: o,
    id,
    orderNumber,
    createdAt,
    status,
    customerName,
    customerEmail,
    customerPhone,
    itemsCount: items.length,
    total,
    paymentMethod,
    archived,
  };
}

function getStatusColor(status) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
    case "pending_payment":
      return "bg-[#f4f4f2] text-[#555555] border border-[#e7e7e2]";
    case "paid":
    case "processing":
      return "bg-[#111111] text-white border border-[#111111]";
    case "shipped":
      return "bg-[#1f1f1f] text-white border border-[#1f1f1f]";
    case "delivered":
      return "bg-[#2d2d2d] text-white border border-[#2d2d2d]";
    case "cancelled":
    case "payment_failed":
    case "refunded":
      return "bg-[#eaeae7] text-[#111111] border border-[#d7d7d1]";
    default:
      return "bg-[#f4f4f2] text-[#555555] border border-[#e7e7e2]";
  }
}

export default function AdminOrders() {
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders", {
        params: { page: 1, limit: 100, includeArchived: showArchived },
      });
      const data = res.data || {};
      const list = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];
      setOrdersRaw(list);
    } catch (error) {
      console.error("Error loading orders:", error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Failed to load orders";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const orders = useMemo(
    () => ordersRaw.map(normalizeOrder).filter((o) => o.id),
    [ordersRaw]
  );

  const filteredOrders = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return orders.filter((o) => {
      const matchesStatus = !filterStatus || o.status === filterStatus;
      if (!s) return matchesStatus;

      const hay = [
        o.orderNumber,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.status,
        o.archived ? "archived" : "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && hay.includes(s);
    });
  }, [orders, searchTerm, filterStatus]);

  const quickUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      toast.success(`Order marked as ${newStatus}`);
      await loadOrders();
    } catch (error) {
      console.error("Status update error:", error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Failed to update status";
      toast.error(msg);
    }
  };

  const toggleArchive = async (order) => {
    const id = order?.id;
    if (!id) return;

    try {
      if (order.archived) {
        await api.patch(`/orders/${id}/unarchive`);
        toast.success("Order unarchived");
      } else {
        await api.patch(`/orders/${id}/archive`);
        toast.success("Order archived");
      }
      await loadOrders();
    } catch (error) {
      console.error("Archive toggle error:", error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Failed to update archive status";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111] md:text-5xl">
            Orders
          </h1>
          <p className="mt-2 text-sm text-[#666666]">
            {orders.length} total orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-2xl border border-[#e7e7e2] bg-white px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#666666] shadow-[0_4px_14px_rgba(0,0,0,0.02)]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-black"
            />
            Show archived
          </label>

          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-sm text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
            disabled={loading}
            title="Refresh"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_230px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a9a94]"
            />
            <input
              type="text"
              placeholder="Search by order #, customer name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-[#e7e7e2] bg-white py-3.5 pl-11 pr-4 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3.5 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="payment_failed">Payment Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] py-20 text-center shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="inline-block h-12 w-12 rounded-full border-2 border-[#111111] border-t-transparent animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] py-20 text-center shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <Package size={48} className="mx-auto mb-4 text-[#c8c8c2]" />
          <p className="text-[#777777]">No orders found</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] ${
                  order.archived ? "opacity-60" : ""
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-semibold text-[#111111]">
                      {order.orderNumber}
                    </p>
                    <p className="mt-2 break-all text-xs text-[#8a8a84]">
                      {order.id}
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {String(order.status || "").replace(/_/g, " ")}
                  </span>
                </div>

                {order.archived && (
                  <div className="mb-4">
                    <span className="inline-flex rounded-full border border-[#e7e7e2] bg-[#f4f4f2] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#666666]">
                      archived
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]">
                      Customer
                    </p>
                    <p className="break-words text-sm font-semibold text-[#111111]">
                      {order.customerName}
                    </p>
                    <p className="mt-2 break-all text-xs text-[#8a8a84]">
                      {order.customerEmail}
                    </p>
                    <p className="break-all text-xs text-[#8a8a84]">
                      {order.customerPhone}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]">
                        Date
                      </p>
                      <p className="text-sm text-[#555555]">
                        {safeDate(order.createdAt)}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]">
                        Items
                      </p>
                      <p className="text-sm text-[#555555]">
                        {order.itemsCount} items
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]">
                      Total
                    </p>
                    <p className="text-[15px] font-semibold text-[#111111]">
                      {fmtKES(order.total)}
                    </p>
                    <p className="mt-2 text-xs text-[#8a8a84]">
                      {order.paymentMethod}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8a8a84]">
                      Actions
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e7e7e2] bg-white px-4 py-2 text-sm text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                      >
                        <Eye size={15} />
                        View
                      </Link>

                      {order.status === "pending" && !order.archived && (
                        <button
                          onClick={() => quickUpdateStatus(order.id, "processing")}
                          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm text-white transition hover:bg-[#222222]"
                          type="button"
                        >
                          <Package size={15} />
                          Process
                        </button>
                      )}

                      <button
                        onClick={() => toggleArchive(order)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#e7e7e2] bg-white px-4 py-2 text-sm text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                        type="button"
                      >
                        <Archive size={15} />
                        {order.archived ? "Unarchive" : "Archive"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] shadow-[0_10px_30px_rgba(0,0,0,0.03)] md:block">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full table-fixed">
                <thead className="border-b border-[#e7e7e2] bg-white">
                  <tr>
                    <th className="w-[28%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Order #
                    </th>
                    <th className="w-[23%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Customer
                    </th>
                    <th className="w-[13%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Date
                    </th>
                    <th className="w-[10%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Items
                    </th>
                    <th className="w-[12%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Total
                    </th>
                    <th className="w-[14%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Status
                    </th>
                    <th className="w-[10%] p-5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`border-t border-[#ecece8] transition hover:bg-white ${
                        order.archived ? "opacity-60" : ""
                      }`}
                    >
                      <td className="align-top p-5">
                        <p className="break-words text-[15px] font-semibold leading-snug text-[#111111]">
                          {order.orderNumber}
                          {order.archived && (
                            <span className="ml-2 inline-flex rounded-full border border-[#e7e7e2] bg-[#f4f4f2] px-2.5 py-1 align-middle text-[10px] uppercase tracking-[0.16em] text-[#666666]">
                              archived
                            </span>
                          )}
                        </p>
                        <p className="mt-2 break-all text-xs leading-6 text-[#8a8a84]">
                          {order.id}
                        </p>
                      </td>

                      <td className="align-top p-5">
                        <p className="break-words text-sm font-semibold text-[#111111]">
                          {order.customerName}
                        </p>
                        <p className="mt-2 break-all text-xs leading-6 text-[#8a8a84]">
                          {order.customerEmail}
                        </p>
                        <p className="break-all text-xs leading-6 text-[#8a8a84]">
                          {order.customerPhone}
                        </p>
                      </td>

                      <td className="align-top p-5 text-sm leading-7 text-[#555555]">
                        {safeDate(order.createdAt)}
                      </td>

                      <td className="align-top p-5 text-sm text-[#555555]">
                        {order.itemsCount} items
                      </td>

                      <td className="align-top p-5">
                        <p className="text-[15px] font-semibold text-[#111111]">
                          {fmtKES(order.total)}
                        </p>
                        <p className="mt-2 text-xs text-[#8a8a84]">
                          {order.paymentMethod}
                        </p>
                      </td>

                      <td className="align-top p-5">
                        <span
                          className={`inline-flex rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {String(order.status || "").replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="align-top p-5">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/admin/orders/${order.id}`}
                            className="rounded-2xl p-2.5 text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                            title="View Details"
                          >
                            <Eye size={17} />
                          </Link>

                          {order.status === "pending" && !order.archived && (
                            <button
                              onClick={() => quickUpdateStatus(order.id, "processing")}
                              className="rounded-2xl p-2.5 text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                              title="Mark as Processing"
                              type="button"
                            >
                              <Package size={17} />
                            </button>
                          )}

                          <button
                            onClick={() => toggleArchive(order)}
                            className="rounded-2xl p-2.5 text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                            title={order.archived ? "Unarchive" : "Archive"}
                            type="button"
                          >
                            <Archive size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}