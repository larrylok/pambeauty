import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { Heart, ShoppingCart, Eye, SlidersHorizontal } from "lucide-react";
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
  const [heroOffset, setHeroOffset] = useState(0);

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

    const nextFilters = {
      category: sp.get("category") || "",
      collection: sp.get("collection") || "",
      search: sp.get("search") || "",
      sort: sp.get("sort") || "",
    };

    setFilters(nextFilters);
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  useEffect(() => {
    const handleScroll = () => {
      if (!heroSectionRef.current) return;

      const rect = heroSectionRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 0;

      const progress = Math.min(
        Math.max((viewportHeight - rect.top) / (viewportHeight + rect.height), 0),
        1
      );

      const translateY = progress * 36;
      setHeroOffset(translateY);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToProducts = () => {
    requestAnimationFrame(() => {
      productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const loadWishlist = async () => {
    const wl = (await storage.get("wishlist")) || [];
    setWishlist(Array.isArray(wl) ? wl : []);
  };

  const loadNavigation = async () => {
    try {
      const res = await api.get("/storefront/navigation");
      setNavData({
        categories: Array.isArray(res.data?.categories) ? res.data.categories : [],
        collections: Array.isArray(res.data?.collections) ? res.data.collections : [],
      });
    } catch (error) {
      console.error("Error loading navigation:", error);
      setNavData({ categories: [], collections: [] });
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data || {});
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        status: "active",
      };

      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.sort) params.sort = filters.sort;
      if (filters.collection) params.collection = filters.collection;

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

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full border-b border-black/10 bg-[#f8f6f4]">
        <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-3 text-center">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.28em] text-black/60">
            {heroContent.announcement}
          </p>
        </div>
      </div>

      <section
        ref={heroSectionRef}
        className="relative isolate overflow-hidden bg-white min-h-[88vh] md:min-h-[96vh]"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-[#f8f6f4]/60 via-white/40 to-white"></div>
        </div>

        <div
          className="absolute inset-0 z-0"
          style={{
            transform: `translateY(${heroOffset}px)`,
            transition: "transform 120ms linear",
          }}
        >
          <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
            <div className="relative h-full w-full overflow-hidden lg:rounded-bl-[42px] bg-[#f8f6f4]">
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent lg:hidden z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/12 to-transparent hidden lg:block z-10"></div>

              <img
                src={desktopHeroImage}
                alt="PAM Beauty editorial hero"
                className="hidden md:block absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: desktopHeroPosition }}
              />

              <img
                src={mobileHeroImage}
                alt="PAM Beauty editorial hero mobile"
                className="block md:hidden absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: mobileHeroPosition }}
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] pt-10 md:pt-12 lg:pt-16 pb-14 md:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-start lg:items-center min-h-[78vh] md:min-h-[82vh]">
            <div className="lg:col-span-6 xl:col-span-5">
              <div className="max-w-2xl bg-white/72 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-0 rounded-[28px] lg:rounded-none p-6 md:p-8 lg:p-0 border border-black/5 lg:border-0 shadow-[0_12px_40px_rgba(0,0,0,0.04)] lg:shadow-none">
                <p className="text-[11px] md:text-xs uppercase tracking-[0.35em] text-black/60 mb-5">
                  {heroContent.eyebrow}
                </p>

                <h1 className="font-serif text-[2.6rem] leading-[0.94] md:text-[4.4rem] lg:text-[5.6rem] xl:text-[6.4rem] tracking-[-0.04em] text-black mb-5">
                  {heroContent.titleLine1}
                  <br />
                  {heroContent.titleLine2}
                </h1>

                <p className="text-sm md:text-base lg:text-lg leading-7 text-black/68 max-w-xl mb-8">
                  {heroContent.description}
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      setShowFilters(false);
                      setFilters({ category: "", collection: "", search: "", sort: "" });
                      setPage(1);
                      setSearchParams({});
                      scrollToProducts();
                    }}
                    className="px-8 py-4 bg-black text-white hover:bg-black transition-all duration-300 text-sm tracking-[0.22em] uppercase font-semibold"
                    type="button"
                  >
                    {heroContent.primaryCta}
                  </button>

                  <button
                    onClick={() => {
                      handleFilterChange("category", "wigs");
                      scrollToProducts();
                    }}
                    className="px-8 py-4 border border-black/80 text-black hover:border-black hover:text-black transition-all duration-300 text-sm tracking-[0.22em] uppercase font-semibold bg-white/85 lg:bg-transparent"
                    type="button"
                  >
                    {heroContent.secondaryCta}
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden lg:block lg:col-span-6 xl:col-span-7" />
          </div>
        </div>
      </section>

      <section
        ref={productsRef}
        className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-16 md:py-20"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 pb-6 border-b border-black/10">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-black">
              {titleText}
            </h2>
            <p className="text-sm text-black/60 mt-1">
              Explore premium wigs, hair products, and beauty accessories
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-black/20 hover:border-black transition-colors text-sm"
              type="button"
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
            </button>

            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange("sort", e.target.value)}
              className="px-4 py-2 border border-black/20 bg-transparent text-sm focus:border-black focus:ring-0"
            >
              <option value="">Sort By</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="mb-8 p-6 border border-black/10 bg-[#faf8f6] animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-3 tracking-[0.2em] uppercase text-black">
                  Category
                </label>
                <div className="space-y-2">
                  {["", ...categoryOptions].map((cat) => (
                    <label key={cat || "all"} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="category"
                        checked={filters.category === cat}
                        onChange={() => handleFilterChange("category", cat)}
                        className="accent-black"
                      />
                      <span className="text-sm">{cat || "All"}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3 tracking-[0.2em] uppercase text-black">
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-4 py-2 border-b-2 border-black/20 focus:border-black bg-transparent focus:ring-0"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-black/60">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-serif text-2xl text-black mb-2">No products found</p>
            <p className="text-black/60">Try adjusting your filters</p>
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

              return (
                <div
                  key={pid}
                  className="group bg-white border border-black/10 hover:border-black/25 transition-all duration-300"
                >
                  <div className="relative overflow-hidden">
                    <Link to={`/products/${product.slug}`}>
                      <div className="relative w-full h-80 bg-black/[0.02]">
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
                          <div className="absolute inset-0 w-full h-full bg-black/[0.03]" />
                        )}

                        {canSwap ? (
                          <img
                            src={hoverImg}
                            alt={`${product.name} (on model)`}
                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                    </Link>

                    <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={() => toggleWishlist(pid)}
                        className="w-10 h-10 bg-white border border-black/15 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                        type="button"
                      >
                        <Heart size={18} fill={wishlist.includes(pid) ? "currentColor" : "none"} />
                      </button>
                      <Link
                        to={`/products/${product.slug}`}
                        className="w-10 h-10 bg-white border border-black/15 flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                      >
                        <Eye size={18} />
                      </Link>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-3">
                      <span className="text-xs tracking-[0.2em] uppercase text-black/60">
                        {product.category}
                      </span>
                    </div>

                    <Link to={`/products/${product.slug}`}>
                      <h3 className="font-serif text-xl text-black mb-2 hover:text-black transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    <p className="text-sm text-black/60 mb-4 line-clamp-2">
                      {product.shortDescription}
                    </p>

                    <button
                      onClick={() => addToCart(product)}
                      className="w-full py-3 bg-black text-white border border-black hover:bg-black hover:border-black transition-all duration-300 text-xs tracking-[0.2em] uppercase font-semibold flex items-center justify-center space-x-2"
                      type="button"
                    >
                      <ShoppingCart size={16} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}