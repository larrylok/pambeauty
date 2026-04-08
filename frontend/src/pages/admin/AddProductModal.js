import React, { useState, useRef } from "react";
import { X, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../api";
 
function safeStr(x) { return String(x ?? "").trim(); }
function safeNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
 
export default function AddProductModal({ isOpen, onClose, onProductAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    basePrice: "",
    description: "",
    category: "",
    variants: [{ id: `v_${Date.now()}`, size: "", color: "", stock: "" }],
    images: [], // Local image files
  });
 
  const [previewImages, setPreviewImages] = useState([]); // Preview URLs
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
 
  if (!isOpen) return null;
 
  /* ================= HANDLERS ================= */
 
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
 
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
 
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...files],
    }));
 
    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImages(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };
 
  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };
 
  const handleVariantChange = (index, field, value) => {
    const updated = [...formData.variants];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, variants: updated }));
  };
 
  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        { id: `v_${Date.now()}_${Math.random()}`, size: "", color: "", stock: "" }
      ],
    }));
  };
 
  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };
 
  const validateForm = () => {
    if (!safeStr(formData.name)) {
      toast.error("Product name is required");
      return false;
    }
    if (!safeNum(formData.basePrice)) {
      toast.error("Price is required");
      return false;
    }
    if (formData.images.length === 0) {
      toast.error("At least one image is required");
      return false;
    }
    if (formData.variants.some(v => !safeNum(v.stock))) {
      toast.error("All variants must have stock quantity");
      return false;
    }
    return true;
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
 
    if (!validateForm()) return;
 
    setLoading(true);
    try {
      // Create FormData to handle file uploads
      const submitData = new FormData();
      submitData.append("name", formData.name);
      submitData.append("slug", formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"));
      submitData.append("basePrice", formData.basePrice);
      submitData.append("description", formData.description);
      submitData.append("category", formData.category);
      submitData.append("variants", JSON.stringify(
        formData.variants.map(v => ({
          size: v.size,
          color: v.color,
          stock: safeNum(v.stock),
        }))
      ));
 
      // Append images
      formData.images.forEach((file, index) => {
        submitData.append("images", file);
      });
 
      const res = await api.post("/products", submitData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
 
      toast.success("Product added successfully!");
      onProductAdded?.(res.data);
      handleClose();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || "Failed to add product";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };
 
  const handleClose = () => {
    setFormData({
      name: "",
      slug: "",
      basePrice: "",
      description: "",
      category: "",
      variants: [{ id: `v_${Date.now()}`, size: "", color: "", stock: "" }],
      images: [],
    });
    setPreviewImages([]);
    onClose();
  };
 
  /* ================= RENDER ================= */
 
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
 
        {/* HEADER */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-[#e7e7e2] bg-white">
          <h2 className="text-2xl font-serif text-[#111111]">Add Product</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#f4f4f2] rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>
 
        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
 
          {/* BASIC INFO */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#111111]">Basic Information</h3>
 
            <div>
              <label className="block text-sm font-medium text-[#666] mb-2">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Organic Lip Balm"
                className="w-full px-4 py-3 rounded-xl border border-[#e7e7e2] bg-white outline-none focus:border-[#111111] transition"
              />
            </div>
 
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#666] mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="organic-lip-balm"
                  className="w-full px-4 py-3 rounded-xl border border-[#e7e7e2] bg-white outline-none focus:border-[#111111] transition"
                />
                <p className="text-xs text-[#999] mt-1">Auto-generated if blank</p>
              </div>
 
              <div>
                <label className="block text-sm font-medium text-[#666] mb-2">
                  Base Price (KES) *
                </label>
                <input
                  type="number"
                  name="basePrice"
                  value={formData.basePrice}
                  onChange={handleInputChange}
                  placeholder="1500"
                  className="w-full px-4 py-3 rounded-xl border border-[#e7e7e2] bg-white outline-none focus:border-[#111111] transition"
                />
              </div>
            </div>
 
            <div>
              <label className="block text-sm font-medium text-[#666] mb-2">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl border border-[#e7e7e2] bg-white outline-none focus:border-[#111111] transition"
              >
                <option value="">Select a category</option>
                <option value="skincare">Skincare</option>
                <option value="makeup">Makeup</option>
                <option value="haircare">Hair Care</option>
                <option value="fragrance">Fragrance</option>
              </select>
            </div>
 
            <div>
              <label className="block text-sm font-medium text-[#666] mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Product description..."
                rows="4"
                className="w-full px-4 py-3 rounded-xl border border-[#e7e7e2] bg-white outline-none focus:border-[#111111] transition"
              />
            </div>
          </div>
 
          {/* IMAGES */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#111111]">Product Images *</h3>
 
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 border-2 border-dashed border-[#e7e7e2] rounded-xl hover:border-[#111111] transition flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <Upload size={24} className="text-[#999]" />
              <p className="font-medium text-[#111]">Click to upload images</p>
              <p className="text-xs text-[#999]">PNG, JPG, WebP up to 10MB each</p>
            </button>
 
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
 
            {/* Preview Grid */}
            {previewImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {previewImages.map((url, i) => (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-24 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
 
          {/* VARIANTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111111]">Variants</h3>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 text-sm text-[#111] hover:text-black"
              >
                <Plus size={16} />
                Add Variant
              </button>
            </div>
 
            {formData.variants.map((variant, idx) => (
              <div key={variant.id} className="p-4 rounded-xl border border-[#e7e7e2] bg-[#fcfcfa] space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[#666] mb-1 block">
                      Size
                    </label>
                    <input
                      type="text"
                      value={variant.size}
                      onChange={(e) => handleVariantChange(idx, "size", e.target.value)}
                      placeholder="e.g., Small"
                      className="w-full px-3 py-2 rounded-lg border border-[#e7e7e2] bg-white text-sm outline-none focus:border-[#111111]"
                    />
                  </div>
 
                  <div>
                    <label className="text-xs font-medium text-[#666] mb-1 block">
                      Color
                    </label>
                    <input
                      type="text"
                      value={variant.color}
                      onChange={(e) => handleVariantChange(idx, "color", e.target.value)}
                      placeholder="e.g., Rose"
                      className="w-full px-3 py-2 rounded-lg border border-[#e7e7e2] bg-white text-sm outline-none focus:border-[#111111]"
                    />
                  </div>
 
                  <div>
                    <label className="text-xs font-medium text-[#666] mb-1 block">
                      Stock *
                    </label>
                    <input
                      type="number"
                      value={variant.stock}
                      onChange={(e) => handleVariantChange(idx, "stock", e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-[#e7e7e2] bg-white text-sm outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
 
                {formData.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(idx)}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
 
          {/* ACTIONS */}
          <div className="flex gap-3 pt-4 border-t border-[#e7e7e2]">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 rounded-xl border border-[#e7e7e2] text-[#111] font-medium hover:bg-[#f4f4f2] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl bg-[#111111] text-white font-medium hover:bg-black transition disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
 
