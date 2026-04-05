import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Loader2,
  AlertCircle,
  Smartphone,
  Copy as CopyIcon,
  MapPin,
  Phone as PhoneIcon,
} from "lucide-react";
import storage from "@/utils/storage";
import analytics from "@/utils/analytics";
import { toast } from "sonner";

import api from "@/api";

// ---- helpers ----
function buildOrderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `LX-${ymd}-${rand}`;
}

function safeStr(x) {
  return String(x ?? "").trim();
}

function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
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
  const imgs = safeArr(product?.images);
  return imgs[0] || "";
}

export default function Checkout() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState(null);
  const [products, setProducts] = useState({});
  const [shippingMethods, setShippingMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [order, setOrder] = useState(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [purchaseTracked, setPurchaseTracked] = useState(false);

  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    isGuest: true,
  });

  const [deliveryInfo, setDeliveryInfo] = useState({
    address: "",
    city: "",
    county: "",
    method: "",
    cost: 0,
  });

  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState("");

  const totals = useMemo(() => {
    let subtotal = 0;
    let giftWrapTotal = 0;

    safeArr(cart?.items).forEach((item) => {
      const product = products?.[item.productId];
      if (!product) return;

      const variant = safeArr(product.variants).find((v) => v?.id === item.variantId);

      const basePrice = safeNum(product.salePrice || product.basePrice || 0, 0);
      const adj = safeNum(variant?.priceAdjustment || 0, 0);
      const qty = safeNum(item.quantity || 0, 0);
      const itemPrice = basePrice + adj;

      subtotal += itemPrice * qty;

      if (item.giftWrap && product.giftWrapAvailable) {
        giftWrapTotal += safeNum(product.giftWrapCost || 0, 0) * qty;
      }
    });

    const shippingCost = safeNum(deliveryInfo.cost || 0, 0);
    const total = subtotal + giftWrapTotal + shippingCost;

    return { subtotal, giftWrapTotal, shippingCost, total };
  }, [cart, products, deliveryInfo]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (step !== 3 || !order?.orderNumber) return;

    let mounted = true;
    let intervalId;

    const pollStatus = async () => {
      if (!mounted || !order?.orderNumber) return;

      try {
        setCheckingPaymentStatus(true);

        const res = await api.get(`/orders/track/${order.orderNumber}`);
        const latest = res?.data;

        if (!latest) return;

        setOrder((prev) => ({
          ...(prev || {}),
          ...latest,
          payment: {
            ...(prev?.payment || {}),
            ...(latest.payment || {}),
          },
        }));

        const orderStatus = safeStr(latest?.status).toLowerCase();
        const paymentStatus = safeStr(latest?.payment?.status).toLowerCase();

        const confirmed =
          paymentStatus === "confirmed" ||
          orderStatus === "processing" ||
          orderStatus === "confirmed";

        const failed =
          paymentStatus === "failed" ||
          orderStatus === "payment_failed" ||
          orderStatus === "failed" ||
          orderStatus === "cancelled";

        if (confirmed) {
          if (!purchaseTracked) {
            try {
              analytics.purchase(
                latest?.id || latest?._id || order?.id,
                safeNum(latest?.total, 0),
                safeArr(latest?.items)
              );
            } catch (e) {
              console.warn("analytics.purchase failed:", e);
            }

            try {
              await storage.set("cart", { items: [], subtotal: 0, total: 0 });
              window.dispatchEvent(new Event("storage-update"));
            } catch (e) {
              console.warn("Failed to clear cart after payment confirmation", e);
            }

            setPurchaseTracked(true);
            toast.success("Payment confirmed!");
          }

          clearInterval(intervalId);
        }

        if (failed) {
          clearInterval(intervalId);
          toast.error("Payment was not completed.");
        }
      } catch (error) {
        console.warn("Payment status check failed:", error);
      } finally {
        if (mounted) setCheckingPaymentStatus(false);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [step, order?.orderNumber, purchaseTracked, order?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCart(), loadSettings()]);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get(`/settings`);
      const methods = Array.isArray(res?.data?.shippingMethods)
        ? res.data.shippingMethods.filter((m) => m?.active !== false)
        : [];

      setShippingMethods(methods);

      if (methods.length > 0) {
        setDeliveryInfo((prev) => {
          const currentExists = methods.some((m) => m.id === prev.method);
          if (currentExists) {
            const current = methods.find((m) => m.id === prev.method);
            return {
              ...prev,
              cost: safeNum(current?.price, 0),
            };
          }

          return {
            ...prev,
            method: safeStr(methods[0]?.id),
            cost: safeNum(methods[0]?.price, 0),
          };
        });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setShippingMethods([]);
    }
  };

  const loadCart = async () => {
    const cartData = await storage.get("cart");

    if (!cartData || !Array.isArray(cartData.items) || cartData.items.length === 0) {
      toast.error("Your cart is empty");
      navigate("/");
      return;
    }

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
        if (!p) return;
        if (p?.id) productsMap[p.id] = p;
        if (p?._id) productsMap[p._id] = p;
      });
      setProducts(productsMap);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Could not load products. Please refresh.");
    }
  };

  const paymentStatus = safeStr(order?.payment?.status).toLowerCase();
  const orderStatus = safeStr(order?.status).toLowerCase();

  const isPaymentConfirmed =
    paymentStatus === "confirmed" ||
    orderStatus === "processing" ||
    orderStatus === "confirmed";

  const isPaymentFailed =
    paymentStatus === "failed" ||
    orderStatus === "payment_failed" ||
    orderStatus === "failed" ||
    orderStatus === "cancelled";

  const isPaymentPending = !!order && !isPaymentConfirmed && !isPaymentFailed;

  const handleCustomerInfoSubmit = (e) => {
    e.preventDefault();

    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.county) {
      toast.error("Please fill in your delivery details");
      return;
    }

    if (!deliveryInfo.method) {
      toast.error("Please select a shipping method");
      return;
    }

    analytics.initiateCheckout(totals.total, safeArr(cart?.items).length || 0);
    setStep(2);
  };

  const handlePayment = async () => {
    if (paymentMethod === "mpesa" && !mpesaPhone) {
      toast.error("Please enter your M-Pesa phone number");
      return;
    }

    setProcessingPayment(true);

    try {
      toast.info("Sending M-Pesa STK Push. Check your phone...");

      const stkResponse = await api.post("/mpesa/stkpush", {
        phone: mpesaPhone,
        amount: Math.round(totals.total),
        accountReference: "PAM Beauty",
        transactionDesc: "Payment",
      });

      const safaricomResponse = stkResponse?.data?.safaricom_response || stkResponse?.data;

      if (!safaricomResponse || safaricomResponse.ResponseCode !== "0") {
        const errMsg =
          safaricomResponse?.errorMessage ||
          safaricomResponse?.ResponseDescription ||
          "Failed to send STK push";
        throw new Error(errMsg);
      }

      const orderNumber = buildOrderNumber();
      const nowIso = new Date().toISOString();

      const orderData = {
        orderNumber,
        customer: {
          ...customerInfo,
          phone: safeStr(customerInfo.phone),
        },
        delivery: {
          ...deliveryInfo,
          method: safeStr(deliveryInfo.method),
          cost: safeNum(deliveryInfo.cost, 0),
        },
        items: safeArr(cart?.items),
        subtotal: totals.subtotal,
        giftWrapTotal: totals.giftWrapTotal,
        discount: 0,
        shippingCost: totals.shippingCost,
        total: totals.total,
        payment: {
          method: "M-Pesa",
          status: "pending",
          mpesaTransactionId: null,
          confirmedAt: null,
          checkoutRequestID: safaricomResponse.CheckoutRequestID || null,
          merchantRequestID: safaricomResponse.MerchantRequestID || null,
          phone: safeStr(mpesaPhone),
        },
        status: "pending_payment",
        statusHistory: [
          {
            status: "pending_payment",
            at: nowIso,
            timestamp: nowIso,
            note: "M-Pesa STK push sent. Awaiting payment confirmation.",
          },
        ],
      };

      const response = await api.post(`/orders`, orderData);
      setOrder(response.data);

      try {
        await storage.set("lastOrder", {
          orderNumber: response.data?.orderNumber || orderNumber,
          phone: safeStr(customerInfo.phone),
          createdAt: nowIso,
        });
      } catch (e) {
        console.warn("Failed to store lastOrder", e);
      }

      toast.success("STK Push sent successfully");
      setStep(3);
    } catch (error) {
      console.error("Payment error:", error);

      const apiMessage =
        error?.response?.data?.detail?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.safaricom_response?.errorMessage ||
        error?.message;

      toast.error(apiMessage || "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCopyOrderNumber = async () => {
    const orderNo = order?.orderNumber;
    if (!orderNo) return;

    try {
      await navigator.clipboard.writeText(orderNo);
      toast.success("Order number copied");
    } catch (e) {
      try {
        const el = document.createElement("textarea");
        el.value = orderNo;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        toast.success("Order number copied");
      } catch {
        toast.error("Could not copy. Please select and copy manually.");
      }
    }
  };

  const handleGoToTracking = () => {
    const orderNo = safeStr(order?.orderNumber);
    const phone = safeStr(customerInfo.phone);
    if (!orderNo) return;

    const qs = new URLSearchParams();
    qs.set("orderNumber", orderNo);
    if (phone) qs.set("phone", phone);

    navigate(`/track-order?${qs.toString()}`);
  };

  const handleCheckStatusNow = async () => {
    if (!order?.orderNumber) return;

    try {
      setCheckingPaymentStatus(true);
      const res = await api.get(`/orders/track/${order.orderNumber}`);
      const latest = res?.data;

      if (!latest) return;

      setOrder((prev) => ({
        ...(prev || {}),
        ...latest,
        payment: {
          ...(prev?.payment || {}),
          ...(latest.payment || {}),
        },
      }));

      const latestOrderStatus = safeStr(latest?.status).toLowerCase();
      const latestPaymentStatus = safeStr(latest?.payment?.status).toLowerCase();

      const confirmed =
        latestPaymentStatus === "confirmed" ||
        latestOrderStatus === "processing" ||
        latestOrderStatus === "confirmed";

      const failed =
        latestPaymentStatus === "failed" ||
        latestOrderStatus === "payment_failed" ||
        latestOrderStatus === "failed" ||
        latestOrderStatus === "cancelled";

      if (confirmed && !purchaseTracked) {
        try {
          analytics.purchase(
            latest?.id || latest?._id || order?.id,
            safeNum(latest?.total, 0),
            safeArr(latest?.items)
          );
        } catch (e) {
          console.warn("analytics.purchase failed:", e);
        }

        try {
          await storage.set("cart", { items: [], subtotal: 0, total: 0 });
          window.dispatchEvent(new Event("storage-update"));
        } catch (e) {
          console.warn("Failed to clear cart after payment confirmation", e);
        }

        setPurchaseTracked(true);
        toast.success("Payment confirmed!");
      }

      if (failed) {
        toast.error("Payment was not completed.");
      }

      if (!confirmed && !failed) {
        toast.info("Payment is still pending. Please complete the prompt on your phone.");
      }
    } catch (error) {
      console.error("Manual payment status check failed:", error);
      toast.error("Could not check payment status right now.");
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center">
        <div className="inline-block w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] py-12">
      <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1400px]">
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-black mb-8">
          Checkout
        </h1>

        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= 1
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 text-neutral-500"
              }`}
            >
              {step > 1 ? <Check size={20} /> : <span>1</span>}
            </div>
            <div
              className={`h-0.5 w-24 ${
                step >= 2 ? "bg-black" : "bg-neutral-300"
              }`}
            />
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= 2
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 text-neutral-500"
              }`}
            >
              {step > 2 ? <Check size={20} /> : <span>2</span>}
            </div>
            <div
              className={`h-0.5 w-24 ${
                step >= 3 ? "bg-black" : "bg-neutral-300"
              }`}
            />
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= 3
                  ? "border-black bg-black text-white"
                  : "border-neutral-300 text-neutral-500"
              }`}
            >
              {step === 3 && isPaymentConfirmed ? <Check size={20} /> : <span>3</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {step === 1 && (
              <form onSubmit={handleCustomerInfoSubmit}>
                <div className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-[28px] p-8 mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
                  <h2 className="font-serif text-2xl text-black mb-6">
                    Contact Information
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.name}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, name: e.target.value })
                        }
                        className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                        required
                        data-testid="customer-name"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, email: e.target.value })
                        }
                        className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                        required
                        data-testid="customer-email"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) =>
                          setCustomerInfo({ ...customerInfo, phone: e.target.value })
                        }
                        placeholder="+254 7XX XXX XXX"
                        className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                        required
                        data-testid="customer-phone"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-[28px] p-8 mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
                  <h2 className="font-serif text-2xl text-black mb-6">
                    Delivery Address
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={deliveryInfo.address}
                        onChange={(e) =>
                          setDeliveryInfo({ ...deliveryInfo, address: e.target.value })
                        }
                        className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                        required
                        data-testid="delivery-address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                          City *
                        </label>
                        <input
                          type="text"
                          value={deliveryInfo.city}
                          onChange={(e) =>
                            setDeliveryInfo({ ...deliveryInfo, city: e.target.value })
                          }
                          className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                          required
                          data-testid="delivery-city"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                          County *
                        </label>
                        <input
                          type="text"
                          value={deliveryInfo.county}
                          onChange={(e) =>
                            setDeliveryInfo({ ...deliveryInfo, county: e.target.value })
                          }
                          className="w-full rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-3 text-neutral-900 outline-none focus:border-black"
                          required
                          data-testid="delivery-county"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        Shipping Method
                      </label>

                      <div className="space-y-3">
                        {shippingMethods.length > 0 ? (
                          shippingMethods.map((method) => (
                            <label
                              key={method.id}
                              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-[#fbfbfa] px-4 py-4 cursor-pointer hover:border-black transition-all"
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="radio"
                                  name="shipping"
                                  checked={deliveryInfo.method === method.id}
                                  onChange={() =>
                                    setDeliveryInfo({
                                      ...deliveryInfo,
                                      method: method.id,
                                      cost: safeNum(method.price, 0),
                                    })
                                  }
                                  className="accent-black"
                                />
                                <div>
                                  <p className="text-sm font-semibold text-black">
                                    {safeStr(method.name)}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {safeStr(method.eta || method.description || "")}
                                  </p>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-black">
                                KES {safeNum(method.price, 0).toLocaleString()}
                              </span>
                            </label>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-neutral-300 bg-[#fbfbfa] px-4 py-4 text-sm text-neutral-500">
                            No shipping methods available right now.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full py-4 bg-black text-white hover:bg-neutral-800 transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold shadow-sm"
                  data-testid="continue-to-payment"
                >
                  Continue to Payment
                </button>
              </form>
            )}

            {step === 2 && (
              <div>
                <div className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-[28px] p-8 mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
                  <h2 className="font-serif text-2xl text-black mb-6">
                    Payment Method
                  </h2>

                  <div className="space-y-4 mb-6">
                    <label className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-[#fbfbfa] p-4 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="payment"
                          checked={paymentMethod === "mpesa"}
                          onChange={() => setPaymentMethod("mpesa")}
                          className="accent-black"
                        />
                        <Smartphone size={24} className="text-black" />
                        <div>
                          <p className="text-sm font-semibold text-black">M-Pesa</p>
                          <p className="text-xs text-neutral-500">Pay with your phone</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {paymentMethod === "mpesa" && (
                    <div className="bg-[#fbfbfa] rounded-2xl p-6 border border-neutral-200">
                      <label className="block text-[11px] font-semibold mb-2 tracking-[0.2em] uppercase text-neutral-500">
                        M-Pesa Phone Number
                      </label>
                      <input
                        type="tel"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        placeholder="+254 7XX XXX XXX"
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none focus:border-black mb-4"
                        data-testid="mpesa-phone"
                      />

                      <div className="bg-white rounded-2xl p-4 border border-neutral-200">
                        <p className="text-xs text-neutral-800 mb-2">
                          <strong>How it works:</strong>
                        </p>
                        <ol className="text-xs text-neutral-600 space-y-1 list-decimal list-inside">
                          <li>Enter your M-Pesa registered phone number</li>
                          <li>You’ll receive an STK Push prompt on your phone</li>
                          <li>Enter your M-Pesa PIN to confirm payment</li>
                          <li>Wait until the website confirms payment</li>
                        </ol>
                      </div>

                      <div className="mt-4 p-4 bg-[#f3f3f1] border border-neutral-200 rounded-2xl">
                        <p className="text-xs text-neutral-700 flex items-start space-x-2">
                          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-black" />
                          <span>
                            <strong>Important:</strong> Your order is not confirmed until payment succeeds. If you cancel the M-Pesa prompt, no receipt will be issued.
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-full py-4 border border-neutral-300 text-black hover:bg-white transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={processingPayment}
                    className="flex-1 rounded-full py-4 bg-black text-white hover:bg-neutral-800 transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
                    data-testid="pay-button"
                    type="button"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Pay KES {totals.total.toLocaleString()}</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && order && (
              <div className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-[28px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
                <div className="text-center">
                  <div className="w-16 h-16 bg-black rounded-full mx-auto mb-6 flex items-center justify-center">
                    {isPaymentConfirmed ? (
                      <Check size={32} className="text-white" />
                    ) : checkingPaymentStatus ? (
                      <Loader2 size={32} className="text-white animate-spin" />
                    ) : (
                      <Smartphone size={32} className="text-white" />
                    )}
                  </div>

                  {isPaymentPending && (
                    <>
                      <h2 className="font-serif text-3xl text-black mb-3">
                        Payment Request Sent
                      </h2>

                      <p className="text-sm text-neutral-600 mb-3">
                        We have sent an M-Pesa prompt to your phone.
                      </p>

                      <p className="text-xs text-neutral-500 mb-6">
                        Complete the payment on your phone. Your receipt will only appear after payment confirmation.
                      </p>
                    </>
                  )}

                  {isPaymentConfirmed && (
                    <>
                      <h2 className="font-serif text-3xl text-black mb-3">
                        Order Confirmed
                      </h2>

                      <p className="text-sm text-neutral-600 mb-6">
                        Payment confirmed successfully. Save this order number — you’ll use it to track delivery.
                      </p>
                    </>
                  )}

                  {isPaymentFailed && (
                    <>
                      <h2 className="font-serif text-3xl text-black mb-3">
                        Payment Not Completed
                      </h2>

                      <p className="text-sm text-neutral-600 mb-6">
                        Your M-Pesa payment was not completed. You can go back and try again.
                      </p>
                    </>
                  )}

                  <div className="inline-flex items-center gap-3 bg-[#fbfbfa] px-6 py-4 rounded-2xl border border-neutral-200 mb-3">
                    <p className="text-2xl font-serif text-black tracking-wider">
                      {order.orderNumber}
                    </p>
                    <button
                      onClick={handleCopyOrderNumber}
                      type="button"
                      className="p-2 rounded-full border border-neutral-300 hover:border-black hover:bg-white"
                      title="Copy order number"
                    >
                      <CopyIcon size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-500 mb-8">
                    If you close this page, you can still track using the Order Number.
                  </p>

                  <div className="flex flex-col md:flex-row gap-3 justify-center">
                    {isPaymentPending && (
                      <button
                        onClick={handleCheckStatusNow}
                        className="px-6 py-4 rounded-full bg-black text-white hover:bg-neutral-800 transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                        type="button"
                      >
                        {checkingPaymentStatus ? "Checking..." : "Check Payment Status"}
                      </button>
                    )}

                    {isPaymentConfirmed && (
                      <button
                        onClick={handleGoToTracking}
                        className="px-6 py-4 rounded-full bg-black text-white hover:bg-neutral-800 transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                        type="button"
                        data-testid="go-to-tracking"
                      >
                        Track This Order
                      </button>
                    )}

                    {isPaymentConfirmed && (
                      <button
                        onClick={() => window.print()}
                        className="px-6 py-4 rounded-full border border-neutral-300 text-black hover:bg-white transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                        type="button"
                      >
                        Print Receipt
                      </button>
                    )}

                    {isPaymentFailed && (
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 py-4 rounded-full bg-black text-white hover:bg-neutral-800 transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                        type="button"
                      >
                        Try Payment Again
                      </button>
                    )}

                    <button
                      onClick={() => navigate("/")}
                      className="px-6 py-4 rounded-full border border-neutral-300 text-black hover:bg-white transition-all duration-300 text-sm tracking-[0.2em] uppercase font-semibold"
                      type="button"
                    >
                      Continue Shopping
                    </button>
                  </div>
                </div>

                <div className="mt-10 grid md:grid-cols-3 gap-4">
                  <div className="border border-neutral-200 rounded-2xl p-4 bg-[#fbfbfa]">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 mb-2">
                      Contact
                    </p>
                    <p className="text-sm text-black font-semibold">{customerInfo.name}</p>
                    <p className="text-sm text-neutral-600 inline-flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4" /> {safeStr(customerInfo.phone)}
                    </p>
                  </div>

                  <div className="border border-neutral-200 rounded-2xl p-4 bg-[#fbfbfa]">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 mb-2">
                      Delivery
                    </p>
                    <p className="text-sm text-black inline-flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <span>
                        {safeStr(deliveryInfo.address)} <br />
                        {safeStr(deliveryInfo.city)}, {safeStr(deliveryInfo.county)}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Method:{" "}
                      {safeStr(
                        shippingMethods.find((m) => m.id === deliveryInfo.method)?.name ||
                          deliveryInfo.method
                      )}{" "}
                      • Shipping: KES {safeNum(deliveryInfo.cost || 0, 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="border border-neutral-200 rounded-2xl p-4 bg-[#fbfbfa]">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-500 mb-2">
                      Payment
                    </p>
                    <p className="text-sm text-black font-semibold">M-Pesa</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Status:{" "}
                      <span className="font-semibold text-black">
                        {isPaymentConfirmed
                          ? "confirmed"
                          : isPaymentFailed
                          ? "failed"
                          : "pending confirmation"}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Phone: <span className="font-semibold text-black">{safeStr(mpesaPhone)}</span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Total:{" "}
                      <span className="font-semibold text-black">
                        KES {totals.total.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-[28px] p-8 sticky top-24 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <h2 className="font-serif text-2xl text-black mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                {safeArr(cart?.items).map((item, idx) => {
                  const product = products?.[item.productId];
                  if (!product) return null;

                  const variant = safeArr(product.variants).find((v) => v?.id === item.variantId);

                  const price = safeNum(product.salePrice || product.basePrice || 0, 0);
                  const itemPrice = price + safeNum(variant?.priceAdjustment || 0, 0);

                  const img = absolutizeMaybe(pickDefaultImage(product));

                  return (
                    <div key={idx} className="flex space-x-4 pb-4 border-b border-neutral-200">
                      {img ? (
                        <img
                          src={img}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-neutral-200 bg-[#f3f3f1]" />
                      )}

                      <div className="flex-1">
                        <p className="text-sm font-semibold text-black">{product.name}</p>
                        <p className="text-xs text-neutral-500">
                          {variant?.color || "Default"} × {safeNum(item.quantity || 0, 0)}
                        </p>
                        {item.giftWrap && <p className="text-xs text-black">+ Gift wrap</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-black">
                          KES {(itemPrice * safeNum(item.quantity || 0, 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 pb-6 border-b border-neutral-200">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="text-black font-semibold">
                    KES {safeNum(totals.subtotal || 0, 0).toLocaleString()}
                  </span>
                </div>

                {safeNum(totals.giftWrapTotal || 0, 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Gift Wrap</span>
                    <span className="text-black font-semibold">
                      KES {safeNum(totals.giftWrapTotal || 0, 0).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Shipping</span>
                  <span className="text-black font-semibold">
                    KES {safeNum(totals.shippingCost || 0, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-xl pt-6">
                <span className="font-serif text-black">Total</span>
                <span className="font-serif text-black font-bold">
                  KES {safeNum(totals.total || 0, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mt-10">
          Tip: After checkout, use “Track This Order” to view live status updates.
        </p>
      </div>
    </div>
  );
}