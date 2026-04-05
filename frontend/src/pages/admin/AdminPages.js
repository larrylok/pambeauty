import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Save,
  X,
  Search,
  RefreshCw,
  Star,
  StarOff,
  ArrowLeft,
  Trash2,
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

function parseCsvIds(value) {
  return (value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function newEmptyDraft() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    type: "manual",
    categorySlug: "",
    productIdsText: "",
    displayOrder: 0,
    active: true,
    showInHeader: false,
    showInFooter: true,
    featured: false,
    seoTitle: "",
    seoDescription: "",
  };
}

function normalizePage(p) {
  const id = p?._id || p?.id || null;
  const productIds = Array.isArray(p?.productIds) ? p.productIds : [];

  return {
    ...p,
    id,
    name: p?.name || "",
    slug: p?.slug || "",
    description: p?.description || "",
    type: p?.type || "manual",
    categorySlug: p?.categorySlug || "",
    productIds,
    productIdsText: productIds.join(", "),
    displayOrder: toNum(p?.displayOrder, 0),
    active: p?.active !== false,
    showInHeader: !!p?.showInHeader,
    showInFooter: p?.showInFooter !== false,
    featured: !!p?.featured,
    seoTitle: p?.seoTitle || "",
    seoDescription: p?.seoDescription || "",
  };
}

export default function AdminPages() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(newEmptyDraft);

  const requestSeq = useRef(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const slug = (p.slug || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const type = (p.type || "").toLowerCase();
      return name.includes(s) || slug.includes(s) || desc.includes(s) || type.includes(s);
    });
  }, [items, q]);

  const loadPages = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      const [pagesRes, categoriesRes] = await Promise.all([
        api.get("/pages"),
        api.get("/categories"),
      ]);

      if (seq !== requestSeq.current) return;

      const pagesData = Array.isArray(pagesRes.data) ? pagesRes.data : pagesRes.data?.items || [];
      const categoriesData = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : categoriesRes.data?.items || [];

      const normalizedPages = pagesData.map(normalizePage);

      setItems(
        normalizedPages
          .slice()
          .sort((a, b) => toNum(a.displayOrder, 0) - toNum(b.displayOrder, 0))
      );
      setCategories(categoriesData);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      toast.error("Failed to load pages");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setDraft(newEmptyDraft());
  };

  const openCreate = () => {
    setDraft(newEmptyDraft());
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setDraft(normalizePage(p));
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
  }, [modalOpen, saving]);

  const onChange = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };

      if (key === "name") {
        const auto = slugify(value);
        if (!d.slug || d.slug === slugify(d.name)) {
          next.slug = auto;
        }
      }

      if (key === "type" && value !== "category") {
        next.categorySlug = "";
      }

      if (key === "type" && value !== "manual") {
        next.productIdsText = "";
      }

      return next;
    });
  };

  const validateDraft = () => {
    if (!draft.name.trim()) return "Page name is required.";
    if (!draft.slug.trim()) return "Slug is required.";

    if (draft.type === "category" && !draft.categorySlug.trim()) {
      return "Category pages must have a category selected.";
    }

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
        heroImage: null,
        type: draft.type,
        categorySlug: draft.type === "category" ? draft.categorySlug.trim() : null,
        productIds: draft.type === "manual" ? parseCsvIds(draft.productIdsText) : [],
        displayOrder: toNum(draft.displayOrder, 0),
        active: !!draft.active,
        showInHeader: !!draft.showInHeader,
        showInFooter: !!draft.showInFooter,
        featured: !!draft.featured,
        seoTitle: (draft.seoTitle || "").trim() || null,
        seoDescription: (draft.seoDescription || "").trim() || null,
      };

      if (draft.id) {
        await api.put(`/pages/${draft.id}`, payload);
        toast.success("Page updated");
      } else {
        await api.post(`/pages`, payload);
        toast.success("Page created");
      }

      window.dispatchEvent(new Event("storefront-navigation-updated"));
      closeModal();
      await loadPages();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to save page";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (p) => {
    const item = normalizePage(p);
    if (!item.id) return;

    try {
      await api.put(`/pages/${item.id}`, {
        name: item.name,
        slug: item.slug,
        description: item.description,
        heroImage: null,
        type: item.type,
        categorySlug: item.type === "category" ? item.categorySlug : null,
        productIds: item.type === "manual" ? item.productIds : [],
        displayOrder: toNum(item.displayOrder, 0),
        active: !!item.active,
        showInHeader: !!item.showInHeader,
        showInFooter: !!item.showInFooter,
        featured: !item.featured,
        seoTitle: item.seoTitle || null,
        seoDescription: item.seoDescription || null,
      });

      toast.success(!item.featured ? "Marked as featured" : "Unfeatured");
      window.dispatchEvent(new Event("storefront-navigation-updated"));
      await loadPages();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update featured status");
    }
  };

  const deletePage = async (page) => {
    const item = normalizePage(page);
    if (!item.id) return;

    const ok = window.confirm(`Delete page "${item.name}"?`);
    if (!ok) return;

    try {
      await api.delete(`/pages/${item.id}`);
      toast.success("Page deleted");
      window.dispatchEvent(new Event("storefront-navigation-updated"));
      await loadPages();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to delete page";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.35em] text-[#7d7d77]">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Pages</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#666666]">
            Create real storefront pages like Promotions, Bridal Edit, Best Sellers, and category-driven pages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadPages}
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
            New page
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
        <Search className="h-4 w-4 text-[#777777]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages by name, slug, description, type…"
          className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#9a9a94]"
        />
      </div>

      <section className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <h2 className="mb-5 font-serif text-2xl text-[#111111]">All pages</h2>

        {loading ? (
          <p className="text-[#777777]">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e7e7e2] bg-white p-5 text-[#777777]">
            No pages found. Create one to start building real storefront routes.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id || p.slug}
                className="flex flex-col gap-4 rounded-[24px] border border-[#e7e7e2] bg-white p-5 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate font-serif text-xl text-[#111111]">
                      {p.name || "Untitled"}
                    </h3>

                    <span className="inline-flex rounded-full border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                      /{p.slug || "no-slug"}
                    </span>

                    <span className="inline-flex rounded-full border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                      {p.type}
                    </span>

                    {p.featured ? (
                      <span className="inline-flex rounded-full border border-[#111111] bg-[#111111] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white">
                        Featured
                      </span>
                    ) : null}

                    {!p.active ? (
                      <span className="inline-flex rounded-full border border-[#d7d7d1] bg-[#f4f4f2] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                        Inactive
                      </span>
                    ) : null}
                  </div>

                  {p.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[#666666]">
                      {p.description}
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
                        {toNum(p.displayOrder, 0)}
                      </span>
                    </span>
                    {p.showInHeader ? (
                      <span>
                        Header:{" "}
                        <span className="font-medium text-[#111111]">Yes</span>
                      </span>
                    ) : null}
                    {p.showInFooter ? (
                      <span>
                        Footer:{" "}
                        <span className="font-medium text-[#111111]">Yes</span>
                      </span>
                    ) : null}
                    {p.categorySlug ? (
                      <span>
                        Category:{" "}
                        <span className="font-medium text-[#111111]">{p.categorySlug}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleFeatured(p)}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    title="Toggle featured"
                    type="button"
                  >
                    {p.featured ? (
                      <StarOff className="h-4 w-4" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    {p.featured ? "Unfeature" : "Feature"}
                  </button>

                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-[#111111] px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#222222]"
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deletePage(p)}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#d7d7d1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#666666] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={closeModal} />

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4">
              <div
                className="mt-6 mb-10 w-full max-w-3xl rounded-[32px] border border-[#e7e7e2] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl text-[#111111]">
                      {draft.id ? "Edit page" : "Create page"}
                    </h2>
                    <p className="mt-1 text-xs text-[#777777]">
                      Pages create real storefront URLs like /pages/promotions and /pages/bridal-edit.
                    </p>
                  </div>

                  <button
                    onClick={closeModal}
                    className="rounded-2xl border border-[#e7e7e2] p-2 text-[#555555] transition hover:bg-[#f8f8f6] hover:text-[#111111]"
                    title="Close"
                    disabled={saving}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    disabled={saving}
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
                      placeholder="e.g. Promotions"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Slug
                    </label>
                    <input
                      value={draft.slug}
                      onChange={(e) => onChange("slug", slugify(e.target.value))}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="promotions"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Type
                    </label>
                    <select
                      value={draft.type}
                      onChange={(e) => onChange("type", e.target.value)}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    >
                      <option value="manual">Manual</option>
                      <option value="category">Category Page</option>
                      <option value="featured">Featured Products</option>
                      <option value="new_arrivals">New Arrivals</option>
                      <option value="bestsellers">Best Sellers</option>
                      <option value="discounted">Discounted Products</option>
                    </select>
                  </div>

                  {draft.type === "category" ? (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Linked category
                      </label>
                      <select
                        value={draft.categorySlug}
                        onChange={(e) => onChange("categorySlug", e.target.value)}
                        className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id || cat.slug} value={cat.slug}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {draft.type === "manual" ? (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Product IDs (comma-separated)
                      </label>
                      <textarea
                        value={draft.productIdsText}
                        onChange={(e) => onChange("productIdsText", e.target.value)}
                        className="min-h-[110px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                        placeholder="product-id-1, product-id-2, product-id-3"
                      />
                      <p className="mt-2 text-xs text-[#8a8a84]">
                        Use this only for manual pages. Leave blank for auto-generated page types.
                      </p>
                    </div>
                  ) : null}

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Description
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => onChange("description", e.target.value)}
                      className="min-h-[110px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="Short page description shown on the storefront page."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      Display order
                    </label>
                    <input
                      type="number"
                      value={draft.displayOrder}
                      onChange={(e) => onChange("displayOrder", toNum(e.target.value, 0))}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Featured
                      </span>
                      <button
                        onClick={() => onChange("featured", !draft.featured)}
                        className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                          draft.featured
                            ? "bg-[#111111] text-white"
                            : "border border-[#d7d7d1] bg-white text-[#555555] hover:bg-[#f8f8f6]"
                        }`}
                        disabled={saving}
                        type="button"
                      >
                        {draft.featured ? "Enabled" : "Disabled"}
                      </button>
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Active
                      </span>
                      <button
                        onClick={() => onChange("active", !draft.active)}
                        className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                          draft.active
                            ? "bg-[#111111] text-white"
                            : "border border-[#d7d7d1] bg-white text-[#555555] hover:bg-[#f8f8f6]"
                        }`}
                        disabled={saving}
                        type="button"
                      >
                        {draft.active ? "Enabled" : "Disabled"}
                      </button>
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Show in header
                      </span>
                      <button
                        onClick={() => onChange("showInHeader", !draft.showInHeader)}
                        className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                          draft.showInHeader
                            ? "bg-[#111111] text-white"
                            : "border border-[#d7d7d1] bg-white text-[#555555] hover:bg-[#f8f8f6]"
                        }`}
                        disabled={saving}
                        type="button"
                      >
                        {draft.showInHeader ? "Enabled" : "Disabled"}
                      </button>
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                        Show in footer
                      </span>
                      <button
                        onClick={() => onChange("showInFooter", !draft.showInFooter)}
                        className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition ${
                          draft.showInFooter
                            ? "bg-[#111111] text-white"
                            : "border border-[#d7d7d1] bg-white text-[#555555] hover:bg-[#f8f8f6]"
                        }`}
                        disabled={saving}
                        type="button"
                      >
                        {draft.showInFooter ? "Enabled" : "Disabled"}
                      </button>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      SEO title
                    </label>
                    <input
                      value={draft.seoTitle}
                      onChange={(e) => onChange("seoTitle", e.target.value)}
                      className="w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="Optional SEO title"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7d7d77]">
                      SEO description
                    </label>
                    <textarea
                      value={draft.seoDescription}
                      onChange={(e) => onChange("seoDescription", e.target.value)}
                      className="min-h-[90px] w-full rounded-2xl border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#111111]"
                      placeholder="Optional SEO description"
                    />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-[#e7e7e2] bg-[#fcfcfa] px-4 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-[#555555] transition hover:bg-[#f4f4f2] hover:text-[#111111]"
                    disabled={saving}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    onClick={saveDraft}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-[#111111] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_22px_rgba(0,0,0,0.10)] transition hover:bg-[#222222] disabled:opacity-50"
                    disabled={saving}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                <p className="mt-4 text-[11px] text-[#8a8a84]">
                  Tip: Use type “category” to auto-build a page from a category, or “manual” for a hand-picked page.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}