import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Trash2, Share2, X } from "lucide-react";
import axios from "axios";
import storage from "@/utils/storage";
import analytics from "@/utils/analytics";
import { toast } from "sonner";

const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API = `${API_BASE}/api`;

function getProductId(product) {
  return product?.id || product?._id || "";
}

function absolutizeImage(url) {
  const u = String(url || "");
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${API_BASE}${u}`;
}

export default function Wishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    loadWishlist();
    analytics.pageView("Wishlist");
  }, []);

  const loadWishlist = async () => {
    setLoading(true);
    const wishlistIds = (await storage.get("wishlist")) || [];
    const safeWishlistIds = Array.isArray(wishlistIds) ? wishlistIds : [];
    setWishlist(safeWishlistIds);

    if (safeWishlistIds.length > 0) {
      try {
        const response = await axios.get(`${API}/products`, {
          params: { limit: 100 },
        });

        const allProducts = response.data?.products || [];
        const wishlistProducts = allProducts.filter((p) =>
          safeWishlistIds.includes(getProductId(p))
        );

        setProducts(wishlistProducts);
      } catch (error) {
        console.error("Error loading wishlist products:", error);
        toast.error("Failed to load wishlist");
      }
    } else {
      setProducts([]);
    }

    setLoading(false);
  };

  const removeFromWishlist = async (productId) => {
    const newWishlist = wishlist.filter((id) => id !== productId);
    setWishlist(newWishlist);
    setProducts(products.filter((p) => getProductId(p) !== productId));
    await storage.set("wishlist", newWishlist);
    window.dispatchEvent(new Event("storage-update"));
    toast.success("Removed from wishlist");
  };

  const addToCart = async (product) => {
    if (!product.variants || product.variants.length === 0) {
      toast.error("Product has no variants available");
      return;
    }

    const defaultVariant = product.variants[0];
    const productId = getProductId(product);

    if (defaultVariant.stock <= 0 && !product.allowPreorder) {
      toast.error("Product is out of stock");
      return;
    }

    const cart = (await storage.get("cart")) || {
      items: [],
      subtotal: 0,
      total: 0,
    };

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId === productId && item.variantId === defaultVariant.id
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += 1;
    } else {
      cart.items.push({
        productId,
        variantId: defaultVariant.id,
        quantity: 1,
        giftWrap: false,
        giftMessage: null,
        giftReceipt: false,
        isPreorder: defaultVariant.stock <= 0 && product.allowPreorder,
      });
    }

    await storage.set("cart", cart);
    window.dispatchEvent(new Event("storage-update"));
    analytics.addToCart(
      productId,
      product.name,
      defaultVariant,
      1,
      product.basePrice
    );
    toast.success("Added to cart");
  };

  const handleShare = () => {
    const wishlistData = {
      items: wishlist,
      timestamp: new Date().toISOString(),
    };

    const encodedData = btoa(JSON.stringify(wishlistData));
    const url = `${window.location.origin}/wishlist?shared=${encodedData}`;

    setShareUrl(url);
    setShareModalOpen(true);
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Wishlist link copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block w-12 h-12 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px]">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-charcoal mb-2">
              My Wishlist
            </h1>
            <p className="text-graphite">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>

          {products.length > 0 && (
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-6 py-3 border border-gold hover:bg-gold hover:text-white transition-all duration-300 text-sm tracking-widest uppercase font-bold"
              data-testid="share-wishlist-button"
            >
              <Share2 size={18} />
              <span>Share Wishlist</span>
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-wishlist">
            <Heart size={64} className="mx-auto text-gold/30 mb-4" />
            <p className="font-serif text-2xl text-charcoal mb-2">
              Your wishlist is empty
            </p>
            <p className="text-graphite mb-8">
              Save your favorite items for later
            </p>
            <Link
              to="/"
              className="inline-block px-8 py-3 bg-charcoal text-gold border border-gold hover:bg-transparent hover:text-charcoal transition-all duration-300 text-sm tracking-widest uppercase font-bold"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product) => {
              const productId = getProductId(product);

              return (
                <div
                  key={productId}
                  className="product-card bg-card border border-gold/20 hover:border-gold transition-all duration-300 group"
                  data-testid={`wishlist-product-${productId}`}
                >
                  <div className="relative overflow-hidden">
                    <Link to={`/products/${product.slug}`}>
                      <img
                        src={absolutizeImage(product.images?.[0])}
                        alt={product.name}
                        className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>

                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {product.isBestseller && (
                        <span className="px-3 py-1 bg-gold text-white text-xs tracking-widest uppercase font-bold">
                          Bestseller
                        </span>
                      )}
                      {product.discountPercentage && (
                        <span className="px-3 py-1 bg-destructive text-white text-xs tracking-widest uppercase font-bold">
                          -{Math.round(product.discountPercentage)}%
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromWishlist(productId)}
                      className="absolute top-4 right-4 w-10 h-10 bg-pearl border border-gold flex items-center justify-center hover:bg-destructive hover:text-white hover:border-destructive transition-colors opacity-0 group-hover:opacity-100"
                      data-testid={`remove-wishlist-${productId}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="mb-3">
                      <span className="text-xs tracking-widest uppercase text-graphite">
                        {product.category}
                      </span>
                    </div>

                    <Link to={`/products/${product.slug}`}>
                      <h3 className="font-serif text-xl text-charcoal mb-2 hover:text-gold transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    <p className="text-sm text-graphite mb-4 line-clamp-2">
                      {product.shortDescription}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {product.salePrice ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-xl font-light text-gold">
                              KES {product.salePrice.toLocaleString()}
                            </span>
                            <span className="text-sm text-graphite line-through">
                              KES {product.basePrice.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xl font-light text-charcoal">
                            KES {product.basePrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {product.averageRating > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-gold">★</span>
                          <span className="text-sm font-bold">
                            {product.averageRating}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      className="w-full py-3 bg-transparent border border-gold text-charcoal hover:bg-charcoal hover:text-gold transition-all duration-300 text-xs tracking-widest uppercase font-bold flex items-center justify-center space-x-2"
                      data-testid={`add-to-cart-${productId}`}
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
      </div>

      {shareModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-charcoal/60 z-50"
            onClick={() => setShareModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="bg-card border-2 border-gold p-8 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-2xl text-charcoal">
                  Share Wishlist
                </h3>
                <button
                  onClick={() => setShareModalOpen(false)}
                  className="p-2 hover:bg-secondary transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-sm text-graphite mb-4">
                Share this link with friends and family
              </p>

              <div className="flex space-x-2 mb-6">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gold/30 bg-secondary text-sm"
                />
                <button
                  onClick={copyShareUrl}
                  className="px-6 py-3 bg-charcoal text-gold border border-gold hover:bg-transparent hover:text-charcoal transition-all duration-300 text-xs tracking-widest uppercase font-bold"
                >
                  Copy
                </button>
              </div>

              <p className="text-xs text-graphite">
                Anyone with this link will be able to view your wishlist
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}