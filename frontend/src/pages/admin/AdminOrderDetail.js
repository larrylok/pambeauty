import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../../api";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Truck,
  CreditCard,
  User,
  MapPin,
  Package,
  FileText,
  Clock,
  MessageSquareText,
  Archive,
} from "lucide-react";

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
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString();
}

function pick(obj, keys, fallback = undefined) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function normalizeHistoryItem(h) {
  if (!h || typeof h !== "object") return null;
  const at = h.at || h.timestamp || h.time || h.createdAt || null;
  return {
    status: String(h.status || "").trim(),
    note: String(h.note || "").trim(),
    at,
  };
}

function defaultNoteForStatus(st) {
  switch (String(st || "").toLowerCase()) {
    case "paid":
      return "Payment confirmed.";
    case "processing":
      return "Order is being prepared.";
    case "shipped":
      return "Order has been dispatched.";
    case "delivered":
      return "Order delivered.";
    case "cancelled":
      return "Order cancelled.";
    case "refunded":
      return "Order refunded.";
    case "pending":
    default:
      return "Order updated.";
  }
}

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [order, setOrder] = useState(null);

  // Editable admin fields
  const [status, setStatus] = useState("pending");
  const [tracking, setTracking] = useState("");
  const [adminNote, setAdminNote] = useState("");

  // Customer-visible note that becomes part of statusHistory
  const [customerUpdateNote, setCustomerUpdateNote] = useState("");

  const loadOrder = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      const o = res.data?.order ?? res.data;
      setOrder(o);

      setStatus(String(o?.status || "pending").toLowerCase());

      const t =
        pick(o?.delivery, ["trackingNumber"], "") ||
        pick(o, ["trackingUrl"], "") ||
        "";
      setTracking(String(t || ""));

      setAdminNote(
        pick(o, ["adminNotes", "adminNote", "notes", "note"], "") || ""
      );

      // reset customer note each load
      setCustomerUpdateNote("");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load order";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const normalized = useMemo(() => {
    const o = order || {};
    const customer = o.customer || o.buyer || {};
    const shipping = o.delivery || o.shipping || o.shippingAddress || {};
    const payment = o.payment || o.mpesa || o.transaction || {};

    const items = Array.isArray(o.items)
      ? o.items
      : Array.isArray(o.cartItems)
      ? o.cartItems
      : Array.isArray(o.products)
      ? o.products
      : [];

    const subtotal =
      pick(o, ["subtotal", "subTotal", "itemsSubtotal"], null) ??
      items.reduce(
        (acc, it) =>
          acc + toNum(it?.price) * toNum(it?.qty ?? it?.quantity ?? 1, 1),
        0
      );

    const shippingFee = pick(
      o,
      ["shippingCost", "shippingFee", "deliveryFee"],
      0
    );
    const discount = pick(o, ["discount", "discountAmount"], 0);
    const tax = pick(o, ["tax", "vat"], 0);

    const total =
      pick(o, ["total", "grandTotal", "amountTotal"], null) ??
      (toNum(subtotal) +
        toNum(shippingFee) +
        toNum(tax) -
        toNum(discount));

    const rawHist = Array.isArray(o.statusHistory) ? o.statusHistory : [];
    const history = rawHist
      .map(normalizeHistoryItem)
      .filter(Boolean)
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    const id = o.id || o._id || orderId;
    const archived = Boolean(o.archived);

    return {
      id,
      archived,
      orderNumber: o.orderNumber || o.ref || o.reference || o.id || orderId,
      createdAt: o.createdAt || o.created_at,
      updatedAt: o.updatedAt || o.updated_at,
      status: String(o.status || "pending").toLowerCase(),
      customer,
      shipping,
      payment,
      items,
      history,
      money: { subtotal, shippingFee, discount, tax, total },
    };
  }, [order, orderId]);

  const saveChanges = async () => {
    if (!order) return;

    const prevStatus = String(order?.status || "pending").toLowerCase();
    const nextStatus = String(status || "pending").toLowerCase();

    const prevTracking =
      pick(order?.delivery, ["trackingNumber"], "") ||
      pick(order, ["trackingUrl"], "") ||
      "";
    const nextTracking = String(tracking || "").trim();

    const existingHistory = Array.isArray(order.statusHistory)
      ? order.statusHistory
      : [];
    const newHistory = existingHistory.slice();

    const nowIso = new Date().toISOString();
    const customerNote = String(customerUpdateNote || "").trim();

    // Append history if status changed
    if (prevStatus !== nextStatus) {
      newHistory.push({
        status: nextStatus,
        note: customerNote || defaultNoteForStatus(nextStatus),
        at: nowIso,
        timestamp: nowIso, // backward compat
      });
    } else {
      const changedTracking =
        String(prevTracking || "").trim() !== nextTracking;
      if (changedTracking && nextTracking) {
        newHistory.push({
          status: nextStatus || prevStatus,
          note: customerNote || "Tracking information updated.",
          at: nowIso,
          timestamp: nowIso,
        });
      } else if (customerNote) {
        newHistory.push({
          status: nextStatus || prevStatus,
          note: customerNote,
          at: nowIso,
          timestamp: nowIso,
        });
      }
    }

    setSaving(true);
    try {
      const payload = {
        status: nextStatus,
        adminNotes: adminNote,
        delivery: {
          ...(order.delivery || {}),
          trackingNumber: nextTracking ? nextTracking : null,
        },
        trackingUrl: nextTracking ? nextTracking : null,
        statusHistory: newHistory,
      };

      await api.put(`/orders/${orderId}`, payload);

      toast.success("Order updated");
      await loadOrder();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to update order";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!normalized?.id) return;
    try {
      if (normalized.archived) {
        await api.patch(`/orders/${normalized.id}/unarchive`);
        toast.success("Order unarchived");
      } else {
        await api.patch(`/orders/${normalized.id}/archive`);
        toast.success("Order archived");
      }
      await loadOrder();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to update archive status";
      toast.error(msg);
    }
  };

  const StatusPill = ({ value }) => (
    <span className="inline-flex rounded-full border border-[#e7e7e2] bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#555555]">
      {String(value || "unknown").replace(/_/g, " ")}
    </span>
  );

  const ArchivedPill = () => (
    <span className="inline-flex rounded-full border border-[#d8d8d2] bg-[#f4f4f2] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#555555]">
      archived
    </span>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => nav(-1)}
              className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] shadow-[0_4px_14px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] shadow-[0_4px_14px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
            >
              Orders
            </Link>

            <button
              onClick={loadOrder}
              className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] shadow-[0_4px_14px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
              disabled={loading}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <h1 className="mt-5 truncate font-serif text-3xl text-[#111111] md:text-4xl">
            Order {normalized.orderNumber}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusPill value={normalized.status} />
            {normalized.archived ? <ArchivedPill /> : null}
            <p className="text-xs text-[#777777]">
              Created:{" "}
              <span className="font-medium text-[#111111]">
                {safeDate(normalized.createdAt)}
              </span>
            </p>
            <p className="text-xs text-[#777777]">
              Updated:{" "}
              <span className="font-medium text-[#111111]">
                {safeDate(normalized.updatedAt)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleArchive}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6] disabled:opacity-50"
            disabled={loading || !order}
            type="button"
            title={normalized.archived ? "Unarchive" : "Archive"}
          >
            <Archive className="h-4 w-4" />
            {normalized.archived ? "Unarchive" : "Archive"}
          </button>

          <button
            onClick={saveChanges}
            className="inline-flex items-center gap-2 rounded-[20px] bg-[#111111] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
            disabled={saving || loading || !order}
            type="button"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-8 text-[#777777] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          Loading order…
        </div>
      ) : !order ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-8 text-[#777777] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          Order not found or failed to load.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">Items</h2>
              </div>

              {normalized.items.length === 0 ? (
                <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-[#777777]">
                  No items on this order.
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
                          Qty
                        </th>
                        <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                          Unit
                        </th>
                        <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalized.items.map((it, idx) => {
                        const name =
                          it?.name || it?.title || it?.productName || "Item";
                        const qty = toNum(it?.qty ?? it?.quantity ?? 1, 1);
                        const unit = toNum(it?.price ?? it?.unitPrice ?? 0, 0);
                        const line = qty * unit;

                        return (
                          <tr
                            key={it?.id || it?._id || it?.slug || idx}
                            className="border-t border-[#ecece8]"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {it?.image ? (
                                  <img
                                    src={it.image}
                                    alt={name}
                                    className="h-12 w-12 rounded-xl border border-[#e7e7e2] object-cover"
                                  />
                                ) : (
                                  <div className="h-12 w-12 rounded-xl border border-[#e7e7e2] bg-[#f4f4f2]" />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-[#111111]">
                                    {name}
                                  </p>
                                  <p className="truncate text-xs text-[#777777]">
                                    {it?.sku
                                      ? `SKU: ${it.sku}`
                                      : it?.slug
                                      ? `/${it.slug}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-medium text-[#111111]">
                              {qty}
                            </td>
                            <td className="p-4 text-[#555555]">
                              {fmtKES(unit)}
                            </td>
                            <td className="p-4 font-medium text-[#111111]">
                              {fmtKES(line)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <h2 className="mb-5 font-serif text-2xl text-[#111111]">
                Totals
              </h2>

              <div className="space-y-3 rounded-[24px] border border-[#e7e7e2] bg-white p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#777777]">Subtotal</span>
                  <span className="font-medium text-[#111111]">
                    {fmtKES(normalized.money.subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#777777]">Shipping</span>
                  <span className="font-medium text-[#111111]">
                    {fmtKES(normalized.money.shippingFee)}
                  </span>
                </div>

                {toNum(normalized.money.tax) !== 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#777777]">Tax</span>
                    <span className="font-medium text-[#111111]">
                      {fmtKES(normalized.money.tax)}
                    </span>
                  </div>
                ) : null}

                {toNum(normalized.money.discount) !== 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#777777]">Discount</span>
                    <span className="font-medium text-[#111111]">
                      - {fmtKES(normalized.money.discount)}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-[#ecece8] pt-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Total
                  </span>
                  <span className="font-serif text-2xl text-[#111111]">
                    {fmtKES(normalized.money.total)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">
                  Status history
                </h2>
              </div>

              {normalized.history.length === 0 ? (
                <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-[#777777]">
                  No history yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {normalized.history
                    .slice()
                    .reverse()
                    .map((h, idx) => (
                      <div
                        key={`${h.at || "time"}-${idx}`}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-white p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-[#111111]">
                            {h.status || "updated"}
                          </p>
                          {h.note ? (
                            <p className="mt-1 text-sm text-[#777777]">
                              {h.note}
                            </p>
                          ) : null}
                        </div>
                        <p className="whitespace-nowrap text-xs text-[#8a8a84]">
                          {safeDate(h.at)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <User className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">
                  Customer
                </h2>
              </div>

              <div className="space-y-2 rounded-[24px] border border-[#e7e7e2] bg-white p-5">
                <p className="font-serif text-xl text-[#111111]">
                  {normalized.customer?.name || "—"}
                </p>
                <p className="text-sm text-[#777777]">
                  {normalized.customer?.email || "—"}
                </p>
                <p className="text-sm text-[#777777]">
                  {normalized.customer?.phone || "—"}
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">
                  Shipping
                </h2>
              </div>

              <div className="space-y-3 rounded-[24px] border border-[#e7e7e2] bg-white p-5 text-sm">
                <p className="text-[#777777]">
                  Method:{" "}
                  <span className="font-medium text-[#111111]">
                    {pick(normalized.shipping, ["method"], "—")}
                  </span>
                </p>
                <p className="text-[#777777]">
                  Location:{" "}
                  <span className="font-medium text-[#111111]">
                    {[
                      normalized.shipping?.address,
                      normalized.shipping?.city,
                      normalized.shipping?.county,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <Truck className="h-4 w-4 text-[#777777]" />
                  <input
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    placeholder="Tracking number (optional)"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">
                  Payment
                </h2>
              </div>

              <div className="space-y-2 rounded-[24px] border border-[#e7e7e2] bg-white p-5 text-sm">
                <p className="text-[#777777]">
                  Method:{" "}
                  <span className="font-medium text-[#111111]">
                    {pick(normalized.payment, ["method"], "—")}
                  </span>
                </p>
                <p className="text-[#777777]">
                  Status:{" "}
                  <span className="font-medium text-[#111111]">
                    {pick(normalized.payment, ["status"], "—")}
                  </span>
                </p>
                <p className="text-[#777777]">
                  Reference:{" "}
                  <span className="font-medium text-[#111111]">
                    {pick(
                      normalized.payment,
                      ["mpesaTransactionId", "transactionId", "reference"],
                      "—"
                    )}
                  </span>
                </p>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="mb-5 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#777777]" />
                <h2 className="font-serif text-2xl text-[#111111]">
                  Admin controls
                </h2>
              </div>

              <div className="space-y-5 rounded-[24px] border border-[#e7e7e2] bg-white p-5">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Order status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                  >
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="processing">processing</option>
                    <option value="shipped">shipped</option>
                    <option value="delivered">delivered</option>
                    <option value="cancelled">cancelled</option>
                    <option value="refunded">refunded</option>
                  </select>
                  <p className="mt-2 text-[11px] text-[#8a8a84]">
                    Changing status adds a customer-visible update saved into
                    status history.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-[#777777]" />
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Customer update note
                    </label>
                  </div>
                  <textarea
                    value={customerUpdateNote}
                    onChange={(e) => setCustomerUpdateNote(e.target.value)}
                    className="min-h-[96px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    placeholder="e.g. Your order has been dispatched. Rider will call upon arrival."
                  />
                  <p className="mt-2 text-[11px] text-[#8a8a84]">
                    If left blank, the system uses a default note based on the
                    status.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                    Internal note
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="min-h-[116px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    placeholder="Internal note (not shown to customer)…"
                  />
                </div>

                <button
                  onClick={saveChanges}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#111111] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
                  disabled={saving}
                  type="button"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}