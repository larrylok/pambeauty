import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search, UserCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";

const NOTIFICATION_EVENT = "pam-admin-notifications-updated";
const DISMISSED_KEY = "pam_admin_dismissed_notifications_v1";

const pageTitles = {
  "/admin": {
    title: "Dashboard",
    subtitle: "Overview of your beauty brand operations and activity.",
  },
  "/admin/products": {
    title: "Products",
    subtitle: "Manage your catalog, pricing, and presentation.",
  },
  "/admin/categories": {
    title: "Categories",
    subtitle: "Organize your product structure and browsing flow.",
  },
  "/admin/pages": {
    title: "Pages",
    subtitle: "Control branded content and key website sections.",
  },
  "/admin/homepage": {
    title: "Homepage",
    subtitle: "Refine your hero area, featured sections, and visual storytelling.",
  },
  "/admin/orders": {
    title: "Orders",
    subtitle: "Track purchases, fulfillment, and customer delivery flow.",
  },
  "/admin/customers": {
    title: "Customers",
    subtitle: "Review your audience, buyers, and customer activity.",
  },
  "/admin/collections": {
    title: "Collections",
    subtitle: "Curate grouped product experiences for the storefront.",
  },
  "/admin/reports": {
    title: "Reports",
    subtitle: "Read business insights and performance trends.",
  },
  "/admin/settings": {
    title: "Settings",
    subtitle: "Adjust store preferences and operational configuration.",
  },
  "/admin/security": {
    title: "Security",
    subtitle: "Protect sessions, access, and administrative controls.",
  },
  "/admin/notifications": {
    title: "Notifications",
    subtitle: "Review alerts, updates, and important admin activity.",
  },
};

const searchTargets = [
  { label: "Dashboard", path: "/admin", keywords: ["dashboard", "home", "overview"] },
  { label: "Products", path: "/admin/products", keywords: ["products", "product", "catalog", "items"] },
  { label: "Categories", path: "/admin/categories", keywords: ["categories", "category"] },
  { label: "Pages", path: "/admin/pages", keywords: ["pages", "page", "content"] },
  { label: "Homepage", path: "/admin/homepage", keywords: ["homepage", "home page", "hero"] },
  { label: "Orders", path: "/admin/orders", keywords: ["orders", "order", "sales"] },
  { label: "Customers", path: "/admin/customers", keywords: ["customers", "customer", "buyers", "clients"] },
  { label: "Collections", path: "/admin/collections", keywords: ["collections", "collection"] },
  { label: "Reports", path: "/admin/reports", keywords: ["reports", "report", "analytics", "revenue"] },
  { label: "Settings", path: "/admin/settings", keywords: ["settings", "preferences", "config"] },
  { label: "Security", path: "/admin/security", keywords: ["security", "password", "recovery"] },
  { label: "Notifications", path: "/admin/notifications", keywords: ["notifications", "alerts"] },
];

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
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

  if (detail && typeof detail === "object" && typeof detail.msg === "string") {
    return detail.msg;
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

export default function AdminHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);

  const requestSeq = useRef(0);

  const currentPage =
    pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path + "/")
    )?.[1] || {
      title: "Admin Panel",
      subtitle: "Manage your PAM Beauty workspace.",
    };

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    return searchTargets.filter((item) => {
      const haystack = [item.label, ...(item.keywords || [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search]);

  const goToTarget = (path) => {
    setSearch("");
    navigate(path);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (filteredTargets.length > 0) {
      goToTarget(filteredTargets[0].path);
    }
  };

  const loadNotificationCount = async () => {
    const seq = ++requestSeq.current;

    try {
      const dismissed = loadDismissed();

      const [ordersRes, productsRes] = await Promise.all([
        api.get("/orders", {
          params: { page: 1, limit: 100, includeArchived: false },
        }),
        api.get("/products", {
          params: { page: 1, limit: 100 },
        }),
      ]);

      if (seq !== requestSeq.current) return;

      const orders = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : Array.isArray(ordersRes.data?.orders)
        ? ordersRes.data.orders
        : Array.isArray(ordersRes.data?.items)
        ? ordersRes.data.items
        : [];

      const products = Array.isArray(productsRes.data)
        ? productsRes.data
        : Array.isArray(productsRes.data?.products)
        ? productsRes.data.products
        : Array.isArray(productsRes.data?.items)
        ? productsRes.data.items
        : [];

      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      const recentOrdersCount = orders.filter((order) => {
        const d = new Date(getOrderDate(order)).getTime();
        const id =
          `new-order:${order?.id || order?._id || order?.orderId || order?.order_id || ""}`;
        return Number.isFinite(d) && now - d <= oneDay && !dismissed[id];
      }).length;

      const pendingOrdersCount = orders.filter((order) => {
        const status = String(order?.status || "").toLowerCase();
        const id =
          `pending-order:${order?.id || order?._id || order?.orderId || order?.order_id || ""}`;
        return (status === "pending" || status === "pending_payment") && !dismissed[id];
      }).length;

      const lowStockCount = products
        .map((product) => {
          const variants = Array.isArray(product?.variants) ? product.variants : [];
          const stock = variants.reduce((sum, v) => sum + toNum(v?.stock, 0), 0);
          const id =
            `low-stock:${product?._id || product?.id || product?.productId || product?.slug || ""}`;
          return { stock, id };
        })
        .filter((item) => item.stock > 0 && item.stock < 5 && !dismissed[item.id]).length;

      setNotificationCount(recentOrdersCount + pendingOrdersCount + lowStockCount);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error("Notification count load error:", err);
      const msg = getErrorMessage(err, "");
      if (msg) console.warn(msg);
      setNotificationCount(0);
    }
  };

  useEffect(() => {
    loadNotificationCount();

    const interval = setInterval(() => {
      loadNotificationCount();
    }, 60000);

    const handleNotificationSync = () => {
      loadNotificationCount();
    };

    window.addEventListener(NOTIFICATION_EVENT, handleNotificationSync);

    return () => {
      requestSeq.current += 1;
      clearInterval(interval);
      window.removeEventListener(NOTIFICATION_EVENT, handleNotificationSync);
    };
  }, []);

  return (
    <header className="px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8">
      <div className="rounded-[28px] border border-[#e7e7e2] bg-[rgba(255,255,255,0.82)] backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-5 px-5 py-5 md:px-6 md:py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
              PAM Beauty Admin
            </p>
            <h1 className="mt-2 font-serif text-2xl leading-tight text-[#111111] md:text-3xl">
              {currentPage.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#666666]">
              {currentPage.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
            <div className="relative">
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-3 rounded-2xl border border-[#e7e7e2] bg-[#f8f8f6] px-4 py-3 shadow-[0_4px_14px_rgba(0,0,0,0.02)]"
              >
                <Search size={16} className="text-[#777777]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Go to products, orders, pages..."
                  className="w-full bg-transparent text-sm text-[#111111] placeholder:text-[#9a9a94] outline-none sm:w-44 lg:w-56"
                />
              </form>

              {search.trim() && filteredTargets.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[#e7e7e2] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                  {filteredTargets.slice(0, 6).map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => goToTarget(item.path)}
                      className="flex w-full items-center justify-between border-b border-[#f1f1ed] px-4 py-3 text-left text-sm text-[#111111] transition hover:bg-[#f8f8f6] last:border-b-0"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-[#8a8a84]">
                        Open
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/notifications")}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e7e7e2] bg-white text-[#111111] shadow-[0_4px_14px_rgba(0,0,0,0.02)] transition-all duration-200 hover:bg-[#f8f8f6]"
              aria-label="Notifications"
              title={`Notifications${notificationCount ? ` (${notificationCount})` : ""}`}
            >
              <Bell size={18} strokeWidth={1.9} />
              {notificationCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#111111] px-1.5 text-[10px] font-semibold text-white">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : (
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#111111]" />
              )}
            </button>

            <div className="flex items-center gap-3 rounded-2xl border border-[#e7e7e2] bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.02)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                <UserCircle2 size={20} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111111]">Admin</p>
                <p className="text-xs text-[#7d7d77]">Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}