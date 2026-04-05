import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Search,
  PackageCheck,
  Truck,
  Clock,
  CheckCircle2,
  MessageSquareText,
} from "lucide-react";
import api from "@/api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIcon(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("deliver")) return <CheckCircle2 className="h-5 w-5" />;
  if (s.includes("ship") || s.includes("dispatch")) {
    return <Truck className="h-5 w-5" />;
  }
  if (s.includes("confirm") || s.includes("paid") || s.includes("process")) {
    return <PackageCheck className="h-5 w-5" />;
  }
  return <Clock className="h-5 w-5" />;
}

function normalizeHistoryItem(h) {
  if (!h || typeof h !== "object") return null;
  const at = h.at || h.timestamp || h.time || h.createdAt || null;
  return {
    status: String(h.status || "").trim(),
    note: String(h.note || "").trim(),
    at,
  };
}

export default function TrackOrder() {
  const query = useQuery();

  const [orderNumber, setOrderNumber] = useState(query.get("orderNumber") || "");
  const [phone, setPhone] = useState(query.get("phone") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const fetchStatus = async () => {
    const on = orderNumber.trim();
    const ph = phone.trim();

    if (!on) {
      toast.error("Enter your order number");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await api.get(`/orders/track/${encodeURIComponent(on)}`);
      const data = res?.data;

      const serverPhone = String(data?.customer?.phone || "").trim();
      if (ph && serverPhone && ph !== serverPhone) {
        toast.error("Phone number does not match this order");
        setResult(null);
        return;
      }

      setResult(data);
      toast.success("Order status loaded");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Could not find that order";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const on = (query.get("orderNumber") || "").trim();
    if (on) fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedHistory = useMemo(() => {
    const hist = Array.isArray(result?.statusHistory) ? result.statusHistory : [];
    return hist
      .map(normalizeHistoryItem)
      .filter(Boolean)
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [result]);

  const latestCustomerUpdate = useMemo(() => {
    return normalizedHistory.find((item) => item.note)?.note || "";
  }, [normalizedHistory]);

  return (
    <div className="min-h-screen bg-[#fcfcfa] py-12">
      <div className="mx-auto max-w-[1100px] px-6 md:px-12 lg:px-24">
        <div className="mb-10">
          <p className="mb-3 text-[10px] uppercase tracking-[0.35em] text-[#8a8a84]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl tracking-tight text-[#111111] md:text-5xl">
            Track Your Order
          </h1>
          <p className="mt-3 text-[#666666]">
            Enter your <span className="font-semibold text-[#111111]">order number</span>.
            <span className="text-[#8a8a84]"> Phone is optional for extra verification.</span>
          </p>
        </div>

        <div className="rounded-[28px] border border-[#e7e7e2] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Order Number
              </label>
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="PB-2026-0001"
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Phone (optional)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              />
            </div>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#111111] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
              type="button"
            >
              <Search className="h-4 w-4" />
              {loading ? "Checking..." : "Track Order"}
            </button>
          </div>
        </div>

        {result ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-[28px] border border-[#e7e7e2] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#7d7d77]">
                    Order Number
                  </p>
                  <p className="mt-2 font-serif text-2xl text-[#111111]">
                    {result.orderNumber}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#7d7d77]">
                    Current Status
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 font-medium capitalize text-[#111111]">
                    {statusIcon(result.status)}
                    {result.status || "pending"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#7d7d77]">
                    Delivery
                  </p>
                  <p className="mt-2 text-[#111111]">
                    {result.delivery?.city || ""}
                    {result.delivery?.city ? ", " : ""}
                    {result.delivery?.county || ""}
                  </p>
                  <p className="mt-1 text-sm text-[#777777]">
                    Method: {result.delivery?.method || "standard"} • Cost: KES{" "}
                    {Number(result.delivery?.cost || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {latestCustomerUpdate ? (
                <div className="mt-6 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-[#777777]" />
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#7d7d77]">
                      Latest Update
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-[#111111]">
                    {latestCustomerUpdate}
                  </p>
                </div>
              ) : null}

              {result.trackingUrl ? (
                <div className="mt-6 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-5">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-[#7d7d77]">
                    Tracking Link
                  </p>
                  <a
                    className="break-all text-[#111111] underline-offset-4 transition hover:underline"
                    href={result.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.trackingUrl}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-[#e7e7e2] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <h2 className="mb-5 font-serif text-2xl text-[#111111]">
                Status Updates
              </h2>

              {normalizedHistory.length > 0 ? (
                <div className="space-y-3">
                  {normalizedHistory.map((h, idx) => (
                    <div
                      key={`${h.at || "time"}-${idx}`}
                      className="flex items-start justify-between gap-4 rounded-[20px] border border-[#e7e7e2] bg-[#fcfcfa] p-4"
                    >
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-2 font-medium capitalize text-[#111111]">
                          {statusIcon(h.status)}
                          {h.status || "updated"}
                        </p>
                        {h.note ? (
                          <p className="mt-1 text-sm leading-relaxed text-[#666666]">
                            {h.note}
                          </p>
                        ) : null}
                      </div>
                      <p className="whitespace-nowrap text-xs text-[#8a8a84]">
                        {formatDate(h.at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[20px] border border-[#e7e7e2] bg-[#fcfcfa] p-4 text-[#777777]">
                  No updates yet. Check again soon.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}