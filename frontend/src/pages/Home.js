import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { Heart, ShoppingCart, Eye, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import api from "@/api";
import storage from "@/utils/storage";
import analytics from "@/utils/analytics";

import pamHeroDesktop from "@/assets/pam-hero-desktop.png";
import pamHeroMobile from "@/assets/pam-hero-mobile.png";

function normalizeId(p) {
  return p?.id || p?._id || p?.productId || p?.slug;
}

function safeStr(x) {
  return String(x ?? "").trim();
}

function getApiOrigin() {
  const base = String(api?.defaults?.baseURL || "");
  return base.replace(/\/api\/?$/, "");
}

function absolutizeMaybe(url) {
  const u = String(url || "");
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const origin = getApiOrigin();
  return origin ? `${origin}${u}` : u;
}

function pickDefaultImage(product) {
  const primary = safeStr(product?.primaryImage);
  if (primary) return primary;

  const imgs = Array.isArray(product?.images) ? product.images : [];
  return imgs[0] || "";
}

function pickHoverImage(product) {
  const model = safeStr(product?.modelImage);
  if (model) return model;

  const imgs = Array.isArray(product?.images) ? product.images : [];
  return imgs[1] || "";
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const productsRef = useRef(null);
  const heroSectionRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState({
    category: "",
    collection: "",
    search: "",
    sort: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [navData, setNavData] = useState({ categories: [], collections: [] });

  const hero = settings?.hero || {};

  const heroContent = {
    announcement:
      hero.announcement ||
      "New arrivals now live • Premium wigs, hair care, and beauty essentials",
    eyebrow: hero.eyebrow || "PAM Beauty",
    titleLine1: hero.titleLine1 || "Luxury Hair.",
    titleLine2: hero.titleLine2 || "Soft Confidence.",
    description:
      hero.description ||
      "Discover premium wigs, beauty accessories, and everyday essentials designed to bring elegance, polish, and effortless confidence to your routine.",
    primaryCta: hero.primaryCta || "Shop Collection",
    secondaryCta: hero.secondaryCta || "Shop Wigs",
  };

  useEffect(() => {
    analytics.pageView("Home");
    loadWishlist();
    loadNavigation();
    loadSettings();

    const handleNavRefresh = () => {
      loadNavigation();
    };

    window.addEventListener("storefront-navigation-updated", handleNavRefresh);

    return () => {
      window.removeEventListener("storefront-navigation-updated", handleNavRefresh);
    };
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const openFilters = sp.get("openFilters");
    if (openFilters) setShowFilters(true);

    setFilters({
      category: sp.get("category") || "",
      collection: sp.get("collection") || "",
      search: sp.get("search") || "",
      sort: sp.get("sort") || "",
    });
  }, [location.search]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const loadWishlist = async () => {
    try {
      const data = (await storage.get("wishlist")) || [];
      const safeData = Array.isArray(data) ? data : [];
      setWishlist(safeData);
    } catch {
      setWishlist([]);
    }
  };

  const loadNavigation = async () => {
    try {
      const res = await api.get("/storefront/navigation");
      setNavData({
        categories: Array.isArray(res.data?.categories) ? res.data.categories : [],
        collections: Array.isArray(res.data?.collections) ? res.data.collections : [],
      });
    } catch (err) {
      console.error("Failed to load navigation:", err);
      setNavData({ categories: [], collections: [] });
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get("/admin/settings");
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadProducts = async () => {
    setLoading(true);

    try {
      const params = { page, limit: 12 };

      if (filters.category) params.category = filters.category;
      if (filters.collection) params.collection = filters.collection;
      if (filters.search) params.search = filters.search;
      if (filters.sort) params.sort = filters.sort;

      const response = await api.get("/products", { params });
      const data = response?.data;

      let list = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data?.products)) {
        list = data.products;
      } else if (Array.isArray(data?.items)) {
        list = data.items;
      }

      setProducts(list || []);
      setTotalPages(Number(data?.pages || data?.totalPages || 1));
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
      setProducts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value };

    setFilters(next);
    setPage(1);

    const params = {};
    if (next.category) params.category = next.category;
    if (next.collection) params.collection = next.collection;
    if (next.search) params.search = next.search;
    if (next.sort) params.sort = next.sort;

    setSearchParams(params);
  };

  const toggleWishlist = async (productId) => {
    const pid = String(productId || "");
    if (!pid) return;

    let newWishlist = Array.isArray(wishlist) ? [...wishlist] : [];
    const index = newWishlist.indexOf(pid);

    if (index > -1) {
      newWishlist.splice(index, 1);
      toast.success("Removed from wishlist");
    } else {
      newWishlist.push(pid);
      const product = products.find((p) => String(normalizeId(p)) === pid);
      analytics.addToWishlist(pid, product?.name);
      toast.success("Added to wishlist");
    }

    setWishlist(newWishlist);
    await storage.set("wishlist", newWishlist);
    window.dispatchEvent(new Event("storage-update"));
  };

  const addToCart = async (product) => {
    if (!product?.variants || product.variants.length === 0) {
      toast.error("Product has no variants available");
      return;
    }

    const defaultVariant = product.variants[0];

    if (Number(defaultVariant?.stock || 0) <= 0 && !product.allowPreorder) {
      toast.error("Product is out of stock");
      return;
    }

    const cart = (await storage.get("cart")) || { items: [], subtotal: 0, total: 0 };
    cart.items = Array.isArray(cart.items) ? cart.items : [];

    const pid = normalizeId(product);
    const vid = defaultVariant?.id || defaultVariant?._id;

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId === pid && item.variantId === vid
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += 1;
    } else {
      cart.items.push({
        productId: pid,
        variantId: vid,
        quantity: 1,
        giftWrap: false,
        giftMessage: null,
        giftReceipt: false,
        isPreorder: Number(defaultVariant?.stock || 0) <= 0 && !!product.allowPreorder,
      });
    }

    await storage.set("cart", cart);
    window.dispatchEvent(new Event("storage-update"));

    analytics.addToCart(
      pid,
      product.name,
      defaultVariant,
      1,
      Number(product.salePrice || product.basePrice || 0)
    );

    toast.success("Added to cart");
  };

  const categoryOptions = navData.categories.map((c) => c.name);
  const activeCollection = navData.collections.find((c) => c.slug === filters.collection);
  const titleText = filters.category || activeCollection?.name || "All Products";

  const desktopHeroImage = hero.desktopImage
    ? absolutizeMaybe(hero.desktopImage)
    : pamHeroDesktop;

  const mobileHeroImage = hero.mobileImage
    ? absolutizeMaybe(hero.mobileImage)
    : pamHeroMobile;

  const desktopHeroPosition = hero.desktopImagePosition || "center top";
  const mobileHeroPosition = hero.mobileImagePosition || "center top";

  // Scroll to products section
  const scrollToProducts = () => {
    setTimeout(() => {
      if (productsRef.current) {
        productsRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      {/* Announcement Bar - SOFT ROSE/MAUVE COLOR */}
      <div className="w-full bg-[#D4B5A0] border-b border-[#C9A876]/20">
        <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-3 text-center">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.28em] text-white/95 font-medium drop-shadow-sm">
            {heroContent.announcement}
          </p>
        </div>
      </div>

      {/* Hero Section */}
      <section
        ref={heroSectionRef}
        className="relative isolate overflow-hidden bg-white min-h-[88vh] md:min-h-[96vh] flex items-center justify-center"
      >
        {/* Background Image - Static, no parallax */}
        <div
          className="absolute inset-0 z-0 opacity-100"
          style={{
            backgroundImage: `url(${
              window.innerWidth >= 768 ? desktopHeroImage : mobileHeroImage
            })`,
            backgroundPosition: window.innerWidth >= 768 ? desktopHeroPosition : mobileHeroPosition,
            backgroundSize: "cover",
            backgroundAttachment: "fixed",
          }}
        >
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-24 text-center max-w-4xl mx-auto">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/95 mb-6 font-medium drop-shadow-lg">
            {heroContent.eyebrow}
          </p>

          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white leading-[1.1] mb-4 drop-shadow-lg font-bold">
            {heroContent.titleLine1}
          </h1>

          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white/95 leading-[1.1] mb-8 drop-shadow-lg">
            {heroContent.titleLine2}
          </h2>

          <p className="text-base md:text-lg text-white/90 mb-12 leading-relaxed drop-shadow-md max-w-2xl mx-auto">
            {heroContent.description}
          </p>

          {/* CTA Buttons - BOTH WORKING */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Primary Button */}
            <button
              onClick={() => {
                analytics.clickedCta("primary_cta");
                scrollToProducts();
              }}
              className="px-10 py-4 bg-[#111111] text-white border-2 border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-bold rounded-lg shadow-lg hover:shadow-xl"
              type="button"
            >
              {heroContent.primaryCta}
            </button>

            {/* Secondary Button */}
            <button
              onClick={() => {
                analytics.clickedCta("secondary_cta");
                // Filter to Wigs category
                setFilters(prev => ({ ...prev, category: "Wigs" }));
                setSearchParams({ category: "Wigs" });
                scrollToProducts();
              }}
              className="px-10 py-4 bg-transparent text-white border-2 border-white hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-bold rounded-lg shadow-lg hover:shadow-xl"
              type="button"
            >
              {heroContent.secondaryCta}
            </button>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section ref={productsRef} className="bg-white py-20 md:py-32">
        <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px]">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#999] mb-2">
                Collection
              </p>
              <h2 className="font-serif text-5xl md:text-6xl text-[#111111]">
                {titleText}
              </h2>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-6 py-3 border border-[#E7E0D8] rounded-lg hover:border-[#111111] hover:bg-[#F8F6F4] transition-all duration-300 text-xs tracking-wider uppercase font-semibold text-[#111111]"
              >
                <SlidersHorizontal size={16} />
                Filters
              </button>

              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange("sort", e.target.value)}
                className="px-6 py-3 border border-[#E7E0D8] rounded-lg bg-white text-[#111111] text-xs tracking-wider uppercase font-semibold hover:border-[#111111] transition-all focus:border-[#111111] focus:ring-0"
              >
                <option value="">Sort By</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Filter Panel - COMPACT */}
          {showFilters && (
            <div className="mb-12 p-8 border border-[#E7E0D8] bg-[#F8F6F4] rounded-xl animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-semibold mb-4 tracking-[0.2em] uppercase text-[#111111]">
                    Category
                  </label>
                  <div className="space-y-3">
                    {["", ...categoryOptions].map((cat) => (
                      <label key={cat || "all"} className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="category"
                          checked={filters.category === cat}
                          onChange={() => handleFilterChange("category", cat)}
                          className="accent-[#111111]"
                        />
                        <span className="text-sm text-[#666] group-hover:text-[#111111] transition-colors">
                          {cat || "All"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Collection Filter */}
                {navData.collections.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold mb-4 tracking-[0.2em] uppercase text-[#111111]">
                      Collection
                    </label>
                    <select
                      value={filters.collection}
                      onChange={(e) => handleFilterChange("collection", e.target.value)}
                      className="w-full px-4 py-2.5 border-b-2 border-[#E7E0D8] bg-transparent text-[#111111] text-sm focus:border-[#111111] focus:ring-0"
                    >
                      <option value="">All Collections</option>
                      {navData.collections.map((col) => (
                        <option key={col.slug} value={col.slug}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Search Filter */}
                <div>
                  <label className="block text-xs font-semibold mb-4 tracking-[0.2em] uppercase text-[#111111]">
                    Search
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Find a product..."
                    className="w-full px-4 py-2.5 border-b-2 border-[#E7E0D8] bg-transparent text-[#111111] text-sm focus:border-[#111111] focus:ring-0 placeholder:text-[#999]"
                  />
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilters({ category: "", collection: "", search: "", sort: "" });
                      setSearchParams({});
                    }}
                    className="w-full px-4 py-2.5 text-sm text-[#999] hover:text-[#111111] transition-colors text-center"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-12 h-12 border-2 border-[#E7E0D8] border-t-[#111111] rounded-full animate-spin"></div>
              <p className="mt-6 text-[#999]">Loading premium collection...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-serif text-3xl text-[#111111] mb-2">No products found</p>
              <p className="text-[#666] mb-8">Try adjusting your filters or search</p>
              <button
                onClick={() => {
                  setFilters({ category: "", collection: "", search: "", sort: "" });
                  setSearchParams({});
                }}
                className="px-8 py-3 border border-[#E7E0D8] rounded-lg hover:bg-[#F8F6F4] transition-all text-sm font-semibold text-[#111111]"
              >
                View All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((product) => {
                const pid = String(normalizeId(product) || "");
                const defaultImgRaw = pickDefaultImage(product);
                const hoverImgRaw = pickHoverImage(product);
                const defaultImg = absolutizeMaybe(defaultImgRaw);
                const hoverImg = absolutizeMaybe(hoverImgRaw);
                const canSwap = !!hoverImg && hoverImg !== defaultImg;
                const isWishlisted = wishlist.includes(pid);

                return (
                  <div
                    key={pid}
                    className="group bg-white border border-[#E7E0D8] hover:border-[#111111] hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-lg overflow-hidden"
                  >
                    {/* Image Container */}
                    <div className="relative overflow-hidden aspect-square bg-[#F8F6F4]">
                      <Link to={`/products/${product.slug}`}>
                        <div className="relative w-full h-full">
                          {defaultImg ? (
                            <img
                              src={defaultImg}
                              alt={product.name}
                              className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
                                canSwap ? "opacity-100 group-hover:opacity-0" : "opacity-100"
                              } group-hover:scale-105`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full bg-[#F0EBDE]" />
                          )}

                          {canSwap ? (
                            <img
                              src={hoverImg}
                              alt={`${product.name} detail`}
                              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                      </Link>

                      {/* Badges */}
                      {product.isFeatured && (
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1.5 bg-[#111111] text-white text-[10px] tracking-[0.15em] uppercase font-semibold">
                            Featured
                          </span>
                        </div>
                      )}

                      {product.discountPercentage > 0 && (
                        <div className="absolute top-4 right-4">
                          <span className="px-3 py-1.5 bg-red-600 text-white text-[10px] tracking-[0.15em] uppercase font-semibold">
                            -{Math.round(product.discountPercentage)}%
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <button
                          onClick={() => toggleWishlist(pid)}
                          className={`flex-1 py-2.5 border border-white text-white hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-semibold flex items-center justify-center gap-2 rounded ${
                            isWishlisted ? "bg-white text-[#111111]" : "bg-black/30"
                          }`}
                          type="button"
                          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        >
                          <Heart size={14} fill={isWishlisted ? "currentColor" : "none"} />
                          {isWishlisted ? "Saved" : "Save"}
                        </button>
                        <Link
                          to={`/products/${product.slug}`}
                          className="flex-1 py-2.5 bg-white text-[#111111] hover:bg-[#111111] hover:text-white transition-all duration-300 text-xs tracking-wider uppercase font-semibold flex items-center justify-center gap-2 rounded"
                        >
                          <Eye size={14} />
                          View
                        </Link>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-6">
                      <div className="mb-3">
                        <span className="text-[10px] tracking-[0.2em] uppercase text-[#999]">
                          {product.category}
                        </span>
                      </div>

                      <Link to={`/products/${product.slug}`}>
                        <h3 className="font-serif text-lg text-[#111111] mb-2 group-hover:text-[#666] transition-colors line-clamp-2">
                          {product.name}
                        </h3>
                      </Link>

                      <p className="text-xs text-[#999] mb-4 line-clamp-2">
                        {product.shortDescription}
                      </p>

                      {/* Price */}
                      <div className="mb-4">
                        {product.salePrice ? (
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-[#111111]">
                              KES {product.salePrice.toLocaleString()}
                            </span>
                            <span className="text-sm text-[#999] line-through">
                              KES {product.basePrice.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-base font-semibold text-[#111111]">
                            KES {product.basePrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full py-3 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-[0.2em] uppercase font-semibold flex items-center justify-center gap-2 rounded"
                        type="button"
                      >
                        <ShoppingCart size={14} />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-16">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-6 py-3 border border-[#E7E0D8] text-[#111111] hover:border-[#111111] hover:bg-[#F8F6F4] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold rounded-lg"
              >
                Previous
              </button>

              <div className="text-sm text-[#666]">
                Page {page} of {totalPages}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-6 py-3 border border-[#E7E0D8] text-[#111111] hover:border-[#111111] hover:bg-[#F8F6F4] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold rounded-lg"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}