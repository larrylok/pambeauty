import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "@/components/storefront/Header";
import Footer from "@/components/storefront/Footer";
import CartDrawer from "@/components/storefront/CartDrawer";

export default function StorefrontLayout() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header onCartClick={() => setCartOpen(true)} />
      <main className="min-h-[calc(100vh-200px)]">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
