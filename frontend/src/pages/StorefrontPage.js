import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useSearchParams, Link } from "react-router-dom";
import { Heart, ShoppingCart, Eye, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import api from "@/api";
import storage from "@/utils/storage";
import analytics from "@/utils/analytics";

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
  return product?.primaryImage || product?.images?.[0] || "";
}

function pickHoverImage(product) {
  return product?.modelImage || product?.images?.[1] || "";
}

export default function StorefrontPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isCategoryRoute = location.pathname.startsWith("/categories/");
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState(null);
  const [products, setProducts] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    sort: searchParams.get("sort") || "",
  });

  useEffect(() => {
    loadWishlist();
  }, []);

  useEffect(() => {
    analytics.pageView(isCategoryRoute ? `Category:${slug}` : `Page:${slug}`);
    loadStorefrontPage();
  }, [slug, location.pathname]);

  useEffect(() => {
    setFilters({
      search: searchParams.get("search") || "",
      sort: searchParams.get("sort") || "",
    });
  }, [searchParams]);

  const loadWishlist = async () => {
    const wl = (await storage.get("wishlist")) || [];
    setWishlist(Array.isArray(wl) ? wl : []);
  };

  const loadStorefrontPage = async () => {
    setLoading(true);
    try {
      const endpoint = isCategoryRoute
        ? `/storefront/categories/${slug}`
        : `/storefront/pages/${slug}`;

      const response = await api.get(endpoint);
      const data = response?.data || {};

      setPageData(data.page || data.category || null);
      setProducts(data.products || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load page");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);

    const params = {};
    if (next.search) params.search = next.search;
    if (next.sort) params.sort = next.sort;

    setSearchParams(params);
  };

  const toggleWishlist = async (id) => {
    let newWishlist = [...wishlist];
    const index = newWishlist.indexOf(id);

    if (index > -1) {
      newWishlist.splice(index, 1);
      toast.success("Removed from wishlist");
    } else {
      newWishlist.push(id);
      toast.success("Added to wishlist");
    }

    setWishlist(newWishlist);
    await storage.set("wishlist", newWishlist);
    window.dispatchEvent(new Event("storage-update"));
  };

  const addToCart = async (product) => {
    const variant = product?.variants?.[0];
    if (!variant) return toast.error("Unavailable");

    const cart = (await storage.get("cart")) || { items: [] };

    cart.items.push({
      productId: normalizeId(product),
      variantId: variant.id,
      quantity: 1,
    });

    await storage.set("cart", cart);
    toast.success("Added to cart");
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q)
      );
    }

    if (filters.sort === "price_asc") {
      list.sort((a, b) => (a.salePrice || a.basePrice) - (b.salePrice || b.basePrice));
    } else if (filters.sort === "price_desc") {
      list.sort((a, b) => (b.salePrice || b.basePrice) - (a.salePrice || a.basePrice));
    }

    return list;
  }, [products, filters]);

  const title = pageData?.name || "Collection";
  const description =
    pageData?.description || "Explore curated beauty and hair essentials.";

  return (
    <div className="min-h-screen bg-white">
      <section className="container mx-auto px-6 md:px-12 lg:px-24 py-16 max-w-[1400px]">

        {/* HEADER */}
        <div className="mb-12 border-b border-black/10 pb-6">
          <h1 className="font-serif text-3xl md:text-4xl text-black">
            {title}
          </h1>
          <p className="text-black/60 mt-2 max-w-xl">{description}</p>
          <p className="text-sm text-black/50 mt-2">
            {filteredProducts.length} products
          </p>
        </div>

        {/* FILTERS */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-black/20 text-sm hover:bg-black hover:text-white transition"
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>

          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
            className="px-4 py-2 border border-black/20 text-sm"
          >
            <option value="">Sort</option>
            <option value="price_asc">Low → High</option>
            <option value="price_desc">High → Low</option>
          </select>
        </div>

        {showFilters && (
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="mb-6 w-full px-4 py-2 border border-black/20"
          />
        )}

        {/* PRODUCTS */}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredProducts.map((product) => {
              const id = normalizeId(product);
              const img = absolutizeMaybe(pickDefaultImage(product));

              return (
                <div key={id} className="group">

                  <Link to={`/products/${product.slug}`}>
                    <div className="w-full h-80 bg-[#f7f2ee] overflow-hidden">
                      {img && (
                        <img
                          src={img}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      )}
                    </div>
                  </Link>

                  <div className="mt-4">
                    <h3 className="font-serif text-lg text-black">
                      {product.name}
                    </h3>

                    <p className="text-sm text-black/60">
                      KES {Number(product.salePrice || product.basePrice || 0).toLocaleString()}
                    </p>

                    <button
                      onClick={() => addToCart(product)}
                      className="mt-3 w-full py-2 border border-black text-black hover:bg-black hover:text-white transition text-xs uppercase tracking-wide"
                    >
                      Add to Cart
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