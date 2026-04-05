import React, { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import api from "../../api";

const defaultHomepage = {
  hero: {
    announcement:
      "New arrivals now live • Premium wigs, hair care, and beauty essentials",
    eyebrow: "PAM Beauty",
    titleLine1: "Luxury Hair.",
    titleLine2: "Soft Confidence.",
    description:
      "Discover premium wigs, beauty accessories, and everyday essentials designed to bring elegance, polish, and effortless confidence to your routine.",
    primaryCta: "Shop Collection",
    secondaryCta: "Shop Wigs",
    desktopImage: "",
    mobileImage: "",
    desktopImagePosition: "center top",
    mobileImagePosition: "center top",
  },
};

export default function AdminHomepage() {
  const [homepage, setHomepage] = useState(defaultHomepage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  const loadHomepage = async () => {
    setLoading(true);
    try {
      const res = await api.get("/settings");
      const data = res.data || {};

      setHomepage({
        hero: {
          ...defaultHomepage.hero,
          ...(data?.hero || {}),
        },
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to load homepage settings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomepage();
  }, []);

  const setHero = (key, value) => {
    setHomepage((prev) => ({
      ...prev,
      hero: {
        ...(prev.hero || {}),
        [key]: value,
      },
    }));
  };

  const uploadImage = async (file, target) => {
    if (!file) return;

    const setUploading =
      target === "desktop" ? setUploadingDesktop : setUploadingMobile;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/admin/upload-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const url = res?.data?.largeUrl || res?.data?.url || "";
      if (!url) {
        toast.error("Upload succeeded but no image URL was returned");
        return;
      }

      if (target === "desktop") {
        setHero("desktopImage", url);
      } else {
        setHero("mobileImage", url);
      }

      toast.success("Image uploaded");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to upload image"
      );
    } finally {
      setUploading(false);
    }
  };

  const saveHomepage = async () => {
    setSaving(true);
    try {
      const current = await api.get("/settings");
      const currentSettings = current.data || {};

      const payload = {
        ...currentSettings,
        hero: {
          ...defaultHomepage.hero,
          ...(currentSettings?.hero || {}),
          ...(homepage?.hero || {}),
        },
      };

      await api.put("/settings", payload);
      toast.success("Homepage settings saved");
      await loadHomepage();
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to save homepage settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h1 className="font-serif text-4xl text-[#111111]">Homepage</h1>
        <p className="text-[#777777]">Loading homepage settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Homepage</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#666666]">
            Manage the homepage hero content, images, and announcement bar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadHomepage}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
            disabled={loading || saving}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          <button
            onClick={saveHomepage}
            className="inline-flex items-center gap-2 rounded-[20px] bg-[#111111] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
            disabled={saving}
            type="button"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <section className="space-y-6 rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div>
          <h2 className="mb-1 font-serif text-2xl text-[#111111]">
            Hero Section
          </h2>
          <p className="text-sm text-[#777777]">
            This controls the announcement bar and the main homepage hero.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Announcement bar
          </label>
          <input
            value={homepage.hero.announcement || ""}
            onChange={(e) => setHero("announcement", e.target.value)}
            className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            placeholder="New arrivals now live • Premium wigs, hair care, and beauty essentials"
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Eyebrow
          </label>
          <input
            value={homepage.hero.eyebrow || ""}
            onChange={(e) => setHero("eyebrow", e.target.value)}
            className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            placeholder="PAM Beauty"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
              Title line 1
            </label>
            <input
              value={homepage.hero.titleLine1 || ""}
              onChange={(e) => setHero("titleLine1", e.target.value)}
              className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              placeholder="Luxury Hair."
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
              Title line 2
            </label>
            <input
              value={homepage.hero.titleLine2 || ""}
              onChange={(e) => setHero("titleLine2", e.target.value)}
              className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              placeholder="Soft Confidence."
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
            Description
          </label>
          <textarea
            rows={4}
            value={homepage.hero.description || ""}
            onChange={(e) => setHero("description", e.target.value)}
            className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
            placeholder="Discover premium wigs, beauty accessories, and everyday essentials..."
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
              Primary CTA
            </label>
            <input
              value={homepage.hero.primaryCta || ""}
              onChange={(e) => setHero("primaryCta", e.target.value)}
              className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              placeholder="Shop Collection"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
              Secondary CTA
            </label>
            <input
              value={homepage.hero.secondaryCta || ""}
              onChange={(e) => setHero("secondaryCta", e.target.value)}
              className="w-full rounded-2xl border border-[#e7e7e2] bg-white px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
              placeholder="Shop Wigs"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div>
          <h2 className="mb-1 font-serif text-2xl text-[#111111]">
            Hero Images
          </h2>
          <p className="text-sm text-[#777777]">
            Upload separate images for desktop and mobile for better framing.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4 rounded-[24px] border border-[#e7e7e2] bg-white p-5">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Desktop image upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadImage(e.target.files?.[0], "desktop")}
                className="w-full text-sm text-[#111111]"
              />
              <p className="mt-2 text-xs text-[#8a8a84]">
                Recommended for wide screens.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Desktop image URL
              </label>
              <input
                value={homepage.hero.desktopImage || ""}
                onChange={(e) => setHero("desktopImage", e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Desktop image position
              </label>
              <input
                value={homepage.hero.desktopImagePosition || "center top"}
                onChange={(e) => setHero("desktopImagePosition", e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                placeholder="center top"
              />
            </div>

            {homepage.hero.desktopImage ? (
              <div className="overflow-hidden rounded-[20px] border border-[#e7e7e2] bg-[#f4f4f2]">
                <img
                  src={homepage.hero.desktopImage}
                  alt="Desktop hero preview"
                  className="h-56 w-full object-cover"
                  style={{
                    objectPosition:
                      homepage.hero.desktopImagePosition || "center top",
                  }}
                />
              </div>
            ) : null}

            {uploadingDesktop ? (
              <p className="text-sm text-[#777777]">
                Uploading desktop image...
              </p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-[24px] border border-[#e7e7e2] bg-white p-5">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Mobile image upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadImage(e.target.files?.[0], "mobile")}
                className="w-full text-sm text-[#111111]"
              />
              <p className="mt-2 text-xs text-[#8a8a84]">
                Recommended for portrait/mobile crop.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Mobile image URL
              </label>
              <input
                value={homepage.hero.mobileImage || ""}
                onChange={(e) => setHero("mobileImage", e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                Mobile image position
              </label>
              <input
                value={homepage.hero.mobileImagePosition || "center top"}
                onChange={(e) => setHero("mobileImagePosition", e.target.value)}
                className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                placeholder="center top"
              />
            </div>

            {homepage.hero.mobileImage ? (
              <div className="max-w-[280px] overflow-hidden rounded-[20px] border border-[#e7e7e2] bg-[#f4f4f2]">
                <img
                  src={homepage.hero.mobileImage}
                  alt="Mobile hero preview"
                  className="h-[360px] w-full object-cover"
                  style={{
                    objectPosition:
                      homepage.hero.mobileImagePosition || "center top",
                  }}
                />
              </div>
            ) : null}

            {uploadingMobile ? (
              <p className="text-sm text-[#777777]">
                Uploading mobile image...
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}