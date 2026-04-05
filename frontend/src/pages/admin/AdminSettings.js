import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, RefreshCw, Truck, Store } from "lucide-react";
import { toast } from "sonner";
import api from "../../api";

const emptySettings = {
  currencyRates: { KES: 1.0, USD: 0.0077, EUR: 0.0071 },
  currencyRatesUpdated: new Date().toISOString(),
  shippingMethods: [],
  businessInfo: {
    brandName: "PAM Beauty",
    email: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    address: "",
    city: "",
    county: "",
  },
  inventoryThreshold: 5,
  allowPreorders: true,
  hero: {
    announcement: "",
    eyebrow: "",
    titleLine1: "",
    titleLine2: "",
    description: "",
    primaryCta: "",
    secondaryCta: "",
    desktopImage: "",
    mobileImage: "",
    desktopImagePosition: "center top",
    mobileImagePosition: "center top",
  },
};

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currencyUpdatedHuman = useMemo(() => {
    try {
      const d = new Date(settings.currencyRatesUpdated);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
    } catch {
      return "—";
    }
  }, [settings.currencyRatesUpdated]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/settings`);
      const data = res.data || {};

      setSettings({
        ...emptySettings,
        ...data,
        hero: {
          ...emptySettings.hero,
          ...(data?.hero || {}),
        },
        currencyRates: {
          ...emptySettings.currencyRates,
          ...(data?.currencyRates || {}),
        },
        businessInfo: {
          ...emptySettings.businessInfo,
          ...(data?.businessInfo || {}),
        },
        shippingMethods: Array.isArray(data?.shippingMethods)
          ? data.shippingMethods.map((m) => ({
              id: m?.id || `${Date.now()}-${Math.random()}`,
              name: m?.name || "",
              description: m?.description || "",
              eta: m?.eta || "",
              price: safeNum(m?.price, 0),
              active: m?.active !== false,
            }))
          : [],
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const setBusinessInfo = (key, value) => {
    setSettings((s) => ({
      ...s,
      businessInfo: { ...(s.businessInfo || {}), [key]: value },
    }));
  };

  const addShippingMethod = () => {
    setSettings((s) => ({
      ...s,
      shippingMethods: [
        ...(s.shippingMethods || []),
        {
          id: `${Date.now()}-${Math.random()}`,
          name: "",
          description: "",
          eta: "",
          price: 0,
          active: true,
        },
      ],
    }));
  };

  const updateShippingMethod = (index, key, value) => {
    setSettings((s) => {
      const next = [...(s.shippingMethods || [])];
      next[index] = {
        ...next[index],
        [key]: key === "price" ? safeNum(value, 0) : value,
      };
      return { ...s, shippingMethods: next };
    });
  };

  const removeShippingMethod = (index) => {
    setSettings((s) => ({
      ...s,
      shippingMethods: (s.shippingMethods || []).filter((_, i) => i !== index),
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        shippingMethods: (settings.shippingMethods || []).map((m) => ({
          id: m.id,
          name: String(m.name || "").trim(),
          description: String(m.description || "").trim(),
          eta: String(m.eta || "").trim(),
          price: safeNum(m.price, 0),
          active: m.active !== false,
        })),
      };

      await api.put(`/settings`, payload);
      toast.success("Settings saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#f7f7f5]">
        <div className="w-10 h-10 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-2">
              PAM Beauty Admin
            </p>
            <h1 className="text-3xl md:text-4xl font-serif text-black">
              Store Settings
            </h1>
            <p className="text-sm text-neutral-500 mt-2">
              Manage shipping fees, business information, and homepage content in one place.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadSettings}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition"
            >
              <RefreshCw size={16} />
              Reload
            </button>

            <button
              onClick={saveSettings}
              type="button"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-black text-white px-5 py-2.5 text-sm hover:bg-neutral-800 transition disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <section className="rounded-3xl border border-neutral-200 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-700">
                  <Truck size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-black">Shipping Fees</h2>
                  <p className="text-sm text-neutral-500">
                    Add and update the delivery options shown at checkout.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {(settings.shippingMethods || []).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-6 text-sm text-neutral-500">
                    No shipping methods added yet.
                  </div>
                )}

                {(settings.shippingMethods || []).map((method, index) => (
                  <div
                    key={method.id || index}
                    className="rounded-2xl border border-neutral-200 bg-[#fbfbfa] p-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                          Method Name
                        </label>
                        <input
                          type="text"
                          value={method.name}
                          onChange={(e) =>
                            updateShippingMethod(index, "name", e.target.value)
                          }
                          placeholder="e.g. Standard Delivery"
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                          Price (KES)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={method.price}
                          onChange={(e) =>
                            updateShippingMethod(index, "price", e.target.value)
                          }
                          placeholder="0"
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                          ETA
                        </label>
                        <input
                          type="text"
                          value={method.eta}
                          onChange={(e) =>
                            updateShippingMethod(index, "eta", e.target.value)
                          }
                          placeholder="e.g. 2-4 business days"
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={method.description}
                          onChange={(e) =>
                            updateShippingMethod(index, "description", e.target.value)
                          }
                          placeholder="e.g. Nairobi metro orders"
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-600">
                        <input
                          type="checkbox"
                          checked={method.active !== false}
                          onChange={(e) =>
                            updateShippingMethod(index, "active", e.target.checked)
                          }
                          className="accent-black"
                        />
                        Active at checkout
                      </label>

                      <button
                        type="button"
                        onClick={() => removeShippingMethod(index)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-black hover:bg-neutral-100 transition"
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addShippingMethod}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition"
                >
                  <Plus size={16} />
                  Add Shipping Method
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-700">
                  <Store size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-black">Business Information</h2>
                  <p className="text-sm text-neutral-500">
                    Core details used across your storefront.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["brandName", "Brand Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["whatsapp", "WhatsApp"],
                  ["instagram", "Instagram"],
                  ["address", "Address"],
                  ["city", "City"],
                  ["county", "County"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={settings.businessInfo?.[key] || ""}
                      onChange={(e) => setBusinessInfo(key, e.target.value)}
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 outline-none focus:border-black"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="rounded-3xl border border-neutral-200 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.03)] p-6">
              <h2 className="text-xl font-serif text-black mb-4">Store Summary</h2>

              <div className="space-y-4">
                <div className="rounded-2xl bg-[#fbfbfa] border border-neutral-200 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
                    Shipping Methods
                  </p>
                  <p className="text-2xl font-serif text-black">
                    {(settings.shippingMethods || []).length}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fbfbfa] border border-neutral-200 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
                    Inventory Threshold
                  </p>
                  <p className="text-2xl font-serif text-black">
                    {safeNum(settings.inventoryThreshold, 5)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fbfbfa] border border-neutral-200 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
                    Currency Last Updated
                  </p>
                  <p className="text-sm text-neutral-700">{currencyUpdatedHuman}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.03)] p-6">
              <h2 className="text-xl font-serif text-black mb-4">Quick Note</h2>
              <p className="text-sm leading-7 text-neutral-600">
                Shipping methods saved here should be loaded dynamically inside checkout.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}