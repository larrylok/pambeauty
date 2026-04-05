import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Save,
  X,
  Search,
  RefreshCw,
  Star,
  StarOff,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../api";

function slugify(input) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function newEmptyDraft() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    heroImage: "",
    displayOrder: 0,
    featured: false,
    productIds: [],
  };
}

function normalizeCollection(c) {
  const id = c?._id || c?.id || null;
  return {
    ...c,
    id,
    name: c?.name || "",
    slug: c?.slug || "",
    description: c?.description || "",
    heroImage: c?.heroImage || "",
    displayOrder: toNum(c?.displayOrder, 0),
    featured: !!c?.featured,
    productIds: Array.isArray(c?.productIds) ? c.productIds : [],
  };
}

export default function AdminCollections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(newEmptyDraft);

  const [uploadingHero, setUploadingHero] = useState(false);

  const requestSeq = useRef(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const slug = (c.slug || "").toLowerCase();
      const desc = (c.description || "").toLowerCase();
      return name.includes(s) || slug.includes(s) || desc.includes(s);
    });
  }, [items, q]);

  const loadCollections = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      const res = await api.get(`/collections`);
      if (seq !== requestSeq.current) return;

      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const normalized = data.map(normalizeCollection);

      setItems(
        normalized
          .slice()
          .sort((a, b) => toNum(a.displayOrder, 0) - toNum(b.displayOrder, 0))
      );
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      toast.error("Failed to load collections");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    if (saving) return;
    if (uploadingHero) {
      toast.error("Please wait for the image upload to finish.");
      return;
    }
    setModalOpen(false);
    setDraft(newEmptyDraft());
  };

  const openCreate = () => {
    setDraft(newEmptyDraft());
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setDraft(normalizeCollection(c));
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, saving, uploadingHero]);

  const onChange = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };

      if (key === "name") {
        const auto = slugify(value);
        if (!d.slug || d.slug === slugify(d.name)) {
          next.slug = auto;
        }
      }

      return next;
    });
  };

  const validateDraft = () => {
    if (!draft.name.trim()) return "Collection name is required.";
    if (!draft.slug.trim()) return "Slug is required (auto-generated from name).";
    return null;
  };

  const saveDraft = async () => {
    if (saving) return;
    const errMsg = validateDraft();
    if (errMsg) {
      toast.error(errMsg);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        description: (draft.description || "").trim(),
        heroImage: (draft.heroImage || "").trim() || null,
        displayOrder: toNum(draft.displayOrder, 0),
        featured: !!draft.featured,
        productIds: Array.isArray(draft.productIds) ? draft.productIds : [],
      };

      if (draft.id) {
        await api.put(`/collections/${draft.id}`, payload);
        toast.success("Collection updated");
      } else {
        await api.post(`/collections`, payload);
        toast.success("Collection created");
      }

      closeModal();
      await loadCollections();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to save collection";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (c) => {
    const col = normalizeCollection(c);
    if (!col.id) return;

    try {
      await api.put(`/collections/${col.id}`, {
        name: col.name,
        slug: col.slug,
        description: col.description,
        heroImage: col.heroImage?.trim() ? col.heroImage.trim() : null,
        displayOrder: toNum(col.displayOrder, 0),
        featured: !col.featured,
        productIds: Array.isArray(col.productIds) ? col.productIds : [],
      });

      toast.success(!col.featured ? "Marked as featured" : "Unfeatured");
      await loadCollections();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update featured status");
    }
  };

  const handleHeroUpload = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    setUploadingHero(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await api.post("/admin/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res?.data?.url;
      if (!url) {
        toast.error("Upload failed: no URL returned");
        return;
      }

      onChange("heroImage", url);
      toast.success("Hero image uploaded");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Image upload failed";
      toast.error(msg);
    } finally {
      setUploadingHero(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Collections</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#666666]">
            Curate product groupings for your storefront such as featured sections, seasonal edits, and signature selections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadCollections}
            className="inline-flex items-center gap-2 rounded-[20px] border border-[#e7e7e2] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.02)] transition hover:bg-[#f8f8f6]"
            disabled={loading}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-[20px] bg-[#111111] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222]"
            type="button"
          >
            <Plus className="h-4 w-4" />
            New collection
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
        <Search className="h-4 w-4 text-[#777777]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search collections by name, slug, description…"
          className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#9a9a94]"
        />
      </div>

      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <h2 className="mb-5 font-serif text-2xl text-[#111111]">All collections</h2>

        {loading ? (
          <p className="text-[#777777]">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e7e7e2] bg-white p-5 text-[#777777]">
            No collections found. Create one to start curating your storefront.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div
                key={c.id || c.slug}
                className="flex flex-col gap-4 rounded-[24px] border border-[#e7e7e2] bg-white p-5 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate font-serif text-xl text-[#111111]">
                      {c.name || "Untitled"}
                    </h3>

                    <span className="inline-flex rounded-full border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                      /{c.slug || "no-slug"}
                    </span>

                    {c.featured ? (
                      <span className="inline-flex rounded-full bg-[#111111] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white">
                        Featured
                      </span>
                    ) : null}
                  </div>

                  {c.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[#666666]">
                      {c.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-[#8a8a84]">
                      No description
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#777777]">
                    <span>
                      Display order:{" "}
                      <span className="font-medium text-[#111111]">
                        {toNum(c.displayOrder, 0)}
                      </span>
                    </span>
                    {c.heroImage ? (
                      <span className="truncate">
                        Hero:{" "}
                        <span className="font-medium text-[#111111]">
                          {c.heroImage}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleFeatured(c)}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    title="Toggle featured"
                    type="button"
                  >
                    {c.featured ? (
                      <StarOff className="h-4 w-4" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    {c.featured ? "Unfeature" : "Feature"}
                  </button>

                  <button
                    onClick={() => openEdit(c)}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-[#111111] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#222222]"
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
            onClick={closeModal}
          />

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4">
              <div
                className="mt-6 mb-10 w-full max-w-2xl rounded-[32px] border border-[#e7e7e2] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl text-[#111111]">
                      {draft.id ? "Edit collection" : "Create collection"}
                    </h2>
                    <p className="mt-1 text-xs text-[#777777]">
                      This controls how collections appear on the storefront.
                    </p>
                  </div>

                  <button
                    onClick={closeModal}
                    className="rounded-2xl border border-[#e7e7e2] p-2 text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                    title="Close"
                    disabled={saving || uploadingHero}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    disabled={saving || uploadingHero}
                    type="button"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Name
                    </label>
                    <input
                      value={draft.name}
                      onChange={(e) => onChange("name", e.target.value)}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="e.g. Valentine’s Edit"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Slug
                    </label>
                    <input
                      value={draft.slug}
                      onChange={(e) => onChange("slug", slugify(e.target.value))}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="valentines-edit"
                    />
                    <p className="mt-2 text-xs text-[#8a8a84]">
                      Used in URLs and internal references. Lowercase, hyphens only.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Description
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => onChange("description", e.target.value)}
                      className="min-h-[110px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="Short description shown on collection sections."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Hero image
                      </label>

                      <label
                        className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                          uploadingHero
                            ? "cursor-not-allowed text-[#8a8a84]"
                            : "cursor-pointer text-[#111111] hover:underline"
                        }`}
                        title="Upload hero image"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingHero ? "Uploading…" : "Upload image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingHero || saving}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            await handleHeroUpload(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {draft.heroImage ? (
                      <div className="relative overflow-hidden rounded-[20px] border border-[#e7e7e2] bg-[#f4f4f2]">
                        <img
                          src={draft.heroImage}
                          alt="Hero preview"
                          className="h-48 w-full object-cover md:h-56"
                        />
                        <button
                          type="button"
                          onClick={() => onChange("heroImage", "")}
                          className="absolute top-3 right-3 rounded-full bg-[#111111] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#222222]"
                          disabled={saving || uploadingHero}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center rounded-[20px] border border-[#e7e7e2] bg-[#f4f4f2] text-sm text-[#777777] md:h-56">
                        No hero image uploaded
                      </div>
                    )}

                    <div className="mt-3">
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Or paste image URL (optional)
                      </label>
                      <input
                        value={draft.heroImage || ""}
                        onChange={(e) => onChange("heroImage", e.target.value)}
                        className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                        placeholder="/uploads/your-image.png  (or https://...)"
                        disabled={uploadingHero}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Display order
                    </label>
                    <input
                      type="number"
                      value={draft.displayOrder}
                      onChange={(e) =>
                        onChange("displayOrder", toNum(e.target.value, 0))
                      }
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-4">
                    <div className="flex-1">
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Featured
                      </label>
                      <p className="text-xs text-[#8a8a84]">
                        Featured collections can be highlighted on the homepage.
                      </p>
                    </div>

                    <button
                      onClick={() => onChange("featured", !draft.featured)}
                      className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                        draft.featured
                          ? "bg-[#111111] text-white"
                          : "border border-[#d7d7d1] bg-white text-[#555555] hover:bg-[#f8f8f6]"
                      }`}
                      disabled={saving || uploadingHero}
                      type="button"
                    >
                      {draft.featured ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    disabled={saving || uploadingHero}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    onClick={saveDraft}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-[#111111] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
                    disabled={saving || uploadingHero}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                <p className="mt-4 text-[11px] text-[#8a8a84]">
                  Tip: Click outside, press ESC, or use Back/Cancel to close without saving.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}