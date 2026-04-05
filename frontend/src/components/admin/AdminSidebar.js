import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Star,
  Folder,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Tags,
  FileText,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import api, { clearAdminToken } from "../../api";

const menuItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/categories", label: "Categories", icon: Tags },
  { path: "/admin/pages", label: "Pages", icon: FileText },
  { path: "/admin/homepage", label: "Homepage", icon: Monitor },
  { path: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { path: "/admin/customers", label: "Customers", icon: Users },
  { path: "/admin/collections", label: "Collections", icon: Folder },
  { path: "/admin/reports", label: "Reports", icon: BarChart3 },
  { path: "/admin/settings", label: "Settings", icon: Settings },
  { path: "/admin/security", label: "Security", icon: Shield },
];

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/admin/logout");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAdminToken();
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    <aside className="hidden lg:flex w-[290px] min-h-screen flex-shrink-0 bg-[#fcfcfa] border-r border-[#e7e7e2]">
      <div className="flex w-full flex-col px-5 py-6">
        <div className="rounded-[28px] border border-[#ecece8] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.38em] text-[#7a7a74]">
              PAM Beauty
            </p>
            <h2 className="mt-2 font-serif text-[30px] leading-none text-[#111111]">
              Admin Panel
            </h2>
          </div>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        </div>

        <nav className="mt-6 flex-1">
          <div className="mb-3 px-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#8a8a84]">
              Navigation
            </p>
          </div>

          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;

              const isActive =
                location.pathname === item.path ||
                (item.path !== "/admin" &&
                  location.pathname.startsWith(item.path + "/"));

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    data-testid={`admin-nav-${item.label.toLowerCase()}`}
                    className={[
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200",
                      isActive
                        ? "bg-[#111111] text-white shadow-[0_10px_25px_rgba(0,0,0,0.10)]"
                        : "text-[#5f5f5a] hover:bg-white hover:text-[#111111] hover:shadow-[0_6px_18px_rgba(0,0,0,0.04)]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200",
                        isActive
                          ? "border-white/15 bg-white/10 text-white"
                          : "border-[#e7e7e2] bg-[#f7f7f5] text-[#444444] group-hover:border-[#dddddd] group-hover:bg-[#fdfdfc] group-hover:text-[#111111]",
                      ].join(" ")}
                    >
                      <Icon size={18} strokeWidth={1.9} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium tracking-[0.01em]">
                        {item.label}
                      </span>
                    </div>

                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full transition-all duration-200",
                        isActive
                          ? "bg-white/75"
                          : "bg-transparent group-hover:bg-black/15",
                      ].join(" ")}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6">
          <button
            onClick={handleLogout}
            type="button"
            data-testid="admin-logout-button"
            className="group flex w-full items-center gap-3 rounded-[22px] border border-[#e7e7e2] bg-white px-4 py-3 text-left text-[#5f5f5a] shadow-[0_6px_20px_rgba(0,0,0,0.02)] transition-all duration-200 hover:border-[#d8d8d2] hover:bg-[#f8f8f6] hover:text-[#111111]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e7e7e2] bg-[#f7f7f5] transition-all duration-200 group-hover:border-[#d8d8d2] group-hover:bg-white">
              <LogOut size={18} strokeWidth={1.9} />
            </span>

            <div className="flex-1">
              <span className="block text-sm font-medium">Logout</span>
              <span className="block text-xs text-[#8a8a84]">
                Exit admin session
              </span>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}