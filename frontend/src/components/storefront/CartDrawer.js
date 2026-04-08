import React, { useState, useEffect } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import storage from "@/utils/storage";
import { toast } from "sonner";
import api from "@/api";
 
// ---- helpers ----
function safeArr(x) {
  return Array.isArray(x) ? x : [];
}
 
function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
 
// Converts "/uploads/xxx.jpg" => "http://127.0.0.1:8000/uploads/xxx.jpg" (dev)
// Leaves absolute URLs unchanged
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
 
export default function CartDrawer({ open, onClose }) {
  const [cart, setCart] = useState(null);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
 
  useEffect(() => {
    if (open) loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
 
  const loadCart = async () => {
    setLoading(true);
 
    const cartData =
      (await storage.get("cart")) || { items: [], subtotal: 0, giftWrapTotal: 0, total: 0 };
 
    cartData.items = safeArr(cartData.items);
    setCart(cartData);
 
    try {
      const productPromises = cartData.items.map((item) =>
        api.get(`/products/${item.productId}`)
      );
 
      const responses = await Promise.all(productPromises);
 
      const productsMap = {};
      responses.forEach((res) => {
        const p = res?.data;
        if (p?.id) productsMap[p.id] = p;
        // fallback: if backend returns _id
        else if (p?._id) productsMap[p._id] = p;
      });
 
      setProducts(productsMap);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Could not load cart products. Please refresh.");
    } finally {
      setLoading(false);
    }
  };
 
  const calculateTotals = (cartData, productsMap) => {
    let subtotal = 0;
    let giftWrapTotal = 0;
 
    const items = safeArr(cartData?.items);
 
    items.forEach((item) => {
      const product = productsMap?.[item.productId];
      if (!product) return;
 
      const variants = safeArr(product?.variants);
      const variant = variants.find((v) => String(v?.id) === String(item.variantId));
 
      const basePrice = safeNum(product?.salePrice || product?.basePrice || 0, 0);
      const adj = safeNum(variant?.priceAdjustment || 0, 0);
      const qty = Math.max(1, safeNum(item?.quantity || 1, 1));
 
      subtotal += (basePrice + adj) * qty;
 
      if (item?.giftWrap && product?.giftWrapAvailable) {
        giftWrapTotal += safeNum(product?.giftWrapCost || 0, 0) * qty;
      }
    });
 
    cartData.subtotal = subtotal;
    cartData.giftWrapTotal = giftWrapTotal;
 
    // NOTE: Drawer total excludes shipping (shipping is selected at checkout)
    cartData.total = subtotal + giftWrapTotal;
  };
 
  const updateQuantity = async (itemIndex, delta) => {
    if (!cart) return;
 
    const newCart = { ...cart };
    newCart.items = safeArr(newCart.items);
 
    const currentQty = safeNum(newCart.items[itemIndex]?.quantity || 1, 1);
    newCart.items[itemIndex].quantity = Math.max(1, currentQty + delta);
 
    calculateTotals(newCart, products);
 
    setCart(newCart);
    await storage.set("cart", newCart);
    window.dispatchEvent(new Event("storage-update"));
  };
 
  const removeItem = async (itemIndex) => {
    if (!cart) return;
 
    const newCart = { ...cart };
    newCart.items = safeArr(newCart.items);
    newCart.items.splice(itemIndex, 1);
 
    calculateTotals(newCart, products);
 
    setCart(newCart);
    await storage.set("cart", newCart);
    window.dispatchEvent(new Event("storage-update"));
 
    toast.success("Item removed from cart");
  };
 
  const handleCheckout = () => {
    onClose?.();
    navigate("/checkout");
  };
 
  // Recompute totals whenever products finish loading (prevents stale totals)
  useEffect(() => {
    if (!cart) return;
    const newCart = { ...cart };
    calculateTotals(newCart, products);
    setCart(newCart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);
 
  if (!open) return null;
 
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        onClick={onClose}
      />
 
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white z-50 shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="border-b border-[#E7E0D8] px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[#999] mb-1">Cart</p>
              <h2 className="font-serif text-2xl text-[#111111]">Shopping Cart</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F7F2EE] rounded-lg transition-colors"
              aria-label="Close cart"
              data-testid="close-cart-button"
              type="button"
            >
              <X size={24} className="text-[#111111]" />
            </button>
          </div>
        </div>
 
        {/* Cart Items Container */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 border-2 border-[#E7E0D8] border-t-[#111111] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#999]">Loading cart...</p>
            </div>
          ) : safeArr(cart?.items).length === 0 ? (
            <div className="text-center py-16 px-6" data-testid="empty-cart">
              <ShoppingBag size={56} className="mx-auto text-[#E7E0D8] mb-6" />
              <p className="font-serif text-xl text-[#111111] mb-2">Your cart is empty</p>
              <p className="text-sm text-[#666] mb-8">Explore our collection and add your favorite items</p>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-semibold rounded-none"
                type="button"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">
              {safeArr(cart?.items).map((item, index) => {
                const product = products?.[item.productId];
                if (!product) return null;
 
                const variants = safeArr(product?.variants);
                const variant = variants.find((v) => String(v?.id) === String(item.variantId));
 
                const price = safeNum(product?.salePrice || product?.basePrice || 0, 0);
                const itemPrice = price + safeNum(variant?.priceAdjustment || 0, 0);
 
                const img = safeArr(product?.images)?.length > 0 ? product.images[0] : "";
 
                return (
                  <div
                    key={`${item.productId}-${item.variantId}-${index}`}
                    className="flex gap-4 pb-4 border-b border-[#F0EBE5] last:border-b-0"
                    data-testid={`cart-item-${index}`}
                  >
                    {img ? (
                      <img
                        src={absolutizeMaybe(img)}
                        alt={product?.name || "Product"}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-[#F7F2EE] rounded-lg flex-shrink-0" />
                    )}
 
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif text-[15px] text-[#111111] leading-tight mb-1">
                          {product?.name || "Item"}
                        </h3>
 
                        <p className="text-xs text-[#999] mb-2">
                          {variant?.color || "Default"}
                          {variant?.size ? ` • ${variant.size}` : ""}
                        </p>
 
                        {item?.giftWrap && product?.giftWrapAvailable && (
                          <p className="text-xs text-[#B89E8A] mb-2">+ Gift wrap</p>
                        )}
 
                        <p className="text-sm font-semibold text-[#111111]">
                          KES {itemPrice.toLocaleString()}
                        </p>
                      </div>
 
                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-[#E7E0D8] rounded-none">
                          <button
                            onClick={() => updateQuantity(index, -1)}
                            className="p-1.5 hover:bg-[#F7F2EE] transition-colors"
                            data-testid={`decrease-quantity-${index}`}
                            type="button"
                          >
                            <Minus size={14} className="text-[#111111]" />
                          </button>
 
                          <span className="text-sm font-semibold w-8 text-center text-[#111111]">
                            {safeNum(item?.quantity || 1, 1)}
                          </span>
 
                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="p-1.5 hover:bg-[#F7F2EE] transition-colors"
                            data-testid={`increase-quantity-${index}`}
                            type="button"
                          >
                            <Plus size={14} className="text-[#111111]" />
                          </button>
                        </div>
 
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1.5 text-[#999] hover:text-red-500 hover:bg-red-50 transition-colors rounded-none"
                          data-testid={`remove-item-${index}`}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
 
        {/* Footer / Checkout Section */}
        {safeArr(cart?.items).length > 0 && (
          <div className="border-t border-[#E7E0D8] px-6 py-6 bg-white flex-shrink-0 space-y-4">
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#666]">Subtotal</span>
                <span className="text-[#111111] font-semibold">
                  KES {safeNum(cart?.subtotal || 0, 0).toLocaleString()}
                </span>
              </div>
 
              {safeNum(cart?.giftWrapTotal || 0, 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#666]">Gift Wrap</span>
                  <span className="text-[#111111] font-semibold">
                    KES {safeNum(cart?.giftWrapTotal || 0, 0).toLocaleString()}
                  </span>
                </div>
              )}
 
              <div className="flex justify-between text-base pt-2.5 border-t border-[#E7E0D8]">
                <span className="font-serif text-[#111111]">Total</span>
                <span className="font-serif font-bold text-[#111111]">
                  KES {safeNum(cart?.total || 0, 0).toLocaleString()}
                </span>
              </div>
            </div>
 
            <button
              onClick={handleCheckout}
              className="w-full py-3.5 bg-[#111111] text-white border border-[#111111] hover:bg-white hover:text-[#111111] transition-all duration-300 text-xs tracking-wider uppercase font-semibold rounded-none"
              data-testid="checkout-button"
              type="button"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
 