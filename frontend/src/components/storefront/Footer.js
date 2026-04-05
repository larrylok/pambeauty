import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from "lucide-react";
import api from "@/api";

export default function Footer() {
  const [navData, setNavData] = useState({
    categories: [],
    pages: [],
    collections: [],
  });

  useEffect(() => {
    loadNavigation();

    const handleNavRefresh = () => {
      loadNavigation();
    };

    window.addEventListener("storefront-navigation-updated", handleNavRefresh);

    return () => {
      window.removeEventListener("storefront-navigation-updated", handleNavRefresh);
    };
  }, []);

  const loadNavigation = async () => {
    try {
      const res = await api.get("/storefront/navigation");
      setNavData({
        categories: Array.isArray(res.data?.categories) ? res.data.categories : [],
        pages: Array.isArray(res.data?.pages) ? res.data.pages : [],
        collections: Array.isArray(res.data?.collections) ? res.data.collections : [],
      });
    } catch (err) {
      console.error("Failed to load footer navigation:", err);
      setNavData({
        categories: [],
        pages: [],
        collections: [],
      });
    }
  };

  const topCategories = navData.categories
    .filter((category) => category?.showInMenu !== false)
    .slice(0, 5);

  const footerPages = navData.pages
    .filter((page) => page?.showInFooter !== false)
    .slice(0, 5);

  return (
    <footer className="bg-white text-black mt-24 border-t border-black/10">
      <div>
        <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div>
              <h2 className="text-xl font-serif mb-4 text-black">PAM Beauty</h2>
              <p className="text-sm leading-relaxed text-black/60">
                Premium wigs, beauty products, and accessories designed to bring
                confidence, elegance, and effortless everyday beauty.
              </p>
            </div>

            {/* Shop */}
            <div>
              <h4 className="font-serif text-lg mb-6 tracking-tight text-black">
                Shop
              </h4>
              <ul className="space-y-3">
                {topCategories.map((category) => (
                  <li key={`footer-cat-${category.slug}`}>
                    <Link
                      to={category.path || `/categories/${category.slug}`}
                      className="text-sm text-black/60 hover:text-black transition-colors"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}

                {footerPages.map((page) => (
                  <li key={`footer-page-${page.slug}`}>
                    <Link
                      to={page.path || `/pages/${page.slug}`}
                      className="text-sm text-black/60 hover:text-black transition-colors"
                    >
                      {page.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Care */}
            <div>
              <h4 className="font-serif text-lg mb-6 tracking-tight text-black">
                Customer Care
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    to="/track-order"
                    className="text-sm text-black/60 hover:text-black transition-colors"
                  >
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link
                    to="/shipping"
                    className="text-sm text-black/60 hover:text-black transition-colors"
                  >
                    Shipping & Delivery
                  </Link>
                </li>
                <li>
                  <Link
                    to="/returns"
                    className="text-sm text-black/60 hover:text-black transition-colors"
                  >
                    Returns & Exchanges
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faqs"
                    className="text-sm text-black/60 hover:text-black transition-colors"
                  >
                    FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-serif text-lg mb-6 tracking-tight text-black">
                Contact
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <MapPin size={18} className="mt-1 flex-shrink-0 text-black/70" />
                  <span className="text-sm text-black/60">Nairobi, Kenya</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Phone size={18} className="mt-1 flex-shrink-0 text-black/70" />
                  <span className="text-sm text-black/60">+254 700 000 000</span>
                </li>
                <li className="flex items-start space-x-3">
                  <Mail size={18} className="mt-1 flex-shrink-0 text-black/70" />
                  <span className="text-sm text-black/60">hello@pambeauty.com</span>
                </li>
              </ul>

              <div className="flex space-x-4 mt-6">
                <a
                  href="#"
                  className="w-10 h-10 border border-black/10 flex items-center justify-center text-black/70 hover:border-black/30 hover:text-black transition-all"
                >
                  <Instagram size={18} />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 border border-black/10 flex items-center justify-center text-black/70 hover:border-black/30 hover:text-black transition-all"
                >
                  <Facebook size={18} />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 border border-black/10 flex items-center justify-center text-black/70 hover:border-black/30 hover:text-black transition-all"
                >
                  <Twitter size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-black/10">
          <div className="container mx-auto px-6 md:px-12 lg:px-24 max-w-[1600px] py-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-black/50">
              © 2026 PAM Beauty. All rights reserved.
            </p>

            <div className="flex space-x-6">
              <Link
                to="/privacy"
                className="text-sm text-black/50 hover:text-black transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-sm text-black/50 hover:text-black transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}