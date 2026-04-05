import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import "@/App.css";

// Storefront pages
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import Wishlist from "@/pages/Wishlist";
import Comparison from "@/pages/Comparison";
import TrackOrder from "@/pages/TrackOrder";

// NEW dynamic storefront page
import StorefrontPage from "@/pages/StorefrontPage";

// Footer pages
import Shipping from "@/pages/Shipping";
import Returns from "@/pages/Returns";
import SizeGuide from "@/pages/SizeGuide";
import Care from "@/pages/Care";
import FAQs from "@/pages/FAQs";
import Privacy from "@/pages/legal/Privacy";
import Terms from "@/pages/legal/Terms";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminOrderDetail from "@/pages/admin/AdminOrderDetail";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminCollections from "@/pages/admin/AdminCollections";
import AdminReports from "@/pages/admin/AdminReports";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminPages from "@/pages/admin/AdminPages";
import AdminHomepage from "@/pages/admin/AdminHomepage";

// Layouts
import StorefrontLayout from "@/layouts/StorefrontLayout";
import AdminLayout from "@/layouts/AdminLayout";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* ================= STORE FRONT ================= */}

          <Route path="/" element={<StorefrontLayout />}>
            <Route index element={<Home />} />

            {/* Product */}
            <Route path="products/:slug" element={<ProductDetail />} />

            {/* Checkout */}
            <Route path="checkout" element={<Checkout />} />

            {/* Order tracking */}
            <Route path="track-order" element={<TrackOrder />} />

            {/* Wishlist */}
            <Route path="wishlist" element={<Wishlist />} />

            {/* Comparison */}
            <Route path="comparison" element={<Comparison />} />

            {/* ================= DYNAMIC PAGES ================= */}

            {/* category pages created by admin */}
            <Route path="categories/:slug" element={<StorefrontPage />} />

            {/* custom pages created by admin */}
            <Route path="pages/:slug" element={<StorefrontPage />} />

            {/* ================= FOOTER ================= */}

            <Route path="shipping" element={<Shipping />} />
            <Route path="returns" element={<Returns />} />
            <Route path="size-guide" element={<SizeGuide />} />
            <Route path="care" element={<Care />} />
            <Route path="faqs" element={<FAQs />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* ================= ADMIN ================= */}

          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />

            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="pages" element={<AdminPages />} />
            <Route path="homepage" element={<AdminHomepage />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:orderId" element={<AdminOrderDetail />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="collections" element={<AdminCollections />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="security" element={<AdminSecurity />} />
            <Route path="notifications" element={<AdminNotifications />} />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* global fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;