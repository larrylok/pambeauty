import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  Tags,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api";

function getId(obj) {
  return obj?._id || obj?.id || "";
}

function total(x) {
  return Number(x || 0).toLocaleString();
}

function getStatusClasses(status) {
  const value = String(status || "").toLowerCase();

  if (["processing", "confirmed", "paid"].includes(value)) {
    return "bg-[#111111] text-white border border-[#111111]";
  }

  if (["pending", "pending_payment", "pending confirmation"].includes(value)) {
    return "bg-[#f4f4f2] text-[#444444] border border-[#e7e7e2]";
  }

  if (["payment_failed", "failed", "cancelled"].includes(value)) {
    return "bg-[#eaeae7] text-[#111111] border border-[#dcdcd6]";
  }

  return "bg-white text-[#555555] border border-[#e7e7e2]";
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    lowStockProducts: 0,
    totalCategories: 0,
    totalPages: 0,
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      const [
        ordersResponse,
        productsResponse,
        categoriesResponse,
        pagesResponse,
      ] = await Promise.all([
        api.get(`/orders`, {
          params: { page: 1, limit: 100, includeArchived: true },
        }),
        api.get(`/products`, { params: { page: 1, limit: 100 } }),
        api.get(`/categories`),
        api.get(`/pages`),
      ]);

      const orders = Array.isArray(ordersResponse.data?.orders)
        ? ordersResponse.data.orders
        : [];

      const products = Array.isArray(productsResponse.data?.products)
        ? productsResponse.data.products
        : [];

      const categories = Array.isArray(categoriesResponse.data)
        ? categoriesResponse.data
        : Array.isArray(categoriesResponse.data?.items)
        ? categoriesResponse.data.items
        : [];

      const pages = Array.isArray(pagesResponse.data)
        ? pagesResponse.data
        : Array.isArray(pagesResponse.data?.items)
        ? pagesResponse.data.items
        : [];

      const totalOrders = orders.length;

      const totalRevenue = orders.reduce((sum, o) => {
        if (o?.payment?.status === "confirmed") {
          return sum + Number(o.total || 0);
        }
        return sum;
      }, 0);

      const uniqueCustomers = new Set(
        orders
          .map((o) => String(o?.customer?.email || "").trim().toLowerCase())
          .filter(Boolean)
      );

      const lowStock = products.filter((product) => {
        const variants = Array.isArray(product?.variants) ? product.variants : [];
        const totalStock = variants.reduce(
          (sum, v) => sum + Number(v?.stock ?? 0),
          0
        );
        return totalStock < 5 && totalStock > 0;
      });

      setLowStockProducts(lowStock);
      setRecentOrders(orders.slice(0, 5));

      setStats({
        totalRevenue,
        totalOrders,
        totalCustomers: uniqueCustomers.size,
        lowStockProducts: lowStock.length,
        totalCategories: categories.length,
        totalPages: pages.length,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const lowStockTop = useMemo(() => lowStockProducts.slice(0, 5), [lowStockProducts]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border border-[#dcdcd6] border-t-[#111111] animate-spin" />
          <p className="text-sm text-[#777777]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#7d7d77] mb-2">
            PAM Beauty
          </p>
          <h1 className="text-3xl md:text-4xl font-serif text-[#111111]">
            Dashboard Overview
          </h1>
          <p className="text-sm text-[#666666] mt-2 max-w-xl">
            Monitor performance, customer activity, and operational insights across your store.
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          type="button"
          className="inline-flex items-center justify-center rounded-[22px] border border-[#e7e7e2] bg-white px-5 py-2.5 text-sm text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.02)] transition-all hover:bg-[#f8f8f6]"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Revenue"
          value={`KES ${total(stats.totalRevenue)}`}
          subtitle="Confirmed payments only"
          icon={<DollarSign size={20} />}
        />
        <StatCard
          title="Orders"
          value={total(stats.totalOrders)}
          subtitle="All orders placed"
          icon={<ShoppingCart size={20} />}
        />
        <StatCard
          title="Customers"
          value={total(stats.totalCustomers)}
          subtitle="Unique customer emails"
          icon={<Users size={20} />}
        />
        <StatCard
          title="Low Stock"
          value={total(stats.lowStockProducts)}
          subtitle="Products below threshold"
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          title="Categories"
          value={total(stats.totalCategories)}
          subtitle="Store categories"
          icon={<Tags size={20} />}
        />
        <StatCard
          title="Pages"
          value={total(stats.totalPages)}
          subtitle="Custom storefront pages"
          icon={<FileText size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-serif text-[#111111]">Recent Orders</h2>
              <p className="mt-1 text-sm text-[#777777]">
                Latest customer activity in your store.
              </p>
            </div>

            <Link
              to="/admin/orders"
              className="text-sm text-[#111111] border-b border-[#111111] transition hover:opacity-70"
            >
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dcdcd6] bg-white px-5 py-10 text-center text-sm text-[#777777]">
              No orders yet
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => {
                const id = getId(order);
                const href = id ? `/admin/orders/${id}` : "/admin/orders";

                return (
                  <Link
                    to={href}
                    key={id || order?.orderNumber}
                    className="block rounded-2xl border border-[#e7e7e2] bg-white p-4 transition hover:border-[#111111]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#111111]">
                          {order?.orderNumber || "Order"}
                        </p>
                        <p className="mt-1 text-xs text-[#777777]">
                          {order?.customer?.name || "No customer name"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getStatusClasses(
                          order?.status
                        )}`}
                      >
                        {String(order?.status || "unknown").replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#777777]">
                        {(order?.items?.length || 0)} item
                        {(order?.items?.length || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="font-semibold text-[#111111]">
                        KES {Number(order?.total || 0).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-8">
          <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <h2 className="mb-4 text-2xl font-serif text-[#111111]">Low Stock</h2>

            {lowStockTop.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdcd6] bg-white px-5 py-8 text-sm text-[#777777]">
                No low stock products right now.
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockTop.map((p) => (
                  <div
                    key={getId(p) || p?.name}
                    className="flex items-center justify-between rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3"
                  >
                    <span className="text-sm font-medium text-[#111111]">
                      {p.name}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-[#777777]">
                      Low
                    </span>
                  </div>
                ))}

                <Link
                  to="/admin/products"
                  className="mt-2 inline-flex border-b border-[#111111] text-sm text-[#111111] transition hover:opacity-70"
                >
                  Manage products
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <h2 className="mb-4 text-2xl font-serif text-[#111111]">Quick View</h2>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4">
                <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#777777]">
                  Revenue Source
                </p>
                <p className="text-sm text-[#111111]">
                  Only confirmed M-Pesa payments are counted in revenue.
                </p>
              </div>

              <div className="rounded-2xl border border-[#e7e7e2] bg-white p-4">
                <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#777777]">
                  Order Count
                </p>
                <p className="text-sm text-[#111111]">
                  Dashboard totals now come directly from your orders endpoint.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="rounded-[26px] border border-[#e7e7e2] bg-[#fcfcfa] p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_14px_35px_rgba(0,0,0,0.05)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            {title}
          </p>
          <p className="text-2xl font-serif text-[#111111]">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e7e7e2] bg-[#f4f4f2] text-[#111111]">
          {icon}
        </div>
      </div>

      <p className="text-sm text-[#777777]">{subtitle}</p>
    </div>
  );
}