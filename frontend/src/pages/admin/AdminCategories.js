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

/* ================= HELPERS (UNCHANGED) ================= */

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
    displayOrder: 0,
    featured: false,
    active: true,
    showInMenu: true,
  };
}

function normalizeCategory(c) {
  const id = c?._id || c?.id || null;
  return {
    ...c,
    id,
    name: c?.name || "",
    slug: c?.slug || "",
    description: c?.description || "",
    displayOrder: toNum(c?.displayOrder, 0),
    featured: !!c?.featured,
    active: c?.active !== false,
    showInMenu: c?.showInMenu !== false,
  };
}

/* ================= COMPONENT ================= */

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(newEmptyDraft);

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

  const sortItems = (list) =>
    list
      .slice()
      .sort((a, b) => toNum(a.displayOrder, 0) - toNum(b.displayOrder, 0));

  const loadCategories = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    try {
      const res = await api.get("/categories");
      if (seq !== requestSeq.current) return;

      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      const normalized = data.map(normalizeCategory);
      setItems(sortItems(normalized));
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      toast.error("Failed to load categories");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
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

  const openEdit = (c) => {
    setDraft(normalizeCategory(c));
    setModalOpen(true);
  };

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
    if (!draft.name.trim()) return "Category name is required.";
    if (!draft.slug.trim()) return "Slug is required.";
    return null;
  };

  const upsertCategoryInState = (savedCategory) => {
    const normalized = normalizeCategory(savedCategory);

    setItems((prev) => {
      const exists = prev.some((x) => x.id === normalized.id);
      const next = exists
        ? prev.map((x) => (x.id === normalized.id ? normalized : x))
        : [...prev, normalized];

      return sortItems(next);
    });
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
        displayOrder: toNum(draft.displayOrder, 0),
        featured: !!draft.featured,
        active: !!draft.active,
        showInMenu: !!draft.showInMenu,
      };

      let res;
      if (draft.id) {
        res = await api.put(`/categories/${draft.id}`, payload);
      } else {
        res = await api.post("/categories", payload);
      }

      const saved = normalizeCategory(res?.data || payload);
      upsertCategoryInState(saved);

      window.dispatchEvent(new Event("storefront-navigation-updated"));
      closeModal();
      toast.success(draft.id ? "Category updated" : "Category created");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (c) => {
    const item = normalizeCategory(c);
    if (!item.id) return;

    try {
      const res = await api.put(`/categories/${item.id}`, {
        ...item,
        featured: !item.featured,
      });

      upsertCategoryInState(res?.data || { ...item, featured: !item.featured });
      toast.success(!item.featured ? "Marked as featured" : "Unfeatured");
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const deleteCategory = async (category) => {
    const item = normalizeCategory(category);
    if (!item.id) return;

    if (!window.confirm(`Delete "${item.name}"?`)) return;

    try {
      await api.delete(`/categories/${item.id}`);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-[#111]">Categories</h1>
          <p className="text-[#777] mt-1">
            Manage your storefront structure.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadCategories}
            className="px-4 py-2 border border-[#e7e7e2] rounded-full bg-white hover:bg-[#f4f4f2]"
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={openCreate}
            className="px-5 py-2 rounded-full bg-black text-white hover:bg-[#222]"
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-[#fcfcfa] border border-[#e7e7e2] rounded-[20px] p-4 flex gap-3">
        <Search className="text-[#777]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search categories..."
          className="w-full bg-transparent outline-none"
        />
      </div>

      {/* LIST */}
      <div className="space-y-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="bg-[#fcfcfa] border border-[#e7e7e2] rounded-[24px] p-5 flex justify-between items-start"
          >
            <div>
              <h3 className="font-serif text-xl">{c.name}</h3>
              <p className="text-sm text-[#777]">/{c.slug}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => toggleFeatured(c)}>
                {c.featured ? <StarOff /> : <Star />}
              </button>

              <button onClick={() => openEdit(c)}>Edit</button>

              <button onClick={() => deleteCategory(c)}>
                <Trash2 />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-start p-6">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-xl">

            <h2 className="font-serif text-2xl mb-4">
              {draft.id ? "Edit" : "Create"} Category
            </h2>

            <input
              value={draft.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Name"
              className="w-full mb-4 p-3 border rounded-xl"
            />

            <input
              value={draft.slug}
              onChange={(e) => onChange("slug", e.target.value)}
              placeholder="Slug"
              className="w-full mb-4 p-3 border rounded-xl"
            />

            <textarea
              value={draft.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="Description"
              className="w-full mb-4 p-3 border rounded-xl"
            />

            <div className="flex justify-end gap-3">
              <button onClick={closeModal}>Cancel</button>
              <button onClick={saveDraft}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}