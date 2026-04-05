// :contentReference[oaicite:0]{index=0} (refactored for PAM Beauty styling)

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Heart,
  ShoppingCart,
  ChevronLeft,
  Star,
  Share2,
  Package,
  Shield,
  Truck,
} from "lucide-react";
import axios from "axios";
import storage from "@/utils/storage";
import analytics from "@/utils/analytics";
import { toast } from "sonner";

const API_BASE = (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API = `${API_BASE}/api`;

function getProductId(product) {
  return product?.id || product?._id || "";
}

function absolutizeImage(url) {
  const u = String(url || "");
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${API_BASE}${u}`;
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const [reviews, setReviews] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    loadProductAndReviews();
    loadWishlist();
  }, [slug]);

  const loadWishlist = async () => {
    const wl = (await storage.get("wishlist")) || [];
    setWishlist(Array.isArray(wl) ? wl : []);
  };

  const loadProductAndReviews = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/products`, {
        params: { limit: 100 },
      });

      const list = response.data?.products || [];
      const prod = list.find((p) => p.slug === slug);

      if (!prod) {
        toast.error("Product not found");
        navigate("/");
        return;
      }

      const productId = getProductId(prod);

      setProduct(prod);
      setSelectedVariant(prod?.variants?.[0] || null);
      setSelectedImage(0);

      analytics.productView(productId, prod.name);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async () => {
    const productId = getProductId(product);
    let newWishlist = [...wishlist];

    if (newWishlist.includes(productId)) {
      newWishlist = newWishlist.filter((id) => id !== productId);
      toast.success("Removed from wishlist");
    } else {
      newWishlist.push(productId);
      toast.success("Added to wishlist");
    }

    setWishlist(newWishlist);
    await storage.set("wishlist", newWishlist);
  };

  const addToCart = async () => {
    if (!selectedVariant) {
      toast.error("Select an option");
      return;
    }

    const productId = getProductId(product);

    const cart = (await storage.get("cart")) || { items: [] };

    cart.items.push({
      productId,
      variantId: selectedVariant.id,
      quantity,
    });

    await storage.set("cart", cart);
    toast.success("Added to cart");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border border-gray-300 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) return null;

  const productId = getProductId(product);
  const price = product.salePrice || product.basePrice;

  return (
    <div className="min-h-screen bg-white">

      {/* BACK */}
      <div className="container mx-auto px-6 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-black"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      </div>

      {/* MAIN */}
      <section className="container mx-auto px-6 pb-20 grid lg:grid-cols-2 gap-12">

        {/* IMAGES */}
        <div>
          <div className="border border-gray-200">
            <img
              src={absolutizeImage(product.images?.[selectedImage])}
              alt={product.name}
              className="w-full h-[500px] object-cover"
            />
          </div>

          <div className="flex gap-3 mt-4">
            {product.images?.map((img, i) => (
              <img
                key={i}
                src={absolutizeImage(img)}
                onClick={() => setSelectedImage(i)}
                className="w-20 h-20 object-cover border cursor-pointer"
              />
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div>

          <p className="text-xs uppercase text-gray-400 mb-2">
            {product.category}
          </p>

          <h1 className="text-3xl font-semibold mb-4">
            {product.name}
          </h1>

          {/* PRICE */}
          <p className="text-2xl font-medium mb-6">
            KES {price.toLocaleString()}
          </p>

          {/* DESCRIPTION */}
          <p className="text-gray-600 mb-6">
            {product.longDescription}
          </p>

          {/* VARIANTS */}
          {product.variants?.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">Options</p>
              <div className="flex flex-wrap gap-3">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-4 py-2 border ${
                      selectedVariant?.id === v.id
                        ? "border-black"
                        : "border-gray-300"
                    }`}
                  >
                    {v.color || v.size || "Option"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QUANTITY */}
          <div className="mb-6">
            <p className="text-sm mb-2">Quantity</p>
            <div className="flex items-center border w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4"
              >
                -
              </button>
              <span className="px-6">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-4"
              >
                +
              </button>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3">

            <button
              onClick={addToCart}
              className="flex-1 bg-black text-white py-3 text-sm"
            >
              Add to Cart
            </button>

            <button
              onClick={toggleWishlist}
              className="p-3 border"
            >
              <Heart
                size={20}
                fill={wishlist.includes(productId) ? "black" : "none"}
              />
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied");
              }}
              className="p-3 border"
            >
              <Share2 size={20} />
            </button>

          </div>

          {/* TRUST */}
          <div className="grid grid-cols-3 gap-4 mt-10 text-center text-xs text-gray-500">
            <div>
              <Truck className="mx-auto mb-1" size={20} />
              Fast delivery
            </div>
            <div>
              <Shield className="mx-auto mb-1" size={20} />
              Secure checkout
            </div>
            <div>
              <Package className="mx-auto mb-1" size={20} />
              Easy returns
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}