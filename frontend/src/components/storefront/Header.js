import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Heart, Search, Menu, X } from "lucide-react";
import api from "@/api";
import storage from "@/utils/storage";

export default function Header({ onCartClick }) {
  const navigate = useNavigate();

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navData, setNavData] = useState({ categories: [], collections: [], pages: [] });

  useEffect(() => {
    loadCounts();
    loadNavigation();

    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    const handleNavUpdate = () => {
      loadNavigation();
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("storage-update", loadCounts);
    window.addEventListener("storefront-navigation-updated", handleNavUpdate);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage-update", loadCounts);
      window.removeEventListener("storefront-navigation-updated", handleNavUpdate);
    };
  }, []);

  const loadCounts = async () => {
    const cart = await storage.get("cart");
    const wishlist = await storage.get("wishlist");

    setCartCount(cart?.items?.length || 0);
    setWishlistCount(wishlist?.length || 0);
  };

  const loadNavigation = async () => {
    try {
      const res = await api.get("/storefront/navigation");
      setNavData({
        categories: Array.isArray(res.data?.categories) ? res.data.categories : [],
        collections: Array.isArray(res.data?.collections) ? res.data.collections : [],
        pages: Array.isArray(res.data?.pages) ? res.data.pages : [],
      });
    } catch (err) {
      console.error("Failed to load storefront navigation:", err);
      setNavData({ categories: [], collections: [], pages: [] });
    }
  };

  const topCategories = navData.categories.filter((c) => c.showInMenu !== false);
  const headerPages = navData.pages.filter((p) => p.showInHeader);
  const featuredCollections = navData.collections.filter((c) => c.featured).slice(0, 2);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
          : "bg-white/80 backdrop-blur-sm border-b border-black/5"
      }`}
    >
      <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px]">
        <div className="flex items-center justify-between h-[76px] md:h-[84px]">

          {/* LOGO */}
          <Link
            to="/"
            className="shrink-0 flex flex-col leading-none"
            onClick={closeMobileMenu}
          >
            <span className="font-serif text-[1.6rem] md:text-[1.8rem] tracking-[-0.05em] text-black">
              PAM Beauty
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.35em] text-black/40">
              Hair • Beauty • Accessories
            </span>
          </Link>

          {/* NAV */}
          <nav className="hidden lg:flex items-center justify-center gap-x-8 flex-1 px-10">
            <Link
              to="/"
              className="text-[11px] tracking-[0.25em] uppercase text-black/80 hover:text-black transition-colors"
            >
              Home
            </Link>

            {topCategories.map((category) => (
              <Link
                key={category.slug}
                to={`/categories/${category.slug}`}
                className="text-[11px] tracking-[0.25em] uppercase text-black/80 hover:text-black transition-colors"
              >
                {category.name}
              </Link>
            ))}

            {headerPages.map((page) => (
              <Link
                key={page.slug}
                to={`/pages/${page.slug}`}
                className="text-[11px] tracking-[0.25em] uppercase text-black/80 hover:text-black transition-colors"
              >
                {page.name}
              </Link>
            ))}

            {featuredCollections.map((collection) => (
              <Link
                key={collection.slug}
                to={`/?collection=${encodeURIComponent(collection.slug)}`}
                className="text-[11px] tracking-[0.25em] uppercase text-black/80 hover:text-black transition-colors"
              >
                {collection.name}
              </Link>
            ))}

            <Link
              to="/track-order"
              className="text-[11px] tracking-[0.25em] uppercase text-black/80 hover:text-black transition-colors"
            >
              Track Order
            </Link>
          </nav>

          {/* ACTIONS */}
          <div className="flex items-center space-x-2 md:space-x-3">

            <button
              onClick={() => {
                closeMobileMenu();
                navigate("/?openFilters=1");
              }}
              className="p-2 rounded-full hover:bg-black/[0.04] transition"
            >
              <Search size={19} className="text-black" />
            </button>

            <Link
              to="/wishlist"
              onClick={closeMobileMenu}
              className="relative p-2 rounded-full hover:bg-black/[0.04] transition"
            >
              <Heart size={19} className="text-black" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <button
              onClick={onCartClick}
              className="relative p-2 rounded-full hover:bg-black/[0.04] transition"
            >
              <ShoppingCart size={19} className="text-black" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-black/[0.04]"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-black/10 bg-white">
          <nav className="px-6 py-6 flex flex-col space-y-5">
            <Link to="/" onClick={closeMobileMenu} className="text-sm uppercase tracking-wider">
              Home
            </Link>

            {topCategories.map((c) => (
              <Link
                key={c.slug}
                to={`/categories/${c.slug}`}
                onClick={closeMobileMenu}
                className="text-sm uppercase tracking-wider"
              >
                {c.name}
              </Link>
            ))}

            {headerPages.map((p) => (
              <Link
                key={p.slug}
                to={`/pages/${p.slug}`}
                onClick={closeMobileMenu}
                className="text-sm uppercase tracking-wider"
              >
                {p.name}
              </Link>
            ))}

            <Link to="/track-order" onClick={closeMobileMenu} className="text-sm uppercase tracking-wider">
              Track Order
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}