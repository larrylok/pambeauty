import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Copy as CopyIcon, X } from "lucide-react";
import { toast } from "sonner";
import api from "../../api";
import AddProductModal from "./AddProductModal";
 
/* ================= HELPERS ================= */
 
function safeArr(x) { return Array.isArray(x) ? x : []; }
function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function safeStr(x) { return String(x ?? "").trim(); }
function normalizeId(p) { return p?.id || p?._id || p?.productId || p?.slug; }
 
function getApiOrigin() {
  const base = String(api?.defaults?.baseURL || "");
  return base.replace(/\/api\/?$/, "");
}
 
function absolutizeMaybe(url) {
  const u = String(url || "");
  if (!u) return "";
  if (u.startsWith("http")) return u;
  const origin = getApiOrigin();
  return origin ? `${origin}${u}` : u;
}
 
/* ================= COMPONENT ================= */
 
export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
 
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
 
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
 
/* ================= LOAD ================= */
 
  useEffect(() => { 
    loadCategories();
    loadProducts(); 
  }, []);
 
  useEffect(() => {
    if (filterCategory) {
      loadProducts();
    }
  }, [filterCategory]);
 
  const loadCategories = async () => {
    try {
      const res = await api.get("/categories");
      const cats = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };
 
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products", {
        params: { page: 1, limit: 100, category: filterCategory || undefined }
      });
 
      const list = Array.isArray(res.data?.products)
        ? res.data.products
        : Array.isArray(res.data)
        ? res.data
        : [];
 
      setProducts(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };
 
/* ================= FILTER ================= */
 
  const filteredProducts = products.filter(p =>
    safeStr(p?.name).toLowerCase().includes(searchTerm.toLowerCase())
  );
 
/* ================= ACTIONS ================= */
 
  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
 
    try {
      await api.delete(`/products/${productId}`);
      toast.success("Product deleted successfully");
      loadProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product");
    }
  };
 
  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowModal(true);
  };
 
  const handleProductAdded = () => {
    loadProducts();
  };
 
  const handleCopy = async (product) => {
    try {
      const copyData = {
        ...product,
        id: undefined,
        _id: undefined,
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${Date.now()}`,
        createdAt: undefined,
        updatedAt: undefined,
      };
      
      await api.post("/products", copyData);
      toast.success("Product duplicated successfully");
      loadProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate product");
    }
  };
 
/* ================= UI ================= */
 
  return (
    <div className="space-y-8">
 
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#7d7d77] mb-2">
            PAM Beauty
          </p>
          <h1 className="font-serif text-4xl text-[#111111]">Products</h1>
          <p className="text-sm text-[#666666] mt-2">
            {products.length} products in your catalog
          </p>
        </div>
 
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#111111] text-white hover:bg-black transition shadow"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>
 
      {/* FILTER BAR */}
      <div className="rounded-[24px] border border-[#e7e7e2] bg-[#fcfcfa] p-6 shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
        <div className="grid md:grid-cols-4 gap-4">
 
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#e7e7e2] bg-white outline-none"
            />
          </div>
 
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-[#e7e7e2] bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id || cat._id} value={cat.slug || cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
 
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === "delete") {
                // Implement bulk delete if needed
                toast.info("Bulk delete coming soon");
                e.target.value = "";
              }
            }}
            className="px-4 py-3 rounded-2xl border border-[#e7e7e2] bg-white"
          >
            <option value="">Bulk Actions</option>
            <option value="delete">Delete</option>
          </select>
        </div>
      </div>
 
      {/* TABLE */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 border border-[#ccc] border-t-black rounded-full animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#999] mb-4">No products found</p>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#111111] text-white hover:bg-black transition"
          >
            <Plus size={18} />
            Add your first product
          </button>
        </div>
      ) : (
        <div className="rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
 
          <table className="w-full">
 
            <thead className="bg-[#111111] text-white text-xs uppercase tracking-[0.25em]">
              <tr>
                <th className="p-4 text-left">Product</th>
                <th className="p-4 text-left">Price</th>
                <th className="p-4 text-left">Stock</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
 
            <tbody>
              {filteredProducts.map(product => {
                const stock = safeArr(product.variants)
                  .reduce((s, v) => s + safeNum(v.stock), 0);
 
                return (
                  <tr key={normalizeId(product)} className="border-t border-[#e7e7e2] hover:bg-white">
 
                    <td className="p-4 flex items-center gap-4">
                      <img
                        src={absolutizeMaybe(product.primaryImage)}
                        onError={(e) => e.target.src = "https://via.placeholder.com/56?text=No+Image"}
                        className="w-14 h-14 rounded-xl object-cover"
                        alt={product.name}
                      />
                      <div>
                        <p className="font-medium text-[#111]">{product.name}</p>
                        <p className="text-xs text-[#777]">{product.slug}</p>
                      </div>
                    </td>
 
                    <td className="p-4">
                      <p className="font-medium">
                        KES {safeNum(product.basePrice).toLocaleString()}
                      </p>
                    </td>
 
                    <td className="p-4 text-sm">
                      {stock}
                    </td>
 
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 hover:bg-[#f4f4f2] rounded-xl transition"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleCopy(product)}
                        className="p-2 hover:bg-[#f4f4f2] rounded-xl transition"
                        title="Duplicate"
                      >
                        <CopyIcon size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(normalizeId(product))}
                        className="p-2 hover:bg-[#f4f4f2] rounded-xl transition text-red-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
 
                  </tr>
                );
              })}
            </tbody>
 
          </table>
        </div>
      )}
 
      {/* MODAL */}
      <AddProductModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onProductAdded={handleProductAdded}
        editingProduct={editingProduct}
      />
    </div>
  );
}