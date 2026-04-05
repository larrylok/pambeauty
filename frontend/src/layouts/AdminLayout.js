import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import api, { getAdminToken, clearAdminToken } from "../api";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const logoutAndRedirect = () => {
      clearAdminToken();
      if (!cancelled) {
        navigate("/admin/login", { replace: true });
      }
    };

    const verifyAuth = async () => {
      const token = getAdminToken?.();

      if (!token) {
        logoutAndRedirect();
        return;
      }

      try {
        await api.get("/admin/verify");
        if (!cancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Admin verification failed:", error);
        logoutAndRedirect();
      }
    };

    verifyAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full border border-[#d9d9d4] border-t-[#111111] animate-spin" />
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#7a7a74]">
              PAM Admin
            </p>
            <h1 className="font-serif text-2xl text-[#111111]">Loading dashboard</h1>
            <p className="text-sm text-[#666666]">
              Preparing your workspace...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#111111]">
      <div className="flex min-h-screen">
        <AdminSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />

          <main className="flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
            <div className="min-h-[calc(100vh-2rem)] rounded-[28px] border border-[#e7e7e2] bg-[#fcfcfa] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] md:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}