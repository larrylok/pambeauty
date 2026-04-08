import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Trash2, Share2, X, Copy } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-2 border-[#E7E0D8] border-t-[#111111] rounded-full animate-spin mb-4"></div>
          <p className="text-[#999]">Loading your wishlist...</p>
        </div>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-16 md:py-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-[#999] mb-3">
              Personal
            </p>
            <h1 className="font-serif text-5xl md:text-6xl text-[#111111] mb-4">
              My Wishlist
            </h1>
            <p className="text-sm text-[#666]">
              {products.length} {products.length === 1 ? "item" : "items"} saved
            </p>
          </div>
 
          {products.length > 0 && (
            <button
              onClick={handleShare}
              className="flex items-center gap-3 px-8 py-3.5 border border-[#E7E0D8] text-[#111111] hover:border-[#111111] hover:bg-[#F8F6F4] transition-all duration-300 text-xs tracking-wider uppercase font-semibold rounded-lg"
              data-testid="share-wishlist-button"
            >
              <Share2 size={18} />
              <span>Share Wishlist</span>
            </button>
          )}
        </div>
 
        {/* Empty State */}
        {products.length === 0 ? (
          <div className="text-center py-24" data-testid="empty-wishlist">
            <div className="inline-block mb-6">
              <Heart size={72} className="text-[#E7E0D8]" />
            </div>
            <p className="font-serif text-3xl text-[#111111] mb-3">
              Your wishlist is empty
            </p>
            <p className="text-[#666] mb-10 text-sm">
              Save your favorite beauty products for later
            </p>
            <Link
              to="/"
              className="inline-block px-8 py-3.5 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-semibold rounded-lg"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product) => {
              const productId = getProductId(product);
              const productImg = absolutizeImage(product.images?.[0]);
 
              return (
                <div
                  key={productId}
                  className="group bg-white border border-[#E7E0D8] hover:border-[#111111] hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] transition-all duration-300 rounded-lg overflow-hidden"
                  data-testid={`wishlist-product-${productId}`}
                >
                  {/* Image Container */}
                  <div className="relative overflow-hidden aspect-square bg-[#F8F6F4]">
                    <Link to={`/products/${product.slug}`}>
                      {productImg ? (
                        <img
                          src={productImg}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#F0EBDE]" />
                      )}
                    </Link>
 
                    {/* Badges */}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {product.isBestseller && (
                        <span className="px-3 py-1.5 bg-[#111111] text-white text-[10px] tracking-[0.15em] uppercase font-semibold">
                          Bestseller
                        </span>
                      )}
                      {product.discountPercentage > 0 && (
                        <span className="px-3 py-1.5 bg-red-600 text-white text-[10px] tracking-[0.15em] uppercase font-semibold">
                          -{Math.round(product.discountPercentage)}%
                        </span>
                      )}
                    </div>
 
                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromWishlist(productId)}
                      className="absolute top-4 right-4 w-10 h-10 bg-white border border-[#E7E0D8] text-[#111111] flex items-center justify-center hover:bg-red-600 hover:border-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 rounded-lg"
                      data-testid={`remove-wishlist-${productId}`}
                      title="Remove from wishlist"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
 
                  {/* Product Info */}
                  <div className="p-6">
                    {/* Category */}
                    <div className="mb-3">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-[#999]">
                        {product.category}
                      </span>
                    </div>
 
                    {/* Product Name */}
                    <Link to={`/products/${product.slug}`}>
                      <h3 className="font-serif text-lg text-[#111111] mb-2 group-hover:text-[#666] transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>
 
                    {/* Description */}
                    <p className="text-xs text-[#999] mb-4 line-clamp-2">
                      {product.shortDescription}
                    </p>
 
                    {/* Pricing */}
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
 
                    {/* Rating */}
                    {product.averageRating > 0 && (
                      <div className="flex items-center gap-2 mb-4 text-xs text-[#999]">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < Math.round(product.averageRating) ? "text-[#B89E8A]" : "text-[#E7E0D8]"}>
                              ★
                            </span>
                          ))}
                        </div>
                        <span>({product.reviewCount || 0})</span>
                      </div>
                    )}
 
                    {/* Add to Cart Button */}
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full py-3 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-[0.2em] uppercase font-semibold flex items-center justify-center gap-2 rounded-lg"
                      data-testid={`add-to-cart-${productId}`}
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
      </div>
 
      {/* Share Modal */}
      {shareModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setShareModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="bg-white border border-[#E7E0D8] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-8 max-w-lg w-full animate-slide-down">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] tracking-[0.35em] uppercase text-[#999] mb-2">
                    Share
                  </p>
                  <h3 className="font-serif text-2xl text-[#111111]">
                    Share Wishlist
                  </h3>
                </div>
                <button
                  onClick={() => setShareModalOpen(false)}
                  className="p-2 hover:bg-[#F8F6F4] rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
 
              {/* Description */}
              <p className="text-sm text-[#666] mb-6">
                Share this link with friends and family so they can see your favorite beauty products
              </p>
 
              {/* Share URL Input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-4 py-3 border border-[#E7E0D8] bg-[#F8F6F4] text-sm text-[#111111] rounded-lg focus:border-[#111111] focus:ring-0"
                />
                <button
                  onClick={copyShareUrl}
                  className="px-6 py-3 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-semibold rounded-lg flex items-center gap-2"
                >
                  <Copy size={16} />
                  Copy
                </button>
              </div>
 
              {/* Footer Note */}
              <p className="text-xs text-[#999] text-center">
                Anyone with this link can view your saved products
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
 