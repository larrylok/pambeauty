import React, { useState, useEffect, useMemo } from "react";
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
        className="fixed inset-0 bg-charcoal/60 z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-card z-50 shadow-2xl transform transition-transform duration-300">
        {/* Header */}
        <div className="border-b-2 border-gold/20 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl tracking-tight text-charcoal">Shopping Cart</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary transition-colors"
              aria-label="Close cart"
              data-testid="close-cart-button"
              type="button"
            >
              <X size={24} className="text-charcoal" />
            </button>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex flex-col h-[calc(100%-80px)]">
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-graphite">Loading cart...</p>
              </div>
            ) : safeArr(cart?.items).length === 0 ? (
              <div className="text-center py-12" data-testid="empty-cart">
                <ShoppingBag size={64} className="mx-auto text-gold/30 mb-4" />
                <p className="font-serif text-xl text-charcoal mb-2">Your cart is empty</p>
                <p className="text-sm text-graphite mb-6">Add some beautiful jewelry to get started</p>
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-charcoal text-gold border border-gold hover:bg-transparent hover:text-charcoal transition-all duration-300 text-xs tracking-widest uppercase font-bold"
                  type="button"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {safeArr(cart?.items).map((item, index) => {
                  const product = products?.[item.productId];
                  if (!product) return null;

                  const variants = safeArr(product?.variants);
                  const variant = variants.find((v) => String(v?.id) === String(item.variantId));

                  const price = safeNum(product?.salePrice || product?.basePrice || 0, 0);
                  const itemPrice = price + safeNum(variant?.priceAdjustment || 0, 0);

                  const img =
                    safeArr(product?.images)?.length > 0 ? product.images[0] : "";

                  return (
                    <div
                      key={`${item.productId}-${item.variantId}-${index}`}
                      className="flex space-x-4 border border-gold/20 p-4"
                      data-testid={`cart-item-${index}`}
                    >
                      {img ? (
                        <img
                          src={absolutizeMaybe(img)}
                          alt={product?.name || "Product"}
                          className="w-24 h-24 object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 border border-gold/20 bg-black/5" />
                      )}

                      <div className="flex-1">
                        <h3 className="font-serif text-base text-charcoal mb-1">
                          {product?.name || "Item"}
                        </h3>

                        {variant ? (
                          <p className="text-xs text-graphite mb-2">
                            {variant?.color || "Default"}{" "}
                            {variant?.size ? `- ${variant.size}` : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-graphite mb-2">Default</p>
                        )}

                        {item?.giftWrap && product?.giftWrapAvailable && (
                          <p className="text-xs text-gold mb-2">+ Gift wrap</p>
                        )}

                        <p className="text-sm font-bold text-charcoal">
                          KES {itemPrice.toLocaleString()}
                        </p>

                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-2 border border-gold/30">
                            <button
                              onClick={() => updateQuantity(index, -1)}
                              className="p-2 hover:bg-secondary transition-colors"
                              data-testid={`decrease-quantity-${index}`}
                              type="button"
                            >
                              <Minus size={14} />
                            </button>

                            <span className="text-sm font-bold w-8 text-center">
                              {safeNum(item?.quantity || 1, 1)}
                            </span>

                            <button
                              onClick={() => updateQuantity(index, 1)}
                              className="p-2 hover:bg-secondary transition-colors"
                              data-testid={`increase-quantity-${index}`}
                              type="button"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 transition-colors"
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

          {/* Footer */}
          {safeArr(cart?.items).length > 0 && (
            <div className="border-t-2 border-gold/20 p-6 bg-secondary">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-graphite">Subtotal</span>
                  <span className="text-charcoal font-bold">
                    KES {safeNum(cart?.subtotal || 0, 0).toLocaleString()}
                  </span>
                </div>

                {safeNum(cart?.giftWrapTotal || 0, 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-graphite">Gift Wrap</span>
                    <span className="text-charcoal font-bold">
                      KES {safeNum(cart?.giftWrapTotal || 0, 0).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-lg border-t border-gold/20 pt-3">
                  <span className="font-serif text-charcoal">Total</span>
                  <span className="font-serif text-gold font-bold">
                    KES {safeNum(cart?.total || 0, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 bg-charcoal text-gold border border-gold hover:bg-transparent hover:text-charcoal transition-all duration-300 text-xs tracking-widest uppercase font-bold"
                data-testid="checkout-button"
                type="button"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}