import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Bell,
  ShoppingBag,
  AlertTriangle,
  Clock,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "../../api";

const DISMISSED_KEY = "pam_admin_dismissed_notifications_v1";

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderId(order) {
  return order?.id || order?._id || order?.orderId || order?.order_id || "";
}

function getOrderDate(order) {
  return (
    order?.createdAt ||
    order?.created_at ||
    order?.updatedAt ||
    order?.updated_at ||
    null
  );
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
        if (item && typeof item === "object") return item.msg || "Validation error";
        return "";
      })
      .filter(Boolean)
      .join(" | ");
    if (joined) return joined;
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
  }

  return err?.message || fallback;
}

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDismissed(map) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {}
}

export default function AdminNotifications() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [dismissed, setDismissed] = useState({});

  const requestSeq = useRef(0);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const loadNotifications = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.get("/orders", {
          params: { page: 1, limit: 100, includeArchived: false },
        }),
        api.get("/products", {
          params: { page: 1, limit: 100 },
        }),
      ]);

      if (seq !== requestSeq.current) return;

      const ordersData = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : Array.isArray(ordersRes.data?.orders)
        ? ordersRes.data.orders
        : Array.isArray(ordersRes.data?.items)
        ? ordersRes.data.items
        : [];

      const productsData = Array.isArray(productsRes.data)
        ? productsRes.data
        : Array.isArray(productsRes.data?.products)
        ? productsRes.data.products
        : Array.isArray(productsRes.data?.items)
        ? productsRes.data.items
        : [];

      setOrders(ordersData);
      setProducts(productsData);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      toast.error(getErrorMessage(err, "Failed to load notifications"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const recentOrders = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return orders
      .filter((order) => {
        const d = new Date(getOrderDate(order)).getTime();
        return Number.isFinite(d) && now - d <= oneDay;
      })
      .sort((a, b) => {
        const da = new Date(getOrderDate(a)).getTime() || 0;
        const db = new Date(getOrderDate(b)).getTime() || 0;
        return db - da;
      })
      .slice(0, 8)
      .map((order) => ({
        id: `new-order:${getOrderId(order)}`,
        type: "new_order",
        title: order?.orderNumber || getOrderId(order),
        subtitle: order?.customer?.name || "Customer",
        date: getOrderDate(order),
        href: `/admin/orders/${getOrderId(order)}`,
      }));
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const status = String(order?.status || "").toLowerCase();
        return status === "pending" || status === "pending_payment";
      })
      .sort((a, b) => {
        const da = new Date(getOrderDate(a)).getTime() || 0;
        const db = new Date(getOrderDate(b)).getTime() || 0;
        return db - da;
      })
      .slice(0, 8)
      .map((order) => ({
        id: `pending-order:${getOrderId(order)}`,
        type: "pending_order",
        title: order?.orderNumber || getOrderId(order),
        subtitle: String(order?.status || "pending").replace(/_/g, " "),
        date: getOrderDate(order),
        href: `/admin/orders/${getOrderId(order)}`,
      }));
  }, [orders]);

  const lowStockProducts = useMemo(() => {
    return products
      .map((product) => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const stock = variants.reduce((sum, v) => sum + toNum(v?.stock, 0), 0);
        return { ...product, computedStock: stock };
      })
      .filter((product) => product.computedStock > 0 && product.computedStock < 5)
      .sort((a, b) => a.computedStock - b.computedStock)
      .slice(0, 8)
      .map((product) => ({
        id: `low-stock:${product?._id || product?.id || product?.productId || product?.slug}`,
        type: "low_stock",
        title: product?.name || "Product",
        subtitle: `Stock left: ${product.computedStock}`,
        date: null,
        href: "/admin/products",
      }));
  }, [products]);

  const visibleRecentOrders = useMemo(
    () => recentOrders.filter((item) => !dismissed[item.id]),
    [recentOrders, dismissed]
  );

  const visiblePendingOrders = useMemo(
    () => pendingOrders.filter((item) => !dismissed[item.id]),
    [pendingOrders, dismissed]
  );

  const visibleLowStock = useMemo(
    () => lowStockProducts.filter((item) => !dismissed[item.id]),
    [lowStockProducts, dismissed]
  );

  const totalVisible =
    visibleRecentOrders.length +
    visiblePendingOrders.length +
    visibleLowStock.length;

  const dismissOne = (id) => {
    const next = { ...dismissed, [id]: true };
    setDismissed(next);
    saveDismissed(next);
  };

  const markAllRead = () => {
    const next = { ...dismissed };

    [...recentOrders, ...pendingOrders, ...lowStockProducts].forEach((item) => {
      next[item.id] = true;
    });

    setDismissed(next);
    saveDismissed(next);
    toast.success("Notifications marked as read");
  };

  const resetDismissed = () => {
    setDismissed({});
    saveDismissed({});
    toast.success("Notifications reset");
  };

  const NotificationCard = ({ item, icon, badgeText, onDismiss }) => (
    <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 transition hover:bg-[#f8f8f6]">
      <div className="flex items-start justify-between gap-3">
        <Link to={item.href} className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-[#777777]">{icon}</div>
            <div className="min-w-0">
              <p className="font-medium text-[#111111]">{item.title}</p>
              <p className="mt-1 text-sm text-[#666666]">{item.subtitle}</p>
              {item.date ? (
                <p className="mt-1 text-xs text-[#8a8a84]">{safeDate(item.date)}</p>
              ) : null}
              <div className="mt-2 inline-flex rounded-full border border-[#d7d7d1] bg-[#f4f4f2] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                {badgeText}
              </div>
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="rounded-xl border border-[#e7e7e2] p-2 text-[#666666] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
          title="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Notifications</h1>
          <p className="mt-2 text-sm text-[#666666]">
            Live operational alerts from orders and inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadNotifications}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
            disabled={loading}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-[20px] bg-[#111111] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222]"
            disabled={loading || totalVisible === 0}
            type="button"
          >
            <Check className="h-4 w-4" />
            Mark all read
          </button>

          <button
            onClick={resetDismissed}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#111111] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] transition hover:bg-[#111111] hover:text-white"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Total alerts
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">{totalVisible}</p>
          <p className="mt-2 text-xs text-[#8a8a84]">Visible notification items</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            New orders
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {visibleRecentOrders.length}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">In the last 24 hours</p>
        </div>

        <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Low stock
          </p>
          <p className="mt-3 font-serif text-3xl text-[#111111]">
            {visibleLowStock.length}
          </p>
          <p className="mt-2 text-xs text-[#8a8a84]">Products below threshold</p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-8 text-[#777777] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          Loading notifications...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="mb-5 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#777777]" />
              <h2 className="font-serif text-2xl text-[#111111]">New Orders</h2>
            </div>

            {visibleRecentOrders.length === 0 ? (
              <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-sm text-[#777777]">
                No new orders right now.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleRecentOrders.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    icon={<ShoppingBag className="h-4 w-4" />}
                    badgeText="New order"
                    onDismiss={dismissOne}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="mb-5 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#777777]" />
              <h2 className="font-serif text-2xl text-[#111111]">Pending Orders</h2>
            </div>

            {visiblePendingOrders.length === 0 ? (
              <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-sm text-[#777777]">
                No pending orders.
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePendingOrders.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    icon={<Clock className="h-4 w-4" />}
                    badgeText="Pending"
                    onDismiss={dismissOne}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#777777]" />
              <h2 className="font-serif text-2xl text-[#111111]">Low Stock</h2>
            </div>

            {visibleLowStock.length === 0 ? (
              <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4 text-sm text-[#777777]">
                No low stock alerts.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleLowStock.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    badgeText="Inventory alert"
                    onDismiss={dismissOne}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && totalVisible === 0 ? (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-white p-6 text-sm text-[#777777] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          Everything looks calm right now. New orders and stock alerts will appear here automatically.
        </div>
      ) : null}
    </div>
  );
}